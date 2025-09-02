// Test Students API
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

async function testStudentsAPI() {
  console.log('🧪 Testing Students API Endpoints...\n');
  
  try {
    // Get auth token
    console.log('🔐 Getting auth token...');
    const token = await getAuthToken();
    console.log('   ✅ Token obtained\n');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Test 1: Get Students Stats
    console.log('📊 Test 1: GET /api/students/stats');
    const statsResponse = await fetch(`${API_BASE}/api/students/stats`, { headers });
    const stats = await statsResponse.json();
    console.log('   ✅ Response:', JSON.stringify(stats, null, 2));
    console.log('');

    // Test 2: Get All Students (paginated)
    console.log('📋 Test 2: GET /api/students?page=1&pageSize=5');
    const studentsResponse = await fetch(`${API_BASE}/api/students?page=1&pageSize=5`, { headers });
    const studentsData = await studentsResponse.json();
    console.log('   ✅ Response:');
    console.log(`   📊 Total: ${studentsData.total}, Page: ${studentsData.page}/${studentsData.totalPages}`);
    if (studentsData.data && studentsData.data.length > 0) {
      studentsData.data.forEach((student, i) => {
        console.log(`   ${i+1}. ${student.name} (${student.nim_kashif}) - ${student.status}`);
      });
    }
    console.log('');

    // Test 3: Get All Students (no pagination)
    console.log('📋 Test 3: GET /api/students/all');
    const allStudentsResponse = await fetch(`${API_BASE}/api/students/all`, { headers });
    const allStudents = await allStudentsResponse.json();
    console.log(`   ✅ Response: ${allStudents.length} students found`);
    console.log('');

    // Test 4: Search Students
    console.log('🔍 Test 4: GET /api/students?search=test');
    const searchResponse = await fetch(`${API_BASE}/api/students?search=test`, { headers });
    const searchData = await searchResponse.json();
    console.log(`   ✅ Search result: ${searchData.total} students found`);
    console.log('');

    // Test 5: Create Student
    console.log('➕ Test 5: POST /api/students');
    const newStudent = {
      nim_kashif: 'TEST001',
      nim_dikti: '12345678901',
      name: 'Test Student API',
      email: 'test.api@student.kampus.edu',
      phone: '081234567890',
      prodi: 'Teknik Informatika',
      angkatan: '2024',
      address: 'Jl. Test API No. 1',
      status: 'active'
    };
    
    const createResponse = await fetch(`${API_BASE}/api/students`, {
      method: 'POST',
      headers,
      body: JSON.stringify(newStudent)
    });
    
    if (createResponse.ok) {
      const createdStudent = await createResponse.json();
      console.log('   ✅ Student created successfully!');
      console.log(`   👤 ID: ${createdStudent.id}`);
      console.log(`   📧 Email: ${createdStudent.email}`);
      console.log(`   🎓 Prodi: ${createdStudent.prodi}`);
      
      // Test 6: Get Single Student
      console.log('\n🔍 Test 6: GET /api/students/:id');
      const getStudentResponse = await fetch(`${API_BASE}/api/students/${createdStudent.id}`, { headers });
      if (getStudentResponse.ok) {
        const student = await getStudentResponse.json();
        console.log('   ✅ Student found:');
        console.log(`      Name: ${student.name}`);
        console.log(`      NIM: ${student.nim_kashif}`);
        console.log(`      Status: ${student.status}`);
      }
      
      // Test 7: Update Student
      console.log('\n✏️  Test 7: PUT /api/students/:id');
      const updateResponse = await fetch(`${API_BASE}/api/students/${createdStudent.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          ...newStudent,
          name: 'Test Student API (Updated)',
          status: 'inactive'
        })
      });
      
      if (updateResponse.ok) {
        const updatedStudent = await updateResponse.json();
        console.log('   ✅ Student updated successfully!');
        console.log(`      New name: ${updatedStudent.name}`);
        console.log(`      New status: ${updatedStudent.status}`);
      }
      
      // Test 8: Delete Student
      console.log('\n🗑️  Test 8: DELETE /api/students/:id');
      const deleteResponse = await fetch(`${API_BASE}/api/students/${createdStudent.id}`, {
        method: 'DELETE',
        headers
      });
      
      if (deleteResponse.ok) {
        const result = await deleteResponse.json();
        console.log('   ✅ Student deleted successfully!');
        console.log(`   📄 Message: ${result.message}`);
      }
      
    } else {
      const error = await createResponse.json();
      console.log('   ❌ Failed to create student:', error.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n🎉 Students API Testing Complete!');
}

testStudentsAPI();