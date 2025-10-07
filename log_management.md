# 📊 Log Management

## PM2 Log Management

### Melihat Logs
```bash
# Melihat semua logs
pm2 logs

# Melihat logs untuk aplikasi tertentu
pm2 logs pembayarankampus-api

# Melihat logs dengan jumlah baris tertentu
pm2 logs pembayarankampus-api --lines 100
```

### Mengatur Rotasi Log
Buat file `logrotate` configuration:
```bash
sudo nano /etc/logrotate.d/pembayarankampus
```

Tambahkan konfigurasi berikut:
```
/home/youruser/.pm2/logs/*.log {
    rotate 12
    weekly
    compress
    delaycompress
    missingok
    notifempty
    create 0644 youruser youruser
}
```

## Nginx Log Management

### Melihat Logs Nginx
```bash
# Melihat error log
sudo tail -f /var/log/nginx/error.log

# Melihat access log
sudo tail -f /var/log/nginx/access.log
```

### Mengatur Rotasi Log Nginx
Konfigurasi rotasi log sudah ada di `/etc/logrotate.d/nginx`

## MySQL Log Management

### Mengaktifkan General Log
```bash
# Masuk ke MySQL
sudo mysql -u root -p

# Aktifkan general log
SET GLOBAL general_log = 'ON';
SET GLOBAL general_log_file = '/var/log/mysql/general.log';

# Keluar dari MySQL
exit
```

### Melihat Logs MySQL
```bash
# Melihat general log
sudo tail -f /var/log/mysql/general.log

# Melihat error log
sudo tail -f /var/log/mysql/error.log
```

## Monitoring Script

Buat file `monitor.sh`:
```bash
#!/bin/bash

echo "=== System Monitoring ==="
echo "Timestamp: $(date)"
echo ""

echo "=== Disk Usage ==="
df -h
echo ""

echo "=== Memory Usage ==="
free -h
echo ""

echo "=== CPU Usage ==="
top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1
echo ""

echo "=== PM2 Status ==="
pm2 status
echo ""

echo "=== Application Logs (last 10 lines) ==="
pm2 logs pembayarankampus-api --lines 10
```

Simpan file ini dan berikan permission executable:
```bash
chmod +x monitor.sh
```

## Alerting Script

Buat file `alert.sh` untuk notifikasi error:
```bash
#!/bin/bash

# Cek status PM2
pm2_status=$(pm2 status | grep "pembayarankampus-api" | grep "online")

if [ -z "$pm2_status" ]; then
    echo "ALERT: Application is not running!"
    # Tambahkan notifikasi email atau Slack di sini
    # curl -X POST -H 'Content-type: application/json' --data '{"text":"Application is down!"}' YOUR_SLACK_WEBHOOK
else
    echo "Application is running normally"
fi
```

## Log Analysis

### Mencari Error dalam Logs
```bash
# Mencari error dalam log PM2
pm2 logs pembayarankampus-api | grep -i error

# Mencari error dalam log Nginx
sudo grep -i error /var/log/nginx/error.log

# Mencari error dalam log MySQL
sudo grep -i error /var/log/mysql/error.log
```

### Menganalisis Traffic
```bash
# Melihat request terbanyak dalam access log
sudo awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head -10

# Melihat halaman yang paling sering diakses
sudo awk '{print $7}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head -10
```