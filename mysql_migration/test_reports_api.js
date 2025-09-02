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

async function testReportsAPI() {
  console.log('🧪 Testing Reports & Analytics API Endpoints...\n');
  
  try {
    // Get auth token
    console.log('🔐 Getting auth token...');
    const token = await getAuthToken();
    console.log('   ✅ Token obtained\n');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Test 1: GET /api/reports/statistics - Get overall statistics
    console.log('📊 Test 1: GET /api/reports/statistics');
    try {
      const statsResponse = await fetch(`${API_BASE}/api/reports/statistics`, { headers });
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        console.log('   ✅ Success!');
        console.log('   📈 Statistics:', {
          totalStudents: statsData.totalStudents,
          totalBills: `Rp ${statsData.totalBills?.toLocaleString()}`,
          totalPaid: `Rp ${statsData.totalPaid?.toLocaleString()}`,
          todayPaymentsAmount: `Rp ${statsData.todayPaymentsAmount?.toLocaleString()}`,
          todayPaymentsCount: statsData.todayPaymentsCount,
          collectibilityRate: `${statsData.collectibilityRate?.toFixed(1)}%`
        });
      } else {
        const errorData = await statsResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 2: GET /api/reports/monthly-income - Get monthly income
    console.log('📅 Test 2: GET /api/reports/monthly-income');
    try {
      const monthlyResponse = await fetch(`${API_BASE}/api/reports/monthly-income?months=6`, { headers });
      if (monthlyResponse.ok) {
        const monthlyData = await monthlyResponse.json();
        console.log('   ✅ Success!');
        console.log('   📊 Monthly Income (last 6 months):');
        monthlyData.forEach((month, index) => {
          console.log(`      ${index + 1}. ${month.month}: Rp ${month.income?.toLocaleString()}`);
        });
      } else {
        const errorData = await monthlyResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 3: GET /api/reports/payment-methods - Get payment method distribution
    console.log('💳 Test 3: GET /api/reports/payment-methods');
    try {
      const methodsResponse = await fetch(`${API_BASE}/api/reports/payment-methods?days=30`, { headers });
      if (methodsResponse.ok) {
        const methodsData = await methodsResponse.json();
        console.log('   ✅ Success!');
        console.log('   💰 Payment Methods (last 30 days):');
        methodsData.forEach((method, index) => {
          console.log(`      ${index + 1}. ${method.method}: ${method.count} payments (${method.percentage}%)`);
        });
      } else {
        const errorData = await methodsResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 4: GET /api/reports/top-programs - Get top programs
    console.log('🏆 Test 4: GET /api/reports/top-programs');
    try {
      const programsResponse = await fetch(`${API_BASE}/api/reports/top-programs?limit=5&days=30`, { headers });
      if (programsResponse.ok) {
        const programsData = await programsResponse.json();
        console.log('   ✅ Success!');
        console.log('   🎓 Top Programs (last 30 days):');
        programsData.forEach((program, index) => {
          console.log(`      ${index + 1}. ${program.prodi}:`);
          console.log(`         Students: ${program.students}`);
          console.log(`         Revenue: Rp ${program.revenue?.toLocaleString()}`);
          console.log(`         Avg/Student: Rp ${(program.revenue / Math.max(1, program.students)).toLocaleString()}`);
        });
      } else {
        const errorData = await programsResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 5: GET /api/reports/dashboard-stats - Get dashboard statistics
    console.log('📈 Test 5: GET /api/reports/dashboard-stats');
    try {
      const dashboardResponse = await fetch(`${API_BASE}/api/reports/dashboard-stats?days=7`, { headers });
      if (dashboardResponse.ok) {
        const dashboardData = await dashboardResponse.json();
        console.log('   ✅ Success!');
        console.log('   📊 Daily Payment Trends (last 7 days):');
        dashboardData.forEach((day, index) => {
          const date = new Date(day.date).toLocaleDateString('id-ID');
          console.log(`      ${index + 1}. ${date}: Rp ${day.amount?.toLocaleString()}`);
        });
      } else {
        const errorData = await dashboardResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 6: GET /api/reports/student-stats - Get student statistics
    console.log('👨‍🎓 Test 6: GET /api/reports/student-stats');
    try {
      const studentStatsResponse = await fetch(`${API_BASE}/api/reports/student-stats`, { headers });
      if (studentStatsResponse.ok) {
        const studentStatsData = await studentStatsResponse.json();
        console.log('   ✅ Success!');
        console.log('   👥 Student Statistics:');
        console.log(`      Total: ${studentStatsData.total}`);
        console.log(`      Active: ${studentStatsData.active}`);
        console.log(`      Inactive: ${studentStatsData.inactive}`);
        console.log(`      Graduated: ${studentStatsData.graduated}`);
        console.log('   📚 By Program:');
        studentStatsData.byProgram?.slice(0, 5).forEach((program, index) => {
          console.log(`      ${index + 1}. ${program.program}: ${program.count} students`);
        });
      } else {
        const errorData = await studentStatsResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 7: GET /api/reports/monthly-income with different parameters
    console.log('📅 Test 7: GET /api/reports/monthly-income (12 months)');
    try {
      const yearlyResponse = await fetch(`${API_BASE}/api/reports/monthly-income?months=12`, { headers });
      if (yearlyResponse.ok) {
        const yearlyData = await yearlyResponse.json();
        console.log('   ✅ Success!');
        console.log(`   📊 Got ${yearlyData.length} months of data`);
        const totalYearlyIncome = yearlyData.reduce((sum, month) => sum + (month.income || 0), 0);
        const avgMonthlyIncome = totalYearlyIncome / Math.max(1, yearlyData.length);
        console.log(`   💰 Total Yearly Income: Rp ${totalYearlyIncome.toLocaleString()}`);
        console.log(`   📈 Average Monthly: Rp ${avgMonthlyIncome.toLocaleString()}`);
      } else {
        const errorData = await yearlyResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 8: GET /api/reports/payment-methods with different parameters
    console.log('💳 Test 8: GET /api/reports/payment-methods (7 days)');
    try {
      const weeklyMethodsResponse = await fetch(`${API_BASE}/api/reports/payment-methods?days=7`, { headers });
      if (weeklyMethodsResponse.ok) {
        const weeklyMethodsData = await weeklyMethodsResponse.json();
        console.log('   ✅ Success!');
        console.log('   💰 Payment Methods (last 7 days):');
        const totalWeeklyPayments = weeklyMethodsData.reduce((sum, method) => sum + method.count, 0);
        console.log(`   📊 Total payments: ${totalWeeklyPayments}`);
        weeklyMethodsData.forEach((method, index) => {
          console.log(`      ${index + 1}. ${method.method}: ${method.count} (${method.percentage}%)`);
        });
      } else {
        const errorData = await weeklyMethodsResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 9: Test authentication (without token)
    console.log('🔒 Test 9: Authentication test (no token)');
    try {
      const noAuthResponse = await fetch(`${API_BASE}/api/reports/statistics`);
      if (noAuthResponse.ok) {
        console.log('   ❌ Should require authentication!');
      } else if (noAuthResponse.status === 401) {
        const errorData = await noAuthResponse.json();
        console.log('   ✅ Authentication working correctly:', errorData.error);
      } else {
        const errorData = await noAuthResponse.json();
        console.log('   ❌ Unexpected response:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

    // Test 10: Test parameter validation
    console.log('⚠️  Test 10: Parameter validation');
    try {
      const invalidParamsResponse = await fetch(`${API_BASE}/api/reports/monthly-income?months=abc`, { headers });
      if (invalidParamsResponse.ok) {
        const data = await invalidParamsResponse.json();
        console.log('   ✅ Invalid parameter handled gracefully - defaults applied');
        console.log(`   📊 Returned ${data.length} months of data`);
      } else {
        const errorData = await invalidParamsResponse.json();
        console.log('   ❌ Error:', errorData);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
    console.log('');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('🎉 Reports & Analytics API Testing Complete!');
}

testReportsAPI();