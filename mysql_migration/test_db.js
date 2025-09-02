// Test Database Connection
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root', 
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pembayaran_kampus_local',
  port: process.env.DB_PORT || 3306
};

async function testConnection() {
  console.log('🔍 Testing MySQL Database Connection...');
  console.log('📋 Configuration:');
  console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
  console.log(`   User: ${dbConfig.user}`);
  console.log(`   Database: ${dbConfig.database}`);
  console.log('');

  try {
    // Test basic connection
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connection successful!');

    // Test database exists
    const [databases] = await connection.execute('SHOW DATABASES');
    const dbExists = databases.some(db => db.Database === dbConfig.database);
    
    if (dbExists) {
      console.log(`✅ Database '${dbConfig.database}' exists`);
    } else {
      console.log(`❌ Database '${dbConfig.database}' not found`);
      console.log('Available databases:', databases.map(db => db.Database).join(', '));
      await connection.end();
      return;
    }

    // Test tables exist
    console.log('\n🔍 Checking required tables...');
    const requiredTables = ['users', 'students', 'bills', 'payments', 'programs', 'bill_categories'];
    
    for (const tableName of requiredTables) {
      try {
        const [result] = await connection.execute(`SHOW TABLES LIKE '${tableName}'`);
        if (result.length > 0) {
          console.log(`   ✅ Table '${tableName}' exists`);
        } else {
          console.log(`   ❌ Table '${tableName}' missing`);
        }
      } catch (error) {
        console.log(`   ❌ Error checking table '${tableName}': ${error.message}`);
      }
    }

    // Test users table structure and data
    console.log('\n🔍 Checking users table...');
    try {
      const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
      console.log(`   📊 Total users: ${users[0].count}`);

      if (users[0].count > 0) {
        const [adminUsers] = await connection.execute("SELECT email, role FROM users WHERE role IN ('admin', 'staff') LIMIT 5");
        console.log('   👥 Admin/Staff users:');
        adminUsers.forEach(user => {
          console.log(`      - ${user.email} (${user.role})`);
        });
      }
    } catch (error) {
      console.log(`   ❌ Error checking users: ${error.message}`);
    }

    await connection.end();
    console.log('\n🎉 Database test completed successfully!');

  } catch (error) {
    console.error('\n❌ Database connection failed:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code}`);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Possible solutions:');
      console.error('   1. Check username and password in .env file');
      console.error('   2. Make sure MySQL server is running (Laragon)');
      console.error('   3. Verify database user permissions');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Possible solutions:');
      console.error('   1. Start MySQL server in Laragon');
      console.error('   2. Check if port 3306 is correct');
      console.error('   3. Verify MySQL service is running');
    }
  }
}

// Run the test
testConnection();