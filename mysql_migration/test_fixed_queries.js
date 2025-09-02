const mysql = require('mysql2/promise');
require('dotenv').config();

async function testFixedQueries() {
  console.log('🔧 Testing Fixed Reports Queries...\n');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pembayaran_kampus'
  });

  try {
    // Test fixed top programs query
    console.log('🏆 Testing FIXED top programs query:');
    try {
      const [programsResult] = await connection.execute(`
        SELECT 
          program_name as prodi,
          student_count as students,
          total_revenue as revenue
        FROM (
          SELECT 
            COALESCE(p.name, s.prodi, 'Lainnya') as program_name,
            COUNT(DISTINCT s.id) as student_count,
            SUM(pay.amount) as total_revenue
          FROM payments pay
          JOIN students s ON pay.student_id = s.id
          LEFT JOIN programs p ON s.program_id = p.id
          WHERE 
            pay.payment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            AND pay.status = 'completed'
          GROUP BY p.id, p.name, s.prodi
          ORDER BY total_revenue DESC
          LIMIT 5
        ) AS program_stats
      `);
      console.log('✅ FIXED Top programs query successful:');
      console.table(programsResult);
    } catch (error) {
      console.log('❌ FIXED Top programs query failed:', error.message);
    }

    // Test fixed student stats query
    console.log('\n👥 Testing FIXED student stats query:');
    try {
      const [programResult] = await connection.execute(`
        SELECT 
          program_name as program,
          student_count as count
        FROM (
          SELECT 
            COALESCE(p.name, s.prodi, 'Lainnya') as program_name,
            COUNT(*) as student_count
          FROM students s
          LEFT JOIN programs p ON s.program_id = p.id
          GROUP BY p.id, p.name, s.prodi
          ORDER BY student_count DESC
          LIMIT 10
        ) AS program_stats
      `);
      console.log('✅ FIXED Student stats query successful:');
      console.table(programResult);
    } catch (error) {
      console.log('❌ FIXED Student stats query failed:', error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await connection.end();
  }
}

testFixedQueries();