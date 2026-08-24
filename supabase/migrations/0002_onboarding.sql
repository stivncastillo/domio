-- Domio — onboarding: perfil automatico + creacion de familia
--
-- Aplica esto en el SQL Editor de Supabase DESPUES de 0001_init.sql.
-- No hace falta volver a correr 0001.

-- ============================================================
-- 1) Trigger: crea automaticamente una fila en public.profiles
--    cada vez que se crea un usuario en auth.users (ej. al llamar
--    supabase.auth.signUp desde la app).
--
-- security definer: la insercion en auth.users la hace internamente
-- el servicio de Auth de Supabase con un rol que NO tiene permisos
-- sobre tu tabla public.profiles. "security definer" hace que esta
-- funcion se ejecute con los permisos de quien la creo (vos, dueño
-- del schema public) en vez de los del rol que dispara el trigger,
-- que es lo que le da permiso de escribir en profiles.
-- "set search_path = public" evita un ataque conocido donde alguien
-- crea una tabla/funcion con el mismo nombre en otro schema para
-- secuestrar la resolucion de nombres dentro de la funcion.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2) Policies de INSERT que faltaban en 0001 (RLS bloquea todo por
--    defecto hasta que una policy lo permite explicitamente).
--
-- `drop policy if exists` antes de cada `create policy`: a diferencia
-- de `create or replace function`, `create policy` NO es idempotente
-- (correrla dos veces tira "policy already exists" y corta el script
-- ahi mismo). Con el drop antes, este archivo se puede volver a
-- correr entero las veces que haga falta sin romperse a la mitad.
-- ============================================================
drop policy if exists "Un usuario autenticado puede crear una familia" on families;
create policy "Un usuario autenticado puede crear una familia"
  on families for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "Un usuario se agrega a si mismo como miembro" on family_members;
create policy "Un usuario se agrega a si mismo como miembro"
  on family_members for insert
  to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "El progreso del Domio se crea junto con la familia" on domio_progress;
create policy "El progreso del Domio se crea junto con la familia"
  on domio_progress for insert
  to authenticated
  with check (is_member_of_family(family_id));

-- ============================================================
-- 3) RPC create_family: crea la familia + el primer miembro (admin)
--    + el domio_progress inicial en un solo paso atomico.
--
-- Se llama desde la app con: supabase.rpc('create_family', { family_name })
--
-- "security definer" (y no invoker, como estaba antes) es necesario
-- aca por un problema real que encontramos: `insert ... returning id`
-- no solo tiene que pasar la policy de INSERT, tambien necesita que la
-- fila recien creada sea VISIBLE segun la policy de SELECT de esa
-- tabla — y nuestra policy de SELECT en `families` exige ya ser
-- miembro de esa familia (is_member_of_family), cosa que todavia no
-- sos en ese instante (el insert en family_members es el paso
-- siguiente). Resultado: el RETURNING no fallaba con error, pero
-- devolvia vacio, `new_family_id` quedaba NULL, y el insert de
-- family_members explotaba despues con family_id nulo.
--
-- Con security definer la funcion corre bypasseando RLS (como el
-- dueño de la funcion), evitando ese problema de huevo-y-gallina. Como
-- perdemos el chequeo automatico de RLS, agregamos una validacion
-- manual de que haya un usuario autenticado.
-- ============================================================
create or replace function public.create_family(family_name text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  new_family_id uuid;
  calling_user uuid := auth.uid();
begin
  if calling_user is null then
    raise exception 'No autenticado';
  end if;

  insert into families (name, created_by)
  values (family_name, calling_user)
  returning id into new_family_id;

  insert into family_members (family_id, profile_id, role)
  values (new_family_id, calling_user, 'admin');

  insert into domio_progress (family_id)
  values (new_family_id);

  return new_family_id;
end;
$$;

revoke execute on function public.create_family(text) from public;
grant execute on function public.create_family(text) to authenticated;
