-- Domio — las misiones "family" tambien reparten coins (2026-08-26).
--
-- Hasta ahora complete_mission solo acreditaba coin_reward cuando la
-- mision era "single" ("family" no repartia nada individual, solo XP
-- al Domio). Stiven pidio que las misiones familiares tambien den
-- coins — a quien la completa (v_family_member_id ya se calcula a
-- partir de auth.uid(), funciona igual para los dos tipos).
--
-- El XP sigue yendo entero al Domio en los dos casos, eso no cambia.
--
-- 0009_rewards_and_coins.sql ya esta aplicada en la base real, asi
-- que esto va en una migracion nueva (no se edita 0009 en el lugar).
-- Aplica esto en el SQL Editor DESPUES de 0001-0010.

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

  insert into mission_completions (mission_id, family_member_id, status, xp_awarded, coins_awarded)
  values (target_mission_id, v_family_member_id, 'completed', v_xp_reward, v_coin_reward);

  update missions set status = 'completed' where id = target_mission_id;

  -- Antes esto era "solo single" — ahora las coins se acreditan
  -- siempre a quien completa la mision, sea "single" (el asignado,
  -- que es quien la marca) o "family" (cualquiera que la marque).
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
        xp_to_next_level = xp_to_next_level + 200
    where family_id = v_family_id
      and current_xp >= xp_to_next_level;

    exit when not found;
  end loop;
end;
$$;

revoke execute on function public.complete_mission(uuid) from public;
grant execute on function public.complete_mission(uuid) to authenticated;
