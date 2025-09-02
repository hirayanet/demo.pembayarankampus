# Pembayaran Kampus (React + Vite + Supabase)

    Aplikasi manajemen pembayaran kampus dengan role Admin dan Mahasiswa. Frontend dibangun dengan React + Vite + TypeScript + Tailwind, terintegrasi ke Supabase (Postgres, REST, Realtime) via `@supabase/supabase-js`.

    ## Prasyarat
    - Node.js LTS dan npm
    - Akun Supabase dan Project aktif
    - Nilai environment berikut:
      - `VITE_SUPABASE_URL`
      - `VITE_SUPABASE_ANON_KEY`

    ## Setup Cepat
    1. Install dependencies:
       ```bash
       npm install
       ```
    2. Salin file env dan isi kredensial Supabase:
       ```bash
       cp .env.example .env.local
       # Edit .env.local lalu isi:
       # VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
       # VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_PUBLIC_KEY
       ```
    3. Jalankan lokal (dev):
       ```bash
       npm run dev
       ```
    4. Build untuk produksi:
       ```bash
       npm run build
       npm run preview   # Preview lokal hasil build
       ```

    ## Struktur Proyek (ringkas)
    - `src/App.tsx`: Root app, routing sederhana berbasis state dan role (admin vs student)
    - `src/pages/`: Halaman Admin (`AdminDashboard`, `admin/*`) dan Mahasiswa (`StudentDashboard`, `student/*`)
    - `src/components/`: UI komponen (Sidebar, Header, Forms, dll.)
    - `src/lib/supabase.ts`: Inisialisasi client Supabase dan `dbService` untuk akses tabel
    - `supabase/migrations/`: (opsional) migrasi SQL

    ## Integrasi Supabase
    - Pastikan tabel berikut ada di Supabase (nama tabel sensitif huruf kecil):
      - `students`: id, nim_kashif, nim_dikti, name, email, phone, prodi, angkatan, address, status, created_at, updated_at
      - `bills`: id, student_id (FK -> students.id), type, category, description, amount, due_date, status, paid_amount, installment_count, installment_amount, created_at, updated_at
      - `payments`: id, bill_id (FK -> bills.id), student_id (FK -> students.id), amount, payment_method, payment_date, receipt_number, status, created_at
    - `src/lib/supabase.ts` mewajibkan variabel environment dan akan error jika belum diisi.

    ## Catatan Auth
    - Saat ini login masih mock via localStorage. Ke depan bisa ditingkatkan ke Supabase Auth dan role-based guard.

    ## Lisensi
    - Internal project.
