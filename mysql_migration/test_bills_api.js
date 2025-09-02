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

async function testBillsAPI() {
  console.log('🧪 Testing Bills API Endpoints...\n');
  
  try {
    // Get auth token
    console.log('🔐 Getting auth token...');
    const token = await getAuthToken();
    console.log('   ✅ Token obtained\n');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    let createdBillId = null;

    // Test 1: GET /api/bills/stats
    console.log('📊 Test 1: GET /api/bills/stats');
    try {
      const statsResponse = await fetch(`${API_BASE}/api/bills/stats`, { headers });
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        console.log('   ✅ Success!');
        console.log('   📈 Stats:', {
          total: statsData.total,
          paid: statsData.paid,
          unpaid: statsData.unpaid,
          partial: statsData.partial,
          totalAmount: statsData.total_amount,
          totalPaid: statsData.total_paid
        });
      } else {
        const errorData = await statsResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 2: GET /api/bills?page=1&pageSize=5 (paginated)
    console.log('📋 Test 2: GET /api/bills (paginated)');
    try {
      const billsResponse = await fetch(`${API_BASE}/api/bills?page=1&pageSize=5`, { headers });
      if (billsResponse.ok) {
        const billsData = await billsResponse.json();
        console.log('   ✅ Success!');
        console.log('   📊 Response structure:', {
          total: billsData.total,
          page: billsData.page,
          pageSize: billsData.pageSize,
          totalPages: billsData.totalPages,
          dataCount: billsData.data ? billsData.data.length : 'undefined'
        });
        if (billsData.data && billsData.data.length > 0) {
          console.log('   📄 First bill:', {
            id: billsData.data[0].id,
            description: billsData.data[0].description,
            amount: billsData.data[0].amount,
            status: billsData.data[0].status
          });
        }
      } else {
        const errorData = await billsResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 3: GET /api/bills/all
    console.log('📋 Test 3: GET /api/bills/all');
    try {
      const allBillsResponse = await fetch(`${API_BASE}/api/bills/all`, { headers });
      if (allBillsResponse.ok) {
        const allBillsData = await allBillsResponse.json();
        console.log('   ✅ Success!');
        console.log('   📊 Total bills found:', allBillsData.length);
      } else {
        const errorData = await allBillsResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 4: Ambil student ID untuk testing (dari Students API)
    console.log('👤 Getting student ID for testing...');
    let studentId = null;
    try {
      const studentsResponse = await fetch(`${API_BASE}/api/students/all?pageSize=1`, { headers });
      if (studentsResponse.ok) {
        const studentsData = await studentsResponse.json();
        if (studentsData.length > 0) {
          studentId = studentsData[0].id;
          console.log('   ✅ Student ID found:', studentId);
        } else {
          console.log('   ⚠️  No students found, creating mock student...');
          // Buat student test jika belum ada
          const newStudent = {
            nim_kashif: 'TESTBILL001',
            nim_dikti: '12345678901',
            name: 'Test Student for Bills',
            email: 'test.bills@student.kampus.edu',
            phone: '081234567890',
            prodi: 'Teknik Informatika',
            angkatan: '2024',
            address: 'Jl. Test Bills No. 1',
            status: 'active'
          };
          
          const createStudentResponse = await fetch(`${API_BASE}/api/students`, {
            method: 'POST',
            headers,
            body: JSON.stringify(newStudent)
          });
          
          if (createStudentResponse.ok) {
            const createdStudent = await createStudentResponse.json();
            studentId = createdStudent.id;
            console.log('   ✅ Student created for testing, ID:', studentId);
          }
        }
      }
    } catch (error) {
      console.log('   ❌ Failed to get student ID:', error.message);
    }

    if (!studentId) {
      console.log('   ⚠️  No student available for bill testing, using mock ID');
      studentId = 1; // Fallback
    }
    console.log('');

    // Test 5: POST /api/bills - Create new bill
    console.log('➕ Test 5: POST /api/bills');
    const newBill = {
      student_id: studentId,
      type: 'fixed',
      category: 'Uang Kuliah',
      description: 'Test Bill API - Uang Kuliah Semester 1',
      amount: 5000000,
      due_date: '2024-12-31',
      status: 'unpaid'
    };
    
    try {
      const createResponse = await fetch(`${API_BASE}/api/bills`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newBill)
      });
      
      if (createResponse.ok) {
        const createdBill = await createResponse.json();
        createdBillId = createdBill.id;
        console.log('   ✅ Bill created successfully!');
        console.log('   📄 ID:', createdBill.id);
        console.log('   💰 Amount: Rp', createdBill.amount.toLocaleString());
        console.log('   📋 Description:', createdBill.description);
        console.log('   👤 Student:', createdBill.student_name);
      } else {
        const errorData = await createResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 6: GET /api/bills/:id - Get single bill
    if (createdBillId) {
      console.log('🔍 Test 6: GET /api/bills/:id');
      try {
        const billResponse = await fetch(`${API_BASE}/api/bills/${createdBillId}`, { headers });
        if (billResponse.ok) {
          const billData = await billResponse.json();
          console.log('   ✅ Bill found:');
          console.log('      Description:', billData.description);
          console.log('      Amount: Rp', billData.amount.toLocaleString());
          console.log('      Status:', billData.status);
          console.log('      Student:', billData.student_name);
        } else {
          const errorData = await billResponse.json();
          console.log('   ❌ Error:', errorData);
        }
      } catch (error) {
        console.log('   ❌ Request failed:', error.message);
      }
      console.log('');
    }

    // Test 7: PUT /api/bills/:id - Update bill
    if (createdBillId) {
      console.log('✏️  Test 7: PUT /api/bills/:id');
      const updateData = {
        description: 'Test Bill API - Uang Kuliah Semester 1 (Updated)',
        amount: 5500000,
        status: 'partial',
        paid_amount: 2500000
      };
      
      try {
        const updateResponse = await fetch(`${API_BASE}/api/bills/${createdBillId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(updateData)
        });
        
        if (updateResponse.ok) {
          const updatedBill = await updateResponse.json();
          console.log('   ✅ Bill updated successfully!');
          console.log('      New description:', updatedBill.description);
          console.log('      New amount: Rp', updatedBill.amount.toLocaleString());
          console.log('      New status:', updatedBill.status);
          console.log('      Paid amount: Rp', updatedBill.paid_amount.toLocaleString());
        } else {
          const errorData = await updateResponse.json();
          console.log('   ❌ Error:', errorData);
        }
      } catch (error) {
        console.log('   ❌ Request failed:', error.message);
      }
      console.log('');
    }

    // Test 8: DELETE /api/bills/:id - Delete bill
    if (createdBillId) {
      console.log('🗑️  Test 8: DELETE /api/bills/:id');
      try {
        const deleteResponse = await fetch(`${API_BASE}/api/bills/${createdBillId}`, {
          method: 'DELETE',
          headers
        });
        
        if (deleteResponse.ok) {
          const deleteResult = await deleteResponse.json();
          console.log('   ✅ Bill deleted successfully!');
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

  console.log('🎉 Bills API Testing Complete!');
}

testBillsAPI();