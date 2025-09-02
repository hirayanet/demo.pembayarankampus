const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixPaymentsTableStructure() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pembayaran_kampus_local',
    port: process.env.DB_PORT || 3306
  });

  try {
    console.log('🔧 Fixing payments table structure...');
    
    // Check current table structure
    console.log('\n📋 Current payments table structure:');
    const [currentStructure] = await connection.execute('DESCRIBE payments');
    console.table(currentStructure);
    
    // Check if there are any existing payments
    const [paymentCount] = await connection.execute('SELECT COUNT(*) as count FROM payments');
    console.log(`\n📊 Current payments count: ${paymentCount[0].count}`);
    
    if (paymentCount[0].count > 0) {
      console.log('⚠️  Warning: Table has existing data. Backing up first...');
      // Create backup table
      await connection.execute(`
        CREATE TABLE payments_backup AS SELECT * FROM payments
      `);
      console.log('✅ Backup created as payments_backup');
    }
    
    // Drop and recreate the table with correct structure
    console.log('\n🔄 Recreating payments table with correct structure...');
    
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    await connection.execute('DROP TABLE IF EXISTS payments');
    
    await connection.execute(`
      CREATE TABLE payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
        bill_id INT,
        student_id INT NOT NULL,
        amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
        payment_method VARCHAR(100) NOT NULL,
        payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        receipt_number VARCHAR(255) UNIQUE NOT NULL,
        notes TEXT,
        status ENUM('completed', 'pending', 'failed') DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )
    `);
    
    // Create indexes
    await connection.execute('CREATE INDEX idx_payments_bill_id ON payments(bill_id)');
    await connection.execute('CREATE INDEX idx_payments_student_id ON payments(student_id)');
    await connection.execute('CREATE INDEX idx_payments_date ON payments(payment_date)');
    await connection.execute('CREATE INDEX idx_payments_receipt ON payments(receipt_number)');
    await connection.execute('CREATE INDEX idx_payments_status ON payments(status)');
    
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    
    // Show final table structure
    console.log('\n📋 New payments table structure:');
    const [newStructure] = await connection.execute('DESCRIBE payments');
    console.table(newStructure);
    
    console.log('\n🎉 Payments table structure fixed successfully!');
    console.log('✅ Now payments table uses AUTO_INCREMENT for id and UUID() for uuid columns');
    
  } catch (error) {
    console.error('❌ Error fixing payments table:', error.message);
  } finally {
    await connection.end();
  }
}

fixPaymentsTableStructure();