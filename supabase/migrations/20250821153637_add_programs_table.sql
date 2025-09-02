-- Create programs table
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

-- Trigger to update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_programs_updated_at on public.programs;
create trigger trg_programs_updated_at
before update on public.programs
for each row execute function public.set_updated_at();

-- Add column program_id to students (nullable for backward compatibility)
alter table public.students
  add column if not exists program_id uuid null references public.programs(id) on update cascade on delete set null;

create index if not exists idx_students_program_id on public.students(program_id);
create index if not exists idx_programs_name on public.programs(name);
create index if not exists idx_programs_code on public.programs(code);

-- Enable realtime if needed (assumes publication exists)
-- Note: In Supabase, ensure programs is added to the realtime publication
-- alter publication supabase_realtime add table public.programs;
