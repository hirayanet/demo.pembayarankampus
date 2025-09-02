const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function createStudentUser() {
  try {
    console.log('🔍 Checking existing users...');
    
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'pembayaran_kampus_local'
    });

    // Cek users yang ada
    const [users] = await connection.execute('SELECT id, email, full_name, role FROM users ORDER BY role, email');
    console.log('📋 Current users in database:');
    users.forEach(user => {
      console.log(`   - ${user.email} (${user.role}) - ${user.full_name}`);
    });

    // Cek apakah sudah ada user mahasiswa
    const studentExists = users.some(user => user.role === 'student');
    
    if (!studentExists) {
      console.log('\n➕ Creating student user...');
      
      const email = 'mahasiswa@kampus.edu';
      const password = 'student123';
      const passwordHash = await bcrypt.hash(password, 10);
      
      await connection.execute(`
        INSERT INTO users (uuid, email, password_hash, full_name, role, email_verified) 
        VALUES (UUID(), ?, ?, ?, ?, ?)
      `, [email, passwordHash, 'Mahasiswa Test', 'student', true]);
      
      console.log('✅ Student user created successfully!');
      console.log(`   📧 Email: ${email}`);
      console.log(`   🔑 Password: ${password}`);
    } else {
      console.log('\n✅ Student user already exists!');
      const studentUser = users.find(user => user.role === 'student');
      console.log(`   📧 Email: ${studentUser.email}`);
      console.log(`   🔑 Password: student123 (assumed)`);
    }

    await connection.end();
    
    console.log('\n🎉 Ready for student login testing!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createStudentUser();