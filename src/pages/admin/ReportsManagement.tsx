import React, { useState, useEffect } from 'react';

import { 
  Download, 
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  FileText,
} from 'lucide-react';
import { dbService, supabase } from '../../lib/mysql';

const ReportsManagement: React.FC = () => {
  const [reportType, setReportType] = useState('overview');
  const [dateRange, setDateRange] = useState('month');
  const [statistics, setStatistics] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [monthlyIncome, setMonthlyIncome] = useState<Array<{ month: string; income: number }>>([]);
  const [methodDist, setMethodDist] = useState<Array<{ method: string; count: number; percentage: number }>>([]);
  const [topPrograms, setTopPrograms] = useState<Array<{ prodi: string; students: number; revenue: number }>>([]);

  useEffect(() => {
    let mounted = true;
    let debounceTimer: any = null;

    const loadWithRetry = async () => {
      const maxRetries = 2;
      const baseDelay = 300; // ms
      let attempt = 0;
      while (attempt <= maxRetries) {
        try {
          setLoading(true);
          // Sesuaikan parameter berdasarkan dateRange
          const rangeToParams = (range: string) => {
            switch (range) {
              case 'week':
                return { monthsCount: 1, methodDays: 7, topDays: 7 };
              case 'month':
                return { monthsCount: 1, methodDays: 30, topDays: 30 };
              case 'quarter':
                return { monthsCount: 3, methodDays: 90, topDays: 90 };
              case 'year':
                return { monthsCount: 12, methodDays: 365, topDays: 365 };
              default:
                return { monthsCount: 1, methodDays: 30, topDays: 30 };
            }
          };
          const { monthsCount, methodDays, topDays } = rangeToParams(dateRange);

          const [stats, months, methods, programs] = await Promise.all([
            dbService.getStatistics(),
            dbService.getMonthlyIncome(monthsCount),
            dbService.getPaymentMethodDistribution(methodDays),
            dbService.getTopPrograms(4, topDays),
          ]);
          if (!mounted) return;
          setStatistics(stats);
          setMonthlyIncome(months);
          setMethodDist(methods);
          setTopPrograms(programs);
          break; // success
        } catch (e) {
          if (attempt < maxRetries) {
            const backoff = baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
            await new Promise((r) => setTimeout(r, backoff));
            attempt++;
            continue;
          }
          console.error('Error loading statistics:', e);
        } finally {
          if (attempt >= maxRetries) setLoading(false);
        }
      }
      setLoading(false);
    };

    const scheduleReload = () => {
      if (!mounted) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadWithRetry();
      }, 400);
    };

    loadWithRetry();

    const channel = supabase
      .channel('reports-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => scheduleReload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, () => scheduleReload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => scheduleReload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'programs' }, () => scheduleReload())
      .subscribe();

    return () => {
      mounted = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [dateRange]);

  const loadStatistics = async () => {
    // kept for potential manual reloads; main effect uses debounced realtime
    try {
      setLoading(true);
      const stats = await dbService.getStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Helpers for export
  const nowStamp = () => {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  };

  const getDateFromRange = (range: string) => {
    const from = new Date();
    switch (range) {
      case 'week':
        from.setDate(from.getDate() - 7);
        break;
      case 'month':
        from.setDate(from.getDate() - 30);
        break;
      case 'quarter':
        from.setDate(from.getDate() - 90);
        break;
      case 'year':
        from.setDate(from.getDate() - 365);
        break;
      default:
        from.setDate(from.getDate() - 30);
    }
    return from;
  };

  const handleExportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default as any;

      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
      const title = 'Laporan & Analitik Pembayaran';
      const subtitle = `Tipe: ${reportType} • Rentang: ${dateRange} • Dibuat: ${new Date().toLocaleString('id-ID')}`;

      doc.setFontSize(16);
      doc.text(title, 40, 40);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(subtitle, 40, 58);

      const addSummary = () => {
        const summaryRows = [
          ['Total Pendapatan', statistics.totalPaid ?? 0],
          ['Mahasiswa Aktif', statistics.totalStudents ?? 0],
          ['Total Tagihan', statistics.totalBills ?? 0],
          ['Tingkat Kolektibilitas', `${(statistics.collectibilityRate ?? 0).toFixed(1)}%`],
        ].map(([k, v]) => [k as string, typeof v === 'number' ? formatCurrency(v as number) : (v as string)]);
        autoTable(doc, {
          startY: 80,
          head: [['Ringkasan', 'Nilai']],
          body: summaryRows,
          styles: { fontSize: 9 },
          headStyles: { fillColor: [84, 0, 2] },
          theme: 'striped',
          columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 120, halign: 'left' } },
        });
      };

      const addMonthlyIncome = () => {
        const monthlyRows = monthlyIncome.map(m => [m.month, formatCurrency(m.income)]);
        autoTable(doc, {
          startY: (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 16 : 80,
          head: [['Bulan', 'Pendapatan']],
          body: monthlyRows,
          styles: { fontSize: 9 },
          headStyles: { fillColor: [84, 0, 2] },
          theme: 'striped',
          columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 120, halign: 'left' } },
        });
      };

      const addMethodDist = () => {
        const methodRows = methodDist.map(m => [m.method, m.count, `${m.percentage}%`]);
        autoTable(doc, {
          startY: (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 16 : 80,
          head: [['Metode', 'Jumlah', 'Persentase']],
          body: methodRows,
          styles: { fontSize: 9 },
          headStyles: { fillColor: [84, 0, 2] },
          theme: 'striped',
        });
      };

      const addTopPrograms = () => {
        const topRows = topPrograms.map((p, i) => [i + 1, p.prodi, p.students, formatCurrency(p.revenue), formatCurrency(p.revenue / Math.max(1, p.students))]);
        autoTable(doc, {
          startY: (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 16 : 80,
          head: [['Ranking', 'Program Studi', 'Mahasiswa', 'Pendapatan', 'Rata-rata/Mhs']],
          body: topRows,
          styles: { fontSize: 9 },
          headStyles: { fillColor: [84, 0, 2] },
          theme: 'striped',
        });
      };

      switch (reportType) {
        case 'financial':
          addSummary();
          addMonthlyIncome();
          break;
        case 'payments':
          addMethodDist();
          break;
        case 'students':
          addTopPrograms();
          break;
        default: // overview
          addSummary();
          addMonthlyIncome();
          addMethodDist();
          addTopPrograms();
      }

      doc.save(`Laporan_${reportType}_${nowStamp()}.pdf`);
    } catch (e) {
      console.error('Export PDF error:', e);
      alert('Gagal membuat PDF. Pastikan dependensi sudah terpasang: jspdf, jspdf-autotable.');
    }
  };

  const handleExportExcel = async () => {
    try {
      const ExcelJS: any = await import('exceljs');

      const currencyFmt = '"Rp" #,##0';
      const percentFmt = '0.0%';
      const maroon = 'FF540002';
      const white = 'FFFFFFFF';

      const wb = new ExcelJS.Workbook();
      wb.creator = 'PembayaranKampus';
      wb.created = new Date();

      const styleHeader = (ws: any, rowIndex: number, colCount: number) => {
        const row = ws.getRow(rowIndex);
        for (let c = 1; c <= colCount; c++) {
          const cell = row.getCell(c);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: maroon } };
          cell.font = { color: { argb: white }, bold: true };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          cell.border = {
            top: { style: 'thin', color: { argb: maroon } },
            left: { style: 'thin', color: { argb: maroon } },
            bottom: { style: 'thin', color: { argb: maroon } },
            right: { style: 'thin', color: { argb: maroon } },
          };
        }
      };

      const addSummarySheet = () => {
        const ws = wb.addWorksheet('Ringkasan');
        ws.columns = [ { width: 25 }, { width: 20 } ];
        ws.addRow(['Ringkasan', 'Nilai']);
        styleHeader(ws, 1, 2);
        ws.addRow(['Total Pendapatan', statistics.totalPaid ?? 0]);
        ws.getCell('B2').numFmt = currencyFmt;
        ws.addRow(['Mahasiswa Aktif', statistics.totalStudents ?? 0]);
        ws.addRow(['Total Tagihan', statistics.totalBills ?? 0]);
        ws.getCell('B4').numFmt = currencyFmt;
        ws.addRow(['Tingkat Kolektibilitas', (statistics.collectibilityRate ?? 0) / 100]);
        ws.getCell('B5').numFmt = percentFmt;
      };

      const addMonthlySheet = () => {
        const ws = wb.addWorksheet('PendapatanBulanan');
        ws.columns = [ { width: 20 }, { width: 20 } ];
        ws.addRow(['Bulan', 'Pendapatan']);
        styleHeader(ws, 1, 2);
        monthlyIncome.forEach((m) => {
          const r = ws.addRow([m.month, m.income]);
          r.getCell(2).numFmt = currencyFmt;
        });
      };

      const addMethodsSheet = () => {
        const ws = wb.addWorksheet('MetodePembayaran');
        ws.columns = [ { width: 20 }, { width: 10 }, { width: 15 } ];
        ws.addRow(['Metode', 'Jumlah', 'Persentase']);
        styleHeader(ws, 1, 3);
        methodDist.forEach((m) => {
          const r = ws.addRow([m.method, m.count, (m.percentage ?? 0) / 100]);
          r.getCell(3).numFmt = percentFmt;
        });
      };

      const addTopSheet = () => {
        const ws = wb.addWorksheet('TopProdi');
        ws.columns = [ { width: 8 }, { width: 30 }, { width: 10 }, { width: 20 }, { width: 18 } ];
        ws.addRow(['Ranking', 'Program Studi', 'Mahasiswa', 'Pendapatan', 'Rata-rata/Mhs']);
        styleHeader(ws, 1, 5);
        topPrograms.forEach((p, i) => {
          const r = ws.addRow([
            i + 1,
            p.prodi,
            p.students,
            p.revenue,
            p.revenue / Math.max(1, p.students),
          ]);
          r.getCell(4).numFmt = currencyFmt;
          r.getCell(5).numFmt = currencyFmt;
        });
      };

      const addOverviewSheet = () => {
        const ws = wb.addWorksheet('Overview');
        ws.columns = [ { width: 25 }, { width: 22 }, { width: 16 }, { width: 18 }, { width: 16 } ];

        // Title and subtitle
        ws.addRow(['Laporan & Analitik Pembayaran']);
        ws.addRow([`Tipe: ${reportType} • Rentang: ${dateRange} • Dibuat: ${new Date().toLocaleString('id-ID')}`]);
        ws.addRow([]);

        // Summary block
        const header1 = ws.addRow(['Ringkasan', 'Nilai']);
        styleHeader(ws, header1.number, 2);
        const r1 = ws.addRow(['Total Pendapatan', statistics.totalPaid ?? 0]); ws.getCell(`B${r1.number}`).numFmt = currencyFmt;
        ws.addRow(['Mahasiswa Aktif', statistics.totalStudents ?? 0]);
        const r3 = ws.addRow(['Total Tagihan', statistics.totalBills ?? 0]); ws.getCell(`B${r3.number}`).numFmt = currencyFmt;
        const r4 = ws.addRow(['Tingkat Kolektibilitas', (statistics.collectibilityRate ?? 0) / 100]); ws.getCell(`B${r4.number}`).numFmt = percentFmt;
        ws.addRow([]);

        // Monthly block
        const header2 = ws.addRow(['Bulan', 'Pendapatan']);
        styleHeader(ws, header2.number, 2);
        monthlyIncome.forEach((m) => {
          const r = ws.addRow([m.month, m.income]);
          ws.getCell(`B${r.number}`).numFmt = currencyFmt;
        });
        ws.addRow([]);

        // Methods block
        const header3 = ws.addRow(['Metode', 'Jumlah', 'Persentase']);
        styleHeader(ws, header3.number, 3);
        methodDist.forEach((m) => {
          const r = ws.addRow([m.method, m.count, (m.percentage ?? 0) / 100]);
          ws.getCell(`C${r.number}`).numFmt = percentFmt;
        });
        ws.addRow([]);

        // Top programs block
        const header4 = ws.addRow(['Ranking', 'Program Studi', 'Mahasiswa', 'Pendapatan', 'Rata-rata/Mhs']);
        styleHeader(ws, header4.number, 5);
        topPrograms.forEach((p, i) => {
          const r = ws.addRow([i + 1, p.prodi, p.students, p.revenue, p.revenue / Math.max(1, p.students)]);
          ws.getCell(`D${r.number}`).numFmt = currencyFmt;
          ws.getCell(`E${r.number}`).numFmt = currencyFmt;
        });
      };

      // Gabungan khusus untuk 'Keuangan' (Ringkasan + Bulanan)
      const addFinancialSheet = () => {
        const ws = wb.addWorksheet('Keuangan');
        ws.columns = [ { width: 25 }, { width: 22 } ];
        ws.addRow(['Laporan & Analitik Pembayaran']);
        ws.addRow([`Tipe: ${reportType} • Rentang: ${dateRange} • Dibuat: ${new Date().toLocaleString('id-ID')}`]);
        ws.addRow([]);

        const header1 = ws.addRow(['Ringkasan', 'Nilai']);
        styleHeader(ws, header1.number, 2);
        const r1 = ws.addRow(['Total Pendapatan', statistics.totalPaid ?? 0]); ws.getCell(`B${r1.number}`).numFmt = currencyFmt;
        ws.addRow(['Mahasiswa Aktif', statistics.totalStudents ?? 0]);
        const r3 = ws.addRow(['Total Tagihan', statistics.totalBills ?? 0]); ws.getCell(`B${r3.number}`).numFmt = currencyFmt;
        const r4 = ws.addRow(['Tingkat Kolektibilitas', (statistics.collectibilityRate ?? 0) / 100]); ws.getCell(`B${r4.number}`).numFmt = percentFmt;
        ws.addRow([]);

        const header2 = ws.addRow(['Bulan', 'Pendapatan']);
        styleHeader(ws, header2.number, 2);
        monthlyIncome.forEach((m) => {
          const r = ws.addRow([m.month, m.income]);
          ws.getCell(`B${r.number}`).numFmt = currencyFmt;
        });
      };

      // Gabungan khusus untuk 'Pembayaran' (Metode Pembayaran)
      const addPaymentsSheet = () => {
        const ws = wb.addWorksheet('Pembayaran');
        ws.columns = [ { width: 20 }, { width: 10 }, { width: 15 } ];
        ws.addRow(['Laporan & Analitik Pembayaran']);
        ws.addRow([`Tipe: ${reportType} • Rentang: ${dateRange} • Dibuat: ${new Date().toLocaleString('id-ID')}`]);
        ws.addRow([]);

        const header = ws.addRow(['Metode', 'Jumlah', 'Persentase']);
        styleHeader(ws, header.number, 3);
        methodDist.forEach((m) => {
          const r = ws.addRow([m.method, m.count, (m.percentage ?? 0) / 100]);
          r.getCell(3).numFmt = percentFmt;
        });
      };

      // Gabungan khusus untuk 'Mahasiswa' (Top Prodi)
      const addStudentsSheet = () => {
        const ws = wb.addWorksheet('Mahasiswa');
        ws.columns = [ { width: 8 }, { width: 30 }, { width: 12 }, { width: 20 }, { width: 18 } ];
        ws.addRow(['Laporan & Analitik Pembayaran']);
        ws.addRow([`Tipe: ${reportType} • Rentang: ${dateRange} • Dibuat: ${new Date().toLocaleString('id-ID')}`]);
        ws.addRow([]);

        const header = ws.addRow(['Ranking', 'Program Studi', 'Mahasiswa', 'Pendapatan', 'Rata-rata/Mhs']);
        styleHeader(ws, header.number, 5);
        topPrograms.forEach((p, i) => {
          const r = ws.addRow([i + 1, p.prodi, p.students, p.revenue, p.revenue / Math.max(1, p.students)]);
          r.getCell(4).numFmt = currencyFmt;
          r.getCell(5).numFmt = currencyFmt;
        });
      };

      switch (reportType) {
        case 'financial':
          addFinancialSheet();
          // Tetap tambahkan sheet per-bagian
          addSummarySheet();
          addMonthlySheet();
          break;
        case 'payments':
          addPaymentsSheet();
          addMethodsSheet();
          break;
        case 'students':
          addStudentsSheet();
          addTopSheet();
          break;
        default:
          addOverviewSheet();
          addSummarySheet();
          addMonthlySheet();
          addMethodsSheet();
          addTopSheet();
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Laporan_${reportType}_${nowStamp()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export Excel error:', e);
      alert('Gagal membuat Excel. Pastikan dependensi sudah terpasang: exceljs.');
    }
  };

  const handleExportCSV = async () => {
    try {
      // Ambil riwayat pembayaran untuk CSV (detail)
      const all = await dbService.getPayments();
      const from = getDateFromRange(dateRange);
      const filtered = all.filter((p: any) => new Date(p.payment_date) >= from);

      const rows = [
        ['Receipt', 'Mahasiswa', 'NIM_KASHIF', 'NIM_DIKTI', 'Kategori', 'Nominal', 'Metode', 'Tanggal', 'Status'],
        ...filtered.map((p: any) => [
          p.receipt_number,
          p.students?.name || '',
          p.students?.nim_kashif || '',
          p.students?.nim_dikti || '',
          p.bills?.category || '',
          p.amount,
          p.payment_method,
          new Date(p.payment_date).toLocaleString('id-ID'),
          p.status,
        ])
      ];

      const csv = rows.map(r => r.map((cell) => {
        const s = String(cell ?? '');
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Riwayat_Pembayaran_${dateRange}_${nowStamp()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export CSV error:', e);
      alert('Gagal membuat CSV.');
    }
  };

  const reportCards = [
    {
      title: 'Total Pendapatan',
      value: formatCurrency(statistics.totalPaid || 0),
      subtitle: 'Dari semua pembayaran',
      icon: DollarSign,
      color: 'green',
      trend: { value: 12.5, isPositive: true }
    },
    {
      title: 'Mahasiswa Aktif',
      value: statistics.totalStudents || 0,
      subtitle: 'Mahasiswa terdaftar',
      icon: Users,
      color: 'blue',
      trend: { value: 5.2, isPositive: true }
    },
    {
      title: 'Total Tagihan',
      value: formatCurrency(statistics.totalBills || 0),
      subtitle: 'Nilai keseluruhan',
      icon: FileText,
      color: 'purple',
      trend: { value: 8.1, isPositive: true }
    },
    {
      title: 'Tingkat Kolektibilitas',
      value: `${statistics.collectibilityRate?.toFixed(1) || 0}%`,
      subtitle: 'Target 90%',
      icon: TrendingUp,
      color: 'orange',
      trend: { value: 2.3, isPositive: false }
    }
  ];

  // Target sederhana: gunakan rata-rata + 10% sebagai target visual
  const monthlyAvg = monthlyIncome.length ? Math.round(monthlyIncome.reduce((s, m) => s + m.income, 0) / monthlyIncome.length) : 0;
  const monthlyTarget = Math.round(monthlyAvg * 1.1);
  const paymentMethods = methodDist;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laporan & Analitik</h1>
          <p className="text-gray-600 mt-1">Dashboard analitik pembayaran dan keuangan</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent">
            <option value="overview">Ringkasan</option>
            <option value="financial">Keuangan</option>
            <option value="students">Mahasiswa</option>
            <option value="payments">Pembayaran</option>
          </select>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent">
            <option value="week">7 Hari</option>
            <option value="month">30 Hari</option>
            <option value="quarter">3 Bulan</option>
            <option value="year">1 Tahun</option>
          </select>
          {/* Primary: PDF (filled maroon) */}
          <button onClick={handleExportPDF} className="flex items-center space-x-2 px-4 py-2 bg-[#540002] text-white rounded-lg hover:bg-[#6d0003] transition-colors">
            <Download className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
          {/* Secondary: Excel (outlined maroon) */}
          <button onClick={handleExportExcel} className="flex items-center space-x-2 px-4 py-2 border border-[#540002] text-[#540002] rounded-lg hover:bg-[#540002]/10 transition-colors">
            <Download className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {reportCards.map((card, index) => {
          const Icon = card.icon;
          const colorClasses = {
            green: 'bg-green-50 text-green-600 border-green-200',
            blue: 'bg-blue-50 text-blue-600 border-blue-200',
            purple: 'bg-purple-50 text-purple-600 border-purple-200',
            orange: 'bg-orange-50 text-orange-600 border-orange-200',
          } as const;
          return (
            <div key={index} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg border ${colorClasses[card.color as keyof typeof colorClasses]}`}>
                  <Icon className="w-6 h-6" />
                </div>
                {card.trend && (
                  <div className={`flex items-center space-x-1 text-sm font-medium ${card.trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {card.trend.isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span>{card.trend.value}%</span>
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-1">{card.value}</h3>
                <p className="text-sm text-gray-600 mb-1">{card.title}</p>
                <p className="text-xs text-gray-500">{card.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Pendapatan Bulanan</h3>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Calendar className="w-4 h-4" />
              <span>6 Bulan Terakhir</span>
            </div>
          </div>
          <div className="space-y-4">
            {monthlyIncome.map((data: { month: string; income: number }, index: number) => {
              const target = monthlyTarget || data.income || 1;
              const pct = Math.min(100, Math.round((data.income / target) * 100));
              return (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-700 w-8">{data.month}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2 w-32">
                      <div className="bg-[#540002] h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">{formatCurrency(data.income)}</div>
                    <div className="text-xs text-gray-500">Target: {formatCurrency(target)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Methods Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Metode Pembayaran</h3>
          <div className="space-y-4">
            {paymentMethods.map((method, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full bg-[#540002]" style={{ opacity: 1 - index * 0.2 }}></div>
                  <span className="text-sm font-medium text-gray-700">{method.method}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">{method.count}</div>
                    <div className="text-xs text-gray-500">{method.percentage}%</div>
                  </div>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div className="bg-[#540002] h-2 rounded-full" style={{ width: `${method.percentage}%`, opacity: 1 - index * 0.2 }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Programs Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Program Studi Teratas</h3>
          <p className="text-sm text-gray-600 mt-1">Berdasarkan jumlah mahasiswa dan pendapatan</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ranking</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program Studi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mahasiswa</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pendapatan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rata-rata/Mahasiswa</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {topPrograms.map((program, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-600' : 'bg-gray-300'}`}>{index + 1}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{program.prodi}</div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{program.students} mahasiswa</div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{formatCurrency(program.revenue)}</div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{formatCurrency(program.revenue / Math.max(1, program.students))}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Section removed per request */}
    </div>
  );
};

export default ReportsManagement;