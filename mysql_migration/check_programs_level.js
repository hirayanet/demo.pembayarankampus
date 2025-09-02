const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001';

async function checkProgramsLevel() {
  console.log('🔍 Mengecek Data Level Program Studi...\n');
  
  try {
    // Get auth token
    console.log('🔐 Mendapatkan auth token...');
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@kampus.edu',
        password: 'admin123'
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to login');
    }
    
    const data = await response.json();
    const token = data.token;
    console.log('   ✅ Token berhasil didapat\n');
    
    // Get programs
    console.log('📋 Mengambil data program studi...');
    const programsResponse = await fetch(`${API_BASE}/api/programs`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!programsResponse.ok) {
      throw new Error('Failed to fetch programs');
    }
    
    const programs = await programsResponse.json();
    console.log(`   ✅ Berhasil mengambil ${programs.length} program studi\n`);
    
    console.log('📊 Data Program Studi saat ini:');
    console.log('='.repeat(60));
    
    programs.forEach((p, i) => {
      console.log(`${i+1}. ${p.name} (${p.code})`);
      console.log(`   Level: '${p.level}' (tipe: ${typeof p.level})`);
      console.log(`   Faculty: '${p.faculty}'`);
      console.log(`   Status: ${p.status}`);
      console.log(`   ID: ${p.id}`);
      console.log('');
    });
    
    // Check for programs without level
    const programsWithoutLevel = programs.filter(p => !p.level || p.level === null || p.level === '');
    
    if (programsWithoutLevel.length > 0) {
      console.log('⚠️  MASALAH DITEMUKAN:');
      console.log(`${programsWithoutLevel.length} program studi tidak memiliki data level:`);
      programsWithoutLevel.forEach(p => {
        console.log(`   - ${p.name} (${p.code}): level = '${p.level}'`);
      });
      console.log('\n💡 SOLUSI:');
      console.log('Perlu menambahkan data level untuk program studi ini di menu Pengaturan > Program Studi');
    } else {
      console.log('✅ Semua program studi memiliki data level yang valid');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkProgramsLevel();