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

async function testTopProgramsEndpoint() {
  console.log('🏆 Testing ONLY Top Programs API Endpoint...\n');
  
  try {
    // Get auth token
    console.log('🔐 Getting auth token...');
    const token = await getAuthToken();
    console.log('   ✅ Token obtained\n');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Test: GET /api/reports/top-programs
    console.log('🏆 Testing: GET /api/reports/top-programs');
    try {
      console.log('Making request to:', `${API_BASE}/api/reports/top-programs?limit=5&days=30`);
      
      const programsResponse = await fetch(`${API_BASE}/api/reports/top-programs?limit=5&days=30`, { headers });
      
      console.log('Response status:', programsResponse.status);
      console.log('Response headers:', programsResponse.headers.raw());
      
      if (programsResponse.ok) {
        const programsData = await programsResponse.json();
        console.log('   ✅ SUCCESS!');
        console.log('   🎓 Top Programs Response:');
        console.log(JSON.stringify(programsData, null, 2));
        
        programsData.forEach((program, index) => {
          console.log(`      ${index + 1}. ${program.prodi}:`);
          console.log(`         Students: ${program.students}`);
          console.log(`         Revenue: Rp ${program.revenue?.toLocaleString()}`);
        });
      } else {
        const errorData = await programsResponse.json();
        console.log('   ❌ HTTP Error:', programsResponse.status, programsResponse.statusText);
        console.log('   ❌ Error Response:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
      console.log('   ❌ Error stack:', error.stack);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testTopProgramsEndpoint();