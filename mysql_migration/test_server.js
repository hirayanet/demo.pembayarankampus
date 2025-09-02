const fetch = require('node-fetch');

async function testServer() {
  try {
    // Test health endpoint
    const healthResponse = await fetch('http://localhost:3001/health');
    const healthData = await healthResponse.json();
    console.log('Health check:', healthData);
    
    // Test login endpoint
    const loginResponse = await fetch('http://localhost:3001/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@kampus.edu',
        password: 'admin123'
      })
    });
    
    console.log('Login status:', loginResponse.status);
    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);
    
  } catch (error) {
    console.error('Error testing server:', error.message);
  }
}

testServer();