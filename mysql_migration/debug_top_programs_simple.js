const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugTopProgramsSimple() {
  console.log('🔍 Debug Top Programs - Simple Test...\n');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pembayaran_kampus'
  });

  try {
    // Test the exact same query from the API with same parameters
    const daysCount = 30;
    const limitCount = 5;
    
    console.log('Testing query with parameters:');
    console.log('- daysCount:', daysCount);
    console.log('- limitCount:', limitCount);
    
    const query = `
      SELECT 
        IFNULL(p.name, s.prodi) as prodi,
        COUNT(DISTINCT s.id) as students,
        IFNULL(SUM(pay.amount), 0) as revenue
      FROM students s
      LEFT JOIN programs p ON s.program_id = p.id
      LEFT JOIN payments pay ON pay.student_id = s.id 
        AND pay.payment_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND pay.status = 'completed'
      GROUP BY p.name, s.prodi
      HAVING prodi IS NOT NULL
      ORDER BY revenue DESC, students DESC
      LIMIT ${limitCount}
    `;
    
    console.log('\nExecuting query with 1 parameter:', [daysCount]);
    
    const [programsResult] = await connection.execute(query, [daysCount]);
    
    console.log('✅ Query successful!');
    console.log('Raw result:', programsResult);
    
    // Format like the API does
    const topPrograms = programsResult.map(row => ({
      prodi: row.prodi || 'Lainnya',
      students: parseInt(row.students) || 0,
      revenue: parseFloat(row.revenue) || 0
    }));
    
    console.log('\n📊 Formatted result:');
    console.log(JSON.stringify(topPrograms, null, 2));
    
  } catch (error) {
    console.log('❌ Query failed:', error.message);
    console.log('❌ Full error:', error);
  } finally {
    await connection.end();
  }
}

debugTopProgramsSimple();