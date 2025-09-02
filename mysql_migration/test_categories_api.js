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

async function testCategoriesAPI() {
  console.log('🧪 Testing Categories API Endpoints...\n');
  
  try {
    // Get auth token
    console.log('🔐 Getting auth token...');
    const token = await getAuthToken();
    console.log('   ✅ Token obtained\n');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    let createdCategoryId = null;

    // Test 1: GET /api/bill-categories - Get all categories
    console.log('📋 Test 1: GET /api/bill-categories');
    try {
      const categoriesResponse = await fetch(`${API_BASE}/api/bill-categories`, { headers });
      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json();
        console.log('   ✅ Success!');
        console.log('   📊 Total categories found:', categoriesData.length);
        if (categoriesData.length > 0) {
          console.log('   📄 First category:', {
            id: categoriesData[0].id,
            name: categoriesData[0].name,
            active: categoriesData[0].active,
            default_amount: categoriesData[0].default_amount
          });
        }
      } else {
        const errorData = await categoriesResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 2: GET /api/bill-categories?onlyActive=true - Get active categories only
    console.log('📋 Test 2: GET /api/bill-categories (active only)');
    try {
      const activeResponse = await fetch(`${API_BASE}/api/bill-categories?onlyActive=true`, { headers });
      if (activeResponse.ok) {
        const activeData = await activeResponse.json();
        console.log('   ✅ Success!');
        console.log('   📊 Active categories found:', activeData.length);
      } else {
        const errorData = await activeResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 3: POST /api/bill-categories - Create new category
    console.log('➕ Test 3: POST /api/bill-categories');
    const newCategoryData = {
      name: `Test Category ${Date.now()}`,
      active: true,
      default_amount: 750000,
      default_due_days: 21,
      default_type: 'fixed'
    };
    
    try {
      const createResponse = await fetch(`${API_BASE}/api/bill-categories`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newCategoryData)
      });
      
      if (createResponse.ok) {
        const createdCategory = await createResponse.json();
        createdCategoryId = createdCategory.id;
        console.log('   ✅ Category created successfully!');
        console.log('      ID:', createdCategory.id);
        console.log('      Name:', createdCategory.name);
        console.log('      Active:', createdCategory.active);
        console.log('      Default Amount: Rp', createdCategory.default_amount?.toLocaleString());
        console.log('      Default Due Days:', createdCategory.default_due_days);
      } else {
        const errorData = await createResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 4: GET /api/bill-categories/:id - Get single category
    if (createdCategoryId) {
      console.log('🔍 Test 4: GET /api/bill-categories/:id');
      try {
        const categoryResponse = await fetch(`${API_BASE}/api/bill-categories/${createdCategoryId}`, { headers });
        if (categoryResponse.ok) {
          const categoryData = await categoryResponse.json();
          console.log('   ✅ Category found:');
          console.log('      Name:', categoryData.name);
          console.log('      Active:', categoryData.active);
          console.log('      Default Amount: Rp', categoryData.default_amount?.toLocaleString());
          console.log('      Default Type:', categoryData.default_type);
        } else {
          const errorData = await categoryResponse.json();
          console.log('   ❌ Error:', errorData);
        }
      } catch (error) {
        console.log('   ❌ Request failed:', error.message);
      }
      console.log('');
    }

    // Test 5: PUT /api/bill-categories/:id - Update category
    if (createdCategoryId) {
      console.log('✏️  Test 5: PUT /api/bill-categories/:id');
      const updateData = {
        name: `Updated Test Category ${Date.now()}`,
        active: true,
        default_amount: 850000,
        default_due_days: 28,
        default_type: 'installment',
        default_installment_count: 3,
        default_installment_amount: 283333
      };
      
      try {
        const updateResponse = await fetch(`${API_BASE}/api/bill-categories/${createdCategoryId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(updateData)
        });
        
        if (updateResponse.ok) {
          const updatedCategory = await updateResponse.json();
          console.log('   ✅ Category updated successfully!');
          console.log('      New name:', updatedCategory.name);
          console.log('      New amount: Rp', updatedCategory.default_amount?.toLocaleString());
          console.log('      New type:', updatedCategory.default_type);
          console.log('      Installment count:', updatedCategory.default_installment_count);
          console.log('      Installment amount: Rp', updatedCategory.default_installment_amount?.toLocaleString());
        } else {
          const errorData = await updateResponse.json();
          console.log('   ❌ Error:', errorData);
        }
      } catch (error) {
        console.log('   ❌ Request failed:', error.message);
      }
      console.log('');
    }

    // Test 6: POST /api/bill-categories - Test validation (create without name)
    console.log('⚠️  Test 6: POST /api/bill-categories (validation test)');
    try {
      const validationResponse = await fetch(`${API_BASE}/api/bill-categories`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          active: true,
          default_amount: 500000
          // Missing required 'name' field
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

    // Test 7: DELETE /api/bill-categories/:id - Delete category
    if (createdCategoryId) {
      console.log('🗑️  Test 7: DELETE /api/bill-categories/:id');
      try {
        const deleteResponse = await fetch(`${API_BASE}/api/bill-categories/${createdCategoryId}`, {
          method: 'DELETE',
          headers
        });
        
        if (deleteResponse.ok) {
          const deleteResult = await deleteResponse.json();
          console.log('   ✅ Category deleted successfully!');
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

    // Test 8: GET /api/bill-categories/:id - Test 404 for deleted category
    if (createdCategoryId) {
      console.log('🔍 Test 8: GET /api/bill-categories/:id (deleted category)');
      try {
        const notFoundResponse = await fetch(`${API_BASE}/api/bill-categories/${createdCategoryId}`, { headers });
        if (notFoundResponse.ok) {
          console.log('   ❌ Should return 404 for deleted category!');
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

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('🎉 Categories API Testing Complete!');
}

testCategoriesAPI();