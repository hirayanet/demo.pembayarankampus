// Check Users in Database
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pembayaran_kampus_local',
  port: process.env.DB_PORT || 3306
};

async function checkUsers() {
  console.log('👥 Checking Users in Database...\n');

  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // Get all users
    const [users] = await connection.execute(
      'SELECT email, role, password_hash, created_at FROM users ORDER BY role, email'
    );

    console.log('📊 Users in database:');
    for (const user of users) {
      console.log(`\n🎭 ${user.role.toUpperCase()}: ${user.email}`);
      console.log(`   📅 Created: ${user.created_at}`);
      console.log(`   🔐 Password hash: ${user.password_hash.substring(0, 20)}...`);
      
      // Test common passwords
      const testPasswords = ['admin123', 'staff123', 'secret', 'password'];
      console.log('   🧪 Testing common passwords:');
      
      for (const testPassword of testPasswords) {
        try {
          const isValid = await bcrypt.compare(testPassword, user.password_hash);
          if (isValid) {
            console.log(`      ✅ Password '${testPassword}' is CORRECT`);
          } else {
            console.log(`      ❌ Password '${testPassword}' is incorrect`);
          }
        } catch (error) {
          console.log(`      ⚠️  Error testing password '${testPassword}': ${error.message}`);
        }
      }
    }

    // Create/update staff user with correct password
    console.log('\n🔧 Fixing staff user password...');
    const staffPassword = 'staff123';
    const saltRounds = 10;
    const staffHash = await bcrypt.hash(staffPassword, saltRounds);

    await connection.execute(
      `UPDATE users SET password_hash = ? WHERE email = 'staff@kampus.edu'`,
      [staffHash]
    );
    
    console.log(`✅ Staff password updated to: ${staffPassword}`);

    await connection.end();
    console.log('\n🎉 User check completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkUsers();