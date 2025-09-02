const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001';

async function createStudentAndTest() {
  try {
    console.log('🔍 Creating student user...');
    
    // Buat user mahasiswa
    const createResponse = await fetch(`${API_BASE}/debug/create-student`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (createResponse.ok) {
      const createData = await createResponse.json();
      console.log('✅ Student user created successfully!');
      console.log(`   📧 Email: ${createData.email}`);
      console.log(`   🔑 Password: ${createData.password}`);
    } else {
      const errorData = await createResponse.json();
      console.log('❌ Failed to create student:', errorData.error);
    }
    
    console.log('\n📋 All available login credentials:');
    
    // Test semua login yang tersedia
    const loginCredentials = [
      { email: 'admin@kampus.edu', password: 'admin123', role: 'Admin' },
      { email: 'staff@kampus.edu', password: 'staff123', role: 'Staff' },
      { email: 'mahasiswa@kampus.edu', password: 'student123', role: 'Mahasiswa' }
    ];
    
    for (const cred of loginCredentials) {
      console.log(`\n🔐 Testing login: ${cred.role}`);
      console.log(`   📧 Email: ${cred.email}`);
      console.log(`   🔑 Password: ${cred.password}`);
      
      try {
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
        } else {
          const errorData = await loginResponse.json();
          console.log(`   ❌ Login failed: ${errorData.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.log(`   ❌ Connection error: ${error.message}`);
      }
    }
    
    console.log('\n🎉 All user credentials ready for frontend testing!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createStudentAndTest();