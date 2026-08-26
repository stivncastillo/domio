-- Domio — RPC create_mission: crear una mision (+ asignado opcional)
-- en un solo paso atomico.
--
-- Bug real encontrado por Stiven (2026-08-26): crear una mision desde
-- el cliente hacia `insert into missions (...) ... returning id` (via
-- supabase-js `.insert(...).select("id").single()`), y esa RETURNING
-- explotaba con "new row violates row-level security policy for
-- table missions" (codigo 42501) — a pesar de que is_admin_of_family
-- confirmaba `true` para ese mismo usuario y familia.
--
-- Causa: el MISMO problema que ya documentamos para create_family
-- (ver seccion correspondiente en el README/memoria del proyecto):
-- un INSERT con RETURNING exige que la fila insertada TAMBIEN pase la
-- policy de SELECT de la tabla (`can_view_mission(id)` en este caso),
-- y esa evaluacion en el contexto de RETURNING se comporta distinto a
-- un SELECT comun hecho aparte (confirmado empiricamente: un SELECT
-- normal sobre la misma fila, en la misma sesion, sí la encontraba).
--
-- Fix: la misma solucion que create_family/join_family — mover la
-- creacion a una funcion `security definer`. Adentro de una funcion
-- asi, el INSERT ... RETURNING corre con los privilegios del dueño de
-- la funcion (que bypasea RLS por completo), asi que el RETURNING
-- interno nunca pasa por la policy de SELECT del llamador. Como la
-- funcion bypasea RLS, el chequeo de "sos admin de esta familia" hay
-- que hacerlo a mano adentro (la policy de INSERT de missions no se
-- evalua para este camino).
--
-- De paso, esto tambien resuelve una condicion de carrera que tenia
-- el approach anterior de 2 inserts sueltos desde el cliente: ya no
-- hace falta ningun "select ... order by created_at desc limit 1"
-- para adivinar cual mision se acaba de crear.
--
-- Aplica esto en el SQL Editor DESPUES de 0001-0009. Corre en
-- cualquier instalación (nueva o existente).

create or replace function create_mission(
  target_family_id uuid,
  mission_title text,
  mission_type mission_type,
  mission_is_mandatory boolean,
  mission_xp_reward integer,
  mission_coin_reward integer,
  assignee_family_member_id uuid default null
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

  -- La policy de INSERT de missions no se evalua para este camino
  -- (la funcion bypasea RLS al ser security definer) — este chequeo
  -- reemplaza esa validacion.
  if not is_admin_of_family(target_family_id) then
    raise exception 'Solo el admin de la familia puede crear misiones';
  end if;

  insert into missions (
    family_id, created_by, title, type, is_mandatory, xp_reward, coin_reward
  )
  values (
    target_family_id, calling_user, mission_title, mission_type,
    mission_is_mandatory, mission_xp_reward, mission_coin_reward
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
  uuid, text, mission_type, boolean, integer, integer, uuid
) from public;
grant execute on function create_mission(
  uuid, text, mission_type, boolean, integer, integer, uuid
) to authenticated;
