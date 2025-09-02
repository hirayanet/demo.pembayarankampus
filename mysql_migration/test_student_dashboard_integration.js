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

async function testStudentDashboardData() {
  console.log('🧪 Testing Student Dashboard Real API Integration...\n');
  
  try {
    // Get auth token
    console.log('🔐 Getting auth token...');
    const token = await getAuthToken();
    console.log('   ✅ Token obtained\n');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 1. Test Students API
    console.log('1. Testing Students API...');
    const studentsResponse = await fetch(`${API_BASE}/api/students`, { headers });
    
    if (studentsResponse.ok) {
      const students = await studentsResponse.json();
      console.log(`   ✅ Found ${students.length} students`);
      
      if (students.length > 0) {
        const firstStudent = students[0];
        console.log(`   📋 Sample student:`, {
          id: firstStudent.id,
          name: firstStudent.name,
          nim_kashif: firstStudent.nim_kashif,
          prodi: firstStudent.prodi,
          status: firstStudent.status
        });

        // 2. Test Bills for this student
        console.log(`\n2. Testing Bills for student ${firstStudent.id}...`);
        const billsResponse = await fetch(`${API_BASE}/api/bills/all?student_id=${firstStudent.id}`, { headers });
        
        if (billsResponse.ok) {
          const bills = await billsResponse.json();
          console.log(`   ✅ Found ${bills.length} bills for student`);
          
          if (bills.length > 0) {
            const sampleBill = bills[0];
            console.log(`   📋 Sample bill:`, {
              id: sampleBill.id,
              description: sampleBill.description,
              amount: sampleBill.amount,
              status: sampleBill.status,
              paid_amount: sampleBill.paid_amount
            });
          }
        } else {
          console.log(`   ❌ Failed to fetch bills: ${billsResponse.status}`);
        }

        // 3. Test Payments for this student
        console.log(`\n3. Testing Payments for student ${firstStudent.id}...`);
        const paymentsResponse = await fetch(`${API_BASE}/api/payments/all`, { headers });
        
        if (paymentsResponse.ok) {
          const allPayments = await paymentsResponse.json();
          const studentPayments = allPayments.filter(p => p.student_id === firstStudent.id);
          console.log(`   ✅ Found ${studentPayments.length} payments for student`);
          
          if (studentPayments.length > 0) {
            const samplePayment = studentPayments[0];
            console.log(`   📋 Sample payment:`, {
              id: samplePayment.id,
              bill_id: samplePayment.bill_id,
              amount: samplePayment.amount,
              status: samplePayment.status,
              payment_method: samplePayment.payment_method
            });
          }
        } else {
          console.log(`   ❌ Failed to fetch payments: ${paymentsResponse.status}`);
        }
      } else {
        console.log('   ⚠️  No students found in database');
        console.log('   💡 You may need to add student data first');
      }
    } else {
      console.log(`   ❌ Failed to fetch students: ${studentsResponse.status}`);
    }

    console.log('\n🎯 SUMMARY:');
    console.log('   - Student Dashboard will now use real API data instead of mock data');
    console.log('   - Data is loaded from /api/students, /api/bills/all, and /api/payments/all');
    console.log('   - Receipt modal will work with real payment IDs');
    console.log('   - Make sure students exist in database and have associated bills/payments');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testStudentDashboardData();