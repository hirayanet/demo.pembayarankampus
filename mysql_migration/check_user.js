const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'pembayaran_kampus_local',
  port: 3306
};

async function checkUser() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // Check if user exists
    const [users] = await connection.execute(
      'SELECT * FROM users WHERE email = ?',
      ['test1756731036726@kampus.edu']
    );
    
    console.log('Users found:', users.length);
    
    if (users.length > 0) {
      console.log('User details:', users[0]);
      
      // Check if the must_change_password flag is set
      console.log('Must change password:', users[0].must_change_password);
      
      // Try to verify the password
      const bcrypt = require('bcrypt');
      const valid = await bcrypt.compare('kamal123', users[0].password_hash);
      console.log('Password "kamal123" is valid:', valid);
    } else {
      console.log('No user found with that email');
    }
    
    await connection.end();
  } catch (error) {
    console.error('Error checking user:', error);
  }
}

checkUser();