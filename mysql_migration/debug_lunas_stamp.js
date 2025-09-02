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

async function debugLunasStamp() {
  console.log('🧪 Debugging Lunas Stamp Display...\n');
  
  try {
    // Get auth token
    console.log('🔐 Getting auth token...');
    const token = await getAuthToken();
    console.log('   ✅ Token obtained\n');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 1. Get all payments to test
    console.log('1. Finding payments to test...');
    const paymentsResponse = await fetch(`${API_BASE}/api/payments/all`, { headers });
    if (!paymentsResponse.ok) {
      console.log('   ❌ Failed to fetch payments');
      return;
    }
    
    const payments = await paymentsResponse.json();
    console.log(`   📊 Found ${payments.length} payments in database`);

    // 2. Test each payment for lunas stamp logic
    console.log('\n2. Testing lunas stamp logic for each payment...\n');
    
    for (const payment of payments.slice(0, 5)) { // Test first 5 payments
      console.log(`🔍 Testing Payment ID: ${payment.id}`);
      
      try {
        const response = await fetch(`${API_BASE}/api/payments/${payment.id}`, { headers });
        
        if (response.ok) {
          const data = await response.json();
          
          // Extract the same logic used in ReceiptModal
          const billStatus = String(data?.bills?.status ?? '').toLowerCase();
          const billType = String(data?.bills?.type ?? '').toLowerCase();
          const billTotal = Number(data?.bills?.amount ?? 0);
          const billPaid = Number(data?.bills?.paid_amount ?? 0);
          
          console.log('   📋 Payment Data:');
          console.log('      Receipt:', data.receipt_number);
          console.log('      Payment Status:', data.status);
          console.log('      Payment Amount:', data.amount);
          console.log('      Bill Status:', billStatus);
          console.log('      Bill Type:', billType);
          console.log('      Bill Total Amount:', billTotal);
          console.log('      Bill Paid Amount:', billPaid);
          
          // Test lunas stamp conditions
          const statusPaid = ['paid','lunas','completed','complete','settlement','verified'].includes(billStatus);
          const amountPaidEnough = billTotal > 0 ? billPaid >= billTotal : false;
          const isPartial = billStatus === 'partial' || (billTotal > 0 && billPaid > 0 && billPaid < billTotal) || billType === 'installment';
          
          console.log('   🎯 Lunas Stamp Logic:');
          console.log('      statusPaid (bill status in valid list):', statusPaid);
          console.log('      amountPaidEnough (paid >= total):', amountPaidEnough);
          console.log('      isPartial (partial/installment):', isPartial);
          
          const isPaid = statusPaid || amountPaidEnough || isPartial;
          console.log('      💡 FINAL isPaid (should show stamp):', isPaid);
          
          if (isPaid) {
            console.log('   ✅ LUNAS STAMP SHOULD BE VISIBLE');
          } else {
            console.log('   ❌ Lunas stamp should NOT be visible');
          }
          
        } else {
          console.log(`   ❌ Failed to fetch payment details: ${response.status}`);
        }
      } catch (error) {
        console.log('   ❌ Request failed:', error.message);
      }
      console.log('');
    }

    console.log('🎯 SUMMARY:');
    console.log('   - If payments show "LUNAS STAMP SHOULD BE VISIBLE" but stamp is missing:');
    console.log('     1. Check if /images/lunas.png is accessible in browser');
    console.log('     2. Check browser console for image loading errors');
    console.log('     3. Check CSS z-index and positioning');
    console.log('   - If payments show "should NOT be visible", update bill status to "paid"');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugLunasStamp();