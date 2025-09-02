const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001';

async function testCreateStudent() {
  console.log('🧪 Testing Student Creation...\n');
  
  try {
    // 1. Get admin token first
    console.log('1. Getting admin token...');
    
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@kampus.edu',
        password: 'admin123'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed with status ${loginResponse.status}`);
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    
    console.log('   ✅ Admin token obtained');
    console.log('   🎫 Token:', token.substring(0, 30) + '...');
    
    // 2. Create a new student
    console.log('\n2. Creating a new student...');
    
    const newStudent = {
      nim_kashif: 'NIM' + Date.now(),
      name: 'Test Student ' + Date.now(),
      email: 'test' + Date.now() + '@kampus.edu',
      prodi: 'Teknik Informatika',
      angkatan: '2025',
      phone: '08123456789',
      address: 'Jl. Test No. 123'
    };
    
    const createResponse = await fetch(`${API_BASE}/api/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newStudent)
    });
    
    console.log('   📡 Response status:', createResponse.status);
    
    const createData = await createResponse.json();
    console.log('   📄 Response data:', JSON.stringify(createData, null, 2));
    
    if (createResponse.ok) {
      console.log('   ✅ Student created successfully!');
      console.log('   🎓 Name:', createData.name);
      console.log('   📧 Email:', createData.email);
    } else {
      console.log('   ❌ Failed to create student');
      console.log('   📄 Error:', createData.error);
      if (createData.details) {
        console.log('   📄 Details:', createData.details);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('   📄 Stack:', error.stack);
  }
}

testCreateStudent();