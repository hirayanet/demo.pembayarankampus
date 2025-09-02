const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

// Script to create/reset admin user
async function createAdminUser() {
  console.log('🔧 Creating Admin User...');
  
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
    
    // Delete existing admin user if exists
    console.log('2. Removing existing admin user (if any)...');
    await connection.execute("DELETE FROM users WHERE email = 'admin@kampus.edu'");
    console.log('   ✅ Existing admin user removed\n');
    
    // Create new admin user with known credentials
    console.log('3. Creating new admin user...');
    const email = 'admin@kampus.edu';
    const password = 'admin123';
    const fullName = 'Admin Kampus';
    const role = 'admin';
    
    // Generate a proper bcrypt hash for the password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    await connection.execute(`
      INSERT INTO users (uuid, email, password_hash, full_name, role, email_verified, created_at, updated_at)
      VALUES (UUID(), ?, ?, ?, ?, 1, NOW(), NOW())
    `, [email, passwordHash, fullName, role]);
    
    console.log('   ✅ Admin user created successfully');
    console.log('   📧 Email:', email);
    console.log('   🔑 Password:', password);
    console.log('   🎯 Role:', role);
    console.log('\n💡 You can now login with these credentials');
    
  } catch (error) {
    console.log('❌ Failed to create admin user:');
    console.log('   💡 Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('   💡 Cannot connect to MySQL database');
      console.log('   💡 Please make sure MySQL is running');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('   💡 Database not found');
      console.log('   💡 Available databases:');
      // List available databases
      try {
        const tempConnection = await mysql.createConnection({
          host: 'localhost',
          user: 'root',
          password: '',
          port: 3306
        });
        const [databases] = await tempConnection.execute('SHOW DATABASES');
        databases.forEach(db => {
          console.log(`      - ${db.Database}`);
        });
        await tempConnection.end();
      } catch (e) {
        console.log('   💡 Could not list databases:', e.message);
      }
    } else if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log('   💡 Users table not found');
      console.log('   💡 Please run database migrations first');
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔒 Database connection closed');
    }
  }
}

createAdminUser();