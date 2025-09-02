const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001';

async function createAndTestStudentLogin() {
  try {
    console.log('🔍 Checking current users...');
    
    // Cek users yang ada
    const usersResponse = await fetch(`${API_BASE}/debug/users`);
    const users = await usersResponse.json();
    
    console.log('📋 Current users:');
    users.forEach(user => {
      console.log(`   - ${user.email} (${user.role}) - ${user.full_name}`);
    });
    
    // Cek apakah sudah ada user student
    const hasStudent = users.some(user => user.role === 'student');
    
    if (!hasStudent) {
      console.log('\n➕ Creating student user...');
      
      // Buat user student menggunakan SQL manual
      // Untuk sementara, mari test dengan user admin dulu
      console.log('⚠️  Belum ada user student. Mari test login yang ada dulu.');
    } else {
      console.log('\n✅ Student user already exists!');
    }
    
    // Test login untuk semua user yang ada
    console.log('\n🧪 Testing login for all users...');
    
    const loginCredentials = [
      { email: 'admin@kampus.edu', password: 'admin123', role: 'admin' },
      { email: 'staff@kampus.edu', password: 'staff123', role: 'staff' },
      { email: 'mahasiswa@kampus.edu', password: 'student123', role: 'student' }
    ];
    
    for (const cred of loginCredentials) {
      try {
        console.log(`\n🔐 Testing login: ${cred.email}`);
        
        const loginResponse = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cred.email,
            password: cred.password
          })
        });
        
        if (loginResponse.ok) {
          const loginData = await loginResponse.json();
          console.log(`   ✅ Login successful! Role: ${loginData.user.role}`);
          console.log(`   📧 Email: ${cred.email}`);
          console.log(`   🔑 Password: ${cred.password}`);
        } else {
          const errorData = await loginResponse.json();
          console.log(`   ❌ Login failed: ${errorData.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.log(`   ❌ Connection error: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createAndTestStudentLogin();