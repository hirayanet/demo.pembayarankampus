-- Create settings table for system-wide configuration
create table if not exists public.settings (
  id text primary key,
  security jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure at least one row exists (id = 'system')
insert into public.settings (id, security)
values (
  'system',
  jsonb_build_object(
    'sessionTimeout', 30,
    'passwordMinLength', 8,
    'requireSpecialChars', false,
    'maxLoginAttempts', 3,
    'twoFactorAuth', false
  )
)
on conflict (id) do nothing;

-- Trigger to update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_settings_updated_at on public.settings;
create trigger trg_settings_updated_at
before update on public.settings
for each row execute function public.set_updated_at();

-- Enable RLS
alter table public.settings enable row level security;

-- Policy: allow read for authenticated users
drop policy if exists settings_read_authenticated on public.settings;
create policy settings_read_authenticated
on public.settings
for select
to authenticated
using (true);

-- Policy: allow insert for authenticated users
drop policy if exists settings_write_authenticated on public.settings;
create policy settings_write_authenticated
on public.settings
for insert
to authenticated
with check (true);

-- Policy: allow update for authenticated users
drop policy if exists settings_update_authenticated on public.settings;
create policy settings_update_authenticated
on public.settings
for update
to authenticated
using (true)
with check (true);
