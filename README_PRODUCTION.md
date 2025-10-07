# 🚀 Panduan Deployment Produksi ke VPS

## 📋 Prerequisites
- ✅ VPS dengan Ubuntu 20.04 atau lebih baru
- ✅ MySQL sudah terinstall
- ✅ Node.js terinstall
- ✅ PM2 untuk manajemen proses
- ✅ Nginx sebagai reverse proxy

## 🔧 Step 1: Setup Database di VPS

### 1.1 Install MySQL
```bash
sudo apt update
sudo apt install mysql-server
sudo mysql_secure_installation
```

### 1.2 Buat Database dan User
```bash
sudo mysql -u root -p
CREATE DATABASE pembayarankampus;
CREATE USER 'adminkampus'@'localhost' IDENTIFIED BY 'admin123123';
GRANT ALL PRIVILEGES ON pembayarankampus.* TO 'adminkampus'@'localhost';
FLUSH PRIVILEGES;
exit
```

### 1.3 Import Schema MySQL
```bash
# Upload schema_mysql.sql ke VPS
mysql -u adminkampus -p pembayarankampus < schema_mysql.sql
```

### 1.4 Verifikasi Database
```sql
USE pembayarankampus;
SHOW TABLES;
SELECT * FROM users;
SELECT * FROM students;
```

## 🔐 Step 2: Setup Authentication Server

### 2.1 Upload Kode ke VPS
```bash
# Gunakan SCP atau Git untuk upload kode ke VPS
# Contoh struktur direktori:
# /home/youruser/pembayarankampus/
# ├── mysql_migration/
# │   ├── auth_server.js
# │   ├── package.json
# │   ├── .env
# │   └── ...
```

### 2.2 Install Dependencies
```bash
cd mysql_migration
npm install
```

### 2.3 Setup Environment Variables
Buat file `.env` dengan konfigurasi berikut:
```bash
DB_HOST=localhost
DB_USER=adminkampus
DB_PASSWORD=admin123123
DB_NAME=pembayarankampus
DB_PORT=3306
JWT_SECRET=kataKunciRahasiaUntukJWT123
PORT=3001
```

### 2.4 Install dan Setup PM2
```bash
# Install PM2 secara global
sudo npm install -g pm2

# Jalankan aplikasi dengan PM2
pm2 start ecosystem.config.js

# Simpan konfigurasi PM2
pm2 save

# Setup startup script
sudo pm2 startup systemd
```

### 2.5 Test Authentication Server
```bash
# Test health check
curl http://localhost:3001/health

# Test database connection
curl http://localhost:3001/test-db
```

## 🔁 Step 3: Setup Nginx Reverse Proxy

### 3.1 Install Nginx
```bash
sudo apt install nginx
```

### 3.2 Buat Konfigurasi Nginx
```bash
sudo nano /etc/nginx/sites-available/pembayarankampus
```

Tambahkan konfigurasi berikut:
```nginx
server {
    listen 80;
    server_name your-domain.com; # Ganti dengan domain Anda atau IP VPS

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3.3 Aktifkan Situs
```bash
sudo ln -s /etc/nginx/sites-available/pembayarankampus /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 🔌 Step 4: Integrasi dengan Frontend di Vercel

### 4.1 Update Environment Variables di Vercel
Di pengaturan Vercel, tambahkan environment variable:
```
VITE_API_BASE_URL=http://your-vps-ip-address
```

### 4.2 Update Kode Frontend
Pastikan frontend menggunakan API base URL yang benar:
```javascript
// Di file konfigurasi API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
```

## 🧪 Step 5: Testing Endpoints

### 5.1 Test Authentication
```bash
# Test login
curl -X POST http://your-vps-ip-address/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kampus.edu","password":"admin123"}'
```

### 5.2 Test Protected Endpoints
```bash
# Test dengan token yang didapat dari login
curl -X GET http://your-vps-ip-address/auth/user \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔄 Step 6: Monitoring dan Maintenance

### 6.1 Monitoring dengan PM2
```bash
# Lihat status aplikasi
pm2 status

# Lihat log
pm2 logs

# Restart aplikasi
pm2 restart pembayarankampus-api
```

### 6.2 Backup Database
```bash
# Backup rutin
mysqldump -u adminkampus -p pembayarankampus > backup-$(date +%F).sql
```

## 🔒 Security Best Practices

### 7.1 Firewall Setup
```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 7.2 SSL Certificate (Opsional)
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Dapatkan SSL certificate
sudo certbot --nginx -d your-domain.com
```

## 🚀 Production Checklist

### ✅ Pre-deployment
- [ ] Database schema imported
- [ ] Environment variables configured
- [ ] Dependencies installed
- [ ] PM2 configured
- [ ] Nginx reverse proxy setup
- [ ] Firewall configured

### ✅ Deployment
- [ ] Application started with PM2
- [ ] Nginx configured and running
- [ ] SSL certificate installed (jika digunakan)
- [ ] Frontend environment variables updated
- [ ] API endpoints tested

### ✅ Post-deployment
- [ ] Monitoring setup
- [ ] Backup procedures documented
- [ ] Performance monitoring
- [ ] Error logging configured

## 🆘 Troubleshooting

### Common Issues:

**1. MySQL Connection Failed**
```bash
# Check if MySQL is running
sudo systemctl status mysql

# Check credentials in .env
# Check MySQL user privileges
```

**2. PM2 Application Not Starting**
```bash
# Check PM2 logs
pm2 logs

# Check error details
pm2 show pembayarankampus-api
```

**3. Nginx Proxy Issues**
```bash
# Test Nginx configuration
sudo nginx -t

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

**4. CORS Issues**
CORS sudah dikonfigurasi di auth_server.js, tetapi pastikan header di Nginx proxy juga benar.

## 📊 Monitoring Commands

```bash
# Lihat status semua aplikasi
pm2 status

# Lihat log real-time
pm2 logs --lines 100

# Restart aplikasi
pm2 restart pembayarankampus-api

# Lihat statistik sistem
pm2 monit
```