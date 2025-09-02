-- Migration: Update RLS to use public.is_admin()/public.is_staff() so admin & staff share the same data
-- Created at: 2025-08-24 14:47:00+07

begin;

-- STUDENTS
-- Drop old policies that relied on JWT 'role' claims or incorrect self checks
drop policy if exists "Students can read own data" on public.students;
drop policy if exists "Admins can manage students" on public.students;

-- New read policy: admin or staff can read all students
create policy "AdminStaff read students"
  on public.students
  for select
  to authenticated
  using (
    public.is_admin() or public.is_staff()
  );

-- New manage policy: admin or staff can insert/update/delete students
create policy "AdminStaff manage students"
  on public.students
  for all
  to authenticated
  using (
    public.is_admin() or public.is_staff()
  )
  with check (
    public.is_admin() or public.is_staff()
  );


-- BILLS
drop policy if exists "Students can read own bills" on public.bills;
drop policy if exists "Admins can manage bills" on public.bills;

-- If you still want students to read only their own bills in student portal,
-- you can add an extra policy for students' self access. For now we ensure
-- admin/staff unified access works.
create policy "AdminStaff read bills"
  on public.bills
  for select
  to authenticated
  using (
    public.is_admin() or public.is_staff()
  );

create policy "AdminStaff manage bills"
  on public.bills
  for all
  to authenticated
  using (
    public.is_admin() or public.is_staff()
  )
  with check (
    public.is_admin() or public.is_staff()
  );

-- Students read only their own bills (keep student portal working)
create policy "Students read own bills"
  on public.bills
  for select
  to authenticated
  using (student_id::text = auth.uid()::text);


-- PAYMENTS
drop policy if exists "Students can read own payments" on public.payments;
drop policy if exists "Users can create payments" on public.payments;
drop policy if exists "Admins can manage payments" on public.payments;

create policy "AdminStaff read payments"
  on public.payments
  for select
  to authenticated
  using (
    public.is_admin() or public.is_staff()
  );

create policy "AdminStaff manage payments"
  on public.payments
  for all
  to authenticated
  using (
    public.is_admin() or public.is_staff()
  )
  with check (
    public.is_admin() or public.is_staff()
  );

-- Students read only their own payments (keep student portal working)
create policy "Students read own payments"
  on public.payments
  for select
  to authenticated
  using (student_id::text = auth.uid()::text);

commit;
