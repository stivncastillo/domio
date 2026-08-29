-- Domio — falta la policy de INSERT en reward_redemptions (2026-08-26).
--
-- Bug real encontrado por Stiven: al reclamar una recompensa, "new row
-- violates row-level security policy for table reward_redemptions".
--
-- A diferencia de los bugs anteriores de RETURNING+RLS (create_family,
-- create_mission), esta vez NO es eso: `redeem_reward` no hace ningun
-- `.select()`/RETURNING sobre reward_redemptions, y la funcion es
-- `security invoker` a proposito (ver el comentario en
-- 0009_rewards_and_coins.sql). El problema es mas simple: cuando se
-- creo `reward_redemptions` en 0001_init.sql se le prendio RLS
-- (`enable row level security`) pero nunca se le agrego una policy de
-- INSERT — y sin ninguna policy que lo permita, RLS bloquea CUALQUIER
-- insert por default, incluso desde una funcion `security invoker`
-- que ya valido todo a mano (nivel del Domio, coins suficientes).
--
-- 0009 agrego una policy de SELECT para reward_redemptions pero se
-- salteo la de INSERT — comparando con `mission_completions` (que sí
-- tiene su policy de INSERT desde 0001_init.sql, "Members can log
-- their own completions") queda claro que era la pieza que faltaba;
-- por eso `complete_mission` (tambien security invoker) siempre
-- funciono bien y `redeem_reward` no.
--
-- Fix: agregar la policy de INSERT que le falta a reward_redemptions,
-- mismo criterio que mission_completions — cualquier miembro puede
-- insertar una redemption para SU PROPIO family_member_id, no para el
-- de otro.
--
-- Aplica esto en el SQL Editor DESPUES de 0001-0012. Corre en
-- cualquier instalación (nueva o existente).

drop policy if exists "Members can log their own redemptions" on reward_redemptions;
create policy "Members can log their own redemptions"
  on reward_redemptions for insert
  to authenticated
  with check (
    exists (
      select 1 from family_members
      where family_members.id = reward_redemptions.family_member_id
        and family_members.profile_id = auth.uid()
    )
  );
