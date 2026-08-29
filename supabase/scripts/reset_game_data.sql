-- Domio — reset de datos de juego (2026-08-29).
--
-- Para cuando queres vaciar misiones/recompensas/progreso (ej. volver
-- a probar el onboarding desde cero, o limpiar datos de prueba) SIN
-- perder usuarios, familias ni membresias. Esto NO es una migracion
-- (no cambia el schema), es un script que corres a mano cuando lo
-- necesites, las veces que quieras.
--
-- Que borra (filas completas):
--   - mission_completions, mission_assignees, missions
--   - reward_redemptions, rewards
--
-- Que resetea a su estado inicial (sin borrar la fila, porque son
-- 1:1 con cada familia/integrante y nada las vuelve a crear despues
-- del alta inicial — ver 0002_onboarding.sql):
--   - domio_progress: level 1, current_xp 0, xp_to_next_level el de
--     nivel 1 (xp_required_for_level(1), ver 0012), mood 'neutral'.
--   - family_members: coins 0, streak_days 0 (son contadores que
--     dependen del historial de misiones que se acaba de borrar, asi
--     que dejarlos como estaban dejaria numeros huerfanos).
--
-- Que NO toca (usuarios y acceso):
--   - auth.users (usuarios de Supabase Auth)
--   - profiles (1:1 con auth.users)
--   - families (ni nombre ni invite_code)
--   - family_members (las filas en si — quien pertenece a que familia
--     y con que rol; solo se resetean sus contadores, arriba)
--
-- ADVERTENCIA: es irreversible y no hace backup. Correlo en el SQL
-- Editor de Supabase solo cuando estes seguro. Si tenes dudas, primero
-- corre un `select count(*) from missions;` (o la tabla que te
-- preocupe) para confirmar cuanto hay antes de borrar.

begin;

truncate table
  mission_completions,
  mission_assignees,
  missions,
  reward_redemptions,
  rewards
cascade;

update domio_progress
set
  level = 1,
  current_xp = 0,
  xp_to_next_level = xp_required_for_level(1),
  family_streak_days = 0,
  mood = 'neutral',
  updated_at = now();

update family_members
set
  coins = 0,
  streak_days = 0;

commit;
