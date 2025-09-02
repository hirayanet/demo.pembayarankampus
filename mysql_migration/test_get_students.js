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

async function testGetStudents() {
  console.log('🔍 Testing GET Students endpoints in detail...\n');
  
  try {
    // Get auth token
    console.log('🔐 Getting auth token...');
    const token = await getAuthToken();
    console.log('   ✅ Token obtained\n');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Test 1: GET /api/students/all (should work)
    console.log('📋 Test 1: GET /api/students/all');
    try {
      const allResponse = await fetch(`${API_BASE}/api/students/all`, { headers });
      console.log('   Status:', allResponse.status);
      
      if (allResponse.ok) {
        const allData = await allResponse.json();
        console.log('   ✅ Success! Found', allData.length, 'students');
        if (allData.length > 0) {
          console.log('   📝 First student:', {
            id: allData[0].id,
            name: allData[0].name,
            nim: allData[0].nim_kashif
          });
        }
      } else {
        const errorData = await allResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 2: GET /api/students (paginated)
    console.log('📋 Test 2: GET /api/students (paginated)');
    try {
      const pagedResponse = await fetch(`${API_BASE}/api/students?page=1&pageSize=5`, { headers });
      console.log('   Status:', pagedResponse.status);
      
      if (pagedResponse.ok) {
        const pagedData = await pagedResponse.json();
        console.log('   ✅ Success!');
        console.log('   📊 Response structure:', {
          total: pagedData.total,
          page: pagedData.page,
          pageSize: pagedData.pageSize,
          totalPages: pagedData.totalPages,
          dataCount: pagedData.data ? pagedData.data.length : 'undefined'
        });
      } else {
        const errorData = await pagedResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 3: GET /api/students/stats
    console.log('📊 Test 3: GET /api/students/stats');
    try {
      const statsResponse = await fetch(`${API_BASE}/api/students/stats`, { headers });
      console.log('   Status:', statsResponse.status);
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        console.log('   ✅ Success!');
        console.log('   📈 Stats:', statsData);
      } else {
        const errorData = await statsResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n🎉 Test Complete!');
}

testGetStudents();