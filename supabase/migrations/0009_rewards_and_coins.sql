-- Domio — sistema de monedas (coins) y recompensas
--
-- Cierra el loop del core del negocio. Diseño acordado con Stiven:
-- no hay competencia entre integrantes de la familia, asi que el
-- nivel/XP individual no tiene sentido — SOLO el Domio sube de nivel
-- (progreso colectivo). Lo individual es la moneda: cada mision
-- "single" da coins, que se gastan al reclamar una recompensa. Y una
-- recompensa no es solo cuestion de tener las coins: tambien exige
-- que el Domio haya llegado a cierto nivel ("el xp desbloquea la
-- habilidad de adquirir una recompensa" — palabras de Stiven), asi
-- que cada recompensa pide nivel minimo del Domio + costo en coins,
-- las dos condiciones a la vez.
--
-- Aplica esto en el SQL Editor DESPUES de 0001-0008 (aplica igual en
-- una instalacion nueva o existente, no se tocó 0003 — sí se editó
-- 0001_init.sql para que un proyecto nuevo ya nazca sin xp/level en
-- family_members).

-- ============================================================
-- 1) family_members: sacar el nivel/XP individual (dejaba de tener
--    sentido, no hay competencia entre integrantes) y agregar coins.
-- ============================================================
alter table family_members drop column if exists xp;
alter table family_members drop column if exists level;
alter table family_members add column if not exists coins integer not null default 0;

-- ============================================================
-- 2) missions / mission_completions: coins que otorga cada mision
-- ============================================================
alter table missions add column if not exists coin_reward integer not null default 0;
alter table mission_completions add column if not exists coins_awarded integer not null default 0;

-- ============================================================
-- 3) rewards / reward_redemptions: renombrar a coins (ahora que
--    coins existe como moneda concreta) y agregar el requisito de
--    nivel del Domio.
-- ============================================================
alter table rewards rename column cost_points to cost_coins;
alter table rewards add column if not exists min_domio_level integer not null default 1;
alter table reward_redemptions rename column points_spent to coins_spent;

-- ============================================================
-- 4) Policies
-- ============================================================

-- Solo el admin crea recompensas — mismo motivo que las misiones
-- (0008): si cualquiera pudiera crear una, le pondria costo 0 y nivel
-- mínimo 1, y se la reclamaria gratis desde el arranque.
drop policy if exists "Only the family admin can create rewards" on rewards;
create policy "Only the family admin can create rewards"
  on rewards for insert
  to authenticated
  with check (is_admin_of_family(family_id));

-- Un miembro ve sus propias redenciones; el admin ve las de toda la
-- familia (para llevar registro de que se reclamo).
drop policy if exists "Members see their own redemptions, admins see all" on reward_redemptions;
create policy "Members see their own redemptions, admins see all"
  on reward_redemptions for select
  to authenticated
  using (
    exists (
      select 1 from family_members fm
      where fm.id = reward_redemptions.family_member_id
        and fm.profile_id = auth.uid()
    )
    or exists (
      select 1 from rewards r
      where r.id = reward_redemptions.reward_id
        and is_admin_of_family(r.family_id)
    )
  );

-- ============================================================
-- 5) RPC redeem_reward: chequea nivel del Domio Y coins suficientes
--    (las dos condiciones), descuenta las coins y registra el canje,
--    todo en una transaccion — si fueran 2-3 llamadas sueltas desde
--    el cliente, dos taps rapidos en "Reclamar" podrian gastar coins
--    que ya no estaban, quedando en negativo.
--
-- security invoker (no definer, a diferencia de create_family/
-- join_family): no hay ningun problema de RETURNING+RLS aca — quien
-- llama ya tiene que poder VER la recompensa por la policy de SELECT
-- existente (ya es miembro de esa familia), y la funcion valida
-- ademas que solo pueda redimir para si mismo.
-- ============================================================
create or replace function redeem_reward(target_reward_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  calling_user uuid := auth.uid();
  v_family_id uuid;
  v_cost integer;
  v_min_level integer;
  v_domio_level integer;
  v_family_member_id uuid;
  v_coins integer;
begin
  if calling_user is null then
    raise exception 'No autenticado';
  end if;

  select family_id, cost_coins, min_domio_level into v_family_id, v_cost, v_min_level
  from rewards
  where id = target_reward_id;

  if v_family_id is null then
    raise exception 'Recompensa no encontrada';
  end if;

  select id, coins into v_family_member_id, v_coins
  from family_members
  where family_id = v_family_id and profile_id = calling_user;

  if v_family_member_id is null then
    raise exception 'No pertenecés a la familia de esta recompensa';
  end if;

  select level into v_domio_level from domio_progress where family_id = v_family_id;

  if v_domio_level < v_min_level then
    raise exception 'El Domio todavía no llegó al nivel % que pide esta recompensa', v_min_level;
  end if;

  if v_coins < v_cost then
    raise exception 'No tenés monedas suficientes';
  end if;

  update family_members
  set coins = coins - v_cost
  where id = v_family_member_id;

  insert into reward_redemptions (reward_id, family_member_id, coins_spent)
  values (target_reward_id, v_family_member_id, v_cost);
end;
$$;

revoke execute on function redeem_reward(uuid) from public;
grant execute on function redeem_reward(uuid) to authenticated;

-- ============================================================
-- 6) complete_mission: ya no toca xp/level individual (esas columnas
--    ya no existen en family_members) — otorga coins en su lugar,
--    solo en misiones "single". El XP del Domio (colectivo) sigue
--    funcionando exactamente igual que antes, para los dos tipos.
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

  -- Solo coins, y solo en "single" — "family" no reparte nada
  -- individual, sigue siendo "el XP entero va al Domio".
  if v_type = 'single' then
    update family_members
    set coins = coins + v_coin_reward
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
