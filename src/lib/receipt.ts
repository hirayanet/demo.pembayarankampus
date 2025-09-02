export function numberToBahasa(n: number): string {
  // Simple Indonesian number to words for thousands/millions; can be enhanced later
  const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  const toWords = (x: number): string => {
    if (x < 12) return satuan[x];
    if (x < 20) return toWords(x - 10) + ' Belas';
    if (x < 100) return toWords(Math.floor(x / 10)) + ' Puluh' + (x % 10 ? ' ' + toWords(x % 10) : '');
    if (x < 200) return 'Seratus' + (x - 100 ? ' ' + toWords(x - 100) : '');
    if (x < 1000) return toWords(Math.floor(x / 100)) + ' Ratus' + (x % 100 ? ' ' + toWords(x % 100) : '');
    if (x < 2000) return 'Seribu' + (x - 1000 ? ' ' + toWords(x - 1000) : '');
    if (x < 1000000) return toWords(Math.floor(x / 1000)) + ' Ribu' + (x % 1000 ? ' ' + toWords(x % 1000) : '');
    if (x < 1000000000) return toWords(Math.floor(x / 1000000)) + ' Juta' + (x % 1000000 ? ' ' + toWords(x % 1000000) : '');
    return x.toString();
  };
  return toWords(Math.floor(n)).trim() + ' Rupiah';
}

export function generateReceiptNumber(nimKashif: string, dateISO: string): string {
  const d = new Date(dateISO);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const last4 = (nimKashif || '').slice(-4).padStart(4, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `KWT-${y}${m}${day}-${last4}${rand}`;
}

export function currencyIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}
