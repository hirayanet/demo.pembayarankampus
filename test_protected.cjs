const http = require('http');

// Use the token from the previous response
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwidXVpZCI6IjU4NTFmNWI3LWEzOGItMTFmMC05Y2Q5LWMyYTAwYWU0MTU3OSIsImVtYWlsIjoiYWRtaW5Aa2FtcHVzLmVkdSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1OTg0NzkzOCwiZXhwIjoxNzU5OTM0MzM4fQ.nWM4YFlIRthjU6bmWgsJ2hVxKzzTr4YJ5LyB1FprNfw';

const options = {
  hostname: '165.22.249.115',
  port: 80,
  path: '/auth/user',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);

  let responseData = '';
  res.on('data', chunk => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('Response:', responseData);
  });
});

req.on('error', error => {
  console.error('Error:', error);
});

req.end();