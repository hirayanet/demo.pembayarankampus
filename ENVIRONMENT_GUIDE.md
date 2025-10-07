# 🌍 Environment Configuration Guide

## 📁 Environment Files

### Development Environment (`.env.development`)
```bash
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=pembayaran_kampus_local
DB_PORT=3306

# JWT Configuration
JWT_SECRET=development_secret_key_change_in_production

# Server Configuration
PORT=3001

# Other Configurations
NODE_ENV=development
```

### Production Environment (`.env.production`)
```bash
# Database Configuration
DB_HOST=localhost
DB_USER=adminkampus
DB_PASSWORD=admin123123
DB_NAME=pembayarankampus
DB_PORT=3306

# JWT Configuration
JWT_SECRET=kataKunciRahasiaUntukJWT123

# Server Configuration
PORT=3001

# Other Configurations
NODE_ENV=production
```

### Staging Environment (`.env.staging`)
```bash
# Database Configuration
DB_HOST=localhost
DB_USER=adminkampus_staging
DB_PASSWORD=staging_password_123
DB_NAME=pembayarankampus_staging
DB_PORT=3306

# JWT Configuration
JWT_SECRET=staging_secret_key_change_in_production

# Server Configuration
PORT=3001

# Other Configurations
NODE_ENV=production
```

## 🔧 Environment Variable Management

### Mengatur Environment Variables di Server
```bash
# Membuat file .env
nano .env

# Memuat environment variables
source .env

# Mengecek environment variables
echo $DB_HOST
echo $DB_USER
```

### Mengatur Environment Variables dengan PM2
Di file `ecosystem.config.js`:
```javascript
module.exports = {
  apps : [{
    name   : "pembayarankampus-api",
    script : "./auth_server.js",
    instances : 1,
    exec_mode : "fork",
    env: {
      NODE_ENV: "development",
      DB_HOST: "localhost",
      DB_USER: "root",
      DB_PASSWORD: "",
      DB_NAME: "pembayaran_kampus_local",
      DB_PORT: 3306,
      JWT_SECRET: "development_secret_key_change_in_production",
      PORT: 3001
    },
    env_production: {
      NODE_ENV: "production",
      DB_HOST: "localhost",
      DB_USER: "adminkampus",
      DB_PASSWORD: "admin123123",
      DB_NAME: "pembayarankampus",
      DB_PORT: 3306,
      JWT_SECRET: "kataKunciRahasiaUntukJWT123",
      PORT: 3001
    }
  }]
}
```

### Menjalankan Aplikasi dengan Environment Tertentu
```bash
# Menjalankan dengan environment development
pm2 start ecosystem.config.js

# Menjalankan dengan environment production
pm2 start ecosystem.config.js --env production

# Menjalankan dengan environment staging
pm2 start ecosystem.config.js --env staging
```

## 🔐 Best Practices untuk Environment Variables

### 1. Jangan Simpan di Repository
Tambahkan `.env` ke `.gitignore`:
```gitignore
# Environment variables
.env
.env.local
.env.*.local
```

### 2. Gunakan Template untuk Developer
Buat file `.env.example`:
```bash
# Database Configuration
DB_HOST=localhost
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name
DB_PORT=3306

# JWT Configuration
JWT_SECRET=your_jwt_secret_key

# Server Configuration
PORT=3001

# Other Configurations
NODE_ENV=development
```

### 3. Validasi Environment Variables
Di aplikasi, validasi environment variables saat startup:
```javascript
// Validasi environment variables
const requiredEnvVars = [
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'DB_PORT',
  'JWT_SECRET',
  'PORT'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

console.log('All required environment variables are present');
```

## 🔄 Environment-Specific Configurations

### Development
- Database lokal dengan data test
- Logging verbose untuk debugging
- Auto-restart saat ada perubahan kode
- Error messages detail

### Staging
- Mirip dengan production tetapi dengan data test
- Logging standard
- Environment mirip production
- Digunakan untuk testing sebelum production

### Production
- Database production
- Logging minimal untuk performance
- Error handling graceful
- Security settings maksimal

## 🛠️ Tools untuk Manajemen Environment

### 1. dotenv
Sudah diinstall dan digunakan di aplikasi:
```javascript
require('dotenv').config();
```

### 2. cross-env (untuk Windows compatibility)
```bash
npm install --save-dev cross-env
```

Update package.json:
```json
{
  "scripts": {
    "dev": "cross-env NODE_ENV=development nodemon auth_server.js",
    "start": "cross-env NODE_ENV=production node auth_server.js"
  }
}
```

### 3. env-cmd
```bash
npm install --save-dev env-cmd
```

Gunakan untuk menjalankan command dengan environment tertentu:
```bash
npx env-cmd -f .env.production node auth_server.js
```

## 📊 Monitoring Environment Variables

### Membuat Endpoint untuk Debug Environment
```javascript
// Tambahkan di auth_server.js untuk debugging
app.get('/debug/env', (req, res) => {
  // Jangan tampilkan secret values di production
  const safeEnvVars = {
    NODE_ENV: process.env.NODE_ENV,
    DB_HOST: process.env.DB_HOST,
    DB_USER: process.env.DB_USER,
    DB_NAME: process.env.DB_NAME,
    DB_PORT: process.env.DB_PORT,
    PORT: process.env.PORT
  };
  
  res.json(safeEnvVars);
});
```

### Mengecek Environment Variables di Runtime
```bash
# Di server, cek environment variables
printenv | grep DB_
printenv | grep JWT_
```

## 🚨 Troubleshooting

### Environment Variables Tidak Terbaca
1. Pastikan file `.env` ada di direktori yang benar
2. Pastikan `require('dotenv').config();` ada di awal aplikasi
3. Cek apakah ada typo dalam penamaan variables
4. Pastikan tidak ada spasi di sekitar `=` dalam file `.env`

### Database Connection Issues
1. Cek nilai `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
2. Pastikan MySQL service running
3. Cek firewall settings
4. Verifikasi credentials dengan MySQL client

### JWT Issues
1. Pastikan `JWT_SECRET` diatur dengan nilai yang kuat
2. Cek apakah secret konsisten antara login dan verifikasi
3. Verifikasi panjang secret minimal 32 karakter

---

📝 **Catatan**: Selalu gunakan environment variables untuk konfigurasi yang berbeda antar environment. Jangan hardcode nilai konfigurasi dalam kode aplikasi.