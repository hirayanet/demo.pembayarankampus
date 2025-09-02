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

async function testPaymentDetailEndpoint() {
  console.log('🧪 Testing Payment Detail Endpoint Fix...\n');
  
  try {
    // Get auth token
    console.log('🔐 Getting auth token...');
    const token = await getAuthToken();
    console.log('   ✅ Token obtained\n');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Test the problematic endpoint
    console.log('🔍 Testing GET /api/payments/2');
    try {
      const response = await fetch(`${API_BASE}/api/payments/2`, { headers });
      
      if (response.ok) {
        const paymentData = await response.json();
        console.log('   ✅ SUCCESS! Payment detail retrieved:');
        console.log('      ID:', paymentData.id);
        console.log('      Receipt:', paymentData.receipt_number);
        console.log('      Amount: Rp', paymentData.amount.toLocaleString());
        console.log('      Status:', paymentData.status);
        console.log('      Student:', paymentData.student_name);
        console.log('      NIM:', paymentData.student_nim);
        console.log('      Prodi:', paymentData.student_prodi);
        console.log('      Bill:', paymentData.bill_description);
        console.log('\n🎉 Error 500 has been FIXED!');
      } else {
        const errorData = await response.json();
        console.log('   ❌ Error:', response.status, errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }

    // Test a few more payment IDs to ensure fix is comprehensive
    console.log('\n🔍 Testing other payment IDs...');
    for (const id of [1, 3, 4, 5]) {
      try {
        const response = await fetch(`${API_BASE}/api/payments/${id}`, { headers });
        if (response.ok) {
          console.log(`   ✅ Payment ID ${id}: OK`);
        } else if (response.status === 404) {
          console.log(`   ℹ️  Payment ID ${id}: Not found (expected)`);
        } else {
          console.log(`   ❌ Payment ID ${id}: Error ${response.status}`);
        }
      } catch (error) {
        console.log(`   ❌ Payment ID ${id}: Request failed`);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure:');
    console.log('   1. Auth server is running (npm run auth-server)');
    console.log('   2. Database is accessible');
    console.log('   3. Auth server has been restarted after the fix');
  }
}

testPaymentDetailEndpoint();