# Public Images Folder

Letakkan semua gambar publik aplikasi di folder ini.

- Akses dari kode: `/images/<nama-file>`
- Contoh logo kwitansi: simpan sebagai `/logo.png` di folder `public/` atau gunakan `/images/logo.png` lalu set ENV `VITE_RECEIPT_LOGO_URL=/images/logo.png`.
- File dalam `public/` akan disajikan langsung oleh Vite tanpa proses bundling.
