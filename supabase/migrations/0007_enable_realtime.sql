-- Domio — habilitar Realtime en las tablas que se actualizan en vivo
-- entre dispositivos: el progreso del Domio, las misiones (cuando
-- alguien las completa) y el XP/nivel individual de cada integrante.
--
-- Aplica esto en el SQL Editor DESPUES de 0001-0006. Corre en
-- cualquier instalación (nueva o existente).
--
-- `alter publication ... add table` NO es idempotente (correrlo dos
-- veces con la misma tabla tira "relation is already member of
-- publication"), asi que cada una se fija antes en
-- pg_publication_tables si ya esta agregada.
--
-- Nota sobre `mission_completions`: no la agregamos porque hoy ninguna
-- pantalla la lee en vivo (es solo historial); si en el futuro armamos
-- un "feed de actividad familiar", ahi se suma.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'domio_progress'
  ) then
    alter publication supabase_realtime add table domio_progress;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'missions'
  ) then
    alter publication supabase_realtime add table missions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'family_members'
  ) then
    alter publication supabase_realtime add table family_members;
  end if;
end $$;
