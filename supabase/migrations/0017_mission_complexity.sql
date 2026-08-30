-- Domio — complejidad de misiones: XP/coins ya no se escriben a mano (2026-08-30).
--
-- Stiven pidió, palabras textuales: "que las misiones tengan
-- complejidad, osea que el admin no ingrese el XP ni los coins, eso se
-- maneja por debajo. Alta: urgente (se ganan Y xp, X coins). Media:
-- moderada (se ganan menos xp y coins que la alta). Baja: facil (se
-- gana poco)." Motivo de fondo: con XP libre a criterio del admin, un
-- Domio puede llegar a nivel alto con pocas misiones si alguien pone
-- números grandes — la complejidad fija el valor por debajo para que
-- eso no dependa de cuánto XP se le ocurra escribir a cada admin.
--
-- Tres preguntas se resolvieron con Stiven via AskUserQuestion antes
-- de implementar:
-- 1) Valores de XP/coins por complejidad: eligió "Moderado" —
--    Baja=15 XP/8 coins, Media=30 XP/15 coins, Alta=50 XP/25 coins.
-- 2) Migración de misiones ya existentes (que tenían XP/coins puestos
--    a mano): eligió asignarles a TODAS complejidad 'medium' sin
--    intentar adivinar por heurística.
-- 3) La penalización de XP por incumplir una misión obligatoria
--    (xp_penalty, 0015_mission_deadlines_and_penalties.sql) también
--    era manual — eligió que PASE a calcularse sola por complejidad
--    en vez de quedar como único campo numérico libre del form.
--    Criterio elegido (simple y simétrico, no se le pidió otro):
--    el castigo por no cumplir es el mismo XP que se hubiera ganado
--    al completarla.
--
-- Diseño: una sola función `mission_xp_for_complexity` (mismo patrón
-- que `xp_required_for_level` en 0012 — un solo lugar define la
-- curva/tabla, se usa en todos lados) es la fuente de verdad para XP;
-- `mission_coins_for_complexity` para coins. Un CHECK constraint nuevo
-- ata `xp_reward`/`coin_reward`/`xp_penalty` a esas funciones — esto
-- no es solo validación en el formulario: bloquea a nivel de base que
-- CUALQUIER insert (incluso uno directo a la tabla por un admin con
-- acceso a la API, sin pasar por `create_mission`) termine con valores
-- que no correspondan a la complejidad declarada. "Se maneja por
-- debajo" queda garantizado por Postgres, no solo por la UI.
--
-- Aplica esto en el SQL Editor DESPUES de 0001-0016. Corre en
-- cualquier instalación (nueva o existente).

-- ============================================================
-- 1) Tipo + funciones: la tabla de valores vive en UN solo lugar.
--    `immutable` (no dependen de nada externo, siempre el mismo
--    resultado para el mismo input) — hace falta para poder usarlas
--    adentro de un CHECK constraint.
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'mission_complexity') then
    create type mission_complexity as enum ('low', 'medium', 'high');
  end if;
end $$;

create or replace function mission_xp_for_complexity(complexity mission_complexity)
returns integer
language sql
immutable
as $$
  select case complexity
    when 'low' then 15
    when 'medium' then 30
    when 'high' then 50
  end;
$$;

create or replace function mission_coins_for_complexity(complexity mission_complexity)
returns integer
language sql
immutable
as $$
  select case complexity
    when 'low' then 8
    when 'medium' then 15
    when 'high' then 25
  end;
$$;

-- ============================================================
-- 2) missions.complexity + backfill + constraint.
--
--    Backfill: TODAS las misiones existentes (sin importar el XP/coins
--    que tenían puestos a mano) pasan a complexity='medium' — decisión
--    explícita de Stiven, sin intentar adivinar por heurística. Como
--    consecuencia, sus xp_reward/coin_reward/xp_penalty tambien se
--    recalculan a los valores de 'medium' para quedar consistentes con
--    el constraint nuevo (si se dejaran los valores viejos, violarían
--    el constraint de entrada). Quien las creó las puede volver a
--    editar despues si alguna merece Alta o Baja.
-- ============================================================
alter table missions add column if not exists complexity mission_complexity not null default 'medium';

update missions
set complexity = 'medium',
    xp_reward = mission_xp_for_complexity('medium'),
    coin_reward = mission_coins_for_complexity('medium'),
    -- Solo tiene sentido para obligatorias, pero no cuesta nada dejarlo
    -- consistente en todas las filas (el constraint de mandatory de
    -- 0015 no se ve afectado: sigue pidiendo xp_penalty > 0 cuando
    -- is_mandatory, y 'medium' siempre da 30 > 0).
    xp_penalty = mission_xp_for_complexity('medium');

alter table missions drop constraint if exists mission_rewards_match_complexity;
alter table missions add constraint mission_rewards_match_complexity check (
  xp_reward = mission_xp_for_complexity(complexity)
  and coin_reward = mission_coins_for_complexity(complexity)
  and xp_penalty = mission_xp_for_complexity(complexity)
);

-- ============================================================
-- 3) create_mission: ya no recibe mission_xp_reward/mission_coin_reward/
--    mission_xp_penalty — ahora recibe mission_complexity y calcula los
--    tres valores adentro con las funciones de arriba. `create or
--    replace function` no permite cambiar la lista de parametros de
--    una funcion ya aplicada (leccion de 0015) — hay que dropear la
--    firma vieja de 9 parametros antes de crear la nueva de 7.
-- ============================================================
drop function if exists create_mission(
  uuid, text, mission_type, boolean, integer, integer, uuid, timestamptz, integer
);

create or replace function create_mission(
  target_family_id uuid,
  mission_title text,
  mission_type mission_type,
  mission_is_mandatory boolean,
  mission_complexity mission_complexity default 'medium',
  assignee_family_member_id uuid default null,
  mission_due_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  calling_user uuid := auth.uid();
  v_mission_id uuid;
  v_xp integer := mission_xp_for_complexity(mission_complexity);
  v_coins integer := mission_coins_for_complexity(mission_complexity);
begin
  if calling_user is null then
    raise exception 'No autenticado';
  end if;

  if not is_admin_of_family(target_family_id) then
    raise exception 'Solo el admin de la familia puede crear misiones';
  end if;

  -- Mismo chequeo que el constraint de fecha (0015), con un mensaje
  -- legible en la UI (el constraint solo protege contra ediciones
  -- directas por SQL). El XP/coins ya no hace falta validarlos aca:
  -- salen siempre de la complejidad, nunca pueden faltar.
  if mission_is_mandatory and mission_due_at is null then
    raise exception 'Una misión obligatoria necesita fecha de vencimiento';
  end if;

  insert into missions (
    family_id, created_by, title, type, is_mandatory, complexity,
    xp_reward, coin_reward, due_at, xp_penalty
  )
  values (
    target_family_id, calling_user, mission_title, mission_type,
    mission_is_mandatory, mission_complexity, v_xp, v_coins,
    mission_due_at, v_xp
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
  uuid, text, mission_type, boolean, mission_complexity, uuid, timestamptz
) from public;
grant execute on function create_mission(
  uuid, text, mission_type, boolean, mission_complexity, uuid, timestamptz
) to authenticated;
