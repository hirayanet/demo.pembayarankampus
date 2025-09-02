const mysql = require('mysql2/promise');
require('dotenv').config();

async function testTopProgramsQuery() {
  console.log('🏆 Testing ONLY Top Programs Query...\n');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pembayaran_kampus'
  });

  try {
    console.log('Testing NEW simplified top programs query:');
    const [programsResult] = await connection.execute(`
      SELECT 
        IFNULL(p.name, s.prodi) as prodi,
        COUNT(DISTINCT s.id) as students,
        IFNULL(SUM(pay.amount), 0) as revenue
      FROM students s
      LEFT JOIN programs p ON s.program_id = p.id
      LEFT JOIN payments pay ON pay.student_id = s.id 
        AND pay.payment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND pay.status = 'completed'
      GROUP BY p.name, s.prodi
      HAVING prodi IS NOT NULL
      ORDER BY revenue DESC, students DESC
      LIMIT 5
    `);
    
    console.log('✅ NEW Top programs query SUCCESS:');
    console.table(programsResult);
    
    // Format like API response
    const formattedResult = programsResult.map(row => ({
      prodi: row.prodi || 'Lainnya',
      students: parseInt(row.students) || 0,
      revenue: parseFloat(row.revenue) || 0
    }));
    
    console.log('\n📊 NEW Formatted API Response:');
    console.table(formattedResult);
    
  } catch (error) {
    console.log('❌ Query failed:', error.message);
  } finally {
    await connection.end();
  }
}

testTopProgramsQuery();