const axios = require('axios');

// Debug script to test the payment endpoint directly
async function debugPaymentEndpoint() {
  console.log('🔍 Debugging Payment Endpoint...\n');
  
  const API_BASE = 'http://localhost:3001';
  const paymentId = '10'; // ID from the error
  
  try {
    // 1. Test server health
    console.log('1. Testing server health...');
    try {
      const healthResponse = await axios.get(`${API_BASE}/health`, { timeout: 5000 });
      console.log('   ✅ Server is running');
      console.log('   📊 Health response:', healthResponse.data);
    } catch (error) {
      console.log('   ❌ Server health check failed');
      if (error.code === 'ECONNREFUSED') {
        console.log('   💡 Server is not running. Start with: npm run auth-server');
      } else {
        console.log('   💡 Error:', error.message);
      }
      return;
    }
    
    // 2. Try to get payment without auth (should fail)
    console.log(`\n2. Testing payment endpoint without auth (ID: ${paymentId})...`);
    try {
      const response = await axios.get(`${API_BASE}/api/payments/${paymentId}`, { timeout: 5000 });
      console.log('   ⚠️  Unexpected success without auth');
      console.log('   📊 Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      if (error.response) {
        console.log(`   ✅ Expected error: ${error.response.status}`);
        console.log('   📊 Error data:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.log('   ❌ Unexpected error:', error.message);
      }
    }
    
    // 3. Login to get auth token
    console.log('\n3. Logging in to get auth token...');
    try {
      // Try the correct admin credentials
      const credentials = { email: 'admin@kampus.edu', password: 'admin123' };
      
      console.log(`   🔍 Trying ${credentials.email}...`);
      const loginResponse = await axios.post(`${API_BASE}/auth/login`, credentials, { timeout: 5000 });
      const token = loginResponse.data.token;
      
      console.log('   ✅ Login successful');
      console.log(`   🔑 Token: ${token.substring(0, 20)}...`);
      
      // 4. Try to get payment with auth
      console.log(`\n4. Testing payment endpoint with auth (ID: ${paymentId})...`);
      try {
        const response = await axios.get(`${API_BASE}/api/payments/${paymentId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          timeout: 10000 // Increase timeout for this test
        });
        
        console.log('   ✅ Payment data retrieved successfully');
        console.log('   📊 Response structure:');
        console.log('      - ID:', response.data.id);
        console.log('      - Amount:', response.data.amount);
        console.log('      - Payment Date:', response.data.payment_date);
        console.log('      - Payment Method:', response.data.payment_method);
        console.log('      - Receipt Number:', response.data.receipt_number);
        console.log('      - Student Name:', response.data.students?.name);
        console.log('      - Bill Description:', response.data.bills?.description);
        
        // Check for missing fields that might cause issues
        const requiredFields = ['id', 'amount', 'payment_date', 'payment_method', 'receipt_number'];
        const missingFields = requiredFields.filter(field => !(field in response.data));
        if (missingFields.length > 0) {
          console.log(`   ⚠️  Missing required fields: ${missingFields.join(', ')}`);
        } else {
          console.log('   ✅ All required fields present');
        }
        
      } catch (error) {
        console.log('   ❌ Failed to get payment with auth');
        if (error.response) {
          console.log(`   📊 Status: ${error.response.status}`);
          console.log('   📊 Error data:', JSON.stringify(error.response.data, null, 2));
          
          // Special handling for 500 errors
          if (error.response.status === 500) {
            console.log('   💡 This is a server-side error. Check the server logs for details.');
          }
          
          // Special handling for 404 errors
          if (error.response.status === 404) {
            console.log('   💡 Payment not found. Check if payment ID exists in database.');
            console.log('   💡 You can list all payments with: node mysql_migration/list_payments.js');
          }
        } else {
          console.log('   💡 Error:', error.message);
        }
      }
      
    } catch (error) {
      console.log('   ❌ Login process failed');
      if (error.response) {
        console.log(`   📊 Status: ${error.response.status}`);
        console.log('   📊 Error data:', JSON.stringify(error.response.data, null, 2));
        
        // If it's a 401 error, let's check what users exist in the database
        if (error.response.status === 401) {
          console.log('   💡 Let\'s check what users exist in the database...');
          try {
            const dbCheckResponse = await axios.get(`${API_BASE}/debug/users`, { timeout: 5000 });
            console.log('   📊 Users in database:');
            dbCheckResponse.data.forEach(user => {
              console.log(`      - ${user.email} (${user.role})`);
            });
          } catch (dbError) {
            console.log('   ❌ Failed to check users:', dbError.message);
          }
        }
      } else {
        console.log('   💡 Error:', error.message);
      }
      return;
    }
    
    console.log('\n🎯 Debug Summary:');
    console.log('   - If server health check fails: Start the auth server');
    console.log('   - If login fails: Check credentials or create admin user');
    console.log('   - If payment endpoint fails with 500: Check server logs for database issues');
    console.log('   - If payment endpoint fails with 404: Check if payment ID exists in database');
    
  } catch (error) {
    console.log('❌ Debug script failed:', error.message);
  }
}

debugPaymentEndpoint();