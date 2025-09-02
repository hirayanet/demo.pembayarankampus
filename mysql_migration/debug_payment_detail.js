const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugPaymentDetail() {
  console.log('🔍 Debugging Payment Detail Error...\n');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pembayaran_kampus_local'
  });

  try {
    // 1. Check if payment ID 2 exists
    console.log('1. Checking if payment ID 2 exists...');
    const [payments] = await connection.execute('SELECT * FROM payments WHERE id = 2');
    console.log(`   Payment ID 2 exists: ${payments.length > 0}`);
    
    if (payments.length > 0) {
      console.log('   Payment data:', {
        id: payments[0].id,
        student_id: payments[0].student_id,
        bill_id: payments[0].bill_id,
        amount: payments[0].amount,
        status: payments[0].status
      });
    }

    // 2. Check table structures for potential issues
    console.log('\n2. Checking table structures...');
    
    // Check payments table structure
    console.log('   📋 Payments table structure:');
    const [paymentColumns] = await connection.execute('DESCRIBE payments');
    paymentColumns.forEach(col => {
      console.log(`      ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    // Check students table structure for 'semester' column
    console.log('   📋 Students table structure:');
    const [studentColumns] = await connection.execute('DESCRIBE students');
    const hasSemester = studentColumns.some(col => col.Field === 'semester');
    console.log(`      Has 'semester' column: ${hasSemester}`);
    
    if (!hasSemester) {
      console.log('   ⚠️  WARNING: students table missing "semester" column!');
      console.log('   This might cause the 500 error in the API query.');
    }

    // 3. Test the exact query from auth_server.js
    console.log('\n3. Testing exact API query...');
    try {
      const [result] = await connection.execute(`
        SELECT 
          p.id,
          p.student_id,
          p.bill_id,
          p.amount,
          p.payment_date,
          p.payment_method,
          p.receipt_number,
          p.notes,
          p.status,
          p.created_at,
          p.updated_at,
          s.name as student_name,
          s.nim_kashif as student_nim,
          s.nim_dikti as student_nim_dikti,
          s.prodi as student_prodi,
          s.semester as student_semester,
          b.description as bill_description,
          b.category as bill_category,
          b.amount as bill_amount,
          b.status as bill_status,
          bc.name as category_name
        FROM payments p
        LEFT JOIN students s ON p.student_id = s.id
        LEFT JOIN bills b ON p.bill_id = b.id
        LEFT JOIN bill_categories bc ON b.category_id = bc.id
        WHERE p.id = ?
      `, [2]);
      
      console.log('   ✅ Query executed successfully!');
      if (result.length > 0) {
        console.log('   📄 Result:', result[0]);
      } else {
        console.log('   ❌ No results found for payment ID 2');
      }
      
    } catch (queryError) {
      console.log('   ❌ Query failed:', queryError.message);
      console.log('   This is likely the cause of the 500 error!');
      
      // Try query without problematic columns
      console.log('\n4. Testing simplified query...');
      try {
        const [simpleResult] = await connection.execute(`
          SELECT 
            p.id,
            p.student_id,
            p.bill_id,
            p.amount,
            p.payment_date,
            p.payment_method,
            p.receipt_number,
            p.notes,
            p.status,
            p.created_at,
            p.updated_at,
            s.name as student_name,
            s.nim_kashif as student_nim,
            s.nim_dikti as student_nim_dikti,
            s.prodi as student_prodi,
            b.description as bill_description,
            b.category as bill_category,
            b.amount as bill_amount,
            b.status as bill_status,
            bc.name as category_name
          FROM payments p
          LEFT JOIN students s ON p.student_id = s.id
          LEFT JOIN bills b ON p.bill_id = b.id
          LEFT JOIN bill_categories bc ON b.category_id = bc.id
          WHERE p.id = ?
        `, [2]);
        
        console.log('   ✅ Simplified query works!');
        console.log('   💡 Issue is with the "semester" column reference');
        
      } catch (simpleError) {
        console.log('   ❌ Even simplified query failed:', simpleError.message);
      }
    }

    // 4. Check if there are any payments at all
    console.log('\n5. Checking available payments...');
    const [allPayments] = await connection.execute('SELECT id, student_id, bill_id, amount, status FROM payments LIMIT 5');
    console.log('   📊 Available payments:');
    allPayments.forEach(payment => {
      console.log(`      ID ${payment.id}: Student ${payment.student_id}, Bill ${payment.bill_id}, Amount ${payment.amount}, Status ${payment.status}`);
    });

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await connection.end();
  }
}

debugPaymentDetail();