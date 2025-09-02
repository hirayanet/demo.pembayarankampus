const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001';

async function testStudentLogin() {
  console.log('🔐 Testing Student Login with Default Password...\n');
  
  try {
    // Try to login with the default password
    console.log('1. Logging in with default password...');
    
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
      if (loginData.mustChangePassword) {
        console.log('   ✅ Login successful with mustChangePassword flag!');
        console.log('   🔄 User needs to change password on first login');
        
        // Test changing password
        console.log('\n2. Testing password change...');
        
        // For this test, we'll simulate what the frontend would do
        // In a real scenario, the frontend would show the password change form
        console.log('   ℹ️  In a real application, the frontend would now show the password change form');
        console.log('   ℹ️  User would enter a new password and submit it to /auth/change-password');
        
      } else {
        console.log('   ⚠️  Login successful but mustChangePassword flag is missing');
      }
    } else {
      console.log('   ❌ Login failed');
      console.log('   📄 Error:', loginData.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('   📄 Stack:', error.stack);
  }
}

testStudentLogin();