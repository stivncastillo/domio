-- Domio — límite de canjes por recompensa (2026-08-26).
--
-- Stiven pidio que las recompensas puedan tener una restriccion extra
-- ademas de nivel del Domio + coins, palabras textuales: "solo se
-- pueden reclamar una vez cada x tiempo, una hamburguesa puede ser
-- redimida 1 vez cada 15 dias, un viaje solo puede ser redimido una
-- vez, un vestuario solo puede ser redimido una vez."
--
-- Alcance del limite (confirmado via AskUserQuestion): depende de
-- `is_family_reward` (columna que YA existia, hasta ahora puramente
-- decorativa — no restringia nada):
--   - Recompensa INDIVIDUAL: cada integrante tiene su propio contador
--     (la hamburguesa de Stiven no bloquea la de otro integrante).
--   - Recompensa FAMILIAR: el limite es compartido por TODA la
--     familia (el viaje se agota para todos apenas uno lo reclama, no
--     importa quien).
--
-- Aplica esto en el SQL Editor DESPUES de 0001-0013. Corre en
-- cualquier instalación (nueva o existente).

-- ============================================================
-- 1) Tipo de limite + columnas nuevas en rewards.
-- ============================================================
do $$ begin
  create type reward_redemption_limit as enum ('unlimited', 'once', 'cooldown');
exception
  when duplicate_object then null;
end $$;

alter table rewards
  add column if not exists redemption_limit_type reward_redemption_limit not null default 'unlimited';
alter table rewards
  add column if not exists cooldown_days integer;

-- Solo tiene sentido cooldown_days cuando el tipo es 'cooldown', y ahi
-- tiene que ser positivo. Para 'unlimited'/'once' no se usa, queda null.
alter table rewards drop constraint if exists reward_cooldown_days_matches_type;
alter table rewards add constraint reward_cooldown_days_matches_type check (
  (redemption_limit_type = 'cooldown' and cooldown_days is not null and cooldown_days > 0)
  or (redemption_limit_type <> 'cooldown' and cooldown_days is null)
);

-- ============================================================
-- 2) redeem_reward: se agrega el chequeo del limite de canjes ANTES
--    del chequeo de nivel/coins (no tiene sentido pedirle coins a
--    alguien para algo que ya no puede reclamar). El resto de la
--    funcion (nivel del Domio, coins, insert del canje) no cambia.
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
  v_is_family boolean;
  v_limit_type reward_redemption_limit;
  v_cooldown_days integer;
  v_domio_level integer;
  v_family_member_id uuid;
  v_coins integer;
  v_last_redeemed_at timestamptz;
  v_available_at timestamptz;
begin
  if calling_user is null then
    raise exception 'No autenticado';
  end if;

  select family_id, cost_coins, min_domio_level, is_family_reward,
         redemption_limit_type, cooldown_days
    into v_family_id, v_cost, v_min_level, v_is_family,
         v_limit_type, v_cooldown_days
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

  if v_limit_type <> 'unlimited' then
    -- Familiar: cuenta cualquier canje de esta recompensa, sin
    -- importar quien lo hizo. Individual: solo los canjes de ESTE
    -- integrante (cada uno tiene su propio contador).
    select max(redeemed_at) into v_last_redeemed_at
    from reward_redemptions
    where reward_id = target_reward_id
      and (v_is_family or family_member_id = v_family_member_id);

    if v_last_redeemed_at is not null then
      if v_limit_type = 'once' then
        raise exception 'Esta recompensa es de un solo uso y ya fue reclamada';
      else
        v_available_at := v_last_redeemed_at + (v_cooldown_days || ' days')::interval;
        if now() < v_available_at then
          raise exception 'Todavía no pasaron los % días desde el último canje — disponible de nuevo el %',
            v_cooldown_days, to_char(v_available_at, 'DD/MM/YYYY');
        end if;
      end if;
    end if;
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
-- 3) reward_lock_status_for_family: para que la UI pueda mostrar
--    "🔒 disponible de nuevo el ..." SIN esperar a que el intento de
--    canje falle. No se puede resolver esto leyendo reward_redemptions
--    directo desde el cliente: la policy de SELECT de esa tabla solo
--    deja ver tus PROPIOS canjes (o todos si sos admin) — un miembro
--    comun no puede ver si OTRO integrante ya canjeo una recompensa
--    familiar. Por eso esta funcion es `security definer` (bypasea
--    esa policy a proposito) pero solo expone booleanos/fechas, nunca
--    quien canjeo que ni cuanto gasto — no filtra nada sensible.
--    Devuelve una fila por recompensa de la familia en un solo
--    viaje (evita N llamadas, una por recompensa, desde la UI).
-- ============================================================
create or replace function reward_lock_status_for_family(target_family_id uuid)
returns table(reward_id uuid, is_locked boolean, available_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  calling_user uuid := auth.uid();
  v_family_member_id uuid;
begin
  if calling_user is null then
    raise exception 'No autenticado';
  end if;

  if not is_member_of_family(target_family_id) then
    raise exception 'No pertenecés a esa familia';
  end if;

  select id into v_family_member_id
  from family_members
  where family_id = target_family_id and profile_id = calling_user;

  return query
  select
    r.id as reward_id,
    case
      when r.redemption_limit_type = 'unlimited' then false
      when r.redemption_limit_type = 'once' then last_redemption.last_at is not null
      when r.redemption_limit_type = 'cooldown' then
        last_redemption.last_at is not null
        and now() < last_redemption.last_at + (r.cooldown_days || ' days')::interval
      else false
    end as is_locked,
    case
      when r.redemption_limit_type = 'cooldown' and last_redemption.last_at is not null
        then last_redemption.last_at + (r.cooldown_days || ' days')::interval
      else null
    end as available_at
  from rewards r
  left join lateral (
    select max(rr.redeemed_at) as last_at
    from reward_redemptions rr
    where rr.reward_id = r.id
      and (r.is_family_reward or rr.family_member_id = v_family_member_id)
  ) last_redemption on true
  where r.family_id = target_family_id;
end;
$$;

revoke execute on function reward_lock_status_for_family(uuid) from public;
grant execute on function reward_lock_status_for_family(uuid) to authenticated;
