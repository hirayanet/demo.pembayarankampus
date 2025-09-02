const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugPaymentsTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pembayaran_kampus_local',
    port: process.env.DB_PORT || 3306
  });

  try {
    console.log('🔍 Debugging payments table...\n');
    
    // 1. Check table structure
    console.log('📋 Table structure:');
    const [structure] = await connection.execute('DESCRIBE payments');
    console.table(structure);
    
    // 2. Check table creation SQL
    console.log('\n🏗️  Table creation SQL:');
    const [createTable] = await connection.execute('SHOW CREATE TABLE payments');
    console.log(createTable[0]['Create Table']);
    
    // 3. Check current AUTO_INCREMENT value
    console.log('\n🔢 Auto increment status:');
    const [autoIncrement] = await connection.execute(`
      SELECT AUTO_INCREMENT 
      FROM information_schema.tables 
      WHERE table_schema = ? AND table_name = 'payments'
    `, [process.env.DB_NAME || 'pembayaran_kampus_local']);
    console.log('Current AUTO_INCREMENT value:', autoIncrement[0]?.AUTO_INCREMENT || 'Not set');
    
    // 4. Test a simple insert to see what happens
    console.log('\n🧪 Testing simple insert...');
    try {
      await connection.execute(`
        INSERT INTO payments (
          student_id, bill_id, amount, payment_method, receipt_number, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [1, 1, 1000000, 'test', 'TEST-' + Date.now(), 'Test insert', 'completed']);
      
      console.log('✅ Test insert successful!');
      
      // Get the inserted record
      const [lastInsert] = await connection.execute('SELECT * FROM payments ORDER BY id DESC LIMIT 1');
      console.log('📄 Last inserted record:');
      console.table(lastInsert);
      
      // Clean up test record
      await connection.execute('DELETE FROM payments WHERE receipt_number LIKE ?', ['TEST-%']);
      console.log('🧹 Test record cleaned up');
      
    } catch (insertError) {
      console.log('❌ Test insert failed:', insertError.message);
      console.log('📊 Error details:', insertError);
    }
    
  } catch (error) {
    console.error('❌ Error debugging payments table:', error.message);
  } finally {
    await connection.end();
  }
}

debugPaymentsTable();