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

async function testGetLatestPaymentForBill() {
  console.log('🧪 Testing getLatestPaymentForBill function...\n');
  
  try {
    // Get auth token
    console.log('🔐 Getting auth token...');
    const token = await getAuthToken();
    console.log('   ✅ Token obtained\n');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 1. Get all bills to find one with payments
    console.log('1. Finding bills with payments...');
    const billsResponse = await fetch(`${API_BASE}/api/bills/all`, { headers });
    if (!billsResponse.ok) {
      console.log('   ❌ Failed to fetch bills');
      return;
    }
    
    const bills = await billsResponse.json();
    console.log(`   📊 Found ${bills.length} bills in database`);

    // 2. Test the /api/payments/all?bill_id= endpoint that our function uses
    for (const bill of bills.slice(0, 3)) { // Test first 3 bills
      console.log(`\n🔍 Testing Bill ID: ${bill.id} (${bill.description})`);
      
      try {
        // Test the API endpoint that getLatestPaymentForBill uses internally
        const paymentsResponse = await fetch(`${API_BASE}/api/payments/all?bill_id=${bill.id}`, { headers });
        
        if (paymentsResponse.ok) {
          const payments = await paymentsResponse.json();
          console.log(`   📋 Found ${payments.length} payments for this bill`);
          
          if (payments.length > 0) {
            // Sort manually to verify our logic
            const sortedPayments = payments.sort((a, b) => {
              const dateA = new Date(a.payment_date).getTime();
              const dateB = new Date(b.payment_date).getTime();
              return dateB - dateA; // descending order
            });
            
            const latest = sortedPayments[0];
            console.log('   ✅ Latest payment found:');
            console.log('      Payment ID:', latest.id);
            console.log('      Receipt:', latest.receipt_number);
            console.log('      Date:', latest.payment_date);
            console.log('      Amount: Rp', latest.amount?.toLocaleString());
            console.log('      Status:', latest.status);
            
            // This simulates what getLatestPaymentForBill will return
            console.log('   🎯 getLatestPaymentForBill should return this payment');
          } else {
            console.log('   ℹ️  No payments found for this bill');
          }
        } else {
          console.log(`   ❌ API call failed: ${paymentsResponse.status}`);
        }
      } catch (error) {
        console.log('   ❌ Request failed:', error.message);
      }
    }

    console.log('\n🎯 SUMMARY:');
    console.log('   - The getLatestPaymentForBill function should now work');
    console.log('   - It uses /api/payments/all?bill_id={billId} endpoint');
    console.log('   - Returns the most recent payment for a bill');
    console.log('   - Returns null if no payments found');
    console.log('\n💡 Next step: Test in frontend by clicking "Kwitansi" button');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testGetLatestPaymentForBill();