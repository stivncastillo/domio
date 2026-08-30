-- Domio — racha familiar real (2026-08-29).
--
-- Stiven pidio seguir con "la racha familiar" — mismo patron que
-- `is_mandatory` (0015) y el limite de canjes (0014): `family_streak_days`
-- existe en `domio_progress` desde el scaffold original (0001_init.sql)
-- y ya se muestra en el Dashboard ("🔥 Racha familiar: N dias"), pero
-- ninguna migracion la actualiza nunca — queda pegada en 0 para
-- siempre. Lo mismo pasa con `family_members.streak_days` (racha
-- INDIVIDUAL, mostrada en la tab Familia) pero esta migracion NO la
-- toca: Stiven pidio especificamente "la racha familiar", que es el
-- campo colectivo del Domio — la individual queda pendiente de que la
-- pida explicitamente (tiene sus propias preguntas de diseño: ¿cuenta
-- cualquier mision, o solo las asignadas a esa persona?).
--
-- Diseño (interpretacion razonable, no confirmada palabra por palabra
-- con Stiven — avisar si prefiere otro criterio): la racha familiar
-- cuenta dias CALENDARIO consecutivos en los que la familia completo
-- al menos una mision (cualquier integrante, cualquier tipo — mismo
-- criterio "colectivo" que ya usa el XP del Domio). Se corta apenas
-- pasa un dia entero sin ninguna mision completada.
--
-- En vez de mantener un contador que se incrementa/resetea a mano (con
-- todos los casos limite que eso implica: que pasa si se completan
-- misiones fuera de orden, que pasa si nadie abre la app un dia,
-- etc), la funcion RECALCULA la racha desde cero cada vez que se
-- llama, mirando el historial real en `mission_completions` — mas
-- simple y sin estado que se pueda desincronizar de la fuente de
-- verdad. Se llama (igual que `process_overdue_missions` en 0015):
--   1) cada vez que alguien abre la app (hooks/useRealtimeSync.ts)
--   2) justo despues de completar una mision (hooks/useMissions.ts,
--      useCompleteMission) — asi la racha sube al toque el mismo dia,
--      sin esperar a que alguien vuelva a abrir la app.
--
-- Limitacion conocida (documentada, no bloqueante): el "dia" se
-- calcula con la zona horaria del servidor de Postgres (UTC en
-- Supabase por default), no con la zona horaria de cada familia. Para
-- una app familiar esto alcanza por ahora; ajustar si en el futuro
-- hace falta precision por zona horaria real.
--
-- Aplica esto en el SQL Editor DESPUES de 0001-0015. Corre en
-- cualquier instalación (nueva o existente).

create or replace function recompute_family_streak(target_family_id uuid)
returns integer
language plpgsql
-- security invoker (no security definer): no hace falta bypasear RLS
-- acá — cualquier miembro de la familia YA puede ver todas las
-- mission_completions de su familia ("Members can view their family's
-- completions", 0001_init.sql, solo exige is_member_of_family) y YA
-- puede actualizar domio_progress ("cualquier miembro de la familia",
-- 0003_missions.sql). El chequeo de abajo es solo para fallar con un
-- mensaje claro en vez de devolver 0 en silencio si alguien intenta
-- llamarla para una familia ajena.
as $$
declare
  calling_user uuid := auth.uid();
  v_streak integer := 0;
  v_day date;
  v_has_activity boolean;
begin
  if calling_user is null then
    raise exception 'No autenticado';
  end if;

  if not is_member_of_family(target_family_id) then
    raise exception 'No pertenecés a esa familia';
  end if;

  -- Si hoy todavia no hay ninguna mision completada, la racha no se
  -- corta todavia (el dia no termino) — se sigue contando desde ayer.
  -- Si hoy ya hay actividad, se cuenta desde hoy.
  v_day := current_date;
  select exists (
    select 1
    from mission_completions mc
    join missions m on m.id = mc.mission_id
    where m.family_id = target_family_id
      and mc.status = 'completed'
      and mc.completed_at::date = v_day
  ) into v_has_activity;

  if not v_has_activity then
    v_day := v_day - 1;
  end if;

  loop
    select exists (
      select 1
      from mission_completions mc
      join missions m on m.id = mc.mission_id
      where m.family_id = target_family_id
        and mc.status = 'completed'
        and mc.completed_at::date = v_day
    ) into v_has_activity;

    exit when not v_has_activity;

    v_streak := v_streak + 1;
    v_day := v_day - 1;
  end loop;

  update domio_progress
  set family_streak_days = v_streak,
      updated_at = now()
  where family_id = target_family_id;

  return v_streak;
end;
$$;

revoke execute on function recompute_family_streak(uuid) from public;
grant execute on function recompute_family_streak(uuid) to authenticated;
