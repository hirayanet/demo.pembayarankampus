const fetch = require('node-fetch');
const bcrypt = require('bcrypt');

const API_BASE = 'http://localhost:3001';

async function testPasswordResetLogic() {
  console.log('🔐 Testing Password Reset Logic...\n');
  
  try {
    // 1. Create a new student
    console.log('1. Creating a new student...');
    
    const adminToken = await getAdminToken();
    
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
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(newStudent)
    });
    
    if (!createResponse.ok) {
      const error = await createResponse.json();
      throw new Error(`Failed to create student: ${error.error}`);
    }
    
    const createdStudent = await createResponse.json();
    console.log('   ✅ Student created successfully');
    console.log('   🎓 Name:', createdStudent.name);
    console.log('   📧 Email:', createdStudent.email);
    
    // 2. Try to login with default password
    console.log('\n2. Testing login with default password...');
    
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: newStudent.email,
        password: 'kamal123'
      })
    });
    
    const loginResult = await loginResponse.json();
    
    if (loginResult.mustChangePassword) {
      console.log('   ✅ Login successful with mustChangePassword flag');
      console.log('   🔄 User needs to change password on first login');
      
      // 3. Test changing password
      console.log('\n3. Testing password change...');
      
      // Save the token for password change
      if (loginResult.token) {
        console.log('   ⚠️  Unexpected token in mustChangePassword response');
      }
      
      // Simulate frontend behavior - login again with new password after change
      const changePasswordResponse = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}` // Using admin token as we don't have user token
        },
        body: JSON.stringify({
          currentPassword: 'kamal123',
          newPassword: 'newpassword123'
        })
      });
      
      if (changePasswordResponse.ok) {
        console.log('   ✅ Password changed successfully (simulated)');
        
        // 4. Test login with new password
        console.log('\n4. Testing login with new password...');
        
        const newLoginResponse = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: newStudent.email,
            password: 'newpassword123'
          })
        });
        
        const newLoginResult = await newLoginResponse.json();
        
        if (newLoginResult.token && !newLoginResult.mustChangePassword) {
          console.log('   ✅ Login successful with new password');
          console.log('   🎫 Token received:', newLoginResult.token.substring(0, 20) + '...');
        } else {
          console.log('   ❌ Login failed with new password');
          console.log('   📄 Response:', JSON.stringify(newLoginResult, null, 2));
        }
      } else {
        const error = await changePasswordResponse.json();
        console.log('   ❌ Password change failed:', error.error);
      }
    } else {
      console.log('   ❌ Login did not return mustChangePassword flag');
      console.log('   📄 Response:', JSON.stringify(loginResult, null, 2));
    }
    
    console.log('\n🎉 Password reset logic test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function getAdminToken() {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'admin@kampus.edu',
      password: 'admin123'
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to get admin token');
  }
  
  const data = await response.json();
  return data.token;
}

testPasswordResetLogic();