const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001';

async function testPasswordChange() {
  console.log('🔐 Testing Password Change Flow...\n');
  
  try {
    // 1. Login with default password to get the mustChangePassword response
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
    
    const loginData = await loginResponse.json();
    
    if (!loginResponse.ok || !loginData.mustChangePassword) {
      console.log('   ❌ Failed to get mustChangePassword flag');
      return;
    }
    
    console.log('   ✅ Login successful with mustChangePassword flag');
    
    // 2. Change password using the change-password endpoint
    console.log('\n2. Changing password...');
    
    const changePasswordResponse = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test1756731036726@kampus.edu',
        currentPassword: 'kamal123',
        newPassword: 'newpassword123'
      })
    });
    
    console.log('   📡 Response status:', changePasswordResponse.status);
    
    const changePasswordData = await changePasswordResponse.json();
    console.log('   📄 Response data:', JSON.stringify(changePasswordData, null, 2));
    
    if (changePasswordResponse.ok) {
      console.log('   ✅ Password changed successfully!');
      
      // 3. Try to login with the new password
      console.log('\n3. Logging in with new password...');
      
      const newLoginResponse = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'test1756731036726@kampus.edu',
          password: 'newpassword123'
        })
      });
      
      console.log('   📡 New login response status:', newLoginResponse.status);
      
      const newLoginData = await newLoginResponse.json();
      console.log('   📄 New login response data:', JSON.stringify(newLoginData, null, 2));
      
      if (newLoginResponse.ok && newLoginData.token && !newLoginData.mustChangePassword) {
        console.log('   ✅ Login successful with new password!');
        console.log('   🎫 Token received:', newLoginData.token.substring(0, 20) + '...');
      } else {
        console.log('   ❌ Login with new password failed');
      }
    } else {
      console.log('   ❌ Password change failed');
      console.log('   📄 Error:', changePasswordData.error);
    }
    
    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testPasswordChange();