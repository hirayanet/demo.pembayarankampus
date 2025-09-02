# Panduan Migrasi Database (Supabase)

Panduan ini merangkum SOP migrasi database untuk aplikasi Pembayaran Kampus berbasis Supabase. Bahasa: Indonesia.

## Ringkasan Skema Saat Ini
Berdasarkan folder `supabase/migrations/`:
- Tabel inti
  - `students` (enum `student_status`), indeks: `nim`, `status`, trigger `update_updated_at_column`
  - `bills` (enum `bill_type`, `bill_status`), FK `student_id`, `category_id` (opsional), indeks: `student_id`, `status`, `due_date`, `category_id`, trigger `update_updated_at_column`, trigger `trg_bills_nullify_legacy_category`
  - `payments` (enum `payment_status`), FK `bill_id`, `student_id`, indeks: `bill_id`, `student_id`, `payment_date`
- Master dan konfigurasi
  - `bill_categories` (+kolom default: `default_type`, `default_installment_count`, `default_installment_amount`), indeks: `name`
  - `programs` (+kolom `program_id` pada `students`), indeks: `programs(name)`, `programs(code)`, `students(program_id)`
  - `settings` (konfigurasi sistem, 1 row id `system`), trigger `trg_settings_updated_at`
- Manajemen peran
  - `admin_users` (awal), lalu dimigrasikan ke `user_roles`
  - `user_roles` (role: `admin`/`staff`), trigger `trg_user_roles_updated_at`
- Fungsi, RPC, Trigger
  - `update_updated_at_column`, `set_updated_at`, `touch_user_roles_updated_at`
  - `is_admin()`, `is_staff()`
  - RPC: `admin_list()`, `admin_add_by_email(text)`, `admin_enable(uuid)`, `admin_disable(uuid)`
  - RPC: `role_set(uuid,text,boolean)`, `managed_users_list()`
  - Trigger: `trg_bills_nullify_legacy_category`
- RLS/Policy (disederhanakan ke fungsi):
  - Admin/Staff dapat baca/kelola `students`, `bills`, `payments`
  - Mahasiswa dapat baca tagihan/pembayaran miliknya sendiri
  - `bill_categories`: semua authenticated dapat baca; admin dapat kelola
  - `settings`: authenticated dapat baca/tulis

Catatan: Kolom `bills.category` sudah deprecated dan dijaga NULL melalui trigger. Gunakan `bills.category_id` -> `bill_categories(id)`.

## Prasyarat & Lingkungan
- Supabase CLI terpasang dan login.
- Variabel lingkungan front-end (Vite):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  Pastikan diset (hindari CORS dari pemanggilan REST/Supabase yang gagal).
- Selalu buat backup database sebelum migrasi produksi.

## Alur Migrasi Standar
1) Desain perubahan skema
- Tandai perubahan non-breaking vs breaking. Gunakan strategi dua-langkah untuk breaking (tambah kolom baru → backfill → update aplikasi → remove lama).

2) Buat migrasi SQL
- Kembangkan di lokal (supabase local) lalu jalankan:
```
supabase db diff --file 2025XXXX_deskripsi.sql
```
- Untuk kasus kompleks, tulis SQL manual dan beri komentar + rencana rollback.

3) Uji lokal
- Jalankan layanan lokal:
```
supabase start
supabase db reset   # untuk clean slate
# atau
supabase db push    # hanya apply migrasi yang pending
```
- Jalankan aplikasi Vite dan tes alur terkait: `students`, `bills`, `payments`, cetak `ReceiptPrint`, `ReceiptModal`.

4) Review & Checklist PR
- File migrasi berada di `supabase/migrations/` dengan nama timestamp.
- Perubahan aplikasi (TypeScript) telah menyesuaikan skema.
- Rencana rollback tercantum di komentar file migrasi.
- Uji lokal lulus.

5) Deploy
- Terapkan ke staging terlebih dulu → verifikasi fungsi utama.
- Backup produksi → apply migrasi → deploy aplikasi.

6) Verifikasi & Monitoring
- Uji query health-check pada tabel/kolom baru.
- Pantau error Supabase (RLS/policy) dan Edge Functions (jika ada).
- Tinjau performa; buat index bila perlu.

7) Rollback
- Gunakan transaksi pada migrasi besar agar atomic.
- Jika dua-langkah, rollback aplikasi ke versi sebelumnya lebih dulu bila perlu.
- Sediakan skrip rollback (drop objek baru, kembalikan definisi lama) atau restore dari backup.

## Daftar Tabel Wajib & Pengaturan RLS/Policy
- students
  - RLS: enable
  - Policy: Admin/Staff dapat SELECT/ALL (`public.is_admin()`/`public.is_staff()`)
  - Indeks: nim, status, program_id
  - Trigger: update `updated_at`
- programs
  - Indeks: code (unique), name
  - Kolom relasi: students.program_id (ON DELETE SET NULL)
- bills
  - RLS: enable
  - Policy: Admin/Staff SELECT/ALL; Student SELECT miliknya
  - Indeks: student_id, status, due_date, category_id
  - Trigger: update `updated_at`; nullify legacy `category`
- bill_categories
  - RLS: enable
  - Policy: Authenticated SELECT; Admin ALL
  - Indeks: name
- payments
  - RLS: enable
  - Policy: Admin/Staff SELECT/ALL; Student SELECT miliknya
  - Indeks: bill_id, student_id, payment_date
- settings
  - RLS: enable
  - Policy: authenticated dapat SELECT/INSERT/UPDATE
  - Trigger: update `updated_at`
- user_roles
  - RLS: (tidak disebutkan, default non-RLS) → opsional enable RLS jika dikelola via RPC security definer
  - Trigger: update `updated_at`
- admin_users (legacy)
  - Sudah digantikan oleh `user_roles`; boleh dipertahankan sementara (read-only) atau dimigrasikan penuh.

## Fungsi & RPC Penting
- Helper `updated_at`: `update_updated_at_column`, `set_updated_at`, `touch_user_roles_updated_at`
- Role checks: `is_admin()`, `is_staff()` (SECURITY DEFINER)
- Admin management (legacy): `admin_list`, `admin_add_by_email`, `admin_enable`, `admin_disable`
- Role management (baru): `role_set`, `managed_users_list`
- Bills legacy guard: `bills_nullify_legacy_category`

## Template Migrasi Dua-Langkah (Breaking Change)
```sql
-- 2025XXXX_add_new_column_safe.sql
begin;
-- 1) Tambah kolom baru (nullable), index bila perlu
alter table public.my_table add column if not exists new_col text null;
create index if not exists idx_my_table_new_col on public.my_table(new_col);
commit;

-- 2025XXXX_backfill_and_enforce.sql
begin;
-- 2) Backfill data
update public.my_table set new_col = old_col where new_col is null;
-- 3) Perbarui aplikasi menggunakan new_col (deploy app)
-- 4) Optionally enforce NOT NULL / drop kolom lama bila aman
-- alter table public.my_table alter column new_col set not null;
-- alter table public.my_table drop column old_col;
commit;
```

## Checklist Migrasi
- Sudah ada backup sebelum deploy.
- File migrasi dilengkapi komentar tujuan/risiko/rollback.
- Perubahan RLS/policy diverifikasi dengan akun admin/staff/student.
- Index sesuai pola query.
- Aplikasi diperbarui dan dites terhadap skema baru.

## Referensi Skema Kanonik
Lihat file referensi: `supabase/reference/canonical_schema.sql` (hanya dokumentasi; tidak dieksekusi otomatis). Gunakan sebagai acuan saat membuat migrasi baru atau bootstrap lingkungan baru.

---
Jika Anda ingin, saya bisa men-generate migrasi konsolidasi untuk bootstrap environment baru berdasarkan file referensi (akan dibuat di luar folder `supabase/migrations/` agar tidak otomatis ter-apply). Silakan beri instruksi lanjutan.
