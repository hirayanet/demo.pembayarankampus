-- Admin roles via table + RPC (SECURITY DEFINER)
-- This avoids using Auth Admin API and Edge Functions for admin management from the UI.

begin;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Only authenticated admins can read/write
drop policy if exists admin_read on public.admin_users;
create policy admin_read on public.admin_users
for select
to authenticated
using (
  exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid() and au.active = true
  )
);

drop policy if exists admin_write on public.admin_users;
create policy admin_write on public.admin_users
for all
to authenticated
using (
  exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid() and au.active = true
  )
)
with check (
  exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid() and au.active = true
  )
);

-- List current admins (id, email, active)
create or replace function public.admin_list()
returns table(user_id uuid, email text, active boolean)
language sql security definer
set search_path = public
as $$
  select u.id, u.email, a.active
  from auth.users u
  join public.admin_users a on a.user_id = u.id
  order by u.email;
$$;
revoke all on function public.admin_list() from public;
grant execute on function public.admin_list() to authenticated;

-- Enable admin by email (idempotent)
create or replace function public.admin_add_by_email(p_email text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_caller_is_admin boolean;
  v_user_id uuid;
begin
  select exists(
    select 1 from public.admin_users where user_id = auth.uid() and active
  ) into v_caller_is_admin;
  if not v_caller_is_admin then
    raise exception 'Forbidden';
  end if;

  select id into v_user_id from auth.users where email = p_email limit 1;
  if v_user_id is null then
    raise exception 'User with email % not found', p_email;
  end if;

  insert into public.admin_users(user_id, active)
  values (v_user_id, true)
  on conflict (user_id) do update set active = excluded.active;
end;
$$;
revoke all on function public.admin_add_by_email(text) from public;
grant execute on function public.admin_add_by_email(text) to authenticated;

-- Enable/disable by user_id
create or replace function public.admin_enable(p_user_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_caller_is_admin boolean;
begin
  select exists(
    select 1 from public.admin_users where user_id = auth.uid() and active
  ) into v_caller_is_admin;
  if not v_caller_is_admin then
    raise exception 'Forbidden';
  end if;

  insert into public.admin_users(user_id, active) values (p_user_id, true)
  on conflict (user_id) do update set active = true;
end;
$$;
revoke all on function public.admin_enable(uuid) from public;
grant execute on function public.admin_enable(uuid) to authenticated;

create or replace function public.admin_disable(p_user_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_caller_is_admin boolean;
begin
  select exists(
    select 1 from public.admin_users where user_id = auth.uid() and active
  ) into v_caller_is_admin;
  if not v_caller_is_admin then
    raise exception 'Forbidden';
  end if;

  update public.admin_users set active = false where user_id = p_user_id;
end;
$$;
revoke all on function public.admin_disable(uuid) from public;
grant execute on function public.admin_disable(uuid) to authenticated;

commit;
