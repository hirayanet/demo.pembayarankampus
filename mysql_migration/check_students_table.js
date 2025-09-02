// Check Students Table Structure
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pembayaran_kampus_local',
  port: process.env.DB_PORT || 3306
};

async function checkStudentsTable() {
  console.log('🔍 Checking Students Table Structure...\n');
  
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // Check table structure
    console.log('📋 Table structure:');
    const [columns] = await connection.execute('DESCRIBE students');
    columns.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `(${col.Key})` : ''}`);
    });
    
    // Count existing students
    const [count] = await connection.execute('SELECT COUNT(*) as total FROM students');
    console.log(`\n📊 Total students: ${count[0].total}`);
    
    // Show sample data if exists
    if (count[0].total > 0) {
      console.log('\n👥 Sample students:');
      const [samples] = await connection.execute('SELECT id, nim_kashif, name, email, prodi, status FROM students LIMIT 3');
      samples.forEach((student, i) => {
        console.log(`   ${i+1}. ${student.name} (${student.nim_kashif}) - ${student.prodi} - ${student.status}`);
        console.log(`      ID: ${student.id}`);
        console.log(`      Email: ${student.email}`);
      });
    }
    
    await connection.end();
    console.log('\n✅ Check completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkStudentsTable();