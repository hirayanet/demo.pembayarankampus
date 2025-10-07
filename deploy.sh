#!/bin/bash

# Script deployment untuk pembayarankampus ke VPS
# Penggunaan: ./deploy.sh [production|staging]

echo "🚀 Memulai deployment pembayarankampus..."

# Variabel
ENV=${1:-production}
PROJECT_DIR="/home/youruser/pembayarankampus"
BACKUP_DIR="/home/youruser/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Fungsi untuk logging
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Fungsi untuk error handling
error_exit() {
    log "❌ ERROR: $1"
    exit 1
}

# Validasi environment
if [[ "$ENV" != "production" && "$ENV" != "staging" ]]; then
    error_exit "Environment harus 'production' atau 'staging'"
fi

log "🔧 Environment: $ENV"

# Backup kode lama
log "📦 Membuat backup kode lama..."
mkdir -p $BACKUP_DIR
tar -czf "$BACKUP_DIR/backup_$TIMESTAMP.tar.gz" -C $PROJECT_DIR . || error_exit "Gagal membuat backup"

# Pull kode terbaru dari repository
log "📥 Pulling kode terbaru dari repository..."
cd $PROJECT_DIR || error_exit "Direktori project tidak ditemukan"
git pull origin main || error_exit "Gagal pull kode terbaru"

# Install/update dependencies
log "⚙️  Menginstall dependencies..."
cd mysql_migration
npm install || error_exit "Gagal menginstall dependencies"

# Restart aplikasi dengan PM2
log "🔄 Merestart aplikasi dengan PM2..."
pm2 restart pembayarankampus-api || error_exit "Gagal merestart aplikasi"

# Cek status aplikasi
log "🔍 Mengecek status aplikasi..."
pm2 status pembayarankampus-api

log "✅ Deployment selesai!"

# Tampilkan informasi tambahan
echo ""
echo "📋 Informasi Deployment:"
echo "  - Environment: $ENV"
echo "  - Timestamp: $TIMESTAMP"
echo "  - Backup: $BACKUP_DIR/backup_$TIMESTAMP.tar.gz"
echo ""
echo "📝 Untuk mengecek log aplikasi:"
echo "  pm2 logs pembayarankampus-api"
echo ""