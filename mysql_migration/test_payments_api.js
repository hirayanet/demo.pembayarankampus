const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001';

// Login untuk mendapatkan token
async function getAuthToken() {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@kampus.edu',
      password: 'admin123'
    })
  });
  
  const data = await response.json();
  return data.token;
}

async function testPaymentsAPI() {
  console.log('🧪 Testing Payments API Endpoints...\n');
  
  try {
    // Get auth token
    console.log('🔐 Getting auth token...');
    const token = await getAuthToken();
    console.log('   ✅ Token obtained\n');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    let createdPaymentId = null;

    // Test 1: GET /api/payments/stats
    console.log('📊 Test 1: GET /api/payments/stats');
    try {
      const statsResponse = await fetch(`${API_BASE}/api/payments/stats`, { headers });
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        console.log('   ✅ Success!');
        console.log('   📈 Stats:', {
          total: statsData.total,
          completed: statsData.completed,
          pending: statsData.pending,
          failed: statsData.failed,
          totalAmountCompleted: statsData.totalAmountCompleted,
          todayAmountCompleted: statsData.todayAmountCompleted
        });
      } else {
        const errorData = await statsResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 2: GET /api/payments?page=1&pageSize=5 (paginated)
    console.log('📋 Test 2: GET /api/payments (paginated)');
    try {
      const paymentsResponse = await fetch(`${API_BASE}/api/payments?page=1&pageSize=5`, { headers });
      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        console.log('   ✅ Success!');
        console.log('   📊 Response structure:', {
          total: paymentsData.total,
          page: paymentsData.page,
          pageSize: paymentsData.pageSize,
          totalPages: paymentsData.totalPages,
          dataCount: paymentsData.data ? paymentsData.data.length : 'undefined'
        });
        if (paymentsData.data && paymentsData.data.length > 0) {
          console.log('   📄 First payment:', {
            id: paymentsData.data[0].id,
            receipt_number: paymentsData.data[0].receipt_number,
            amount: paymentsData.data[0].amount,
            status: paymentsData.data[0].status,
            method: paymentsData.data[0].payment_method
          });
        }
      } else {
        const errorData = await paymentsResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 3: GET /api/payments/all
    console.log('📋 Test 3: GET /api/payments/all');
    try {
      const allPaymentsResponse = await fetch(`${API_BASE}/api/payments/all`, { headers });
      if (allPaymentsResponse.ok) {
        const allPaymentsData = await allPaymentsResponse.json();
        console.log('   ✅ Success!');
        console.log('   📊 Total payments found:', allPaymentsData.length);
      } else {
        const errorData = await allPaymentsResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 4: Ambil student ID dan bill ID untuk testing
    console.log('👤 Getting student and bill IDs for testing...');
    let studentId = null;
    let billId = null;
    
    try {
      // Get student ID
      const studentsResponse = await fetch(`${API_BASE}/api/students/all?pageSize=1`, { headers });
      if (studentsResponse.ok) {
        const studentsData = await studentsResponse.json();
        if (studentsData.length > 0) {
          studentId = studentsData[0].id;
          console.log('   📝 Student ID obtained:', studentId);
        }
      }
      
      // Get bill ID
      const billsResponse = await fetch(`${API_BASE}/api/bills/all?pageSize=1&status=unpaid`, { headers });
      if (billsResponse.ok) {
        const billsData = await billsResponse.json();
        if (billsData.length > 0) {
          billId = billsData[0].id;
          console.log('   📝 Bill ID obtained:', billId);
        }
      }
    } catch (error) {
      console.log('   ❌ Failed to get test IDs:', error.message);
    }
    console.log('');

    // Test 5: POST /api/payments - Create new payment
    if (studentId && billId) {
      console.log('➕ Test 5: POST /api/payments');
      const newPaymentData = {
        student_id: studentId,
        bill_id: billId,
        amount: 1500000,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'transfer_bank',
        receipt_number: `TEST-PAY-${Date.now()}`,
        notes: 'Test payment via API testing',
        status: 'completed'
      };
      
      try {
        const createResponse = await fetch(`${API_BASE}/api/payments`, {
          method: 'POST',
          headers,
          body: JSON.stringify(newPaymentData)
        });
        
        if (createResponse.ok) {
          const createdPayment = await createResponse.json();
          createdPaymentId = createdPayment.id;
          console.log('   ✅ Payment created successfully!');
          console.log('      ID:', createdPayment.id);
          console.log('      Receipt:', createdPayment.receipt_number);
          console.log('      Amount: Rp', createdPayment.amount.toLocaleString());
          console.log('      Status:', createdPayment.status);
          console.log('      Student:', createdPayment.student_name);
          console.log('      Bill:', createdPayment.bill_description);
        } else {
          const errorData = await createResponse.json();
          console.log('   ❌ Error:', errorData);
        }
      } catch (error) {
        console.log('   ❌ Request failed:', error.message);
      }
      console.log('');
    }

    // Test 6: GET /api/payments/:id - Get single payment
    if (createdPaymentId) {
      console.log('🔍 Test 6: GET /api/payments/:id');
      try {
        const paymentResponse = await fetch(`${API_BASE}/api/payments/${createdPaymentId}`, { headers });
        if (paymentResponse.ok) {
          const paymentData = await paymentResponse.json();
          console.log('   ✅ Payment found:');
          console.log('      Receipt:', paymentData.receipt_number);
          console.log('      Amount: Rp', paymentData.amount.toLocaleString());
          console.log('      Method:', paymentData.payment_method);
          console.log('      Status:', paymentData.status);
          console.log('      Student:', paymentData.student_name);
          console.log('      Bill:', paymentData.bill_description);
        } else {
          const errorData = await paymentResponse.json();
          console.log('   ❌ Error:', errorData);
        }
      } catch (error) {
        console.log('   ❌ Request failed:', error.message);
      }
      console.log('');
    }

    // Test 7: PUT /api/payments/:id - Update payment
    if (createdPaymentId) {
      console.log('✏️  Test 7: PUT /api/payments/:id');
      const updateData = {
        amount: 1750000,
        notes: 'Test payment via API testing (Updated)',
        payment_method: 'cash'
      };
      
      try {
        const updateResponse = await fetch(`${API_BASE}/api/payments/${createdPaymentId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(updateData)
        });
        
        if (updateResponse.ok) {
          const updatedPayment = await updateResponse.json();
          console.log('   ✅ Payment updated successfully!');
          console.log('      Receipt:', updatedPayment.receipt_number);
          console.log('      New amount: Rp', updatedPayment.amount.toLocaleString());
          console.log('      New method:', updatedPayment.payment_method);
          console.log('      New notes:', updatedPayment.notes);
        } else {
          const errorData = await updateResponse.json();
          console.log('   ❌ Error:', errorData);
        }
      } catch (error) {
        console.log('   ❌ Request failed:', error.message);
      }
      console.log('');
    }

    // Test 8: GET /api/payments with filters
    console.log('🔍 Test 8: GET /api/payments (with filters)');
    try {
      const filterParams = new URLSearchParams({
        status: 'completed',
        method: 'transfer_bank',
        dateRange: 'today',
        page: '1',
        pageSize: '10'
      });
      
      const filteredResponse = await fetch(`${API_BASE}/api/payments?${filterParams}`, { headers });
      if (filteredResponse.ok) {
        const filteredData = await filteredResponse.json();
        console.log('   ✅ Filtered payments retrieved!');
        console.log('   📊 Results:', {
          total: filteredData.total,
          filteredCount: filteredData.data.length,
          filters: 'status=completed, method=transfer_bank, dateRange=today'
        });
      } else {
        const errorData = await filteredResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 9: DELETE /api/payments/:id - Delete payment
    if (createdPaymentId) {
      console.log('🗑️  Test 9: DELETE /api/payments/:id');
      try {
        const deleteResponse = await fetch(`${API_BASE}/api/payments/${createdPaymentId}`, {
          method: 'DELETE',
          headers
        });
        
        if (deleteResponse.ok) {
          const deleteResult = await deleteResponse.json();
          console.log('   ✅ Payment deleted successfully!');
          console.log('   📄 Message:', deleteResult.message);
        } else {
          const errorData = await deleteResponse.json();
          console.log('   ❌ Error:', errorData);
        }
      } catch (error) {
        console.log('   ❌ Request failed:', error.message);
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('🎉 Payments API Testing Complete!');
}

testPaymentsAPI();