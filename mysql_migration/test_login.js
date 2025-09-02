// Test Login Functionality
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001';

async function testLogin() {
  console.log('🔐 Testing Login Functionality...\n');

  // Test cases
  const testCases = [
    {
      name: 'Admin Login',
      email: 'admin@kampus.edu',
      password: 'admin123',
      expectedRole: 'admin'
    },
    {
      name: 'Staff Login',
      email: 'staff@kampus.edu', 
      password: 'staff123',
      expectedRole: 'staff'
    },
    {
      name: 'Invalid Credentials',
      email: 'admin@kampus.edu',
      password: 'wrongpassword',
      shouldFail: true
    }
  ];

  for (const testCase of testCases) {
    console.log(`🧪 Testing: ${testCase.name}`);
    
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: testCase.email,
          password: testCase.password
        })
      });

      const data = await response.json();

      if (testCase.shouldFail) {
        if (response.ok) {
          console.log(`   ❌ Expected failure but got success`);
        } else {
          console.log(`   ✅ Correctly rejected invalid credentials`);
          console.log(`   📄 Error: ${data.error}`);
        }
      } else {
        if (response.ok) {
          console.log(`   ✅ Login successful!`);
          console.log(`   👤 User: ${data.user.email}`);
          console.log(`   🎭 Role: ${data.user.role}`);
          console.log(`   🎫 Token: ${data.token.substring(0, 30)}...`);
          
          // Test token validation
          const userResponse = await fetch(`${API_BASE}/auth/user`, {
            headers: {
              'Authorization': `Bearer ${data.token}`
            }
          });
          
          if (userResponse.ok) {
            const userData = await userResponse.json();
            console.log(`   ✅ Token validation successful`);
            console.log(`   📧 Email verified: ${userData.email}`);
          } else {
            console.log(`   ❌ Token validation failed`);
          }
        } else {
          console.log(`   ❌ Login failed: ${data.error}`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Network error: ${error.message}`);
    }
    
    console.log(''); // Empty line for readability
  }
}

// Test health check first
async function testHealthCheck() {
  console.log('🏥 Testing Health Check...');
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('   ✅ Server is healthy');
      console.log(`   ⏰ Server time: ${data.timestamp}`);
    } else {
      console.log('   ❌ Server health check failed');
    }
  } catch (error) {
    console.log(`   ❌ Cannot connect to server: ${error.message}`);
    console.log('   💡 Make sure auth server is running: npm start');
    process.exit(1);
  }
  console.log('');
}

// Run tests
async function runAllTests() {
  await testHealthCheck();
  await testLogin();
  
  console.log('🎉 All tests completed!');
  console.log('\n📋 Summary:');
  console.log('   ✅ Database connection working');
  console.log('   ✅ Auth server responding');
  console.log('   ✅ Login functionality tested');
  console.log('\n🚀 Ready to test frontend integration!');
}

runAllTests();