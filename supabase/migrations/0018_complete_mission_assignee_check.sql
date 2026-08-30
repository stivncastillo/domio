-- Domio — solo el asignado puede completar una mision "single" (2026-08-30).
--
-- Bug real reportado por Stiven: "como admin creo las misiones, las
-- asigno a otro miembro y las puedo completar, no debería dejar
-- completar misiones que no están asignadas a mi usuario actual."
--
-- Causa: `complete_mission` (ultima version en
-- 0012_domio_level_curve.sql) nunca chequeaba el asignado — solo
-- validaba "sos miembro de la familia de esta mision". Para un
-- integrante comun esto no se notaba porque la RLS de `missions`
-- (`can_view_mission`, 0008_mission_roles_and_assignment.sql) ya le
-- oculta las misiones `single` que no son suyas — el `select ... from
-- missions where id = ...` de adentro de la funcion (security invoker,
-- corre bajo el RLS de quien llama) directamente no encuentra la fila,
-- y la funcion explota con "Mision no encontrada" antes de llegar a
-- completarla. Pero el ADMIN puede ver TODAS las misiones de su
-- familia por diseño (`can_view_mission` lo deja pasar siempre, para
-- poder gestionar/asignar) — y esa visibilidad amplia se estaba
-- colando como permiso de COMPLETAR, que es un permiso distinto.
-- "Puedo ver esta mision para administrarla" no tendria que implicar
-- "puedo marcarla como hecha yo mismo aunque sea de otro integrante".
--
-- Fix: agregar el chequeo de asignado DENTRO de la funcion, explicito,
-- sin depender de la RLS de SELECT para esto — se aplica a TODO el
-- que llama, admin incluido. Solo aplica a misiones que no son
-- "family" (esas las puede completar cualquier integrante, eso no
-- cambia — ver 0011_family_mission_coins.sql) Y que tienen al menos un
-- asignado en `mission_assignees`: si una mision `single` quedo sin
-- asignar (dato viejo huerfano, ver nota en README sobre 0008), sigue
-- sin exigir un asignado especifico — solo el admin la puede ver de
-- entrada, asi que solo el admin llega a este punto igual.
--
-- El signature de complete_mission no cambia (sigue siendo solo
-- target_mission_id uuid), asi que no hace falta un DROP FUNCTION —
-- create or replace alcanza.
--
-- Aplica esto en el SQL Editor DESPUES de 0001-0017. Corre en
-- cualquier instalación (nueva o existente).

create or replace function public.complete_mission(target_mission_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  calling_user uuid := auth.uid();
  v_family_id uuid;
  v_xp_reward integer;
  v_coin_reward integer;
  v_type mission_type;
  v_family_member_id uuid;
begin
  if calling_user is null then
    raise exception 'No autenticado';
  end if;

  select family_id, xp_reward, coin_reward, type
    into v_family_id, v_xp_reward, v_coin_reward, v_type
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

  -- Chequeo nuevo: una mision no-familiar con asignado(s) solo la
  -- puede completar quien esta en mission_assignees para ella — ni
  -- siquiera el admin se salta esto. Si no tiene NINGUN asignado
  -- (mision huerfana vieja, solo visible para el admin via RLS), se
  -- deja pasar igual que antes.
  if v_type <> 'family'
     and exists (select 1 from mission_assignees where mission_id = target_mission_id)
     and not exists (
       select 1 from mission_assignees
       where mission_id = target_mission_id and family_member_id = v_family_member_id
     )
  then
    raise exception 'Esta misión está asignada a otro integrante de la familia';
  end if;

  insert into mission_completions (mission_id, family_member_id, status, xp_awarded, coins_awarded)
  values (target_mission_id, v_family_member_id, 'completed', v_xp_reward, v_coin_reward);

  update missions set status = 'completed' where id = target_mission_id;

  -- Coins: siempre a quien completa (single y family, ver 0011).
  update family_members
  set coins = coins + v_coin_reward
  where id = v_family_member_id;

  update domio_progress
  set current_xp = current_xp + v_xp_reward
  where family_id = v_family_id;

  loop
    update domio_progress
    set level = level + 1,
        current_xp = current_xp - xp_to_next_level,
        xp_to_next_level = xp_required_for_level(level + 1)
    where family_id = v_family_id
      and current_xp >= xp_to_next_level;

    exit when not found;
  end loop;
end;
$$;

revoke execute on function public.complete_mission(uuid) from public;
grant execute on function public.complete_mission(uuid) to authenticated;
