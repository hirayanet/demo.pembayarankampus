const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// JSON parse error handler (returns 400 instead of crashing)
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  next();
});

// Database connection
const dbConfig = {
  host: process.env.DB_HOST || 'lmysql.railway.internal',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'ZwYMpmewxGFnJCuYiMlXdOpKexopJlee',
  database: process.env.DB_NAME || 'railway',
  port: process.env.DB_PORT || 3306
};

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Helper function to get database connection
async function getConnection() {
  return await mysql.createConnection(dbConfig);
}

// Middleware untuk verifikasi JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// =====================
// AUTH ROUTES
// =====================

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const connection = await getConnection();
    
    const [users] = await connection.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user needs to change password on first login
    if (user.must_change_password) {
      await connection.end();
      return res.status(200).json({
        mustChangePassword: true,
        message: 'Password change required',
        user: {
          id: user.uuid,
          email: user.email,
          full_name: user.full_name,
          role: user.role
        }
      });
    }

    // Update last login
    await connection.execute(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    // Generate JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        uuid: user.uuid,
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await connection.end();

    res.json({
      token,
      user: {
        id: user.uuid, // Use UUID for frontend compatibility
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register (for testing purposes)
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, full_name, role = 'student' } = req.body;
    
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password, and full name are required' });
    }

    const connection = await getConnection();
    
    // Check if user already exists
    const [existingUsers] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const [result] = await connection.execute(
      'INSERT INTO users (email, password_hash, full_name, role, email_verified) VALUES (?, ?, ?, ?, ?)',
      [email, password_hash, full_name, role, true]
    );

    await connection.end();

    res.status(201).json({
      message: 'User created successfully',
      user_id: result.insertId
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admins - Create new admin or staff user (admin only)
app.post('/api/admins', authenticateToken, async (req, res) => {
  let connection;
  try {
    // Check if the requester is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Only admins can create other admins/staff' });
    }
    
    const { email, role = 'staff' } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Validate role
    if (role !== 'admin' && role !== 'staff') {
      return res.status(400).json({ error: 'Invalid role. Must be either "admin" or "staff"' });
    }
    
    connection = await getConnection();
    
    // Check if user already exists
    const [existingUsers] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      await connection.end();
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Set default password based on role
    let defaultPassword;
    if (role === 'staff') {
      defaultPassword = 'staff123';
    } else {
      defaultPassword = 'admin123';
    }
    
    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(defaultPassword, saltRounds);

    // Insert new user
    const [result] = await connection.execute(`
      INSERT INTO users (
        uuid, email, password_hash, full_name, role, 
        email_verified, must_change_password, created_at, updated_at
      ) VALUES (
        UUID(), ?, ?, ?, ?, ?, ?, NOW(), NOW()
      )
    `, [
      email, password_hash, email, role, 
      true, true // email_verified = true, must_change_password = true
    ]);

    await connection.end();

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: result.insertId,
        email: email,
        role: role,
        default_password: defaultPassword
      }
    });

  } catch (error) {
    console.error('Create admin/staff error:', error);
    
    // Close connection if still open
    if (connection) {
      try {
        await connection.end();
      } catch (closeError) {
        console.error('Error closing connection:', closeError);
      }
    }
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'User with this email already exists' });
    } else {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Get current user
app.get('/auth/user', authenticateToken, async (req, res) => {
  try {
    const connection = await getConnection();
    
    const [users] = await connection.execute(
      'SELECT uuid, email, full_name, role, created_at FROM users WHERE uuid = ?',
      [req.user.uuid]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await connection.end();

    res.json(users[0]);

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout (client-side token removal, but we can log it)
app.post('/auth/logout', authenticateToken, (req, res) => {
  // In a real application, you might want to blacklist the token
  // For now, just send success response
  res.json({ message: 'Logged out successfully' });
});

// Change password endpoint
app.post('/auth/change-password', async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;
    
    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and new password are required' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    
    const connection = await getConnection();
    
    // Get user data
    const [users] = await connection.execute(
      'SELECT id, uuid, password_hash, must_change_password FROM users WHERE email = ?',
      [email]
    );
    
    if (users.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = users[0];
    
    // If user must change password, skip current password validation
    if (!user.must_change_password) {
      // For regular password changes, current password is required
      if (!currentPassword) {
        await connection.end();
        return res.status(400).json({ error: 'Current password is required' });
      }
      
      const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!validPassword) {
        await connection.end();
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    }
    
    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    
    // Update password and set must_change_password to false
    await connection.execute(
      'UPDATE users SET password_hash = ?, must_change_password = FALSE, updated_at = NOW() WHERE uuid = ?',
      [newPasswordHash, user.uuid]
    );
    
    await connection.end();
    
    res.json({ message: 'Password changed successfully' });
    
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================
// TEST ROUTES
// =====================

app.post('/auth/logout', authenticateToken, (req, res) => {
  // In a real application, you might want to blacklist the token
  // For now, just send success response
  res.json({ message: 'Logged out successfully' });
});

// =====================
// TEST ROUTES
// =====================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test database connection
app.get('/test-db', async (req, res) => {
  try {
    const connection = await getConnection();
    const [rows] = await connection.execute('SELECT 1 as test');
    await connection.end();
    
    res.json({ 
      status: 'Database connected', 
      result: rows[0],
      config: {
        host: dbConfig.host,
        database: dbConfig.database,
        port: dbConfig.port
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'Database connection failed', 
      error: error.message 
    });
  }
});

// =============================================================================
// DEBUGGING AND USER SETUP ENDPOINTS
// =============================================================================

// Create/Reset admin user with correct password
app.post('/debug/reset-admin', async (req, res) => {
  try {
    const email = 'admin@kampus.edu';
    const password = 'admin123';
    const passwordHash = await bcrypt.hash(password, 10);
    
    const connection = await getConnection();
    
    // Delete existing admin if exists
    await connection.execute('DELETE FROM users WHERE email = ?', [email]);
    
    // Create new admin
    const [result] = await connection.execute(`
      INSERT INTO users (uuid, email, password_hash, full_name, role, email_verified) 
      VALUES (UUID(), ?, ?, ?, ?, ?)
    `, [email, passwordHash, 'Admin Kampus', 'admin', true]);
    
    await connection.end();
    
    res.json({ 
      success: true, 
      message: 'Admin user created successfully',
      email: email,
      password: password
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

// GET /api/users/admins-staff - Get all admin and staff users (admin only)
app.get('/api/users/admins-staff', authenticateToken, async (req, res) => {
  try {
    // Check if the requester is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Only admins can access this resource' });
    }
    
    const connection = await getConnection();
    
    // Get all admin and staff users
    const [users] = await connection.execute(`
      SELECT 
        uuid, email, full_name, role, email_verified, created_at, last_login
      FROM users 
      WHERE role IN ('admin', 'staff')
      ORDER BY created_at DESC
    `);
    
    await connection.end();
    
    res.json(users);
    
  } catch (error) {
    console.error('Get admin/staff users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List all users for debugging
app.get('/debug/users', async (req, res) => {
  try {
    const connection = await getConnection();
    const [rows] = await connection.execute('SELECT id, email, full_name, role, email_verified FROM users');
    await connection.end();
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create/Reset student user with correct password
app.post('/debug/create-student', async (req, res) => {
  try {
    const email = 'mahasiswa@kampus.edu';
    const password = 'student123';
    const passwordHash = await bcrypt.hash(password, 10);
    
    const connection = await getConnection();
    
    // Delete existing student if exists
    await connection.execute('DELETE FROM users WHERE email = ?', [email]);
    
    // Create new student
    const [result] = await connection.execute(`
      INSERT INTO users (uuid, email, password_hash, full_name, role, email_verified) 
      VALUES (UUID(), ?, ?, ?, ?, ?)
    `, [email, passwordHash, 'Mahasiswa Test', 'student', true]);
    
    await connection.end();
    
    res.json({ 
      success: true, 
      message: 'Student user created successfully',
      email: email,
      password: password
    });
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({ error: 'Failed to create student user' });
  }
});

// =============================================================================
// API ENDPOINTS FOR STUDENTS  
// =============================================================================

// GET /api/students - Get all students (with optional filtering)
app.get('/api/students', authenticateToken, async (req, res) => {
  try {
    const { search, status, prodi, angkatan, page = 1, pageSize = 50 } = req.query;
    
    console.log('GET /api/students called with params:', { search, status, prodi, angkatan, page, pageSize }); // Debug log
    
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    
    if (search) {
      whereClause += ' AND (s.name LIKE ? OR s.nim_kashif LIKE ? OR s.nim_dikti LIKE ? OR s.email LIKE ?)';
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }
    
    if (status && status !== 'all') {
      whereClause += ' AND s.status = ?';
      queryParams.push(status);
    }
    
    if (prodi && prodi !== 'all') {
      whereClause += ' AND s.prodi = ?';
      queryParams.push(prodi);
    }
    
    if (angkatan && angkatan !== 'all') {
      whereClause += ' AND s.angkatan = ?';
      queryParams.push(angkatan);
    }
    
    console.log('WHERE clause:', whereClause); // Debug log
    console.log('Query params:', queryParams); // Debug log
    
    const connection = await getConnection();
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM students s 
      LEFT JOIN programs p ON s.program_id = p.id
      ${whereClause}
    `;
    console.log('Count query:', countQuery); // Debug log
    
    const [countResult] = await connection.execute(countQuery, queryParams);
    
    const total = countResult[0].total;
    console.log('Total count:', total); // Debug log
    
    // Calculate pagination
    const limit = parseInt(pageSize);
    const offset = (parseInt(page) - 1) * limit;
    console.log('Pagination:', { limit, offset, page: parseInt(page) }); // Debug log
    
    // Get paginated results - using string interpolation for LIMIT/OFFSET to avoid MySQL parameter issues
    const dataQuery = `
      SELECT 
        s.id,
        s.uuid,
        s.nim_kashif,
        s.nim_dikti,
        s.name,
        s.email,
        s.phone,
        s.prodi,
        s.angkatan,
        s.address,
        s.status,
        s.program_id,
        p.name as program_name,
        s.created_at,
        s.updated_at
      FROM students s 
      LEFT JOIN programs p ON s.program_id = p.id
      ${whereClause}
      ORDER BY s.name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
    console.log('Data query:', dataQuery); // Debug log
    console.log('Query params for WHERE clause:', queryParams); // Debug log
    
    const [rows] = await connection.execute(dataQuery, queryParams);
    
    await connection.end();
    
    console.log('Students pagination result:', { total, dataCount: rows.length, page, pageSize }); // Debug log
    
    res.json({
      data: rows,
      total: total,
      page: parseInt(page),
      pageSize: limit,
      totalPages: Math.ceil(total / limit)
    });
    
  } catch (error) {
    console.error('Error fetching students:', error);
    console.error('Error stack:', error.stack); // More detailed error log
    res.status(500).json({ error: 'Failed to fetch students', details: error.message });
  }
});

// GET /api/students/stats - Get student statistics
app.get('/api/students/stats', authenticateToken, async (req, res) => {
  try {
    const connection = await getConnection();
    
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN status = 'graduated' THEN 1 ELSE 0 END) as graduated
      FROM students
    `);
    
    await connection.end();
    
    console.log('Student stats result:', stats[0]); // Debug log
    res.json(stats[0]);
    
  } catch (error) {
    console.error('Error fetching student stats:', error);
    res.status(500).json({ error: 'Failed to fetch student statistics' });
  }
});

// GET /api/students/all - Get all students without pagination (for dropdowns, etc)
app.get('/api/students/all', authenticateToken, async (req, res) => {
  try {
    const { search, status, prodi, angkatan } = req.query;
    
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    
    if (search) {
      whereClause += ' AND (s.name LIKE ? OR s.nim_kashif LIKE ? OR s.nim_dikti LIKE ? OR s.email LIKE ?)';
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }
    
    if (status && status !== 'all') {
      whereClause += ' AND s.status = ?';
      queryParams.push(status);
    }
    
    if (prodi && prodi !== 'all') {
      whereClause += ' AND s.prodi = ?';
      queryParams.push(prodi);
    }
    
    if (angkatan && angkatan !== 'all') {
      whereClause += ' AND s.angkatan = ?';
      queryParams.push(angkatan);
    }
    
    const connection = await getConnection();
    
    const [rows] = await connection.execute(`
      SELECT 
        s.id,
        s.uuid,
        s.nim_kashif,
        s.nim_dikti,
        s.name,
        s.email,
        s.phone,
        s.prodi,
        s.angkatan,
        s.address,
        s.status,
        s.program_id,
        p.name as program_name,
        s.created_at,
        s.updated_at
      FROM students s 
      LEFT JOIN programs p ON s.program_id = p.id
      ${whereClause}
      ORDER BY s.name ASC
    `, queryParams);
    
    await connection.end();
    
    res.json(rows);
    
  } catch (error) {
    console.error('Error fetching all students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// GET /api/students/:id - Get single student
app.get('/api/students/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await getConnection();
    
    const [rows] = await connection.execute(`
      SELECT 
        s.id,
        s.uuid,
        s.nim_kashif,
        s.nim_dikti,
        s.name,
        s.email,
        s.phone,
        s.prodi,
        s.angkatan,
        s.address,
        s.status,
        s.program_id,
        p.name as program_name,
        s.created_at,
        s.updated_at
      FROM students s 
      LEFT JOIN programs p ON s.program_id = p.id
      WHERE s.uuid = ? OR s.id = ?
    `, [id, id]);
    
    await connection.end();
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    res.json(rows[0]);
    
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

// POST /api/students - Create new student
app.post('/api/students', authenticateToken, async (req, res) => {
  let connection;
  try {
    const {
      nim_kashif,
      nim_dikti,
      name,
      email,
      phone,
      prodi,
      angkatan,
      address,
      status = 'active',
      program_id
    } = req.body;
    
    if (!nim_kashif || !name || !email || !prodi || !angkatan) {
      return res.status(400).json({ 
        error: 'NIM Kashif, name, email, prodi, and angkatan are required' 
      });
    }
    
    // Convert undefined to null for MySQL
    const cleanedData = {
      nim_kashif: nim_kashif || null,
      nim_dikti: nim_dikti || null,
      name: name || null,
      email: email || null,
      phone: phone || null,
      prodi: prodi || null,
      angkatan: angkatan || null,
      address: address || null,
      status: status || 'active',
      program_id: program_id || null
    };
    
    connection = await getConnection();
    
    // Check if NIM or email already exists
    const [existing] = await connection.execute(`
      SELECT id FROM students 
      WHERE nim_kashif = ? OR email = ?
    `, [cleanedData.nim_kashif, cleanedData.email]);
    
    if (existing.length > 0) {
      await connection.end();
      return res.status(409).json({ 
        error: 'Student with this NIM or email already exists' 
      });
    }
    
    // Start transaction
    await connection.beginTransaction();
    
    // Insert student data
    const [result] = await connection.execute(`
      INSERT INTO students (
        uuid, nim_kashif, nim_dikti, name, email, phone, 
        prodi, angkatan, address, status, program_id, 
        created_at, updated_at
      ) VALUES (
        UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
      )
    `, [
      cleanedData.nim_kashif, cleanedData.nim_dikti, cleanedData.name, 
      cleanedData.email, cleanedData.phone, cleanedData.prodi, 
      cleanedData.angkatan, cleanedData.address, cleanedData.status, 
      cleanedData.program_id
    ]);
    
    // Create user account for the student with default password
    const defaultPassword = 'kamal123';
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);
    
    const [userResult] = await connection.execute(`
      INSERT INTO users (
        uuid, email, password_hash, full_name, role, 
        email_verified, must_change_password, created_at, updated_at
      ) VALUES (
        UUID(), ?, ?, ?, ?, ?, ?, NOW(), NOW()
      )
    `, [
      cleanedData.email, passwordHash, cleanedData.name, 'student',
      true, true // email_verified = true, must_change_password = true
    ]);
    
    // Update student with user_id
    await connection.execute(`
      UPDATE students SET user_id = ? WHERE id = ?
    `, [userResult.insertId, result.insertId]);
    
    // Commit transaction
    await connection.commit();
    
    // Get the created student using insert ID
    const [rows] = await connection.execute(`
      SELECT 
        s.*,
        p.name as program_name
      FROM students s 
      LEFT JOIN programs p ON s.program_id = p.id
      WHERE s.id = ?
    `, [result.insertId]);
    
    await connection.end();
    
    res.status(201).json(rows[0]);
    
  } catch (error) {
    console.error('Error creating student:', error);
    console.error('Request body:', req.body); // Debug log
    
    // Try to rollback transaction if connection is still open
    if (connection) {
      try {
        await connection.rollback();
        await connection.end();
      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError);
      }
    }
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Student with this data already exists' });
    } else {
      return res.status(500).json({ error: 'Failed to create student', details: error.message });
    }
  }
});

// PUT /api/students/:id - Update student
app.put('/api/students/:id', authenticateToken, async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const {
      nim_kashif,
      nim_dikti,
      name,
      email,
      phone,
      prodi,
      angkatan,
      address,
      status,
      program_id
    } = req.body;
    
    // Convert undefined to null for MySQL
    const cleanedData = {
      nim_kashif: nim_kashif || null,
      nim_dikti: nim_dikti || null,
      name: name || null,
      email: email || null,
      phone: phone || null,
      prodi: prodi || null,
      angkatan: angkatan || null,
      address: address || null,
      status: status || null,
      program_id: program_id || null
    };
    
    connection = await getConnection();
    
    // Check if NIM or email already exists for another student
    const [existing] = await connection.execute(`
      SELECT id FROM students 
      WHERE (nim_kashif = ? OR email = ?) AND id != ?
    `, [cleanedData.nim_kashif, cleanedData.email, id]);
    
    if (existing.length > 0) {
      await connection.end();
      return res.status(409).json({ 
        error: 'Student with this NIM or email already exists' 
      });
    }
    
    // Start transaction
    await connection.beginTransaction();
    
    // Update student data
    const [result] = await connection.execute(`
      UPDATE students SET
        nim_kashif = ?, nim_dikti = ?, name = ?, email = ?, phone = ?, 
        prodi = ?, angkatan = ?, address = ?, status = ?, program_id = ?, 
        updated_at = NOW()
      WHERE id = ?
    `, [
      cleanedData.nim_kashif, cleanedData.nim_dikti, cleanedData.name, 
      cleanedData.email, cleanedData.phone, cleanedData.prodi, 
      cleanedData.angkatan, cleanedData.address, cleanedData.status, 
      cleanedData.program_id, id
    ]);
    
    if (result.affectedRows === 0) {
      await connection.rollback();
      await connection.end();
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Update user account for the student if email changed
    const [student] = await connection.execute(`
      SELECT user_id FROM students WHERE id = ?
    `, [id]);
    
    if (student.length > 0 && student[0].user_id) {
      const [user] = await connection.execute(`
        SELECT email FROM users WHERE id = ?
      `, [student[0].user_id]);
      
      if (user.length > 0 && user[0].email !== cleanedData.email) {
        await connection.execute(`
          UPDATE users SET email = ?, updated_at = NOW() WHERE id = ?
        `, [cleanedData.email, student[0].user_id]);
      }
    }
    
    // Commit transaction
    await connection.commit();
    
    // Get the updated student using ID
    const [rows] = await connection.execute(`
      SELECT 
        s.*,
        p.name as program_name
      FROM students s 
      LEFT JOIN programs p ON s.program_id = p.id
      WHERE s.id = ?
    `, [id]);
    
    await connection.end();
    
    res.json(rows[0]);
    
  } catch (error) {
    console.error('Error updating student:', error);
    console.error('Request body:', req.body); // Debug log
    
    // Try to rollback transaction if connection is still open
    if (connection) {
      try {
        await connection.rollback();
        await connection.end();
      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError);
      }
    }
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Student with this data already exists' });
    } else {
      return res.status(500).json({ error: 'Failed to update student', details: error.message });
    }
  }
});

// DELETE /api/students/:id - Delete student
app.delete('/api/students/:id', authenticateToken, async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    
    connection = await getConnection();
    
    // Check if student has related bills/payments
    const [relatedData] = await connection.execute(`
      SELECT 
        (SELECT COUNT(*) FROM bills WHERE student_id = ?) as bill_count,
        (SELECT COUNT(*) FROM payments WHERE student_id = ?) as payment_count
    `, [id, id]);
    
    const { bill_count, payment_count } = relatedData[0];
    
    if (bill_count > 0 || payment_count > 0) {
      await connection.end();
      return res.status(400).json({ 
        error: `Cannot delete student. Has ${bill_count} bills and ${payment_count} payments.`,
        details: { bill_count, payment_count }
      });
    }
    
    // Get student data to check if we need to delete associated user
    const [student] = await connection.execute(`
      SELECT user_id FROM students WHERE id = ?
    `, [id]);
    
    if (student.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Start transaction
    await connection.beginTransaction();
    
    // Delete student data
    const [result] = await connection.execute(`
      DELETE FROM students WHERE id = ?
    `, [id]);
    
    if (result.affectedRows === 0) {
      await connection.rollback();
      await connection.end();
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Delete user account for the student if exists
    if (student[0].user_id) {
      await connection.execute(`
        DELETE FROM users WHERE id = ?
      `, [student[0].user_id]);
    }
    
    // Commit transaction
    await connection.commit();
    
    await connection.end();
    
    res.json({ message: 'Student deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting student:', error);
    
    // Try to rollback transaction if connection is still open
    if (connection) {
      try {
        await connection.rollback();
        await connection.end();
      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError);
      }
    }
    
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

    
// DELETE /api/students/:id - Delete student
app.delete('/api/students/:id', authenticateToken, async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    
    connection = await getConnection();
    
    // Check if student has related bills/payments
    const [relatedData] = await connection.execute(`
      SELECT 
        (SELECT COUNT(*) FROM bills WHERE student_id = ?) as bill_count,
        (SELECT COUNT(*) FROM payments WHERE student_id = ?) as payment_count
    `, [id, id]);
    
    const { bill_count, payment_count } = relatedData[0];
    
    if (bill_count > 0 || payment_count > 0) {
      await connection.end();
      return res.status(400).json({ 
        error: `Cannot delete student. Has ${bill_count} bills and ${payment_count} payments.`,
        details: { bill_count, payment_count }
      });
    }
    
    // Get student data to check if we need to delete associated user
    const [student] = await connection.execute(`
      SELECT user_id FROM students WHERE id = ?
    `, [id]);
    
    if (student.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Start transaction
    await connection.beginTransaction();
    
    // Delete student data
    const [result] = await connection.execute(`
      DELETE FROM students WHERE id = ?
    `, [id]);
    
    if (result.affectedRows === 0) {
      await connection.rollback();
      await connection.end();
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Delete user account for the student if exists
    if (student[0].user_id) {
      await connection.execute(`
        DELETE FROM users WHERE id = ?
      `, [student[0].user_id]);
    }
    
    // Commit transaction
    await connection.commit();
    
    await connection.end();
    
    res.json({ message: 'Student deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting student:', error);
    
    // Try to rollback transaction if connection is still open
    if (connection) {
      try {
        await connection.rollback();
        await connection.end();
      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError);
      }
    }
    
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// =============================================================================
// API ENDPOINTS FOR BILLS
// =============================================================================

// GET /api/bills - Get all bills (with optional filtering and pagination)
app.get('/api/bills', authenticateToken, async (req, res) => {
  try {
    const { search, status, student_id, page = 1, pageSize = 50 } = req.query;
    
    console.log('GET /api/bills called with params:', { search, status, student_id, page, pageSize });
    
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    
    if (search) {
      whereClause += ' AND (b.description LIKE ? OR s.name LIKE ? OR s.nim_kashif LIKE ?)';
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }
    
    if (status && status !== 'all') {
      whereClause += ' AND b.status = ?';
      queryParams.push(status);
    }
    
    if (student_id) {
      whereClause += ' AND b.student_id = ?';
      queryParams.push(student_id);
    }
    
    const connection = await getConnection();
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM bills b 
      LEFT JOIN students s ON b.student_id = s.id
      LEFT JOIN bill_categories bc ON b.category_id = bc.id
      ${whereClause}
    `;
    
    const [countResult] = await connection.execute(countQuery, queryParams);
    const total = countResult[0].total;
    
    // Calculate pagination
    const limit = parseInt(pageSize);
    const offset = (parseInt(page) - 1) * limit;
    
    // Get paginated results
    const dataQuery = `
      SELECT 
        b.id,
        b.student_id,
        b.category,
        b.description,
        b.amount,
        b.due_date,
        b.status,
        b.paid_amount,
        b.installment_count,
        b.installment_amount,
        b.category_id,
        b.created_at,
        b.updated_at,
        s.name as student_name,
        s.nim_kashif as student_nim,
        bc.name as category_name
      FROM bills b 
      LEFT JOIN students s ON b.student_id = s.id
      LEFT JOIN bill_categories bc ON b.category_id = bc.id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [rows] = await connection.execute(dataQuery, queryParams);
    
    await connection.end();

    res.json({
      data: rows,
      total: total,
      page: parseInt(page),
      pageSize: limit,
      totalPages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error('Error fetching bills:', error);
    res.status(500).json({ error: 'Failed to fetch bills', details: error.message });
  }
});

// GET /api/bills/stats - Get bill statistics
app.get('/api/bills/stats', authenticateToken, async (req, res) => {
  try {
    const connection = await getConnection();
    
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
        SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END) as unpaid,
        SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial,
        SUM(amount) as total_amount,
        SUM(paid_amount) as total_paid
      FROM bills
    `);
    
    await connection.end();
    
    console.log('Bills stats result:', stats[0]);
    res.json(stats[0]);
    
  } catch (error) {
    console.error('Error fetching bill stats:', error);
    res.status(500).json({ error: 'Failed to fetch bill statistics' });
  }
});

// GET /api/bills/all - Get all bills without pagination
app.get('/api/bills/all', authenticateToken, async (req, res) => {
  try {
    const { search, status, student_id } = req.query;
    
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    
    if (search) {
      whereClause += ' AND (b.description LIKE ? OR s.name LIKE ? OR s.nim_kashif LIKE ?)';
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }
    
    if (status && status !== 'all') {
      whereClause += ' AND b.status = ?';
      queryParams.push(status);
    }
    
    if (student_id) {
      whereClause += ' AND b.student_id = ?';
      queryParams.push(student_id);
    }
    
    const connection = await getConnection();
    
    const [rows] = await connection.execute(`
      SELECT 
        b.id,
        b.student_id,
        b.category,
        b.description,
        b.amount,
        b.due_date,
        b.status,
        b.paid_amount,
        b.installment_count,
        b.installment_amount,
        b.category_id,
        b.created_at,
        b.updated_at,
        s.name as student_name,
        s.nim_kashif as student_nim,
        bc.name as category_name
      FROM bills b 
      LEFT JOIN students s ON b.student_id = s.id
      LEFT JOIN bill_categories bc ON b.category_id = bc.id
      ${whereClause}
      ORDER BY b.created_at DESC
    `, queryParams);
    
    await connection.end();
    
    res.json(rows);
    
  } catch (error) {
    console.error('Error fetching all bills:', error);
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
});

// GET /api/bills/:id - Get single bill
app.get('/api/bills/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await getConnection();
    
    const [rows] = await connection.execute(`
      SELECT 
        b.id,
        b.student_id,
        b.category,
        b.description,
        b.amount,
        b.due_date,
        b.status,
        b.paid_amount,
        b.installment_count,
        b.installment_amount,
        b.category_id,
        b.created_at,
        b.updated_at,
        s.name as student_name,
        s.nim_kashif as student_nim,
        s.email as student_email,
        bc.name as category_name
      FROM bills b 
      LEFT JOIN students s ON b.student_id = s.id
      LEFT JOIN bill_categories bc ON b.category_id = bc.id
      WHERE b.id = ?
    `, [id]);
    
    await connection.end();
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Bill not found' });
    }
    
    res.json(rows[0]);
    
  } catch (error) {
    console.error('Error fetching bill:', error);
    res.status(500).json({ error: 'Failed to fetch bill' });
  }
});

// POST /api/bills - Create new bill
app.post('/api/bills', authenticateToken, async (req, res) => {
  try {
    const {
      student_id,
      category,
      description,
      amount,
      due_date,
      status = 'unpaid',
      installment_count,
      installment_amount,
      category_id
    } = req.body;
    
    if (!student_id || !description || !amount || !due_date) {
      return res.status(400).json({ 
        error: 'Student ID, description, amount, and due date are required' 
      });
    }
    
    // Convert undefined to null for MySQL
    const cleanedData = {
      student_id: student_id || null,
      category: category || null,
      description: description || null,
      amount: amount || null,
      due_date: due_date || null,
      status: status || 'unpaid',
      paid_amount: 0,
      installment_count: installment_count || null,
      installment_amount: installment_amount || null,
      category_id: category_id || null
    };
    
    const connection = await getConnection();
    
    // Verify student exists
    const [studentCheck] = await connection.execute(
      'SELECT id FROM students WHERE id = ?',
      [cleanedData.student_id]
    );
    
    if (studentCheck.length === 0) {
      await connection.end();
      return res.status(400).json({ error: 'Student not found' });
    }

    // Insert the bill
    const [result] = await connection.execute(`
      INSERT INTO bills (
        student_id, category, description, amount, due_date, status, 
        paid_amount, installment_count, installment_amount, category_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cleanedData.student_id, cleanedData.category, cleanedData.description,
      cleanedData.amount, cleanedData.due_date, cleanedData.status,
      cleanedData.paid_amount, cleanedData.installment_count,
      cleanedData.installment_amount, cleanedData.category_id
    ]);
    
    // Get the created bill with student info
    const [rows] = await connection.execute(`
      SELECT 
        b.*,
        s.name as student_name,
        s.nim_kashif as student_nim,
        bc.name as category_name
      FROM bills b 
      LEFT JOIN students s ON b.student_id = s.id
      LEFT JOIN bill_categories bc ON b.category_id = bc.id
      WHERE b.id = ?
    `, [result.insertId]);
    
    await connection.end();
    
    res.status(201).json(rows[0]);
    
  } catch (error) {
    console.error('Error creating bill:', error);
    res.status(500).json({ error: 'Failed to create bill', details: error.message });
  }
});

// PUT /api/bills/:id - Update bill
app.put('/api/bills/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      student_id,
      category,
      description,
      amount,
      due_date,
      status,
      paid_amount,
      installment_count,
      installment_amount,
      category_id
    } = req.body;
    
    const connection = await getConnection();
    
    // Check if bill exists first
    const [existing] = await connection.execute(
      'SELECT * FROM bills WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Bill not found' });
    }
    
    // Get current values and merge with updates
    const currentBill = existing[0];
    const updatedData = {
      student_id: student_id !== undefined ? student_id : currentBill.student_id,
      category: category !== undefined ? category : currentBill.category,
      description: description !== undefined ? description : currentBill.description,
      amount: amount !== undefined ? amount : currentBill.amount,
      due_date: due_date !== undefined ? due_date : currentBill.due_date,
      status: status !== undefined ? status : currentBill.status,
      paid_amount: paid_amount !== undefined ? paid_amount : currentBill.paid_amount,
      installment_count: installment_count !== undefined ? installment_count : currentBill.installment_count,
      installment_amount: installment_amount !== undefined ? installment_amount : currentBill.installment_amount,
      category_id: category_id !== undefined ? category_id : currentBill.category_id
    };
    
    // Update the bill
    await connection.execute(`
      UPDATE bills 
      SET student_id = ?, category = ?, description = ?, amount = ?, due_date = ?,
          status = ?, paid_amount = ?, installment_count = ?, installment_amount = ?,
          category_id = ?, updated_at = NOW()
      WHERE id = ?
    `, [
      updatedData.student_id, updatedData.category,
      updatedData.description, updatedData.amount, updatedData.due_date,
      updatedData.status, updatedData.paid_amount, updatedData.installment_count,
      updatedData.installment_amount, updatedData.category_id, id
    ]);
    
    // Get the updated bill
    const [rows] = await connection.execute(`
      SELECT 
        b.*,
        s.name as student_name,
        s.nim_kashif as student_nim,
        bc.name as category_name
      FROM bills b 
      LEFT JOIN students s ON b.student_id = s.id
      LEFT JOIN bill_categories bc ON b.category_id = bc.id
      WHERE b.id = ?
    `, [id]);
    
    await connection.end();
    
    res.json(rows[0]);
    
  } catch (error) {
    console.error('Error updating bill:', error);
    console.error('Error stack:', error.stack); // More detailed error log
    res.status(500).json({ error: 'Failed to update bill', details: error.message });
  }
});

// DELETE /api/bills/:id - Delete bill
app.delete('/api/bills/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await getConnection();
    
    // Check if bill has related payments
    const [relatedPayments] = await connection.execute(
      'SELECT COUNT(*) as payment_count FROM payments WHERE bill_id = ?',
      [id]
    );
    
    const paymentCount = relatedPayments[0].payment_count;
    
    if (paymentCount > 0) {
      await connection.end();
      return res.status(400).json({ 
        error: `Cannot delete bill. Has ${paymentCount} related payments.`,
        details: { payment_count: paymentCount }
      });
    }
    
    const [result] = await connection.execute(
      'DELETE FROM bills WHERE id = ?',
      [id]
    );
    
    await connection.end();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Bill not found' });
    }
    
    res.json({ message: 'Bill deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting bill:', error);
    res.status(500).json({ error: 'Failed to delete bill' });
  }
});

// DELETE /api/admins/:id - Delete admin or staff user (admin only)
app.delete('/api/admins/:id', authenticateToken, async (req, res) => {
  try {
    // Check if the requester is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Only admins can delete other admins/staff' });
    }
    
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const connection = await getConnection();
    
    // Check if user exists and is admin/staff
    const [users] = await connection.execute(
      'SELECT id, role FROM users WHERE uuid = ? AND role IN ("admin", "staff")',
      [id]
    );
    
    if (users.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Admin/staff user not found' });
    }
    
    // Prevent admin from deleting themselves
    if (req.user.uuid === id) {
      await connection.end();
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    
    // Delete the user
    await connection.execute(
      'DELETE FROM users WHERE uuid = ?',
      [id]
    );
    
    await connection.end();
    
    res.json({ message: 'User deleted successfully' });
    
  } catch (error) {
    console.error('Delete admin/staff user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================================================
// API ENDPOINTS FOR PROGRAMS
// =============================================================================

// GET /api/programs - Get all programs
app.get('/api/programs', authenticateToken, async (req, res) => {
  try {
    const connection = await getConnection();
    const [rows] = await connection.execute(`
      SELECT 
        id,
        code,
        name,
        faculty,
        level,
        status,
        created_at,
        updated_at
      FROM programs 
      ORDER BY code ASC
    `);
    await connection.end();
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching programs:', error);
    res.status(500).json({ error: 'Failed to fetch programs' });
  }
});

// POST /api/programs - Create new program
app.post('/api/programs', authenticateToken, async (req, res) => {
  try {
    const { code, name, faculty, level, status = 'active' } = req.body;
    
    if (!code || !name) {
      return res.status(400).json({ error: 'Code and name are required' });
    }
    
    const connection = await getConnection();
    const [result] = await connection.execute(`
      INSERT INTO programs (code, name, faculty, level, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `, [code, name, faculty || null, level || null, status]);
    
    // Get the created program
    const [rows] = await connection.execute(`
      SELECT * FROM programs WHERE id = ?
    `, [result.insertId]);
    
    await connection.end();
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating program:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Program code already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create program', details: error.message });
    }
  }
});

// PUT /api/programs/:id - Update program
app.put('/api/programs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, faculty, level, status } = req.body;
    
    const connection = await getConnection();
    const [result] = await connection.execute(`
      UPDATE programs 
      SET code = ?, name = ?, faculty = ?, level = ?, status = ?, updated_at = NOW()
      WHERE id = ?
    `, [code, name, faculty || null, level || null, status, id]);
    
    if (result.affectedRows === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Program not found' });
    }
    
    // Get the updated program
    const [rows] = await connection.execute(`
      SELECT * FROM programs WHERE id = ?
    `, [id]);
    
    await connection.end();
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating program:', error);
    res.status(500).json({ error: 'Failed to update program' });
  }
});

// GET /api/programs/:id - Get single program
app.get('/api/programs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await getConnection();
    const [rows] = await connection.execute(`
      SELECT * FROM programs WHERE id = ?
    `, [id]);
    
    await connection.end();
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Program not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching program:', error);
    res.status(500).json({ error: 'Failed to fetch program' });
  }
});

// DELETE /api/programs/:id - Delete program
app.delete('/api/programs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await getConnection();
    
    // Check if program has related students
    const [relatedStudents] = await connection.execute(`
      SELECT COUNT(*) as student_count FROM students WHERE program_id = ?
    `, [id]);
    
    const studentCount = relatedStudents[0].student_count;
    
    if (studentCount > 0) {
      await connection.end();
      return res.status(400).json({ 
        error: `Cannot delete program. Has ${studentCount} related students.`,
        details: { student_count: studentCount }
      });
    }
    
    const [result] = await connection.execute(`
      DELETE FROM programs WHERE id = ?
    `, [id]);
    
    await connection.end();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Program not found' });
    }
    
    res.json({ message: 'Program deleted successfully' });
  } catch (error) {
    console.error('Error deleting program:', error);
    res.status(500).json({ error: 'Failed to delete program' });
  }
});


// =============================================================================
// API ENDPOINTS FOR REPORTS & ANALYTICS
// =============================================================================

// GET /api/reports/statistics - Get overall statistics
app.get('/api/reports/statistics', authenticateToken, async (req, res) => {
  try {
    const connection = await getConnection();
    
    // Get total active students
    const [studentsResult] = await connection.execute(`
      SELECT COUNT(*) as total_students FROM students WHERE status = 'active'
    `);
    const totalStudents = studentsResult[0].total_students;
    
    // Get bills statistics
    const [billsResult] = await connection.execute(`
      SELECT 
        SUM(amount) as total_bills,
        SUM(paid_amount) as total_paid
      FROM bills
    `);
    const totalBills = parseFloat(billsResult[0].total_bills) || 0;
    const totalPaid = parseFloat(billsResult[0].total_paid) || 0;
    
    // Get today's payments
    const [todayPaymentsResult] = await connection.execute(`
      SELECT 
        COUNT(*) as today_count,
        SUM(amount) as today_amount
      FROM payments 
      WHERE DATE(payment_date) = CURDATE() AND status = 'completed'
    `);
    const todayPaymentsCount = parseInt(todayPaymentsResult[0].today_count) || 0;
    const todayPaymentsAmount = parseFloat(todayPaymentsResult[0].today_amount) || 0;
    
    // Calculate collectibility rate
    const collectibilityRate = totalBills > 0 ? (totalPaid / totalBills) * 100 : 0;
    
    await connection.end();
    
    res.json({
      totalStudents,
      totalBills,
      totalPaid,
      todayPaymentsAmount,
      todayPaymentsCount,
      collectibilityRate
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET /api/reports/monthly-income - Get monthly income data
app.get('/api/reports/monthly-income', authenticateToken, async (req, res) => {
  try {
    const { months = 6 } = req.query;
    const monthsCount = parseInt(months) || 6;
    
    const connection = await getConnection();
    
    // Get monthly income for the last N months
    const [monthlyResult] = await connection.execute(`
      SELECT 
        DATE_FORMAT(payment_date, '%Y-%m') as month_key,
        DATE_FORMAT(MIN(payment_date), '%M %Y') as month_name,
        SUM(amount) as income
      FROM payments 
      WHERE 
        payment_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
        AND status = 'completed'
      GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
      ORDER BY month_key ASC
    `, [monthsCount]);
    
    await connection.end();
    
    // Format response
    const monthlyIncome = monthlyResult.map(row => ({
      month: row.month_name,
      income: parseFloat(row.income) || 0
    }));
    
    res.json(monthlyIncome);
  } catch (error) {
    console.error('Error fetching monthly income:', error);
    res.status(500).json({ error: 'Failed to fetch monthly income' });
  }
});

// GET /api/reports/payment-methods - Get payment method distribution
app.get('/api/reports/payment-methods', authenticateToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const daysCount = parseInt(days) || 30;
    
    const connection = await getConnection();
    
    // Get payment method distribution for the last N days
    const [methodsResult] = await connection.execute(`
      SELECT 
        payment_method as method,
        COUNT(*) as count
      FROM payments 
      WHERE 
        payment_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND status = 'completed'
      GROUP BY payment_method
      ORDER BY count DESC
    `, [daysCount]);
    
    await connection.end();
    
    // Calculate total and percentages
    const totalPayments = methodsResult.reduce((sum, row) => sum + parseInt(row.count), 0);
    
    const methodDistribution = methodsResult.map(row => ({
      method: row.method || 'Lainnya',
      count: parseInt(row.count),
      percentage: totalPayments > 0 ? Math.round((parseInt(row.count) / totalPayments) * 100) : 0
    }));
    
    res.json(methodDistribution);
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods distribution' });
  }
});

// GET /api/reports/top-programs - Get top programs by revenue and students
app.get('/api/reports/top-programs', authenticateToken, async (req, res) => {
  try {
    const { limit = 5, days = 30 } = req.query;
    const limitCount = parseInt(limit) || 5;
    const daysCount = parseInt(days) || 30;
    
    console.log('Top programs endpoint called with params:', { limit, days, limitCount, daysCount });
    
    const connection = await getConnection();
    console.log('Database connection established for top programs');
    
    // Simplified approach: Get programs with actual data first
    const [programsResult] = await connection.execute(`
      SELECT 
        IFNULL(p.name, s.prodi) as prodi,
        COUNT(DISTINCT s.id) as students,
        IFNULL(SUM(pay.amount), 0) as revenue
      FROM students s
      LEFT JOIN programs p ON s.program_id = p.id
      LEFT JOIN payments pay ON pay.student_id = s.id 
        AND pay.payment_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND pay.status = 'completed'
      GROUP BY p.name, s.prodi
      HAVING prodi IS NOT NULL
      ORDER BY revenue DESC, students DESC
      LIMIT ${limitCount}
    `, [daysCount]);
    
    console.log('Query executed successfully, results:', programsResult);
    
    await connection.end();
    
    // Format response - handle cases where there might be no payments
    const topPrograms = programsResult.map(row => ({
      prodi: row.prodi || 'Lainnya',
      students: parseInt(row.students) || 0,
      revenue: parseFloat(row.revenue) || 0
    }));
    
    console.log('Formatted top programs response:', topPrograms);
    
    res.json(topPrograms);
  } catch (error) {
    console.error('Error fetching top programs:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch top programs' });
  }
});

// GET /api/reports/dashboard-stats - Get dashboard statistics for charts
app.get('/api/reports/dashboard-stats', authenticateToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const daysCount = parseInt(days) || 30;
    
    const connection = await getConnection();
    
    // Get daily payment amounts for trend chart
    const [dailyPaymentsResult] = await connection.execute(`
      SELECT 
        DATE(payment_date) as date,
        SUM(amount) as amount
      FROM payments 
      WHERE 
        payment_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND status = 'completed'
      GROUP BY DATE(payment_date)
      ORDER BY date ASC
    `, [daysCount]);
    
    await connection.end();
    
    // Format response
    const dailyStats = dailyPaymentsResult.map(row => ({
      date: row.date,
      amount: parseFloat(row.amount) || 0
    }));
    
    res.json(dailyStats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// GET /api/reports/student-stats - Get student statistics
app.get('/api/reports/student-stats', authenticateToken, async (req, res) => {
  try {
    const connection = await getConnection();
    
    // Get student statistics by status
    const [statusResult] = await connection.execute(`
      SELECT 
        status,
        COUNT(*) as count
      FROM students
      GROUP BY status
    `);
    
    // Get student statistics by program
    const [programResult] = await connection.execute(`
      SELECT 
        program_name as program,
        student_count as count
      FROM (
        SELECT 
          COALESCE(p.name, s.prodi, 'Lainnya') as program_name,
          COUNT(*) as student_count
        FROM students s
        LEFT JOIN programs p ON s.program_id = p.id
        GROUP BY p.id, p.name, s.prodi
        ORDER BY student_count DESC
        LIMIT 10
      ) AS program_stats
    `);
    
    await connection.end();
    
    // Calculate totals
    const totalStudents = statusResult.reduce((sum, row) => sum + parseInt(row.count), 0);
    const activeStudents = statusResult.find(row => row.status === 'active')?.count || 0;
    const inactiveStudents = statusResult.find(row => row.status === 'inactive')?.count || 0;
    const graduatedStudents = statusResult.find(row => row.status === 'graduated')?.count || 0;
    
    res.json({
      total: totalStudents,
      active: parseInt(activeStudents),
      inactive: parseInt(inactiveStudents),
      graduated: parseInt(graduatedStudents),
      byProgram: programResult.map(row => ({
        program: row.program,
        count: parseInt(row.count)
      }))
    });
  } catch (error) {
    console.error('Error fetching student stats:', error);
    res.status(500).json({ error: 'Failed to fetch student statistics' });
  }
});

// GET /api/bill-categories - Get all bill categories
app.get('/api/bill-categories', authenticateToken, async (req, res) => {
  try {
    const { onlyActive } = req.query;
    const connection = await getConnection();
    
    let query = `
      SELECT 
        id,
        name,
        active,
        default_amount,
        default_due_days,
        default_type,
        default_installment_count,
        default_installment_amount,
        created_at,
        updated_at
      FROM bill_categories
    `;
    
    const params = [];
    if (onlyActive === 'true') {
      query += ' WHERE active = ?';
      params.push(true);
    }
    
    query += ' ORDER BY name ASC';
    
    const [rows] = await connection.execute(query, params);
    await connection.end();
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching bill categories:', error);
    res.status(500).json({ error: 'Failed to fetch bill categories' });
  }
});

// POST /api/bill-categories - Create new bill category
app.post('/api/bill-categories', authenticateToken, async (req, res) => {
  try {
    const { 
      name, 
      active = true, 
      default_amount, 
      default_due_days, 
      default_type, 
      default_installment_count, 
      default_installment_amount 
    } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const connection = await getConnection();
    const [result] = await connection.execute(`
      INSERT INTO bill_categories (
        name, active, default_amount, default_due_days, 
        default_type, default_installment_count, default_installment_amount,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      name, 
      active, 
      default_amount || null, 
      default_due_days || null, 
      default_type || null, 
      default_installment_count || null, 
      default_installment_amount || null
    ]);
    
    // Get the created category
    const [rows] = await connection.execute(`
      SELECT * FROM bill_categories WHERE id = ?
    `, [result.insertId]);
    
    await connection.end();
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating bill category:', error);
    res.status(500).json({ error: 'Failed to create bill category', details: error.message });
  }
});

// PUT /api/bill-categories/:id - Update bill category
app.put('/api/bill-categories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      active, 
      default_amount, 
      default_due_days, 
      default_type, 
      default_installment_count, 
      default_installment_amount 
    } = req.body;
    
    const connection = await getConnection();
    const [result] = await connection.execute(`
      UPDATE bill_categories 
      SET 
        name = ?, active = ?, default_amount = ?, default_due_days = ?,
        default_type = ?, default_installment_count = ?, default_installment_amount = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [
      name, 
      active, 
      default_amount || null, 
      default_due_days || null, 
      default_type || null, 
      default_installment_count || null, 
      default_installment_amount || null, 
      id
    ]);
    
    if (result.affectedRows === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Bill category not found' });
    }
    
    // Get the updated category
    const [rows] = await connection.execute(`
      SELECT * FROM bill_categories WHERE id = ?
    `, [id]);
    
    await connection.end();
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating bill category:', error);
    res.status(500).json({ error: 'Failed to update bill category' });
  }
});

// GET /api/bill-categories/:id - Get single bill category
app.get('/api/bill-categories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await getConnection();
    const [rows] = await connection.execute(`
      SELECT * FROM bill_categories WHERE id = ?
    `, [id]);
    
    await connection.end();
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Bill category not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching bill category:', error);
    res.status(500).json({ error: 'Failed to fetch bill category' });
  }
});

// DELETE /api/bill-categories/:id - Delete bill category
app.delete('/api/bill-categories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await getConnection();
    const [result] = await connection.execute(`
      DELETE FROM bill_categories WHERE id = ?
    `, [id]);
    
    await connection.end();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Bill category not found' });
    }
    
    res.json({ message: 'Bill category deleted successfully' });
  } catch (error) {
    console.error('Error deleting bill category:', error);
    res.status(500).json({ error: 'Failed to delete bill category' });
  }
});

// =============================================================================
// PAYMENTS API ENDPOINTS
// =============================================================================

// GET /api/payments/stats - Get payments statistics
app.get('/api/payments/stats', authenticateToken, async (req, res) => {
  try {
    const { search, method = 'all', dateRange = 'all' } = req.query;
    
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    
    // Filter by payment method
    if (method && method !== 'all') {
      whereClause += ' AND p.payment_method = ?';
      queryParams.push(method);
    }
    
    // Filter by date range
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let dateFrom;
      
      if (dateRange === 'today') {
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (dateRange === 'week') {
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (dateRange === 'month') {
        dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      
      if (dateFrom) {
        whereClause += ' AND p.payment_date >= ?';
        queryParams.push(dateFrom.toISOString().split('T')[0]);
      }
    }
    
    // Filter by search (receipt number, student name, bill description)
    if (search) {
      whereClause += ' AND (p.receipt_number LIKE ? OR s.name LIKE ? OR b.description LIKE ?)';
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }
    
    const connection = await getConnection();
    
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN p.status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN p.status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END) as totalAmountCompleted,
        SUM(CASE WHEN p.status = 'completed' AND DATE(p.payment_date) = CURDATE() THEN p.amount ELSE 0 END) as todayAmountCompleted
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
      LEFT JOIN bills b ON p.bill_id = b.id
      ${whereClause}
    `, queryParams);
    
    await connection.end();
    
    res.json({
      total: parseInt(stats[0].total) || 0,
      completed: parseInt(stats[0].completed) || 0,
      pending: parseInt(stats[0].pending) || 0,
      failed: parseInt(stats[0].failed) || 0,
      totalAmountCompleted: parseFloat(stats[0].totalAmountCompleted) || 0,
      todayAmountCompleted: parseFloat(stats[0].todayAmountCompleted) || 0
    });
    
  } catch (error) {
    console.error('Error fetching payment stats:', error);
    res.status(500).json({ error: 'Failed to fetch payment statistics' });
  }
});

// GET /api/payments - Get payments with pagination and filters
app.get('/api/payments', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      pageSize = 20, 
      search, 
      status = 'all', 
      method = 'all', 
      dateRange = 'all',
      student_id 
    } = req.query;
    
    const limit = Math.min(parseInt(pageSize), 100);
    const offset = (parseInt(page) - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    
    // Filter by student ID
    if (student_id) {
      whereClause += ' AND p.student_id = ?';
      queryParams.push(student_id);
    }
    
    // Filter by status
    if (status && status !== 'all') {
      whereClause += ' AND p.status = ?';
      queryParams.push(status);
    }
    
    // Filter by payment method
    if (method && method !== 'all') {
      whereClause += ' AND p.payment_method = ?';
      queryParams.push(method);
    }
    
    // Filter by date range
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let dateFrom;
      
      if (dateRange === 'today') {
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (dateRange === 'week') {
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (dateRange === 'month') {
        dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      
      if (dateFrom) {
        whereClause += ' AND p.payment_date >= ?';
        queryParams.push(dateFrom.toISOString().split('T')[0]);
      }
    }
    
    // Filter by search
    if (search) {
      whereClause += ' AND (p.receipt_number LIKE ? OR s.name LIKE ? OR s.nim_kashif LIKE ? OR b.description LIKE ?)';
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }
    
    const connection = await getConnection();
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
      LEFT JOIN bills b ON p.bill_id = b.id
      ${whereClause}
    `;
    
    const [countResult] = await connection.execute(countQuery, queryParams);
    const total = countResult[0].total;
    
    // Get paginated data
    const dataQuery = `
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
        b.description as bill_description,
        b.category as bill_category,
        b.amount as bill_amount,
        bc.name as category_name
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
      LEFT JOIN bills b ON p.bill_id = b.id
      LEFT JOIN bill_categories bc ON b.category_id = bc.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const [rows] = await connection.execute(dataQuery, queryParams);
    
    await connection.end();
    
    res.json({
      data: rows,
      total: total,
      page: parseInt(page),
      pageSize: limit,
      totalPages: Math.ceil(total / limit)
    });
    
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments', details: error.message });
  }
});

// GET /api/payments/all - Get all payments without pagination
app.get('/api/payments/all', authenticateToken, async (req, res) => {
  try {
    const { search, status = 'all', method = 'all', dateRange = 'all', student_id } = req.query;
    
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    
    // Filter by student ID
    if (student_id) {
      whereClause += ' AND p.student_id = ?';
      queryParams.push(student_id);
    }
    
    // Filter by status
    if (status && status !== 'all') {
      whereClause += ' AND p.status = ?';
      queryParams.push(status);
    }
    
    // Filter by payment method
    if (method && method !== 'all') {
      whereClause += ' AND p.payment_method = ?';
      queryParams.push(method);
    }
    
    // Filter by date range
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let dateFrom;
      
      if (dateRange === 'today') {
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (dateRange === 'week') {
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (dateRange === 'month') {
        dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      
      if (dateFrom) {
        whereClause += ' AND p.payment_date >= ?';
        queryParams.push(dateFrom.toISOString().split('T')[0]);
      }
    }
    
    // Filter by search
    if (search) {
      whereClause += ' AND (p.receipt_number LIKE ? OR s.name LIKE ? OR s.nim_kashif LIKE ? OR b.description LIKE ?)';
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }
    
    const connection = await getConnection();
    
    const dataQuery = `
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
        b.description as bill_description,
        b.category as bill_category,
        b.amount as bill_amount,
        bc.name as category_name
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
      LEFT JOIN bills b ON p.bill_id = b.id
      LEFT JOIN bill_categories bc ON b.category_id = bc.id
      ${whereClause}
      ORDER BY p.created_at DESC
    `;
    
    const [rows] = await connection.execute(dataQuery, queryParams);
    
    await connection.end();
    
    res.json(rows);
    
  } catch (error) {
    console.error('Error fetching all payments:', error);
    res.status(500).json({ error: 'Failed to fetch all payments', details: error.message });
  }
});

// GET /api/payments/:id - Get single payment by ID
app.get('/api/payments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ID parameter
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }
    
    const connection = await getConnection();
    
    // Check if payment exists first
    const [paymentCheck] = await connection.execute(
      'SELECT id FROM payments WHERE id = ?',
      [id]
    );
    
    if (paymentCheck.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    const [rows] = await connection.execute(`
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
        b.paid_amount as bill_paid_amount,
        bc.name as category_name
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
      LEFT JOIN bills b ON p.bill_id = b.id
      LEFT JOIN bill_categories bc ON b.category_id = bc.id
      WHERE p.id = ?
    `, [id]);
    
    await connection.end();
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    // Transform the data to match frontend expectations
    const payment = rows[0];
    const transformedPayment = {
      id: payment.id,
      student_id: payment.student_id,
      bill_id: payment.bill_id,
      amount: parseFloat(payment.amount) || 0,
      payment_date: payment.payment_date,
      payment_method: payment.payment_method || 'Unknown',
      receipt_number: payment.receipt_number || `KW-${payment.id}`,
      notes: payment.notes,
      status: payment.status || 'unknown',
      created_at: payment.created_at,
      updated_at: payment.updated_at,
      // Transform student data
      student_name: payment.student_name || 'Data Tidak Tersedia',
      student_nim: payment.student_nim || 'N/A',
      student_nim_dikti: payment.student_nim_dikti,
      student_prodi: payment.student_prodi || 'N/A',
      students: {
        name: payment.student_name || 'Data Tidak Tersedia',
        nim_kashif: payment.student_nim || 'N/A',
        nim_dikti: payment.student_nim_dikti || null,
        prodi: payment.student_prodi || 'N/A'
      },
      // Transform bill data to match frontend expectations
      bill_description: payment.bill_description || 'Pembayaran',
      bill_category: payment.bill_category,
      bill_amount: parseFloat(payment.bill_amount) || 0,
      bill_status: payment.bill_status || 'unknown',
      bill_paid_amount: parseFloat(payment.bill_paid_amount) || 0,
      bills: {
        description: payment.bill_description || 'Pembayaran',
        category: payment.bill_category || null,
        amount: parseFloat(payment.bill_amount) || 0,
        status: payment.bill_status || 'unknown',
        paid_amount: parseFloat(payment.bill_paid_amount) || 0
      },
      // Category data
      category_name: payment.category_name || null
    };
    
    res.json(transformedPayment);
    
  } catch (error) {
    console.error('Error fetching payment:', error);
    
    // More specific error handling
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ 
        error: 'Database connection failed', 
        details: 'Cannot connect to database. Please check database server.' 
      });
    }
    
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({ 
        error: 'Database schema error', 
        details: 'Required table not found in database.' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch payment', 
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
    });
  }
});

// POST /api/payments - Create new payment
app.post('/api/payments', authenticateToken, async (req, res) => {
  try {
    const {
      student_id,
      bill_id,
      amount,
      payment_date,
      payment_method,
      receipt_number,
      notes,
      status = 'completed'
    } = req.body;
    
    // Validation
    if (!student_id || !bill_id || !amount || !payment_date || !payment_method) {
      return res.status(400).json({ 
        error: 'Missing required fields: student_id, bill_id, amount, payment_date, payment_method' 
      });
    }
    
    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    
    const connection = await getConnection();
    
    // Check if student exists
    const [students] = await connection.execute(
      'SELECT id FROM students WHERE id = ?',
      [student_id]
    );
    
    if (students.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Check if bill exists
    const [bills] = await connection.execute(
      'SELECT id, amount, paid_amount, status FROM bills WHERE id = ?',
      [bill_id]
    );
    
    if (bills.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Bill not found' });
    }
    
    const bill = bills[0];
    
    // Generate receipt number if not provided
    const finalReceiptNumber = receipt_number || `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    // Insert payment
    const [result] = await connection.execute(`
      INSERT INTO payments (
        student_id, bill_id, amount, payment_date, payment_method,
        receipt_number, notes, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      student_id, bill_id, amount, payment_date, payment_method,
      finalReceiptNumber, notes || null, status
    ]);
    
    // Update bill paid amount and status if payment is completed
    if (status === 'completed') {
      const newPaidAmount = parseFloat(bill.paid_amount || 0) + parseFloat(amount);
      const billAmount = parseFloat(bill.amount);
      
      let newBillStatus = 'unpaid';
      if (newPaidAmount >= billAmount) {
        newBillStatus = 'paid';
      } else if (newPaidAmount > 0) {
        newBillStatus = 'partial';
      }
      
      await connection.execute(`
        UPDATE bills 
        SET paid_amount = ?, status = ?, updated_at = NOW()
        WHERE id = ?
      `, [newPaidAmount, newBillStatus, bill_id]);
    }
    
    // Get the created payment with related data
    const [createdPayment] = await connection.execute(`
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
        b.description as bill_description,
        b.category as bill_category
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
      LEFT JOIN bills b ON p.bill_id = b.id
      WHERE p.id = LAST_INSERT_ID()
    `);
    
    await connection.end();
    
    res.status(201).json(createdPayment[0]);
    
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Failed to create payment', details: error.message });
  }
});

// PUT /api/payments/:id - Update payment
app.put('/api/payments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      amount,
      payment_date,
      payment_method,
      receipt_number,
      notes,
      status
    } = req.body;
    
    const connection = await getConnection();
    
    // Get current payment data
    const [currentPayments] = await connection.execute(
      'SELECT * FROM payments WHERE id = ?',
      [id]
    );
    
    if (currentPayments.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    const currentPayment = currentPayments[0];
    
    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    
    if (amount !== undefined) {
      updateFields.push('amount = ?');
      updateValues.push(amount);
    }
    
    if (payment_date !== undefined) {
      updateFields.push('payment_date = ?');
      updateValues.push(payment_date);
    }
    
    if (payment_method !== undefined) {
      updateFields.push('payment_method = ?');
      updateValues.push(payment_method);
    }
    
    if (receipt_number !== undefined) {
      updateFields.push('receipt_number = ?');
      updateValues.push(receipt_number);
    }
    
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(notes);
    }
    
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    
    if (updateFields.length === 0) {
      await connection.end();
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updateFields.push('updated_at = NOW()');
    updateValues.push(id);
    
    // Update payment
    await connection.execute(`
      UPDATE payments 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues);
    
    // If amount or status changed, update bill accordingly
    if ((amount !== undefined && amount !== currentPayment.amount) || 
        (status !== undefined && status !== currentPayment.status)) {
      
      // Get all payments for this bill to recalculate total
      const [billPayments] = await connection.execute(`
        SELECT SUM(amount) as total_paid
        FROM payments 
        WHERE bill_id = ? AND status = 'completed'
      `, [currentPayment.bill_id]);
      
      const [bills] = await connection.execute(
        'SELECT amount FROM bills WHERE id = ?',
        [currentPayment.bill_id]
      );
      
      if (bills.length > 0) {
        const billAmount = parseFloat(bills[0].amount);
        const totalPaid = parseFloat(billPayments[0].total_paid || 0);
        
        let newBillStatus = 'unpaid';
        if (totalPaid >= billAmount) {
          newBillStatus = 'paid';
        } else if (totalPaid > 0) {
          newBillStatus = 'partial';
        }
        
        await connection.execute(`
          UPDATE bills 
          SET paid_amount = ?, status = ?, updated_at = NOW()
          WHERE id = ?
        `, [totalPaid, newBillStatus, currentPayment.bill_id]);
      }
    }
    
    // Get updated payment with related data
    const [updatedPayment] = await connection.execute(`
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
        b.description as bill_description,
        b.category as bill_category
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
      LEFT JOIN bills b ON p.bill_id = b.id
      WHERE p.id = ?
    `, [id]);
    
    await connection.end();
    
    res.json(updatedPayment[0]);
    
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({ error: 'Failed to update payment', details: error.message });
  }
});

// DELETE /api/payments/:id - Delete payment
app.delete('/api/payments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await getConnection();
    
    // Get payment data before deletion
    const [payments] = await connection.execute(
      'SELECT bill_id, amount, status FROM payments WHERE id = ?',
      [id]
    );
    
    if (payments.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    const payment = payments[0];
    
    // Delete the payment
    const [result] = await connection.execute(
      'DELETE FROM payments WHERE id = ?',
      [id]
    );
    
    // Update bill paid amount and status if payment was completed
    if (payment.status === 'completed') {
      const [billPayments] = await connection.execute(`
        SELECT SUM(amount) as total_paid
        FROM payments 
        WHERE bill_id = ? AND status = 'completed'
      `, [payment.bill_id]);
      
      const [bills] = await connection.execute(
        'SELECT amount FROM bills WHERE id = ?',
        [payment.bill_id]
      );
      
      if (bills.length > 0) {
        const billAmount = parseFloat(bills[0].amount);
        const totalPaid = parseFloat(billPayments[0].total_paid || 0);
        
        let newBillStatus = 'unpaid';
        if (totalPaid >= billAmount) {
          newBillStatus = 'paid';
        } else if (totalPaid > 0) {
          newBillStatus = 'partial';
        }
        
        await connection.execute(`
          UPDATE bills 
          SET paid_amount = ?, status = ?, updated_at = NOW()
          WHERE id = ?
        `, [totalPaid, newBillStatus, payment.bill_id]);
      }
    }
    
    await connection.end();
    
    res.json({ message: 'Payment deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ error: 'Failed to delete payment', details: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Auth server running on http://localhost:${PORT}`);
  console.log(`📊 Database: ${dbConfig.database} at ${dbConfig.host}:${dbConfig.port}`);
});

module.exports = app;