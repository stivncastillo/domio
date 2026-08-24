-- Domio — misiones: completar mision + otorgar XP
--
-- Aplica esto en el SQL Editor DESPUES de 0001_init.sql y
-- 0002_onboarding.sql.

-- ============================================================
-- 1) Policies de UPDATE que faltaban. Completar una mision necesita
--    poder sumar XP en family_members y en domio_progress, y RLS
--    bloquea eso por defecto hasta que una policy lo permite.
-- ============================================================
drop policy if exists "A user can update their own progress" on family_members;
create policy "A user can update their own progress"
  on family_members for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "Members can update their Domio's progress" on domio_progress;
create policy "Members can update their Domio's progress"
  on domio_progress for update
  to authenticated
  using (is_member_of_family(family_id))
  with check (is_member_of_family(family_id));

-- ============================================================
-- 2) RPC complete_mission: registra el completado de una mision y
--    otorga XP individual + familiar, subiendo de nivel cuando
--    corresponde. Se llama desde la app con:
--    supabase.rpc('complete_mission', { target_mission_id })
--
-- Alcance actual (MVP): pensada para misiones "single" y "family",
-- que se completan una sola vez (la mision pasa a status =
-- 'completed' y ya). Todavia no soporta bien "recurring"/"habit",
-- que en rigor necesitarian generar una nueva ocurrencia en vez de
-- "cerrar" la mision para siempre — queda para una iteracion futura.
--
-- security invoker (no definer, a diferencia de create_family): aca no
-- hay ningun problema de "RETURNING antes de tiempo" — quien llama a
-- esta funcion YA es miembro de la familia desde antes (se unio al
-- crear/unirse a la familia), asi que las policies de arriba ya lo
-- cubren sin necesidad de bypassear RLS.
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

  -- Registrar el completado (historial — una mision recurrente en el
  -- futuro tendria una fila por cada ocurrencia completada).
  insert into mission_completions (mission_id, family_member_id, status, xp_awarded)
  values (target_mission_id, v_family_member_id, 'completed', v_xp_reward);

  update missions set status = 'completed' where id = target_mission_id;

  -- Reparto de XP segun el tipo (definido con Stiven, fase 1):
  -- "single" -> el XP es para quien la completo, ademas de sumar al
  -- Domio. "family" -> "cualquiera la completa": el XP entero va al
  -- Domio, nadie se lo lleva individualmente (todavia). Mas adelante
  -- la version colaborativa (mision con subtareas, una por
  -- integrante) va a repartir XP distinto — cuando eso exista, esta
  -- funcion se separa en dos.
  if v_type = 'single' then
    -- `xp` del lado derecho es siempre el valor ANTES de este UPDATE
    -- (asi funciona un SET en Postgres), asi que las dos expresiones
    -- usan el mismo valor base de forma consistente. Formula simple
    -- para el MVP: cada 500 XP acumulado, un nivel mas.
    update family_members
    set xp = xp + v_xp_reward,
        level = (xp + v_xp_reward) / 500 + 1
    where id = v_family_member_id;
  end if;

  -- XP colectivo del Domio (esto pasa siempre, sea "single" o "family").
  update domio_progress
  set current_xp = current_xp + v_xp_reward
  where family_id = v_family_id;

  -- Subir de nivel el Domio las veces que corresponda (por si una
  -- mision de mucho XP alcanza para mas de un nivel de una vez). Cada
  -- nivel sube el umbral del siguiente en 200 XP, para que la
  -- progresion se sienta cada vez un poco mas larga.
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
