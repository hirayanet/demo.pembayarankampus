const axios = require('axios');

// Test script to verify payment API functionality
async function testPaymentAPI() {
  try {
    console.log('🔍 Testing Payment API...');
    
    // Test getting a specific payment by ID without authentication first to see the error
    const paymentId = '10'; // Use the ID from your error log
    console.log(`\n📋 Fetching payment with ID: ${paymentId} (without auth)`);
    
    try {
      const response = await axios.get(`http://localhost:3001/api/payments/${paymentId}`, {
        timeout: 5000
      });
      
      console.log('✅ Payment API Response (without auth):');
      console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log('❌ Payment API Error (without auth):');
      if (error.response) {
        // Server responded with error status
        console.log(`Status: ${error.response.status}`);
        console.log(`Data: ${JSON.stringify(error.response.data, null, 2)}`);
      } else if (error.request) {
        // Request was made but no response received
        console.log('No response received from server');
      } else {
        // Something else happened
        console.log('Error:', error.message);
      }
    }
    
    // Now try with authentication
    console.log('\n🔐 Attempting to login...');
    const loginResponse = await axios.post('http://localhost:3001/auth/login', {
      email: 'admin@example.com', // Ganti dengan email admin yang valid
      password: 'password123'     // Ganti dengan password yang valid
    }, {
      timeout: 5000
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    console.log(`Token: ${token.substring(0, 20)}...`);
    
    // Test getting a specific payment by ID with authentication
    console.log(`\n📋 Fetching payment with ID: ${paymentId} (with auth)`);
    
    try {
      const response = await axios.get(`http://localhost:3001/api/payments/${paymentId}`, {
        timeout: 5000,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ Payment API Response (with auth):');
      console.log(JSON.stringify(response.data, null, 2));
      
      // Check if response has required fields
      const requiredFields = ['id', 'amount', 'payment_date', 'payment_method'];
      const missingFields = requiredFields.filter(field => !(field in response.data));
      
      if (missingFields.length > 0) {
        console.log(`⚠️  Missing required fields: ${missingFields.join(', ')}`);
      } else {
        console.log('✅ All required fields present');
      }
    } catch (error) {
      console.log('❌ Payment API Error (with auth):');
      if (error.response) {
        // Server responded with error status
        console.log(`Status: ${error.response.status}`);
        console.log(`Data: ${JSON.stringify(error.response.data, null, 2)}`);
      } else if (error.request) {
        // Request was made but no response received
        console.log('No response received from server');
      } else {
        // Something else happened
        console.log('Error:', error.message);
      }
    }
    
  } catch (error) {
    console.log('❌ Login Error:');
    if (error.response) {
      // Server responded with error status
      console.log(`Status: ${error.response.status}`);
      console.log(`Data: ${JSON.stringify(error.response.data, null, 2)}`);
    } else if (error.request) {
      // Request was made but no response received
      console.log('No response received from server');
    } else {
      // Something else happened
      console.log('Error:', error.message);
    }
  }
  
  try {
    // Test getting all payments
    console.log('\n📋 Fetching all payments...');
    // We would also need to authenticate for this endpoint
    console.log('⚠️  Note: This endpoint also requires authentication');
  } catch (error) {
    console.log('❌ Error fetching all payments:');
    console.log(error.message);
  }
}

// Run the test
testPaymentAPI();