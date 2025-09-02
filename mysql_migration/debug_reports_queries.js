const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugReportsQueries() {
  console.log('🔍 Debugging Reports API Queries...\n');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pembayaran_kampus'
  });

  try {
    // Check payments table structure and data
    console.log('📋 Checking payments table structure:');
    const [describe] = await connection.execute('DESCRIBE payments');
    console.table(describe);
    
    console.log('\n📊 Sample payments data:');
    const [payments] = await connection.execute('SELECT * FROM payments LIMIT 5');
    console.table(payments);
    
    // Check students table
    console.log('\n👨‍🎓 Sample students data:');
    const [students] = await connection.execute('SELECT * FROM students LIMIT 3');
    console.table(students);
    
    // Check programs table
    console.log('\n🎓 Sample programs data:');
    const [programs] = await connection.execute('SELECT * FROM programs LIMIT 3');
    console.table(programs);

    // Test monthly income query
    console.log('\n📅 Testing monthly income query:');
    try {
      const [monthlyResult] = await connection.execute(`
        SELECT 
          DATE_FORMAT(payment_date, '%Y-%m') as month_key,
          DATE_FORMAT(MIN(payment_date), '%M %Y') as month_name,
          SUM(amount) as income
        FROM payments 
        WHERE 
          payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
          AND status = 'completed'
        GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
        ORDER BY month_key ASC
      `);
      console.log('✅ Monthly income query successful:');
      console.table(monthlyResult);
    } catch (error) {
      console.log('❌ Monthly income query failed:', error.message);
    }

    // Test top programs query
    console.log('\n🏆 Testing top programs query:');
    try {
      const [programsResult] = await connection.execute(`
        SELECT 
          COALESCE(p.name, s.prodi, 'Lainnya') as prodi,
          COUNT(DISTINCT s.id) as students,
          SUM(pay.amount) as revenue
        FROM payments pay
        JOIN students s ON pay.student_id = s.id
        LEFT JOIN programs p ON s.program_id = p.id
        WHERE 
          pay.payment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          AND pay.status = 'completed'
        GROUP BY p.id, p.name, s.prodi
        ORDER BY revenue DESC
        LIMIT 5
      `);
      console.log('✅ Top programs query successful:');
      console.table(programsResult);
    } catch (error) {
      console.log('❌ Top programs query failed:', error.message);
    }

    // Test student stats query
    console.log('\n👥 Testing student stats query:');
    try {
      const [statusResult] = await connection.execute(`
        SELECT 
          status,
          COUNT(*) as count
        FROM students
        GROUP BY status
      `);
      console.log('✅ Student status query successful:');
      console.table(statusResult);

      const [programResult] = await connection.execute(`
        SELECT 
          COALESCE(p.name, s.prodi, 'Lainnya') as program,
          COUNT(*) as count
        FROM students s
        LEFT JOIN programs p ON s.program_id = p.id
        GROUP BY p.id, p.name, s.prodi
        ORDER BY count DESC
        LIMIT 10
      `);
      console.log('✅ Student program query successful:');
      console.table(programResult);
    } catch (error) {
      console.log('❌ Student stats query failed:', error.message);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await connection.end();
  }
}

debugReportsQueries();