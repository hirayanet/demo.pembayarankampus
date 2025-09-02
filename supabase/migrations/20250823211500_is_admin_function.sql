-- SECURITY DEFINER helper to check if current auth.uid() is an active admin
begin;

create or replace function public.is_admin()
returns boolean
language sql security definer
set search_path = public
as $$
  select exists(
    select 1 from public.admin_users where user_id = auth.uid() and active
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

commit;
