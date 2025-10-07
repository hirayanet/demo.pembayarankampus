module.exports = {
  apps : [{
    name   : "pembayarankampus-api",
    script : "./auth_server.js",
    instances : 1,
    exec_mode : "fork",
    env: {
      NODE_ENV: "production",
    }
  }]
}