-- Migration: Add user_roles with 'admin' and 'staff' roles, migrate existing admin_users, add helpers and RPCs
set statement_timeout to 0;
set lock_timeout to 0;
set idle_in_transaction_session_timeout to 0;

-- 1) Table user_roles
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','staff')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_user_roles_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_user_roles_updated_at'
  ) then
    create trigger trg_user_roles_updated_at
    before update on public.user_roles
    for each row execute procedure public.touch_user_roles_updated_at();
  end if;
end $$;

-- 2) Migrate data from admin_users -> user_roles as role='admin'
do $$ begin
  if exists (
    select 1 from information_schema.tables where table_schema='public' and table_name='admin_users'
  ) then
    insert into public.user_roles (user_id, role, active)
    select au.user_id, 'admin', coalesce(au.active, true)
    from public.admin_users au
    on conflict (user_id) do nothing;
  end if;
end $$;

-- 3) Functions: is_admin(), is_staff()
create or replace function public.is_admin()
returns boolean
language sql security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin' and active
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'staff' and active
  );
$$;

-- 4) RPC: role_set(p_user_id, p_role, p_active) -> only admin can set
create or replace function public.role_set(p_user_id uuid, p_role text, p_active boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  -- only admins can change roles
  if not public.is_admin() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if p_role not in ('admin','staff') then
    raise exception 'Invalid role';
  end if;

  insert into public.user_roles (user_id, role, active)
  values (p_user_id, p_role, coalesce(p_active, true))
  on conflict (user_id)
  do update set role = excluded.role, active = coalesce(excluded.active, true), updated_at = now();
end;
$$;

-- 5) RPC: managed_users_list() -> admin+staff with email
create or replace function public.managed_users_list()
returns table (
  user_id uuid,
  email text,
  role text,
  active boolean
)
language sql security definer
set search_path = public
as $$
  select ur.user_id,
         u.email::text,
         ur.role,
         ur.active
  from public.user_roles ur
  left join auth.users u on u.id = ur.user_id
  where ur.role in ('admin','staff');
$$;

-- Optional: keep existing RPCs if present; no change here to avoid breaking other parts.

-- 6) Ensure extensions (for auth.uid) are available (usually already in Supabase)
-- create extension if not exists pgjwt with schema extensions; -- not strictly required here
