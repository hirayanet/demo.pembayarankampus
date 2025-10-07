# Panduan Deployment: Railway (Database & Backend) + Netlify (Frontend)

Panduan ini akan membantu Anda mendeploy sistem manajemen pembayaran kampus menggunakan Railway untuk database MySQL dan backend Node.js, sementara frontend tetap berada di Netlify.

## Prasyarat

1. Akun:
   - Akun Railway (daftar di https://railway.app/)
   - Akun GitHub (untuk menghubungkan repository Anda)
   - Akun Netlify (untuk deployment frontend)

2. Tools:
   - Git terinstal di mesin lokal Anda
   - Node.js dan npm terinstal

## Langkah 1: Persiapkan Repository Kode Anda

1. Pastikan proyek Anda berada dalam repository GitHub
2. Pastikan repository Anda memiliki struktur berikut:
   ```
   your-repo/
   ├── mysql_migration/
   │   ├── auth_server.js
   │   ├── schema_mysql.sql
   │   └── ... (file migrasi lainnya)
   ├── src/
   │   └── ... (file frontend)
   ├── package.json
   ├── README.md
   └── ... (file konfigurasi lainnya)
   ```

## Langkah 2: Deploy Database MySQL di Railway

1. Buka [Railway](https://railway.app/) dan masuk
2. Klik "New Project"
3. Pilih "Empty Project"
4. Klik "Add Service" dan pilih "Database"
5. Pilih "MySQL" dari opsi database
6. Tunggu hingga layanan MySQL disediakan

### Konfigurasi Variabel Lingkungan MySQL

Setelah MySQL dideploy, Railway secara otomatis menyediakan variabel lingkungan berikut:
- `MYSQLHOST`
- `MYSQLPORT`
- `MYSQLUSER`
- `MYSQLPASSWORD`
- `MYSQLDATABASE`
- `MYSQL_URL`

Anda dapat melihatnya di tab "Variables" layanan MySQL Anda.

## Langkah 3: Deploy Backend Node.js di Railway

1. Dalam project Railway yang sama, klik "Add Service" lagi
2. Pilih "GitHub Repo" dan hubungkan ke repository Anda
3. Pilih repository yang berisi kode Anda
4. Railway akan secara otomatis mendeteksi ini adalah proyek Node.js

### Konfigurasi Variabel Lingkungan Backend

Di tab "Variables" layanan backend Anda, tambahkan variabel lingkungan berikut:

```
# Konfigurasi Server
PORT=${{ PORT }}
JWT_SECRET=your-secure-jwt-secret-change-in-production
DB_HOST=${{ your-mysql-service-name.MYSQLHOST }}
DB_USER=${{ your-mysql-service-name.MYSQLUSER }}
DB_PASSWORD=${{ your-mysql-service-name.MYSQLPASSWORD }}
DB_NAME=${{ your-mysql-service-name.MYSQLDATABASE }}
DB_PORT=${{ your-mysql-service-name.MYSQLPORT }}
```

Ganti `your-mysql-service-name` dengan nama aktual layanan MySQL Anda di Railway.

Catatan: Anda juga dapat menggunakan variabel referensi Railway untuk secara otomatis mereferensikan variabel layanan MySQL:
- `DB_HOST=${{ MySQL.MYSQLHOST }}`
- `DB_USER=${{ MySQL.MYSQLUSER }}`
- dll.

### Perbarui Kode Koneksi Database Anda

Pastikan file [mysql_migration/auth_server.js](file://d:/FILE_AYAH/Project%20Explore/pembayarankampus/mysql_migration/auth_server.js) Anda menggunakan variabel lingkungan Railway:

```javascript
// Koneksi database
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pembayaran_kampus_local',
  port: process.env.DB_PORT || 3306
};
```

## Langkah 4: Inisialisasi Skema Database Anda

Anda memiliki dua opsi untuk menginisialisasi database:

### Opsi 1: Import Manual (Direkomendasikan untuk deployment pertama)

1. Di Railway, buka layanan MySQL Anda
2. Pergi ke tab "Connect" dan salin detail koneksi eksternal
3. Gunakan klien MySQL (seperti MySQL Workbench) untuk terhubung ke database MySQL Railway Anda
4. Jalankan script [schema_mysql.sql](file://d:/FILE_AYAH/Project%20Explore/pembayarankampus/mysql_migration/schema_mysql.sql) untuk membuat tabel Anda
5. Masukkan data awal jika diperlukan

### Opsi 2: Tambahkan Script Inisialisasi

Buat file baru `mysql_migration/init_db.js`:

```javascript
const mysql = require('mysql2/promise');
require('dotenv').config();

async function initDatabase() {
  const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  };

  const connection = await mysql.createConnection(dbConfig);
  
  // Baca dan jalankan file skema Anda
  const fs = require('fs');
  const path = require('path');
  const schema = fs.readFileSync(path.join(__dirname, 'schema_mysql.sql'), 'utf8');
  
  // Pisahkan berdasarkan titik koma dan jalankan setiap pernyataan
  const statements = schema.split(';').filter(s => s.trim() !== '');
  
  for (const statement of statements) {
    if (statement.trim() !== '') {
      await connection.execute(statement);
    }
  }
  
  console.log('Database berhasil diinisialisasi');
  await connection.end();
}

initDatabase().catch(console.error);
```

Tambahkan script ini ke [package.json](file://d:/FILE_AYAH/Project%20Explore/pembayarankampus/package.json) Anda:

```json
{
  "scripts": {
    "init-db": "node mysql_migration/init_db.js"
  }
}
```

## Langkah 5: Konfigurasi Frontend untuk Backend Railway

Karena frontend Anda sudah dideploy di Netlify, Anda perlu memperbarui konfigurasi endpoint API.

### Perbarui Variabel Lingkungan di Netlify

1. Buka dashboard Netlify Anda
2. Pilih situs frontend Anda
3. Pergi ke "Site settings" → "Build & deploy" → "Environment"
4. Tambahkan variabel lingkungan berikut:

```
REACT_APP_API_URL=https://your-railway-backend-url.up.railway.app
```

Anda dapat menemukan URL backend Railway Anda di tab "Settings" layanan → "Networking" → "Public Networking".

### Perbarui Konfigurasi API Frontend

Di kode frontend Anda, pastikan panggilan API diarahkan ke backend Railway Anda. Contohnya, di file [src/lib/supabase.ts](file://d:/FILE_AYAH/Project%20Explore/pembayarankampus/src/lib/supabase.ts) atau file layanan API yang setara:

```javascript
// Ganti panggilan Supabase dengan panggilan API langsung ke backend Railway Anda
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Contoh panggilan API
async function login(credentials) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });
  
  return response.json();
}
```

## Langkah 6: Konfigurasi CORS (jika diperlukan)

Perbarui [mysql_migration/auth_server.js](file://d:/FILE_AYAH/Project%20Explore/pembayarankampus/mysql_migration/auth_server.js) Anda untuk mengizinkan permintaan dari frontend Netlify:

```javascript
const cors = require('cors');

// Perbarui konfigurasi CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
```

Tambahkan `FRONTEND_URL` ke variabel lingkungan backend Railway Anda:
```
FRONTEND_URL=https://your-netlify-site.netlify.app
```

## Langkah 7: Deploy Pembaruan

1. Commit dan push semua perubahan ke repository GitHub Anda
2. Railway akan secara otomatis meredeploy layanan backend Anda
3. Netlify akan secara otomatis meredeploy frontend Anda (jika Anda telah mengatur continuous deployment)

## Langkah 8: Uji Deployment Anda

1. Kunjungi URL frontend Netlify Anda
2. Coba login dengan pengguna admin default (periksa [schema_mysql.sql](file://d:/FILE_AYAH/Project%20Explore/pembayarankampus/mysql_migration/schema_mysql.sql) untuk kredensial)
3. Navigasi melalui berbagai bagian untuk memastikan semua fungsi bekerja
4. Periksa dashboard Railway untuk error apapun di log layanan backend Anda

## Penyelesaian Masalah

### Masalah Umum

1. **Connection Refused**: Pastikan URL backend Railway Anda dikonfigurasi dengan benar di variabel lingkungan Netlify
2. **CORS Errors**: Verifikasi konfigurasi CORS di backend mengizinkan permintaan dari domain Netlify Anda
3. **Database Connection Issues**: Periksa bahwa semua variabel lingkungan dikonfigurasi dengan benar di Railway dan sesuai dengan layanan database Anda
4. **Environment Variables Not Found**: Pastikan Anda menggunakan nama variabel yang benar sesuai yang disediakan oleh Railway

### Memeriksa Log

1. Di Railway, buka tab "Deployments" layanan Anda untuk melihat log
2. Di Netlify, buka tab "Deploys" situs Anda untuk melihat log build
3. Periksa tools developer browser untuk error frontend

## Pertimbangan Keamanan Tambahan

1. Ubah secret JWT default di produksi
2. Gunakan kata sandi yang kuat untuk database Anda
3. Perbarui dependensi secara berkala di [package.json](file://d:/FILE_AYAH/Project%20Explore/pembayarankampus/package.json)
4. Pertimbangkan menambahkan rate limiting ke endpoint API Anda
5. Gunakan HTTPS untuk semua komunikasi (ditangani secara otomatis oleh Railway dan Netlify)

## Pertimbangan Scaling

1. Railway secara otomatis menskalakan layanan Anda berdasarkan permintaan
2. Untuk aplikasi dengan traffic tinggi, pertimbangkan upgrade plan MySQL Anda
3. Monitor metrik layanan Anda di dashboard Railway
4. Atur alert untuk penggunaan resource

Dengan mengikuti panduan ini, Anda seharusnya memiliki deployment yang berfungsi penuh dari sistem manajemen pembayaran kampus Anda dengan Railway menangani backend dan database, dan Netlify melayani frontend Anda.