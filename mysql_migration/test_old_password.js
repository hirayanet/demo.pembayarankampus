const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001';

async function testOldPassword() {
  console.log('🔐 Testing Old Password Rejection...\n');
  
  try {
    // Try to login with the old default password
    console.log('1. Attempting login with old password...');
    
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test1756731036726@kampus.edu',
        password: 'kamal123'
      })
    });
    
    console.log('   📡 Response status:', loginResponse.status);
    
    const loginData = await loginResponse.json();
    console.log('   📄 Response data:', JSON.stringify(loginData, null, 2));
    
    if (loginResponse.ok) {
      console.log('   ❌ Login with old password succeeded (should have failed)');
    } else {
      console.log('   ✅ Login with old password correctly rejected');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('   📄 Stack:', error.stack);
  }
}

testOldPassword();