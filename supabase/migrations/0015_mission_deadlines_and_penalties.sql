-- Domio — vencimiento de misiones obligatorias + penalizacion de XP (2026-08-29).
--
-- Stiven pidio, palabras textuales: "Quisiera que una misión tuviera
-- una fecha y hora de vencimiento, si no se cumple dentro de la fecha
-- estipulada, baja XP al domio. Agregar al realtime para que aparezca
-- un card diciendo que no completaste la misión y el XP que restó.
-- Aparecera una vez y desaparece unos minutos después de que se vea
-- en la app. El XP que resta debe estar definido en el form de
-- misiones."
--
-- Esto es, en los hechos, terminar de implementar algo que ya estaba
-- prometido pero nunca se hizo: el checkbox "Obligatoria" del form de
-- misiones (app/(tabs)/missions.tsx) siempre dijo en su label "resta
-- XP si no se cumple", pero `is_mandatory` nunca disparaba ninguna
-- resta — era una etiqueta decorativa. Por eso esta migracion ata la
-- fecha de vencimiento + el XP a restar directamente a `is_mandatory`
-- en vez de agregar un toggle nuevo: una mision obligatoria AHORA
-- necesita las dos cosas (fecha limite + cuanto XP resta), y una
-- mision no-obligatoria sigue sin vencimiento (igual que hoy).
--
-- Deteccion de vencidas (decidido con Stiven via AskUserQuestion):
-- chequeo bajo demanda cuando alguien de la familia abre la app (RPC
-- process_overdue_missions, llamada desde hooks/useRealtimeSync.ts),
-- NO un cron de Supabase (pg_cron) — mas simple, sin extensiones
-- nuevas que habilitar, consistente con como se construyo el resto
-- del proyecto. Contras conocido: si nadie abre la app, la penalizacion
-- se aplica recien cuando alguien entra, no exactamente a la hora del
-- vencimiento.
--
-- Aplica esto en el SQL Editor DESPUES de 0001-0014. Corre en
-- cualquier instalación (nueva o existente).

-- ============================================================
-- 1) missions.xp_penalty + constraint: obligatoria implica fecha +
--    penalizacion (due_at ya existia en el schema desde 0001, sin uso
--    real hasta ahora).
-- ============================================================
alter table missions add column if not exists xp_penalty integer not null default 0;

-- Backfill necesario ANTES del constraint: is_mandatory existe desde
-- el scaffold original pero, hasta esta migracion, era puramente
-- decorativo (el checkbox del form nunca disparaba ninguna
-- consecuencia real) — asi que en cualquier instalacion con uso
-- previo es esperable que existan misiones `is_mandatory = true` sin
-- `due_at` ni `xp_penalty`. Agregar el constraint directo sobre esas
-- filas revienta con "check constraint ... is violated by some row"
-- (el error real que le aparecio a Stiven). Como esas misiones viejas
-- nunca tuvieron vencimiento de verdad, lo mas seguro es des-marcarlas
-- como obligatorias en vez de inventarles una fecha/penalizacion de
-- la nada — quien las creo puede volver a marcarlas y ponerles fecha
-- si de verdad las quiere con vencimiento.
update missions
set is_mandatory = false
where is_mandatory = true
  and (due_at is null or xp_penalty <= 0);

alter table missions drop constraint if exists mission_mandatory_needs_deadline_and_penalty;
alter table missions add constraint mission_mandatory_needs_deadline_and_penalty check (
  (not is_mandatory) or (due_at is not null and xp_penalty > 0)
);

-- ============================================================
-- 2) create_mission: agrega due_at + xp_penalty. 0010 ya esta
--    aplicada en la base de Stiven, y `create or replace function` NO
--    permite cambiar la lista de parametros de una funcion existente
--    (agregar parametros nuevos, aunque tengan default, cambia la
--    firma) — asi que hay que dropear la version vieja de 7
--    parametros antes de crear la de 9.
-- ============================================================
drop function if exists create_mission(
  uuid, text, mission_type, boolean, integer, integer, uuid
);

create or replace function create_mission(
  target_family_id uuid,
  mission_title text,
  mission_type mission_type,
  mission_is_mandatory boolean,
  mission_xp_reward integer,
  mission_coin_reward integer,
  assignee_family_member_id uuid default null,
  mission_due_at timestamptz default null,
  mission_xp_penalty integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  calling_user uuid := auth.uid();
  v_mission_id uuid;
begin
  if calling_user is null then
    raise exception 'No autenticado';
  end if;

  if not is_admin_of_family(target_family_id) then
    raise exception 'Solo el admin de la familia puede crear misiones';
  end if;

  -- Mismo chequeo que el constraint de la tabla, pero ademas con un
  -- mensaje en español legible en la UI (el constraint solo protege
  -- contra ediciones directas por SQL).
  if mission_is_mandatory and (mission_due_at is null or mission_xp_penalty <= 0) then
    raise exception 'Una misión obligatoria necesita fecha de vencimiento y XP a restar';
  end if;

  insert into missions (
    family_id, created_by, title, type, is_mandatory, xp_reward, coin_reward,
    due_at, xp_penalty
  )
  values (
    target_family_id, calling_user, mission_title, mission_type,
    mission_is_mandatory, mission_xp_reward, mission_coin_reward,
    mission_due_at, mission_xp_penalty
  )
  returning id into v_mission_id;

  if assignee_family_member_id is not null then
    insert into mission_assignees (mission_id, family_member_id)
    values (v_mission_id, assignee_family_member_id);
  end if;

  return v_mission_id;
end;
$$;

revoke execute on function create_mission(
  uuid, text, mission_type, boolean, integer, integer, uuid, timestamptz, integer
) from public;
grant execute on function create_mission(
  uuid, text, mission_type, boolean, integer, integer, uuid, timestamptz, integer
) to authenticated;

-- ============================================================
-- 3) mission_penalties: un registro por cada vez que una mision
--    obligatoria vence sin completarse — es lo que la UI escucha por
--    Realtime para mostrar el card "no se cumplió, se restaron X XP".
--    No tiene policy de INSERT para `authenticated`: solo se inserta
--    desde adentro de process_overdue_missions (security definer),
--    nunca directo desde el cliente.
-- ============================================================
create table if not exists mission_penalties (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  mission_id uuid not null references missions (id) on delete cascade,
  -- Copia del titulo al momento de vencer (no un join a missions): si
  -- la mision se borra despues, el evento historico sigue siendo
  -- legible.
  mission_title text not null,
  xp_lost integer not null,
  created_at timestamptz not null default now()
);

alter table mission_penalties enable row level security;

create policy "Members can view their family's mission penalties"
  on mission_penalties for select
  to authenticated
  using (is_member_of_family(family_id));

-- ============================================================
-- 4) process_overdue_missions: recorre las misiones obligatorias,
--    pendientes y vencidas de una familia, las marca 'failed', resta
--    el xp_penalty al Domio (sin bajar de 0, y sin bajarle el nivel —
--    solo se toca current_xp) y deja un registro en mission_penalties.
--
--    security definer (a diferencia de complete_mission, que es
--    invoker): un integrante comun podria disparar esto y encontrarse
--    con misiones 'single' vencidas asignadas a OTRO integrante, que
--    can_view_mission no lo dejaria ver/actualizar bajo su propio RLS.
--    Como bypasea RLS, valida a mano que quien llama sea miembro de
--    la familia (mismo patron que create_mission/reward_lock_status_for_family).
-- ============================================================
create or replace function process_overdue_missions(target_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  calling_user uuid := auth.uid();
  rec record;
begin
  if calling_user is null then
    raise exception 'No autenticado';
  end if;

  if not is_member_of_family(target_family_id) then
    raise exception 'No pertenecés a esa familia';
  end if;

  for rec in
    select id, title, xp_penalty
    from missions
    where family_id = target_family_id
      and status = 'pending'
      and is_mandatory = true
      and due_at is not null
      and due_at < now()
  loop
    update missions
    set status = 'failed'
    where id = rec.id;

    update domio_progress
    set current_xp = greatest(current_xp - rec.xp_penalty, 0),
        updated_at = now()
    where family_id = target_family_id;

    insert into mission_penalties (family_id, mission_id, mission_title, xp_lost)
    values (target_family_id, rec.id, rec.title, rec.xp_penalty);
  end loop;
end;
$$;

revoke execute on function process_overdue_missions(uuid) from public;
grant execute on function process_overdue_missions(uuid) to authenticated;

-- ============================================================
-- 5) Realtime en mission_penalties — mismo patron idempotente que
--    0007_enable_realtime.sql (alter publication ... add table no es
--    idempotente por si solo).
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mission_penalties'
  ) then
    alter publication supabase_realtime add table mission_penalties;
  end if;
end $$;
