#!/bin/bash

# Script backup database untuk pembayarankampus
# Penggunaan: ./backup_db.sh [production|staging]

echo "💾 Memulai backup database pembayarankampus..."

# Variabel
ENV=${1:-production}
DB_NAME="pembayarankampus"
DB_USER="adminkampus"
BACKUP_DIR="/home/youruser/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql"

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

# Buat direktori backup jika belum ada
mkdir -p $BACKUP_DIR

# Backup database
log "📤 Membuat backup database..."
mysqldump -u $DB_USER -p $DB_NAME > $BACKUP_FILE || error_exit "Gagal membuat backup database"

# Kompres file backup
log "🗜️  Mengkompres backup..."
gzip $BACKUP_FILE || error_exit "Gagal mengkompres backup"

log "✅ Backup database selesai!"
log "📁 File backup: $BACKUP_FILE.gz"

# Hapus backup lama (lebih dari 7 hari)
log "🧹 Membersihkan backup lama..."
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete

log "✨ Cleanup selesai!"