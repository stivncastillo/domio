-- Domio — curva de dificultad para subir de nivel (2026-08-26).
--
-- Hasta ahora el umbral era fijo: nivel 1->2 pedia 1000 XP (definido en
-- el default de la columna, 0001_init.sql) y cada nivel siguiente sumaba
-- 200 XP mas (`xp_to_next_level + 200`, hardcodeado adentro de
-- complete_mission). Muy duro para arrancar (1000 XP antes de ver el
-- primer nivel) y crecia muy poco despues.
--
-- Stiven pidio (via AskUserQuestion): niveles tempranos faciles/rapidos,
-- y que se ponga notoriamente mas dificil despues del nivel 10. Se
-- eligio la opcion "escalon marcado en nivel 10": lineal y suave hasta
-- ahi, exponencial despues.
--
-- Formula (una sola funcion, reutilizada en el default de la columna,
-- en el backfill de abajo, y en complete_mission — asi no queda
-- duplicada en tres lugares):
--   nivel <= 10:  50 + 30*(nivel - 1)          (lineal: 50, 80, 110, ...)
--   nivel  > 10:  round(320 * 1.25^(nivel-10)) (exponencial desde ahi)
--
-- Ejemplos: nivel 1->2 = 50 XP, nivel 5->6 = 170 XP, nivel 10->11 =
-- 320 XP, nivel 15->16 = 977 XP, nivel 20->21 = 2980 XP.
--
-- Aplica esto en el SQL Editor DESPUES de 0001-0011. Corre en
-- cualquier instalación (nueva o existente).

-- ============================================================
-- 1) La funcion de la curva. `immutable` porque para el mismo nivel
--    siempre da el mismo numero (no depende de tablas ni de reloj).
-- ============================================================
create or replace function xp_required_for_level(target_level integer)
returns integer
language sql
immutable
as $$
  select case
    when target_level <= 10 then 50 + 30 * (target_level - 1)
    else round(320 * power(1.25, target_level - 10))::integer
  end;
$$;

-- ============================================================
-- 2) Nuevo default de domio_progress.xp_to_next_level: antes era el
--    literal 1000, ahora usa la funcion (para nivel 1 da 50). Solo
--    afecta filas nuevas (families que se creen de aca en adelante);
--    las que ya existen se recalculan en el paso 3.
-- ============================================================
alter table domio_progress
  alter column xp_to_next_level set default xp_required_for_level(1);

-- ============================================================
-- 3) Backfill: las familias que ya tenian domio_progress (con el
--    umbral viejo, +200 por nivel) recalculan su xp_to_next_level
--    segun la curva nueva PARA SU NIVEL ACTUAL. No se toca current_xp
--    (el progreso ganado no se pierde) — pero como el umbral nuevo es
--    mas bajo en niveles tempranos, es posible que current_xp ya
--    alcance para subir uno o mas niveles de una: el loop de abajo
--    hace ese ajuste (mismo patron que el loop de complete_mission).
-- ============================================================
update domio_progress
set xp_to_next_level = xp_required_for_level(level);

do $$
declare
  rec record;
begin
  for rec in select family_id from domio_progress loop
    loop
      update domio_progress
      set level = level + 1,
          current_xp = current_xp - xp_to_next_level,
          xp_to_next_level = xp_required_for_level(level + 1)
      where family_id = rec.family_id
        and current_xp >= xp_to_next_level;

      exit when not found;
    end loop;
  end loop;
end $$;

-- ============================================================
-- 4) complete_mission: el loop de nivel usaba el literal
--    `xp_to_next_level + 200` — ahora usa la misma funcion que todo
--    lo demas. El resto de la funcion (coins para single y family,
--    ver 0011_family_mission_coins.sql) no cambia.
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
