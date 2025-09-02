const mysql = require('mysql2/promise');
require('dotenv').config();

async function updatePaymentsTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pembayaran_kampus_local',
    port: process.env.DB_PORT || 3306
  });

  try {
    console.log('🔧 Updating payments table structure...');
    
    // Check if notes column exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'notes'
    `, [process.env.DB_NAME || 'pembayaran_kampus_local']);

    if (columns.length === 0) {
      console.log('   📝 Adding notes column...');
      await connection.execute(`
        ALTER TABLE payments 
        ADD COLUMN notes TEXT AFTER receipt_number
      `);
      console.log('   ✅ Notes column added successfully');
    } else {
      console.log('   ✅ Notes column already exists');
    }

    // Check if updated_at column exists
    const [updatedAtColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'updated_at'
    `, [process.env.DB_NAME || 'pembayaran_kampus_local']);

    if (updatedAtColumns.length === 0) {
      console.log('   📝 Adding updated_at column...');
      await connection.execute(`
        ALTER TABLE payments 
        ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at
      `);
      console.log('   ✅ Updated_at column added successfully');
    } else {
      console.log('   ✅ Updated_at column already exists');
    }

    // Show final table structure
    console.log('\n📋 Final payments table structure:');
    const [structure] = await connection.execute('DESCRIBE payments');
    console.table(structure);

    console.log('\n🎉 Payments table update completed!');
    
  } catch (error) {
    console.error('❌ Error updating payments table:', error.message);
  } finally {
    await connection.end();
  }
}

updatePaymentsTable();