# 🚀 Panduan Testing Migrasi MySQL di Laragon

## 📋 Prerequisites
- ✅ Laragon sudah terinstall
- ✅ MySQL enabled di Laragon  
- ✅ Node.js terinstall

## 🔧 Step 1: Setup Database di Laragon

### 1.1 Start MySQL di Laragon
```bash
# Buka Laragon
# Klik Start All atau Start MySQL
# Pastikan MySQL running di port 3306
```

### 1.2 Import Schema MySQL
```bash
# Buka phpMyAdmin di browser: http://localhost/phpmyadmin
# Atau gunakan MySQL Command Line

# Via Command Line:
mysql -u root -p
CREATE DATABASE pembayaran_kampus_local;
exit

# Import schema:
mysql -u root -p pembayaran_kampus_local < mysql_migration/schema_mysql.sql
```

### 1.3 Verifikasi Database
```sql
USE pembayaran_kampus_local;
SHOW TABLES;
SELECT * FROM users;
SELECT * FROM students;
```

## 🔐 Step 2: Setup Authentication Server

### 2.1 Install Dependencies Auth Server
```bash
cd mysql_migration
npm install
```

### 2.2 Setup Environment Variables
```bash
# Copy environment file
copy .env.example .env

# Edit .env file sesuai konfigurasi Laragon:
# DB_HOST=localhost
# DB_USER=root  
# DB_PASSWORD=    (kosong untuk default Laragon)
# DB_NAME=pembayaran_kampus_local
# DB_PORT=3306
```

### 2.3 Start Authentication Server
```bash
# Development mode
npm run dev

# atau normal mode
npm start

# Server akan berjalan di: http://localhost:3001
```

### 2.4 Test Authentication Server
```bash
# Test health check
curl http://localhost:3001/health

# Test database connection
curl http://localhost:3001/test-db
```

## 🔄 Step 3: Update Frontend Application

### 3.1 Install Additional Dependencies
```bash
# Kembali ke root project
cd ..
npm install axios  # untuk HTTP client jika diperlukan
```

### 3.2 Add Environment Variables untuk Frontend
```bash
# Edit .env.local (atau buat baru)
echo "VITE_API_BASE_URL=http://localhost:3001" >> .env.local
```

### 3.3 Update Import di App.tsx (Temporary)
```typescript
// Backup original supabase import
// import { supabase, dbService } from './lib/supabase';

// Use MySQL version for testing
import { dbService, authService } from './lib/mysql';
```

## 🧪 Step 4: Testing Scenarios

### 4.1 Test Authentication
1. Buka aplikasi: `npm run dev`
2. Login dengan:
   - Email: `admin@kampus.edu`
   - Password: `password` (default dari schema)

### 4.2 Test Basic CRUD Operations
1. **Students Management**
   - Create new student
   - View student list
   - Update student data
   - Delete student

2. **Bills Management**
   - Create new bill
   - View bills list  
   - Update bill status
   - Delete bill

3. **Payments Management**
   - Record payment
   - View payment history
   - Generate receipt

### 4.3 Test Performance
1. **Load Test with Sample Data**
```sql
-- Insert sample data untuk testing performa
INSERT INTO students (uuid, nim_kashif, name, email, prodi, angkatan) 
SELECT 
    UUID(),
    CONCAT('2024', LPAD(ROW_NUMBER() OVER(), 3, '0')),
    CONCAT('Student Test ', ROW_NUMBER() OVER()),
    CONCAT('student', ROW_NUMBER() OVER(), '@test.edu'),
    'Teknik Informatika',
    '2024'
FROM information_schema.tables 
LIMIT 1000;
```

2. **Compare Response Times**
   - Record time untuk query besar
   - Compare dengan Supabase performance

## 🔍 Step 5: Validation Checklist

### ✅ Functionality Tests
- [ ] Login/Logout works
- [ ] Student CRUD operations
- [ ] Bill CRUD operations  
- [ ] Payment CRUD operations
- [ ] Search functionality
- [ ] Filtering and pagination
- [ ] Receipt generation
- [ ] Export functionality

### ✅ Performance Tests  
- [ ] Page load times
- [ ] Query response times
- [ ] Large dataset handling
- [ ] Concurrent user simulation

### ✅ Data Integrity Tests
- [ ] Foreign key constraints
- [ ] Data validation
- [ ] Transaction handling
- [ ] Backup/restore procedures

## 🐛 Troubleshooting

### Common Issues:

**1. MySQL Connection Failed**
```bash
# Check if MySQL is running
netstat -an | findstr 3306

# Restart MySQL di Laragon
# Atau check credentials di .env
```

**2. CORS Issues**
```javascript
// Auth server sudah include cors middleware
// Jika masih ada masalah, check browser console
```

**3. Authentication Token Issues**
```javascript
// Clear localStorage
localStorage.clear();

// Check token expiry in browser DevTools
```

**4. Database Query Errors**
```sql
-- Check table structure
DESCRIBE table_name;

-- Check data
SELECT * FROM table_name LIMIT 5;
```

## 📊 Step 6: Performance Comparison

### Create Simple Benchmark Script
```javascript
// benchmark.js - untuk compare performance

const testOperations = async () => {
  const start = performance.now();
  
  // Test operations here
  await dbService.getStudentsPaged({ page: 1, pageSize: 50 });
  
  const end = performance.now();
  console.log(`Operation took ${end - start} milliseconds`);
};
```

## 🎯 Expected Outcomes

Setelah testing selesai, Anda akan memiliki:

1. **Working prototype** dengan MySQL di localhost
2. **Performance benchmarks** MySQL vs Supabase  
3. **Identified challenges** untuk production migration
4. **Cost estimation** untuk development effort
5. **Technical documentation** untuk production deployment

## 🚀 Next Steps

Jika testing berhasil:
1. Setup production environment di Hostinger
2. Implement complete API endpoints  
3. Add security enhancements
4. Setup automated backup
5. Plan production cutover

Apakah ingin melanjutkan ke step implementasi?