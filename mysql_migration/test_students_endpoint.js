const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001';

async function getAuthToken() {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@kampus.edu',
      password: 'admin123'
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to get auth token');
  }
  
  const data = await response.json();
  return data.token;
}

async function testStudentsEndpoint() {
  console.log('🧪 Testing Students Endpoint Specifically...\n');
  
  try {
    // Get auth token
    console.log('🔐 Getting auth token...');
    const token = await getAuthToken();
    console.log('   ✅ Token obtained\n');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Test 1: GET /api/students/all
    console.log('1. Testing GET /api/students/all...');
    const allResponse = await fetch(`${API_BASE}/api/students/all`, { headers });
    console.log('   Status:', allResponse.status);
    console.log('   Status Text:', allResponse.statusText);
    
    if (allResponse.ok) {
      const allData = await allResponse.json();
      console.log('   ✅ Success!');
      console.log('   📊 Response type:', typeof allData);
      console.log('   📊 Is Array:', Array.isArray(allData));
      console.log('   📊 Length:', allData?.length);
      console.log('   📄 Raw response:', JSON.stringify(allData, null, 2));
    } else {
      const errorText = await allResponse.text();
      console.log('   ❌ Error response:', errorText);
    }

    // Test 2: GET /api/students (paginated)
    console.log('\n2. Testing GET /api/students (paginated)...');
    const pagedResponse = await fetch(`${API_BASE}/api/students?page=1&pageSize=5`, { headers });
    console.log('   Status:', pagedResponse.status);
    
    if (pagedResponse.ok) {
      const pagedData = await pagedResponse.json();
      console.log('   ✅ Success!');
      console.log('   📊 Response structure:', {
        hasData: 'data' in pagedData,
        hasTotal: 'total' in pagedData,
        dataType: typeof pagedData.data,
        dataLength: pagedData.data?.length,
        total: pagedData.total
      });
      console.log('   📄 Raw response:', JSON.stringify(pagedData, null, 2));
    } else {
      const errorText = await pagedResponse.text();
      console.log('   ❌ Error response:', errorText);
    }

    // Test 3: Check if auth server logs show anything
    console.log('\n3. Testing with query parameters...');
    const queryResponse = await fetch(`${API_BASE}/api/students/all?status=active`, { headers });
    console.log('   Status:', queryResponse.status);
    
    if (queryResponse.ok) {
      const queryData = await queryResponse.json();
      console.log('   ✅ Query with status=active success!');
      console.log('   📊 Length:', queryData?.length);
    } else {
      const errorText = await queryResponse.text();
      console.log('   ❌ Query error:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testStudentsEndpoint();