-- Bootstrap Schema for Fresh Database (Run only on EMPTY DB)
-- This file consolidates the current canonical schema: tables, enums, indexes, triggers, functions, and RLS policies.
-- Safe usage: Paste and run in Supabase SQL Editor for a new project.
-- Warning: Do NOT run on an existing database that already has migrations applied.

begin;

-- =====================
-- Enums
-- =====================
create type if not exists public.student_status as enum ('active','inactive','graduated');
create type if not exists public.bill_type as enum ('fixed','installment');
create type if not exists public.bill_status as enum ('paid','unpaid','partial');
create type if not exists public.payment_status as enum ('completed','pending','failed');

-- =====================
-- Helper functions (updated_at)
-- =====================
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create or replace function public.touch_user_roles_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =====================
-- Master tables
-- =====================
create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  faculty text null,
  level text null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_programs_name on public.programs(name);
create index if not exists idx_programs_code on public.programs(code);

create table if not exists public.bill_categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  active boolean not null default true,
  default_amount numeric check (default_amount > 0),
  default_due_days integer check (default_due_days > 0),
  default_type text check (default_type in ('fixed','installment')),
  default_installment_count integer check (default_installment_count > 0),
  default_installment_amount numeric check (default_installment_amount > 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_bill_categories_name on public.bill_categories(name);

drop trigger if exists update_bill_categories_updated_at on public.bill_categories;
create trigger update_bill_categories_updated_at
  before update on public.bill_categories
  for each row execute function public.update_updated_at_column();

-- =====================
-- Core tables
-- =====================
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  nim text unique not null,
  name text not null,
  email text unique not null,
  phone text,
  prodi text not null,
  angkatan text not null,
  address text,
  status public.student_status default 'active',
  program_id uuid null references public.programs(id) on update cascade on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_students_nim on public.students(nim);
create index if not exists idx_students_status on public.students(status);
create index if not exists idx_students_program_id on public.students(program_id);

drop trigger if exists update_students_updated_at on public.students;
create trigger update_students_updated_at
  before update on public.students
  for each row execute function public.update_updated_at_column();

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  type public.bill_type not null,
  category text null, -- legacy, will be nullified by trigger
  description text not null,
  amount numeric not null check (amount > 0),
  due_date date not null,
  status public.bill_status default 'unpaid',
  paid_amount numeric default 0 check (paid_amount >= 0),
  installment_count integer check (installment_count > 0),
  installment_amount numeric check (installment_amount > 0),
  category_id uuid null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.bills drop constraint if exists bills_category_id_fkey;
alter table public.bills
  add constraint bills_category_id_fkey
  foreign key (category_id)
  references public.bill_categories(id)
  on delete set null;

create index if not exists idx_bills_student_id on public.bills(student_id);
create index if not exists idx_bills_status on public.bills(status);
create index if not exists idx_bills_due_date on public.bills(due_date);
create index if not exists idx_bills_category_id on public.bills(category_id);

drop trigger if exists update_bills_updated_at on public.bills;
create trigger update_bills_updated_at
  before update on public.bills
  for each row execute function public.update_updated_at_column();

create or replace function public.bills_nullify_legacy_category()
returns trigger as $$
begin
  new.category := null;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_bills_nullify_legacy_category on public.bills;
create trigger trg_bills_nullify_legacy_category
  before insert or update on public.bills
  for each row execute function public.bills_nullify_legacy_category();

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid references public.bills(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  amount numeric not null check (amount > 0),
  payment_method text not null,
  payment_date timestamptz default now(),
  receipt_number text unique not null,
  status public.payment_status default 'completed',
  created_at timestamptz default now()
);

create index if not exists idx_payments_bill_id on public.payments(bill_id);
create index if not exists idx_payments_student_id on public.payments(student_id);
create index if not exists idx_payments_date on public.payments(payment_date);

-- =====================
-- Settings
-- =====================
create table if not exists public.settings (
  id text primary key,
  security jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_settings_updated_at on public.settings;
create trigger trg_settings_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

insert into public.settings (id, security)
values ('system', '{}'::jsonb)
on conflict (id) do nothing;

-- =====================
-- Roles and access helpers
-- =====================
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','staff')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_user_roles_updated_at'
  ) then
    create trigger trg_user_roles_updated_at
    before update on public.user_roles
    for each row execute procedure public.touch_user_roles_updated_at();
  end if;
end $$;

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

create or replace function public.role_set(p_user_id uuid, p_role text, p_active boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
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

-- =====================
-- RLS & Policies
-- =====================
-- Enable RLS
alter table public.students enable row level security;
alter table public.bills enable row level security;
alter table public.payments enable row level security;
alter table public.bill_categories enable row level security;
alter table public.settings enable row level security;

-- Students
create policy if not exists "AdminStaff read students"
  on public.students for select to authenticated
  using (public.is_admin() or public.is_staff());
create policy if not exists "AdminStaff manage students"
  on public.students for all to authenticated
  using (public.is_admin() or public.is_staff())
  with check (public.is_admin() or public.is_staff());

-- Bills
create policy if not exists "AdminStaff read bills"
  on public.bills for select to authenticated
  using (public.is_admin() or public.is_staff());
create policy if not exists "AdminStaff manage bills"
  on public.bills for all to authenticated
  using (public.is_admin() or public.is_staff())
  with check (public.is_admin() or public.is_staff());
create policy if not exists "Students read own bills"
  on public.bills for select to authenticated
  using (student_id::text = auth.uid()::text);

-- Payments
create policy if not exists "AdminStaff read payments"
  on public.payments for select to authenticated
  using (public.is_admin() or public.is_staff());
create policy if not exists "AdminStaff manage payments"
  on public.payments for all to authenticated
  using (public.is_admin() or public.is_staff())
  with check (public.is_admin() or public.is_staff());
create policy if not exists "Students read own payments"
  on public.payments for select to authenticated
  using (student_id::text = auth.uid()::text);

-- Bill categories
create policy if not exists "Categories read for all authenticated"
  on public.bill_categories for select to authenticated
  using (true);
-- Admin manage via app_metadata.role = 'admin'
create policy if not exists "Admins manage categories"
  on public.bill_categories for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Settings
create policy if not exists settings_read_authenticated
  on public.settings for select to authenticated using (true);
create policy if not exists settings_write_authenticated
  on public.settings for insert to authenticated with check (true);
create policy if not exists settings_update_authenticated
  on public.settings for update to authenticated using (true) with check (true);

commit;
