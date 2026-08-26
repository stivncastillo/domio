-- Domio — schema inicial
--
-- Como aplicar esto:
-- 1. Crea un proyecto en https://supabase.com (free tier).
-- 2. Ve a SQL Editor en el dashboard de Supabase, pega este archivo
--    completo y ejecutalo. (O usa la Supabase CLI: `supabase db push`
--    si prefieres manejar migraciones desde tu maquina.)
--
-- Convenciones:
-- - Todo lo estructural (tablas, columnas, tipos/enums, funciones,
--   nombres de policy) va en ingles: es la convencion del proyecto de
--   aca en adelante. Los comentarios explicativos como este quedan en
--   español (son para vos, no corren en la base de datos), y los
--   mensajes de `raise exception` tambien quedan en español porque
--   terminan mostrandose directo en la UI de la app.
-- - snake_case en la base de datos; el codigo TS mapea a camelCase
--   (ver types/domain.ts).
-- - RLS (Row Level Security) esta activado en todo: por defecto NADIE
--   puede leer/escribir nada hasta que una policy lo permita
--   explicitamente. Esto es lo que reemplaza a tener un backend propio
--   validando permisos.

-- ============================================================
-- profiles: un perfil por usuario de auth.users (1:1)
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Authenticated users can view profiles"
  on profiles for select
  to authenticated
  using (true);

create policy "A user can only edit their own profile"
  on profiles for update
  to authenticated
  using (id = auth.uid());

-- ============================================================
-- families: un Domio por familia
-- ============================================================
create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default substr(md5(random()::text), 1, 8),
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

alter table families enable row level security;

-- ============================================================
-- family_members: relacion N:M entre profiles y families,
-- con el estado de gamificacion individual de cada integrante.
-- ============================================================
create type family_role as enum ('admin', 'member');

-- No hay level/xp individual acá a propósito: no hay competencia
-- entre integrantes de una familia, así que el único que sube de
-- nivel es el Domio (ver domio_progress más abajo). Lo individual es
-- la moneda (coins, agregada en 0009_rewards_and_coins.sql).
create table if not exists family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  role family_role not null default 'member',
  streak_days integer not null default 0,
  joined_at timestamptz not null default now(),
  unique (family_id, profile_id)
);

alter table family_members enable row level security;

-- Helper: ¿el usuario actual pertenece a esta familia?
create or replace function is_member_of_family(target_family_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from family_members
    where family_id = target_family_id and profile_id = auth.uid()
  );
$$;

create policy "Members can view their own family"
  on families for select
  to authenticated
  using (is_member_of_family(id));

create policy "Members can see each other within their family"
  on family_members for select
  to authenticated
  using (is_member_of_family(family_id));

-- ============================================================
-- missions
-- ============================================================
create type mission_type as enum ('single', 'recurring', 'habit', 'family');
create type mission_status as enum (
  'pending', 'completed', 'failed', 'skipped', 'rescheduled'
);

create table if not exists missions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  title text not null,
  type mission_type not null default 'single',
  is_mandatory boolean not null default false,
  xp_reward integer not null default 10,
  status mission_status not null default 'pending',
  recurrence_rule jsonb, -- p.ej. { "freq": "daily" } o { "freq": "weekly", "days": [1,3,5] }
  due_at timestamptz,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

alter table missions enable row level security;

create policy "Members can view their family's missions"
  on missions for select
  to authenticated
  using (is_member_of_family(family_id));

create policy "Members can create missions for their family"
  on missions for insert
  to authenticated
  with check (is_member_of_family(family_id));

create policy "Members can update their family's missions"
  on missions for update
  to authenticated
  using (is_member_of_family(family_id));

-- Asignacion N:M: una mision puede tener varios responsables
-- (ej. una "mision familiar" asignada a todos).
create table if not exists mission_assignees (
  mission_id uuid not null references missions (id) on delete cascade,
  family_member_id uuid not null references family_members (id) on delete cascade,
  primary key (mission_id, family_member_id)
);

alter table mission_assignees enable row level security;

create policy "Members can view their family's assignments"
  on mission_assignees for select
  to authenticated
  using (
    exists (
      select 1 from missions
      where missions.id = mission_assignees.mission_id
        and is_member_of_family(missions.family_id)
    )
  );

-- Historial de completado/incumplido — separado de `missions` porque
-- una mision recurrente genera un registro por cada ocurrencia
-- (ej. "sacar la basura" completada el lunes y el martes son dos filas).
create table if not exists mission_completions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions (id) on delete cascade,
  family_member_id uuid not null references family_members (id) on delete cascade,
  status mission_status not null,
  xp_awarded integer not null default 0,
  completed_at timestamptz not null default now()
);

alter table mission_completions enable row level security;

create policy "Members can view their family's completions"
  on mission_completions for select
  to authenticated
  using (
    exists (
      select 1 from missions
      where missions.id = mission_completions.mission_id
        and is_member_of_family(missions.family_id)
    )
  );

create policy "Members can log their own completions"
  on mission_completions for insert
  to authenticated
  with check (
    exists (
      select 1 from family_members
      where family_members.id = mission_completions.family_member_id
        and family_members.profile_id = auth.uid()
    )
  );

-- ============================================================
-- rewards
-- ============================================================
create table if not exists rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  title text not null,
  cost_points integer not null default 0,
  is_family_reward boolean not null default false,
  created_at timestamptz not null default now()
);

alter table rewards enable row level security;

create policy "Members can view their family's rewards"
  on rewards for select
  to authenticated
  using (is_member_of_family(family_id));

create table if not exists reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references rewards (id) on delete cascade,
  family_member_id uuid not null references family_members (id) on delete cascade,
  points_spent integer not null,
  redeemed_at timestamptz not null default now()
);

alter table reward_redemptions enable row level security;

-- ============================================================
-- domio_progress: 1 fila por familia con el estado colectivo del Domio
-- ============================================================
create table if not exists domio_progress (
  family_id uuid primary key references families (id) on delete cascade,
  level integer not null default 1,
  current_xp integer not null default 0,
  xp_to_next_level integer not null default 1000,
  family_streak_days integer not null default 0,
  mood text not null default 'neutral', -- positive | neutral | alert | critical
  updated_at timestamptz not null default now()
);

alter table domio_progress enable row level security;

create policy "Members can view their Domio's progress"
  on domio_progress for select
  to authenticated
  using (is_member_of_family(family_id));

-- Realtime: ver supabase/migrations/0007_enable_realtime.sql — ahi se
-- agregan domio_progress, missions y family_members a la publicacion
-- `supabase_realtime` (asi todos ven a Domi reaccionar sin refrescar).
