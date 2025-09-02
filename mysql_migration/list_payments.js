const mysql = require('mysql2/promise');

// Script to list payments in the database
async function listPayments() {
  console.log('📋 Listing Payments...\n');
  
  // Database connection configuration
  const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'pembayaran_kampus_local', // Updated to correct database name
    port: 3306
  };
  
  let connection;
  
  try {
    // Connect to database
    console.log('1. Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('   ✅ Connected to database\n');
    
    // Get payment count
    console.log('2. Getting payment count...');
    const [countResult] = await connection.execute('SELECT COUNT(*) as count FROM payments');
    const totalCount = countResult[0].count;
    console.log(`   📊 Total payments: ${totalCount}\n`);
    
    // List recent payments
    console.log('3. Listing recent payments...');
    const [payments] = await connection.execute(`
      SELECT 
        p.id,
        p.bill_id,
        p.student_id,
        p.amount,
        p.payment_method,
        p.payment_date,
        p.receipt_number,
        p.status,
        s.name as student_name,
        s.nim_kashif as student_nim,
        b.description as bill_description
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
      LEFT JOIN bills b ON p.bill_id = b.id
      ORDER BY p.payment_date DESC, p.created_at DESC
      LIMIT 20
    `);
    
    if (payments.length === 0) {
      console.log('   ⚠️  No payments found in database');
    } else {
      console.log(`   📋 Found ${payments.length} payments (showing up to 20):`);
      console.log('   ' + '='.repeat(120));
      console.log('   | ID  | Bill ID | Student ID | Amount    | Method      | Date       | Receipt Number | Status     |');
      console.log('   ' + '='.repeat(120));
      
      payments.forEach(payment => {
        console.log(`   | ${String(payment.id).padStart(3)} | ${String(payment.bill_id).padStart(7)} | ${String(payment.student_id).padStart(10)} | ${String(payment.amount).padStart(9)} | ${payment.payment_method.padEnd(11).substring(0,11)} | ${payment.payment_date} | ${payment.receipt_number.padEnd(14).substring(0,14)} | ${payment.status.padEnd(10).substring(0,10)} |`);
      });
      
      console.log('   ' + '='.repeat(120));
      
      // Show details for payment ID 10 if it exists
      const payment10 = payments.find(p => p.id == 10);
      if (payment10) {
        console.log('\n🔍 Details for Payment ID 10:');
        console.log('   📊 ID:', payment10.id);
        console.log('   💰 Amount:', payment10.amount);
        console.log('   📅 Payment Date:', payment10.payment_date);
        console.log('   💳 Method:', payment10.payment_method);
        console.log('   📄 Receipt Number:', payment10.receipt_number);
        console.log('   📈 Status:', payment10.status);
        console.log('   👤 Student:', payment10.student_name, `(${payment10.student_nim})`);
        console.log('   📝 Bill Description:', payment10.bill_description);
      } else {
        console.log('\n⚠️  Payment ID 10 not found in recent payments');
        console.log('   💡 It may not exist or may be older than the 20 most recent payments');
      }
    }
    
    console.log('\n🎯 Payment Listing Complete!');
    
  } catch (error) {
    console.log('❌ Failed to list payments:');
    console.log('   💡 Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('   💡 Cannot connect to MySQL database');
      console.log('   💡 Please make sure MySQL is running');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('   💡 Database not found');
      console.log('   💡 Please create the database first');
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔒 Database connection closed');
    }
  }
}

listPayments();