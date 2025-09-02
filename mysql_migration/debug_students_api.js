const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001';

// Login untuk mendapatkan token
async function getAuthToken() {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@kampus.edu',
      password: 'admin123'
    })
  });
  
  const data = await response.json();
  return data.token;
}

async function debugStudentsAPI() {
  console.log('🔍 Debug Students API...\n');
  
  try {
    // Get auth token
    console.log('🔐 Getting auth token...');
    const token = await getAuthToken();
    console.log('   ✅ Token obtained\n');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Test paginated endpoint with detailed response
    console.log('📋 Testing GET /api/students?page=1&pageSize=5');
    const studentsResponse = await fetch(`${API_BASE}/api/students?page=1&pageSize=5`, { headers });
    const studentsData = await studentsResponse.json();
    console.log('   Raw response:', JSON.stringify(studentsData, null, 2));
    console.log('');

    // Test create student with detailed error
    console.log('➕ Testing POST /api/students with detailed error...');
    const newStudent = {
      nim_kashif: 'TESTDEBUG001',
      nim_dikti: '12345678901',
      name: 'Test Student API Debug',
      email: 'test.debug@student.kampus.edu',
      phone: '081234567890',
      prodi: 'Teknik Informatika',
      angkatan: '2024',
      address: 'Jl. Test API Debug No. 1',
      status: 'active'
    };
    
    console.log('   Request body:', JSON.stringify(newStudent, null, 2));
    
    const createResponse = await fetch(`${API_BASE}/api/students`, {
      method: 'POST',
      headers,
      body: JSON.stringify(newStudent)
    });
    
    console.log('   Response status:', createResponse.status);
    console.log('   Response headers:', Object.fromEntries(createResponse.headers.entries()));
    
    const responseData = await createResponse.json();
    console.log('   Response data:', JSON.stringify(responseData, null, 2));

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }

  console.log('\n🎉 Debug Complete!');
}

debugStudentsAPI();