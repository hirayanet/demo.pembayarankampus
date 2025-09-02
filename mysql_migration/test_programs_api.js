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

async function testProgramsAPI() {
  console.log('🧪 Testing Programs API Endpoints...\n');
  
  try {
    // Get auth token
    console.log('🔐 Getting auth token...');
    const token = await getAuthToken();
    console.log('   ✅ Token obtained\n');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    let createdProgramId = null;

    // Test 1: GET /api/programs - Get all programs
    console.log('📋 Test 1: GET /api/programs');
    try {
      const programsResponse = await fetch(`${API_BASE}/api/programs`, { headers });
      if (programsResponse.ok) {
        const programsData = await programsResponse.json();
        console.log('   ✅ Success!');
        console.log('   📊 Total programs found:', programsData.length);
        if (programsData.length > 0) {
          console.log('   📄 First program:', {
            id: programsData[0].id,
            code: programsData[0].code,
            name: programsData[0].name,
            faculty: programsData[0].faculty,
            level: programsData[0].level,
            status: programsData[0].status
          });
        }
      } else {
        const errorData = await programsResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 2: POST /api/programs - Create new program
    console.log('➕ Test 2: POST /api/programs');
    const newProgramData = {
      code: `TEST${Date.now()}`,
      name: `Test Program ${Date.now()}`,
      faculty: 'Fakultas Test',
      level: 'S1',
      status: 'active'
    };
    
    try {
      const createResponse = await fetch(`${API_BASE}/api/programs`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newProgramData)
      });
      
      if (createResponse.ok) {
        const createdProgram = await createResponse.json();
        createdProgramId = createdProgram.id;
        console.log('   ✅ Program created successfully!');
        console.log('      ID:', createdProgram.id);
        console.log('      Code:', createdProgram.code);
        console.log('      Name:', createdProgram.name);
        console.log('      Faculty:', createdProgram.faculty);
        console.log('      Level:', createdProgram.level);
        console.log('      Status:', createdProgram.status);
      } else {
        const errorData = await createResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 3: GET /api/programs/:id - Get single program
    if (createdProgramId) {
      console.log('🔍 Test 3: GET /api/programs/:id');
      try {
        const programResponse = await fetch(`${API_BASE}/api/programs/${createdProgramId}`, { headers });
        if (programResponse.ok) {
          const programData = await programResponse.json();
          console.log('   ✅ Program found:');
          console.log('      Code:', programData.code);
          console.log('      Name:', programData.name);
          console.log('      Faculty:', programData.faculty);
          console.log('      Level:', programData.level);
          console.log('      Status:', programData.status);
        } else {
          const errorData = await programResponse.json();
          console.log('   ❌ Error:', errorData);
        }
      } catch (error) {
        console.log('   ❌ Request failed:', error.message);
      }
      console.log('');
    }

    // Test 4: PUT /api/programs/:id - Update program
    if (createdProgramId) {
      console.log('✏️  Test 4: PUT /api/programs/:id');
      const updateData = {
        code: `UPD${Date.now()}`,
        name: `Updated Test Program ${Date.now()}`,
        faculty: 'Fakultas Updated',
        level: 'S2',
        status: 'active'
      };
      
      try {
        const updateResponse = await fetch(`${API_BASE}/api/programs/${createdProgramId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(updateData)
        });
        
        if (updateResponse.ok) {
          const updatedProgram = await updateResponse.json();
          console.log('   ✅ Program updated successfully!');
          console.log('      New code:', updatedProgram.code);
          console.log('      New name:', updatedProgram.name);
          console.log('      New faculty:', updatedProgram.faculty);
          console.log('      New level:', updatedProgram.level);
        } else {
          const errorData = await updateResponse.json();
          console.log('   ❌ Error:', errorData);
        }
      } catch (error) {
        console.log('   ❌ Request failed:', error.message);
      }
      console.log('');
    }

    // Test 5: POST /api/programs - Test validation (create without required fields)
    console.log('⚠️  Test 5: POST /api/programs (validation test)');
    try {
      const validationResponse = await fetch(`${API_BASE}/api/programs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          // Missing required 'code' and 'name' fields
          faculty: 'Fakultas Test',
          level: 'S1'
        })
      });
      
      if (validationResponse.ok) {
        console.log('   ❌ Validation should have failed!');
      } else {
        const errorData = await validationResponse.json();
        console.log('   ✅ Validation working correctly:', errorData.error);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 6: POST /api/programs - Test duplicate code
    console.log('⚠️  Test 6: POST /api/programs (duplicate code test)');
    if (createdProgramId) {
      try {
        // Get the created program's code first
        const programResponse = await fetch(`${API_BASE}/api/programs/${createdProgramId}`, { headers });
        if (programResponse.ok) {
          const programData = await programResponse.json();
          
          try {
            const duplicateResponse = await fetch(`${API_BASE}/api/programs`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                code: programData.code, // Use same code
                name: 'Duplicate Test Program',
                faculty: 'Fakultas Test'
              })
            });
            
            if (duplicateResponse.ok) {
              console.log('   ❌ Duplicate code should have been rejected!');
            } else {
              const errorData = await duplicateResponse.json();
              console.log('   ✅ Duplicate validation working correctly:', errorData.error);
            }
          } catch (error) {
            console.log('   ❌ Duplicate request failed:', error.message);
          }
        } else {
          const errorData = await programResponse.json();
          console.log('   ❌ Failed to get program data:', errorData);
        }
      } catch (error) {
        console.log('   ❌ Test 6 failed:', error.message);
      }
    } else {
      console.log('   ⚠️  Skipped - no created program ID available');
    }
    console.log('');

    // Test 7: POST /api/programs - Create program for deletion test
    console.log('➕ Test 7: Create program for deletion test');
    let programToDeleteId = null;
    const programToDelete = {
      code: `DEL${Date.now()}`,
      name: `Program To Delete ${Date.now()}`,
      faculty: 'Fakultas Delete Test',
      level: 'D3',
      status: 'inactive'
    };
    
    try {
      const createResponse = await fetch(`${API_BASE}/api/programs`, {
        method: 'POST',
        headers,
        body: JSON.stringify(programToDelete)
      });
      
      if (createResponse.ok) {
        const createdProgram = await createResponse.json();
        programToDeleteId = createdProgram.id;
        console.log('   ✅ Test program created for deletion test');
        console.log('      ID:', createdProgram.id);
        console.log('      Code:', createdProgram.code);
      } else {
        const errorData = await createResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 8: DELETE /api/programs/:id - Delete program
    if (programToDeleteId) {
      console.log('🗑️  Test 8: DELETE /api/programs/:id');
      try {
        const deleteResponse = await fetch(`${API_BASE}/api/programs/${programToDeleteId}`, {
          method: 'DELETE',
          headers
        });
        
        if (deleteResponse.ok) {
          const deleteResult = await deleteResponse.json();
          console.log('   ✅ Program deleted successfully!');
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

    // Test 9: GET /api/programs/:id - Test 404 for deleted program
    if (programToDeleteId) {
      console.log('🔍 Test 9: GET /api/programs/:id (deleted program)');
      try {
        const notFoundResponse = await fetch(`${API_BASE}/api/programs/${programToDeleteId}`, { headers });
        if (notFoundResponse.ok) {
          console.log('   ❌ Should return 404 for deleted program!');
        } else if (notFoundResponse.status === 404) {
          const errorData = await notFoundResponse.json();
          console.log('   ✅ 404 response correct:', errorData.error);
        } else {
          const errorData = await notFoundResponse.json();
          console.log('   ❌ Unexpected error:', errorData);
        }
      } catch (error) {
        console.log('   ❌ Request failed:', error.message);
      }
      console.log('');
    }

    // Test 10: DELETE /api/programs/:id - Clean up created program
    if (createdProgramId) {
      console.log('🧹 Test 10: Cleanup - DELETE created program');
      try {
        const deleteResponse = await fetch(`${API_BASE}/api/programs/${createdProgramId}`, {
          method: 'DELETE',
          headers
        });
        
        if (deleteResponse.ok) {
          const deleteResult = await deleteResponse.json();
          console.log('   ✅ Cleanup successful:', deleteResult.message);
        } else {
          const errorData = await deleteResponse.json();
          console.log('   ❌ Cleanup error:', errorData);
        }
      } catch (error) {
        console.log('   ❌ Cleanup failed:', error.message);
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('🎉 Programs API Testing Complete!');
}

testProgramsAPI();