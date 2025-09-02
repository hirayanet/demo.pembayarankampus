const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001';

async function getAuthToken() {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@kampus.edu',
        password: 'admin123'
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Login failed: ${error.error || response.status}`);
    }
    
    const data = await response.json();
    return data.token;
  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

async function testReceiptModalEndpoint() {
  console.log('🧪 Testing Receipt Modal API Call (getPaymentById)...\n');
  
  try {
    // 1. Test server availability
    console.log('1. Testing server health...');
    try {
      const healthResponse = await fetch(`${API_BASE}/health`);
      if (healthResponse.ok) {
        console.log('   ✅ Auth server is running');
      } else {
        console.log('   ❌ Auth server health check failed');
        return;
      }
    } catch (error) {
      console.log('   ❌ Cannot connect to auth server. Is it running?');
      console.log(`   💡 Start with: npm run auth-server`);
      return;
    }

    // 2. Get auth token
    console.log('2. Getting auth token...');
    const token = await getAuthToken();
    console.log('   ✅ Token obtained\n');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 3. Find available payments to test
    console.log('3. Finding available payments...');
    const paymentsResponse = await fetch(`${API_BASE}/api/payments/all`, { headers });
    if (!paymentsResponse.ok) {
      console.log('   ❌ Failed to fetch payments list');
      return;
    }
    
    const payments = await paymentsResponse.json();
    console.log(`   📊 Found ${payments.length} payments in database`);
    
    if (payments.length === 0) {
      console.log('   ⚠️  No payments found. Cannot test receipt modal.');
      return;
    }

    // 4. Test each payment ID (first 3)
    console.log('4. Testing getPaymentById for each payment...\n');
    const testPayments = payments.slice(0, 3); // Test first 3 payments

    for (const payment of testPayments) {
      console.log(`🔍 Testing Payment ID: ${payment.id}`);
      try {
        const response = await fetch(`${API_BASE}/api/payments/${payment.id}`, { headers });
        
        if (response.ok) {
          const paymentData = await response.json();
          console.log('   ✅ SUCCESS! Payment detail retrieved:');
          console.log('      Receipt:', paymentData.receipt_number);
          console.log('      Amount: Rp', paymentData.amount?.toLocaleString());
          console.log('      Status:', paymentData.status);
          console.log('      Student:', paymentData.student_name);
          console.log('      Bill:', paymentData.bill_description);
          
          // Validate required data for receipt
          const requiredFields = ['receipt_number', 'amount', 'payment_date', 'student_name'];
          const missingFields = requiredFields.filter(field => !paymentData[field]);
          
          if (missingFields.length > 0) {
            console.log(`   ⚠️  Missing required fields: ${missingFields.join(', ')}`);
          } else {
            console.log('   ✅ All required receipt fields present');
          }
          
        } else if (response.status === 404) {
          console.log('   ❌ Payment not found (404)');
        } else if (response.status === 500) {
          console.log('   ❌ STILL ERROR 500! Problem not fixed yet.');
          const errorData = await response.json();
          console.log('      Error details:', errorData);
        } else {
          console.log(`   ❌ Error ${response.status}`);
          const errorData = await response.json();
          console.log('      Error details:', errorData);
        }
      } catch (error) {
        console.log('   ❌ Request failed:', error.message);
      }
      console.log('');
    }

    // 5. Summary
    console.log('🎯 SUMMARY:');
    console.log('   - If all tests show ✅ SUCCESS: Receipt Modal should work fine');
    console.log('   - If any test shows ❌ ERROR 500: Auth server needs restart');
    console.log('   - If connection fails: Start auth server with "npm run auth-server"');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Troubleshooting steps:');
    console.log('   1. Make sure auth server is running: npm run auth-server');
    console.log('   2. Check database connection');
    console.log('   3. Restart auth server after any code changes');
  }
}

testReceiptModalEndpoint();