# Implementasi Logika Reset Password Default untuk Mahasiswa

## Gambaran Umum
Dokumen ini menjelaskan implementasi logika reset password default untuk mahasiswa dalam aplikasi pembayaran kampus menggunakan database MySQL.

## Perubahan yang Dilakukan

### 1. Skema Database
- Menambahkan kolom `must_change_password` (BOOLEAN) ke tabel `users`
- Menambahkan indeks untuk kolom `must_change_password` untuk meningkatkan kinerja query

### 2. Backend (auth_server.js)

#### Endpoint POST /api/students
- Memodifikasi endpoint untuk secara otomatis membuat pengguna di tabel `users` ketika mahasiswa baru dibuat
- Menetapkan password default "kamal123" untuk pengguna baru
- Menandai `must_change_password = TRUE` untuk pengguna baru
- Menggunakan transaksi database untuk memastikan konsistensi data

#### Endpoint POST /auth/login
- Memodifikasi endpoint login untuk memeriksa apakah pengguna perlu mengganti password
- Jika `must_change_password = TRUE`, mengembalikan flag khusus tanpa token
- Memungkinkan pengguna untuk login setelah mengganti password

#### Endpoint POST /auth/change-password
- Menambahkan endpoint baru untuk mengganti password pengguna
- Memverifikasi password saat ini (atau melewati verifikasi jika `must_change_password = TRUE`)
- Mengatur `must_change_password = FALSE` setelah password berhasil diubah

### 3. Frontend (Login.tsx)
- Memodifikasi komponen Login untuk menangani kasus ketika pengguna perlu mengganti password
- Menampilkan form khusus untuk penggantian password ketika diperlukan
- Mengimplementasikan logika untuk mengganti password dan login ulang

## Cara Kerja

1. Ketika admin membuat mahasiswa baru melalui `POST /api/students`:
   - Data mahasiswa disimpan di tabel `students`
   - Pengguna yang sesuai dibuat di tabel `users` dengan:
     - Password default "kamal123"
     - `must_change_password = TRUE`
     - `email_verified = TRUE`

2. Ketika mahasiswa mencoba login dengan password default:
   - Sistem mengenali bahwa password perlu diubah
   - Mengembalikan respons khusus yang menandakan perlu mengganti password
   - Tidak memberikan token akses

3. Di frontend:
   - Menampilkan form khusus untuk mengganti password
   - Mengirim permintaan ke `POST /auth/change-password`
   - Setelah berhasil, melakukan login ulang dengan password baru

4. Setelah penggantian password:
   - `must_change_password` diatur ke `FALSE`
   - Pengguna dapat login normal dengan password baru

## Keamanan

- Password disimpan sebagai hash bcrypt
- Token JWT tetap digunakan untuk autentikasi setelah penggantian password
- Validasi input untuk memastikan password baru memenuhi persyaratan

## Kompatibilitas

Implementasi ini tidak mempengaruhi fungsi lain yang sudah berjalan:
- Tabel dan kolom yang ada tetap dipertahankan
- Endpoint yang sudah ada tetap berfungsi seperti sebelumnya
- Hanya menambahkan fungsionalitas baru tanpa mengubah struktur data yang ada

## Pengujian

Untuk menguji implementasi:
1. Buat mahasiswa baru melalui admin panel
2. Coba login dengan email mahasiswa dan password "kamal123"
3. Verifikasi bahwa sistem meminta penggantian password
4. Ganti password dan verifikasi bahwa login berhasil dengan password baru