const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugDatabaseStructure() {
  console.log('🔍 Debugging Database Structure and Data...\n');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pembayaran_kampus_local'
  });

  try {
    // 1. Check bills table structure
    console.log('1. Bills table structure:');
    const [billColumns] = await connection.execute('DESCRIBE bills');
    billColumns.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

    // 2. Check if we have any bills data
    console.log('\\n2. Bills data sample:');
    const [bills] = await connection.execute('SELECT * FROM bills LIMIT 3');
    console.log(`   Found ${bills.length} bills`);
    bills.forEach((bill, index) => {
      console.log(`   Bill ${index + 1}:`, {
        id: bill.id,
        student_id: bill.student_id,
        description: bill.description,
        amount: bill.amount,
        status: bill.status,
        paid_amount: bill.paid_amount,
        type: bill.type
      });
    });

    // 3. Check students data
    console.log('\\n3. Students data sample:');
    const [students] = await connection.execute('SELECT * FROM students LIMIT 3');
    console.log(`   Found ${students.length} students`);
    students.forEach((student, index) => {
      console.log(`   Student ${index + 1}:`, {
        id: student.id,
        name: student.name,
        nim_kashif: student.nim_kashif,
        prodi: student.prodi,
        status: student.status
      });
    });

    // 4. Check payments data
    console.log('\\n4. Payments data sample:');
    const [payments] = await connection.execute('SELECT * FROM payments LIMIT 3');
    console.log(`   Found ${payments.length} payments`);
    payments.forEach((payment, index) => {
      console.log(`   Payment ${index + 1}:`, {
        id: payment.id,
        student_id: payment.student_id,
        bill_id: payment.bill_id,
        amount: payment.amount,
        status: payment.status
      });
    });

    // 5. Test JOIN query for payment ID 2
    console.log('\\n5. Testing payment detail JOIN query for ID 2:');
    try {
      const [result] = await connection.execute(`
        SELECT 
          p.id,
          p.bill_id,
          p.amount,
          p.status,
          b.description as bill_description,
          b.amount as bill_amount,
          b.status as bill_status,
          b.paid_amount as bill_paid_amount,
          b.type as bill_type
        FROM payments p
        LEFT JOIN bills b ON p.bill_id = b.id
        WHERE p.id = 2
      `);
      
      if (result.length > 0) {
        console.log('   ✅ JOIN query successful!');
        console.log('   📄 Result:', result[0]);
      } else {
        console.log('   ❌ No results found for payment ID 2');
      }
      
    } catch (queryError) {
      console.log('   ❌ JOIN query failed:', queryError.message);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await connection.end();
  }
}

debugDatabaseStructure();