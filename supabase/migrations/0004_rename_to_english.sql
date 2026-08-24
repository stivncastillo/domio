-- Domio — migrar a nomenclatura en ingles
--
-- Este archivo es solo para vos, Stiven: tu proyecto de Supabase ya
-- tiene 0001/0002/0003 aplicados con los valores viejos (en español).
-- Los archivos 0001_init.sql, 0002_onboarding.sql y 0003_missions.sql
-- ya quedaron reescritos con los nombres en ingles para el dia que
-- alguien monte el proyecto desde cero — pero volver a correrlos no
-- alcanza para "migrar" tu base ya existente (los `create type` y
-- `create table if not exists` no tocan algo que ya existe). Este
-- archivo hace la transicion real sobre datos que ya estan ahi.
--
-- Aplica esto en el SQL Editor DESPUES de 0001/0002/0003 (los
-- originales que ya corriste). Es seguro correrlo una sola vez.
--
-- Orden importante: primero renombramos los VALORES de los enums
-- (esto no toca los datos — una fila que hoy dice 'unica' va a decir
-- 'single' despues del rename, sin migracion de datos manual, porque
-- por dentro Postgres identifica cada valor de enum por un id interno,
-- no por el texto; el texto es solo una etiqueta). Recien despues
-- reemplazamos la funcion `complete_mission`, porque su codigo tiene
-- escrito 'unica'/'completada' como texto — si la dejamos como esta,
-- al ejecutarse buscaria un valor de enum que ya no existe y explota.

-- ============================================================
-- 1) Renombrar los valores de los enums
-- ============================================================
alter type family_role rename value 'miembro' to 'member';

alter type mission_type rename value 'unica' to 'single';
alter type mission_type rename value 'recurrente' to 'recurring';
alter type mission_type rename value 'habito' to 'habit';
alter type mission_type rename value 'familiar' to 'family';

alter type mission_status rename value 'pendiente' to 'pending';
alter type mission_status rename value 'completada' to 'completed';
alter type mission_status rename value 'incumplida' to 'failed';
alter type mission_status rename value 'omitida' to 'skipped';
alter type mission_status rename value 'reprogramada' to 'rescheduled';

-- Los `default` de columnas (family_members.role, missions.type,
-- missions.status) apuntan al mismo valor de enum por id interno, asi
-- que quedan apuntando bien solos — no hace falta un `alter table ...
-- set default` aparte.

-- ============================================================
-- 2) Recrear complete_mission con los literales en ingles (ver nota
--    de arriba: 'unica'/'completada' ya no existen como etiquetas).
--    Es una copia exacta de la version en 0003_missions.sql.
-- ============================================================
create or replace function public.complete_mission(target_mission_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  calling_user uuid := auth.uid();
  v_family_id uuid;
  v_xp_reward integer;
  v_type mission_type;
  v_family_member_id uuid;
begin
  if calling_user is null then
    raise exception 'No autenticado';
  end if;

  select family_id, xp_reward, type into v_family_id, v_xp_reward, v_type
  from missions
  where id = target_mission_id;

  if v_family_id is null then
    raise exception 'Mision no encontrada';
  end if;

  select id into v_family_member_id
  from family_members
  where family_id = v_family_id and profile_id = calling_user;

  if v_family_member_id is null then
    raise exception 'No pertenecés a la familia de esta misión';
  end if;

  insert into mission_completions (mission_id, family_member_id, status, xp_awarded)
  values (target_mission_id, v_family_member_id, 'completed', v_xp_reward);

  update missions set status = 'completed' where id = target_mission_id;

  if v_type = 'single' then
    update family_members
    set xp = xp + v_xp_reward,
        level = (xp + v_xp_reward) / 500 + 1
    where id = v_family_member_id;
  end if;

  update domio_progress
  set current_xp = current_xp + v_xp_reward
  where family_id = v_family_id;

  loop
    update domio_progress
    set level = level + 1,
        current_xp = current_xp - xp_to_next_level,
        xp_to_next_level = xp_to_next_level + 200
    where family_id = v_family_id
      and current_xp >= xp_to_next_level;

    exit when not found;
  end loop;
end;
$$;

revoke execute on function public.complete_mission(uuid) from public;
grant execute on function public.complete_mission(uuid) to authenticated;

-- ============================================================
-- 3) Renombrar las policies (cosmetico — no afecta permisos, solo el
--    nombre con el que aparecen en pg_policies / el dashboard). Se
--    hace con ALTER POLICY ... RENAME TO, que no borra ni recrea nada,
--    asi que no hay ventana sin proteccion.
-- ============================================================
alter policy "Cualquier usuario autenticado puede ver perfiles" on profiles
  rename to "Authenticated users can view profiles";
alter policy "Un usuario solo edita su propio perfil" on profiles
  rename to "A user can only edit their own profile";

alter policy "Los miembros ven su propia familia" on families
  rename to "Members can view their own family";
alter policy "Un usuario autenticado puede crear una familia" on families
  rename to "An authenticated user can create a family";

alter policy "Los miembros se ven entre si dentro de su familia" on family_members
  rename to "Members can see each other within their family";
alter policy "Un usuario se agrega a si mismo como miembro" on family_members
  rename to "A user can add themselves as a member";
alter policy "Un usuario actualiza su propio progreso" on family_members
  rename to "A user can update their own progress";

alter policy "Los miembros ven las misiones de su familia" on missions
  rename to "Members can view their family's missions";
alter policy "Los miembros crean/editan misiones de su familia" on missions
  rename to "Members can create missions for their family";
alter policy "Los miembros actualizan misiones de su familia" on missions
  rename to "Members can update their family's missions";

alter policy "Los miembros ven asignaciones de su familia" on mission_assignees
  rename to "Members can view their family's assignments";

alter policy "Los miembros ven completados de su familia" on mission_completions
  rename to "Members can view their family's completions";
alter policy "Los miembros registran sus propios completados" on mission_completions
  rename to "Members can log their own completions";

alter policy "Los miembros ven recompensas de su familia" on rewards
  rename to "Members can view their family's rewards";

alter policy "Los miembros ven el progreso de su Domio" on domio_progress
  rename to "Members can view their Domio's progress";
alter policy "El progreso del Domio se crea junto con la familia" on domio_progress
  rename to "Domio progress is created together with the family";
alter policy "Los miembros actualizan el progreso de su Domio" on domio_progress
  rename to "Members can update their Domio's progress";
