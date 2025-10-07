# ✅ Production Deployment Checklist

## 🔧 Server Configuration

### ✅ VPS Setup
- [ ] Ubuntu 20.04 atau lebih baru terinstall
- [ ] Firewall dikonfigurasi (ufw)
- [ ] SSH key authentication aktif
- [ ] Automatic security updates diaktifkan

### ✅ Database Setup
- [ ] MySQL 8.0+ terinstall
- [ ] Database `pembayarankampus` dibuat
- [ ] User `adminkampus` dengan password kuat dibuat
- [ ] Schema diimport dari `schema_mysql.sql`
- [ ] Backup rutin dikonfigurasi

### ✅ Node.js Setup
- [ ] Node.js 16+ terinstall
- [ ] npm terinstall
- [ ] PM2 terinstall secara global
- [ ] Dependencies aplikasi diinstall

### ✅ Web Server Setup
- [ ] Nginx terinstall
- [ ] Reverse proxy dikonfigurasi
- [ ] SSL certificate diinstal (opsional)
- [ ] Gzip compression diaktifkan

## 🔐 Security Configuration

### ✅ Firewall Rules
- [ ] Port 22 (SSH) terbuka
- [ ] Port 80 (HTTP) terbuka
- [ ] Port 443 (HTTPS) terbuka (jika menggunakan SSL)
- [ ] Port 3306 (MySQL) diblokir dari public access
- [ ] Rate limiting diaktifkan

### ✅ Application Security
- [ ] Environment variables dikonfigurasi dengan benar
- [ ] JWT secret diganti dengan nilai yang kuat
- [ ] CORS policy dikonfigurasi dengan benar
- [ ] Input validation diaktifkan untuk semua endpoint

### ✅ Database Security
- [ ] MySQL root password diganti
- [ ] Remote access ke MySQL dinonaktifkan
- [ ] Regular user digunakan untuk aplikasi (bukan root)
- [ ] SQL injection protection diaktifkan

## 🚀 Application Deployment

### ✅ Code Deployment
- [ ] Kode terbaru diupload ke VPS
- [ ] Environment variables dikonfigurasi
- [ ] PM2 ecosystem file dikonfigurasi
- [ ] Aplikasi dijalankan dengan PM2

### ✅ Service Configuration
- [ ] PM2 startup script diaktifkan
- [ ] Nginx virtual host dikonfigurasi
- [ ] SSL certificate diinstal (jika digunakan)
- [ ] Custom error pages dikonfigurasi

### ✅ Monitoring Setup
- [ ] Log rotation dikonfigurasi
- [ ] Health check endpoint diaktifkan
- [ ] Monitoring script dibuat
- [ ] Alerting system dikonfigurasi

## 🧪 Testing

### ✅ Functional Testing
- [ ] Authentication works (login/logout)
- [ ] Student CRUD operations
- [ ] Bill CRUD operations
- [ ] Payment CRUD operations
- [ ] Report generation
- [ ] File upload/download

### ✅ Performance Testing
- [ ] Response time < 2 seconds
- [ ] Database queries optimized
- [ ] Caching diaktifkan (jika diperlukan)
- [ ] Load testing dilakukan

### ✅ Security Testing
- [ ] SQL injection testing
- [ ] XSS testing
- [ ] CSRF protection
- [ ] Rate limiting works

## 📊 Monitoring & Maintenance

### ✅ Monitoring Tools
- [ ] PM2 monitoring aktif
- [ ] Nginx logs dipantau
- [ ] MySQL logs dipantau
- [ ] Custom metrics dikumpulkan

### ✅ Backup Strategy
- [ ] Database backup harian
- [ ] Code backup mingguan
- [ ] Backup retention policy
- [ ] Backup restoration testing

### ✅ Maintenance Procedures
- [ ] Update schedule ditentukan
- [ ] Patch management process
- [ ] Incident response plan
- [ ] Disaster recovery plan

## 🌐 Frontend Integration

### ✅ Vercel Configuration
- [ ] Environment variable `VITE_API_BASE_URL` diatur
- [ ] Custom domain dikonfigurasi
- [ ] SSL certificate aktif
- [ ] CDN diaktifkan

### ✅ API Integration Testing
- [ ] Login from frontend works
- [ ] Data loading works
- [ ] Form submissions work
- [ ] File uploads work

## 📋 Documentation

### ✅ Technical Documentation
- [ ] API documentation updated
- [ ] Deployment guide completed
- [ ] Troubleshooting guide
- [ ] Monitoring procedures

### ✅ Operational Documentation
- [ ] Backup procedures
- [ ] Recovery procedures
- [ ] Scaling procedures
- [ ] Maintenance windows

## 🚨 Emergency Procedures

### ✅ Rollback Plan
- [ ] Previous version backup tersedia
- [ ] Database rollback procedure
- [ ] Quick restore process
- [ ] Communication plan

### ✅ Incident Response
- [ ] Contact information tim
- [ ] Escalation procedures
- [ ] Post-mortem process
- [ ] Communication templates

## ✅ Final Verification

### ✅ Pre-Launch Checklist
- [ ] All checkboxes above completed
- [ ] Final testing performed
- [ ] Stakeholder approval obtained
- [ ] Go-live plan confirmed

### ✅ Post-Launch Monitoring
- [ ] 24-hour monitoring schedule
- [ ] Performance metrics tracking
- [ ] User feedback collection
- [ ] Issue resolution process

---

📝 **Catatan**: Checklist ini harus diisi dan diverifikasi sebelum produksi deployment. Setiap item yang tidak dapat diselesaikan harus didokumentasikan dengan alasan dan rencana penyelesaian.