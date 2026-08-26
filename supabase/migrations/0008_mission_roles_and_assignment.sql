-- Domio — roles en misiones: solo el admin crea y asigna misiones;
-- un miembro comun solo ve (y completa) las suyas + las familiares.
--
-- Motivo (Stiven, 2026-08-24): si cualquier miembro pudiera crear
-- misiones, podria inventarse una con mucho XP y auto-completarla sin
-- supervision del admin/padre. Coincide ademas con la seccion "Roles
-- familiares" del brief de producto: crear/asignar misiones es una
-- capacidad del Administrador/Padre, no del Miembro.
--
-- Aplica esto en el SQL Editor DESPUES de 0001-0007. Corre en
-- cualquier instalación (nueva o existente) — igual que 0006 y 0007.

-- ============================================================
-- 1) Helper: ¿el usuario actual es admin de esta familia?
--    Mismo patron que is_member_of_family (0001_init.sql): security
--    definer para poder usarla adentro de otras policies sin
--    depender de permisos extra sobre family_members.
-- ============================================================
create or replace function is_admin_of_family(target_family_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from family_members
    where family_id = target_family_id
      and profile_id = auth.uid()
      and role = 'admin'
  );
$$;

-- ============================================================
-- 2) Helper: ¿el usuario actual puede ver (y por lo tanto tambien
--    completar) esta mision? Alguna de estas tres:
--    - Es admin de la familia (ve/administra todo).
--    - La mision es "family" (siempre fue "cualquiera la completa").
--    - Esta asignado a esa mision via mission_assignees.
--    Un solo criterio para las dos cosas: si no la podes ver, tampoco
--    la podes completar — no hace falta un helper separado.
-- ============================================================
create or replace function can_view_mission(target_mission_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from missions m
    where m.id = target_mission_id
      and is_member_of_family(m.family_id)
      and (
        is_admin_of_family(m.family_id)
        or m.type = 'family'
        or exists (
          select 1
          from mission_assignees ma
          join family_members fm on fm.id = ma.family_member_id
          where ma.mission_id = m.id and fm.profile_id = auth.uid()
        )
      )
  );
$$;

-- ============================================================
-- 3) Endurecer missions.
--
-- Nota sobre por que esto alcanza para tapar el bug que noto Stiven
-- ("creo una tarea y se ven en los dos miembros"): la RPC
-- complete_mission (0003_missions.sql) arranca con
-- `select ... from missions where id = target_mission_id` — esa
-- consulta corre como quien llama (security invoker) y por lo tanto
-- YA queda sujeta a esta policy de SELECT. Si un miembro no admin
-- intenta completar una mision que no le corresponde, esa select no
-- encuentra nada, `v_family_id` queda null, y la funcion corta sola
-- con "Mision no encontrada" — sin tocar ni una linea de esa funcion.
-- ============================================================
drop policy if exists "Members can create missions for their family" on missions;
create policy "Only the family admin can create missions"
  on missions for insert
  to authenticated
  with check (is_admin_of_family(family_id));

drop policy if exists "Members can view their family's missions" on missions;
create policy "Members can view missions they're allowed to see"
  on missions for select
  to authenticated
  using (can_view_mission(id));

drop policy if exists "Members can update their family's missions" on missions;
create policy "Members can update missions they're allowed to see"
  on missions for update
  to authenticated
  using (can_view_mission(id));

-- ============================================================
-- 4) mission_assignees: el admin es quien asigna; y solo se puede ver
--    la fila de asignacion de una mision que ya podrias ver vos
--    (mismo criterio de arriba — evita filtrarle a alguien "esta
--    mision existe y esta asignada a tu hermano" cuando ni siquiera
--    deberia saber que esa mision existe).
-- ============================================================
drop policy if exists "Members can view their family's assignments" on mission_assignees;
create policy "Members can view assignments of missions they can see"
  on mission_assignees for select
  to authenticated
  using (can_view_mission(mission_id));

drop policy if exists "Only the family admin can assign missions" on mission_assignees;
create policy "Only the family admin can assign missions"
  on mission_assignees for insert
  to authenticated
  with check (
    exists (
      select 1 from missions
      where missions.id = mission_assignees.mission_id
        and is_admin_of_family(missions.family_id)
    )
  );
