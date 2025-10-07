# 📚 API Documentation

## 🔐 Authentication

### POST `/auth/login`
Login dengan email dan password untuk mendapatkan JWT token.

**Request:**
```json
{
  "email": "admin@kampus.edu",
  "password": "admin123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "admin@kampus.edu",
    "full_name": "Admin Kampus",
    "role": "admin"
  }
}
```

### POST `/auth/register` (Testing Only)
Registrasi user baru untuk testing.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "User Name",
  "role": "student"
}
```

### GET `/auth/user`
Mendapatkan informasi user yang sedang login.

**Headers:**
```
Authorization: Bearer <token>
```

## 👥 Users Management

### POST `/api/admins`
Membuat user admin atau staff (hanya untuk admin).

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "email": "staff@kampus.edu",
  "role": "staff"
}
```

### GET `/api/users/admins-staff`
Mendapatkan daftar semua admin dan staff (hanya untuk admin).

**Headers:**
```
Authorization: Bearer <token>
```

### DELETE `/api/admins/:id`
Menghapus user admin atau staff (hanya untuk admin).

**Headers:**
```
Authorization: Bearer <token>
```

## 🎓 Students Management

### GET `/api/students`
Mendapatkan daftar students dengan pagination.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Nomor halaman (default: 1)
- `pageSize` (optional): Jumlah item per halaman (default: 50)
- `search` (optional): Pencarian berdasarkan nama, NIM, atau email
- `status` (optional): Filter berdasarkan status (active, inactive, graduated)
- `prodi` (optional): Filter berdasarkan program studi
- `angkatan` (optional): Filter berdasarkan angkatan

### GET `/api/students/:id`
Mendapatkan detail student berdasarkan ID.

**Headers:**
```
Authorization: Bearer <token>
```

### POST `/api/students`
Membuat student baru.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "nim_kashif": "2024001",
  "nim_dikti": "NIM-DIKTI-001",
  "name": "Mahasiswa Test",
  "email": "student@kampus.edu",
  "phone": "08123456789",
  "prodi": "Teknik Informatika",
  "angkatan": "2024",
  "address": "Alamat Mahasiswa",
  "status": "active",
  "program_id": 1
}
```

### PUT `/api/students/:id`
Memperbarui data student.

**Headers:**
```
Authorization: Bearer <token>
```

### DELETE `/api/students/:id`
Menghapus student.

**Headers:**
```
Authorization: Bearer <token>
```

## 💰 Bills Management

### GET `/api/bills`
Mendapatkan daftar bills dengan pagination.

**Headers:**
```
Authorization: Bearer <token>
```

### GET `/api/bills/:id`
Mendapatkan detail bill berdasarkan ID.

**Headers:**
```
Authorization: Bearer <token>
```

### POST `/api/bills`
Membuat bill baru.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "student_id": 1,
  "category": "SPP",
  "description": "Semester Pendek 2024/2025",
  "amount": 5000000,
  "due_date": "2025-12-31",
  "status": "unpaid",
  "installment_count": 2,
  "installment_amount": 2500000,
  "category_id": 1
}
```

### PUT `/api/bills/:id`
Memperbarui data bill.

**Headers:**
```
Authorization: Bearer <token>
```

### DELETE `/api/bills/:id`
Menghapus bill.

**Headers:**
```
Authorization: Bearer <token>
```

## 💳 Payments Management

### GET `/api/payments`
Mendapatkan daftar payments dengan pagination.

**Headers:**
```
Authorization: Bearer <token>
```

### GET `/api/payments/:id`
Mendapatkan detail payment berdasarkan ID.

**Headers:**
```
Authorization: Bearer <token>
```

### POST `/api/payments`
Membuat payment baru.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "student_id": 1,
  "bill_id": 1,
  "amount": 2500000,
  "payment_date": "2025-10-07",
  "payment_method": "Transfer Bank",
  "receipt_number": "KW-20251007-001",
  "notes": "Pembayaran cicilan pertama",
  "status": "completed"
}
```

### PUT `/api/payments/:id`
Memperbarui data payment.

**Headers:**
```
Authorization: Bearer <token>
```

### DELETE `/api/payments/:id`
Menghapus payment.

**Headers:**
```
Authorization: Bearer <token>
```

## 📊 Reports & Analytics

### GET `/api/reports/statistics`
Mendapatkan statistik keseluruhan.

**Headers:**
```
Authorization: Bearer <token>
```

### GET `/api/reports/monthly-income`
Mendapatkan data pendapatan bulanan.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `months` (optional): Jumlah bulan (default: 6)

### GET `/api/reports/payment-methods`
Mendapatkan distribusi metode pembayaran.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `days` (optional): Jumlah hari (default: 30)

### GET `/api/reports/top-programs`
Mendapatkan program studi dengan pendapatan tertinggi.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Jumlah program (default: 5)
- `days` (optional): Jumlah hari (default: 30)

## 🏫 Programs Management

### GET `/api/programs`
Mendapatkan daftar program studi.

**Headers:**
```
Authorization: Bearer <token>
```

### POST `/api/programs`
Membuat program studi baru.

**Headers:**
```
Authorization: Bearer <token>
```

### PUT `/api/programs/:id`
Memperbarui program studi.

**Headers:**
```
Authorization: Bearer <token>
```

### DELETE `/api/programs/:id`
Menghapus program studi.

**Headers:**
```
Authorization: Bearer <token>
```

## 📂 Bill Categories

### GET `/api/bill-categories`
Mendapatkan daftar kategori tagihan.

**Headers:**
```
Authorization: Bearer <token>
```

### POST `/api/bill-categories`
Membuat kategori tagihan baru.

**Headers:**
```
Authorization: Bearer <token>
```

### PUT `/api/bill-categories/:id`
Memperbarui kategori tagihan.

**Headers:**
```
Authorization: Bearer <token>
```

### DELETE `/api/bill-categories/:id`
Menghapus kategori tagihan.

**Headers:**
```
Authorization: Bearer <token>
```

## 🛠️ Debugging Endpoints

### POST `/debug/reset-admin`
Reset user admin (untuk testing).

### POST `/debug/create-student`
Buat user student (untuk testing).

### GET `/debug/users`
Lihat semua user (untuk debugging).