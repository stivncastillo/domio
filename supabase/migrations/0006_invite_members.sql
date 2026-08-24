-- Domio — invitar miembros a una familia existente
--
-- Aplica esto en el SQL Editor DESPUES de 0001-0005.

-- ============================================================
-- 1) Endurecer family_members: hasta ahora existia una policy
--    ("A user can add themselves as a member") que dejaba que
--    cualquier usuario autenticado se auto-insertara como miembro de
--    CUALQUIER family_id, sin validar el invite_code — alcanzaba con
--    conocer (o adivinar) el uuid de una familia para sumarse sin
--    permiso. Nunca hizo falta para la app real: crear o unirse a una
--    familia siempre paso (y sigue pasando) por funciones `security
--    definer` (create_family, y ahora join_family), que bypasean RLS
--    igual. La sacamos para cerrar ese hueco.
-- ============================================================
drop policy if exists "A user can add themselves as a member" on family_members;

-- ============================================================
-- 2) RPC join_family: valida el invite_code y agrega al usuario
--    actual como miembro (rol "member"). Se llama desde la app con:
--    supabase.rpc('join_family', { target_invite_code: code })
--
-- security definer por la misma razon que create_family: necesita
-- poder buscar la familia por invite_code aunque el usuario todavia
-- no sea miembro (la policy de SELECT de `families` exige serlo), e
-- insertar en family_members sin depender de una policy de INSERT
-- que ya no existe. Idempotente a proposito: si ya sos miembro, no
-- falla, simplemente devuelve el family_id igual (evita un error feo
-- de "unique constraint" si alguien toca "Unirme" dos veces).
-- ============================================================
create or replace function public.join_family(target_invite_code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  calling_user uuid := auth.uid();
  v_family_id uuid;
  v_already_member boolean;
begin
  if calling_user is null then
    raise exception 'No autenticado';
  end if;

  select id into v_family_id
  from families
  where invite_code = lower(trim(target_invite_code));

  if v_family_id is null then
    raise exception 'Código de invitación inválido';
  end if;

  select exists (
    select 1 from family_members
    where family_id = v_family_id and profile_id = calling_user
  ) into v_already_member;

  if not v_already_member then
    insert into family_members (family_id, profile_id, role)
    values (v_family_id, calling_user, 'member');
  end if;

  return v_family_id;
end;
$$;

revoke execute on function public.join_family(text) from public;
grant execute on function public.join_family(text) to authenticated;
