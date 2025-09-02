import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Search, 
  Download, 
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  Calendar,
  TrendingUp,
  Trash
} from 'lucide-react';
import { dbService } from '../../lib/mysql';
import { useToast } from '../../components/Toast/ToastProvider';
import ReceiptModal from '../../components/Receipts/ReceiptModal';

const PaymentsManagement: React.FC = () => {
  const { showToast } = useToast();
  const [filteredPayments, setFilteredPayments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [total, setTotal] = useState(0);
  const [statsGlobal, setStatsGlobal] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    failed: 0,
    totalAmountCompleted: 0,
    todayAmountCompleted: 0,
  });

  useEffect(() => {
    fetchPaymentsPage();
    fetchPaymentsStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, methodFilter, dateFilter]);

  useEffect(() => {
    // reset to page 1 whenever search term changes
    const debounce = setTimeout(() => {
      setPage(1);
      fetchPaymentsPage(1);
      fetchPaymentsStats();
    }, 300);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const fetchPaymentsPage = async (overridePage?: number) => {
    try {
      setLoading(true);
      const statusParam: 'completed' | 'pending' | 'failed' | 'all' | undefined =
        statusFilter === 'all' ? 'all' : (statusFilter as 'completed' | 'pending' | 'failed');
      const methodParam: string | 'all' | undefined = methodFilter || 'all';
      const dateParam: 'all' | 'today' | 'week' | 'month' | undefined = (dateFilter as any) || 'all';
      const { data, total: count } = await dbService.getPaymentsPaged({
        page: overridePage ?? page,
        pageSize,
        search: searchTerm || undefined,
        status: statusParam,
        method: methodParam,
        dateRange: dateParam,
      });
      setFilteredPayments(data || []);
      setTotal(count || 0);
    } catch (error) {
      console.error('Error loading payments:', error);
      showToast({ type: 'error', title: 'Gagal memuat', message: 'Tidak dapat memuat data pembayaran.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePayment = async (id: string) => {
    const ok = window.confirm('Hapus pembayaran ini? Tindakan ini tidak dapat dibatalkan.');
    if (!ok) return;
    try {
      setLoading(true);
      await dbService.deletePayment(id);
      showToast({ type: 'success', title: 'Berhasil', message: 'Pembayaran dihapus.' });
      // Refresh data and stats
      await Promise.all([fetchPaymentsPage(1), fetchPaymentsStats()]);
      setPage(1);
    } catch (e) {
      console.error('Delete payment failed', e);
      showToast({ type: 'error', title: 'Gagal', message: 'Tidak dapat menghapus pembayaran.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentsStats = async () => {
    try {
      const methodParam: string | 'all' | undefined = methodFilter || 'all';
      const dateParam: 'all' | 'today' | 'week' | 'month' | undefined = (dateFilter as any) || 'all';
      const { total: t, completed, pending, failed, totalAmountCompleted, todayAmountCompleted } = await dbService.getPaymentsGlobalStats({
        search: searchTerm || undefined,
        method: methodParam,
        dateRange: dateParam,
      });
      setTotal(t || 0);
      setStatsGlobal({ total: t || 0, completed, pending, failed, totalAmountCompleted, todayAmountCompleted });
    } catch (error) {
      // Non-fatal for UI; keep silent or log
      console.error('Error loading payment stats:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // (buildExportPaymentRows removed; export now fetches all filtered rows from server)

  const handleExportPaymentsExcel = async () => {
    const ExcelJS: any = await import('exceljs');
    const maroon = 'FF540002';
    const white = 'FFFFFFFF';
    const currencyFmt = '"Rp" #,##0';

    const wb = new ExcelJS.Workbook();
    wb.creator = 'PembayaranKampus';
    wb.created = new Date();

    const ws = wb.addWorksheet('Pembayaran');
    ws.columns = [
      { width: 16 }, // Receipt
      { width: 28 }, // Mahasiswa
      { width: 20 }, // NIM KASHIF
      { width: 36 }, // Deskripsi
      { width: 16 }, // Metode
      { width: 14 }, // Nominal
      { width: 12 }, // Tanggal
      { width: 10 }, // Jam
      { width: 12 }, // Status
    ];

    const styleHeader = (rowIndex: number, colCount: number) => {
      const row = ws.getRow(rowIndex);
      for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: maroon } } as any;
        cell.font = { color: { argb: white }, bold: true } as any;
        cell.alignment = { vertical: 'middle', horizontal: 'left' } as any;
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        } as any;
      }
    };

    const header = ws.addRow(['Receipt','Mahasiswa','NIM KASHIF','Deskripsi','Metode','Nominal','Tanggal','Jam','Status']);
    styleHeader(header.number, 9);

    // Fetch all filtered payments (no pagination) for full export
    const allFiltered = await dbService.getPaymentsAllFiltered({
      search: searchTerm || undefined,
      status: (statusFilter as any) || 'all',
      method: (methodFilter as any) || 'all',
      dateRange: (dateFilter as any) || 'all',
    });
    allFiltered.forEach((p: any) => {
      const row = ws.addRow([
        p.receipt_number,
        p.student_name || '-',
        [p.student_nim, p.student_nim_dikti].filter(Boolean).join(' / '),
        p.bill_description || p.bill_category || '-',
        p.payment_method || '-',
        p.amount || 0,
        new Date(p.payment_date).toLocaleDateString('id-ID'),
        new Date(p.payment_date).toLocaleTimeString('id-ID'),
        p.status,
      ]);
      row.getCell(6).numFmt = currencyFmt;
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    a.download = `Laporan_pembayaran_${ts}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPaymentsPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    // F4 portrait points in landscape (match BillsManagement)
    const F4_PORTRAIT_PT: [number, number] = [595.28, 935.43];
    const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: F4_PORTRAIT_PT });
    const pageSize: any = doc.internal.pageSize;
    const pageWidth: number = (pageSize.getWidth ? pageSize.getWidth() : pageSize.width) as number;

    // Title
    const title = 'Status Pembayaran';
    doc.setFontSize(14);
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, (pageWidth - titleWidth) / 2, 40);

    // Subtitle with active filters
    const statusLabel = statusFilter === 'all' ? 'Semua' : (statusFilter === 'completed' ? 'Berhasil' : statusFilter === 'pending' ? 'Pending' : 'Gagal');
    const methodLabel = methodFilter === 'all' ? 'Semua' : methodFilter;
    const dateLabel = (() => {
      switch (dateFilter) {
        case 'today': return 'Hari Ini';
        case 'week': return '7 Hari Terakhir';
        case 'month': return '30 Hari Terakhir';
        default: return 'Semua Waktu';
      }
    })();
    const searchLabel = searchTerm ? ` | Pencarian: ${searchTerm}` : '';
    doc.setFontSize(11);
    doc.text(`Status: ${statusLabel} | Metode: ${methodLabel} | Periode: ${dateLabel}${searchLabel}`.trim(), 20, 58);

    const head = [[
      'Receipt',
      'Mahasiswa',
      'NIM KASHIF',
      'Deskripsi',
      'Metode',
      'Nominal',
      'Tanggal',
      'Jam',
      'Status',
    ]];

    // Fetch all filtered payments (no pagination) for full export
    const allFiltered = await dbService.getPaymentsAllFiltered({
      search: searchTerm || undefined,
      status: (statusFilter as any) || 'all',
      method: (methodFilter as any) || 'all',
      dateRange: (dateFilter as any) || 'all',
    });
    const rows = allFiltered.map((p: any) => [
      p.receipt_number,
      p.student_name || '-',
      [p.student_nim, p.student_nim_dikti].filter(Boolean).join(' / '),
      p.bill_description || p.bill_category || '-',
      p.payment_method || '-',
      formatCurrency(p.amount || 0),
      new Date(p.payment_date).toLocaleDateString('id-ID'),
      new Date(p.payment_date).toLocaleTimeString('id-ID'),
      p.status,
    ]);

    autoTable(doc, {
      head,
      body: rows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4, halign: 'left', valign: 'middle', lineColor: [200,200,200], lineWidth: 0.5, cellWidth: 'wrap', overflow: 'linebreak' },
      headStyles: { fillColor: [84, 0, 2], textColor: 255, halign: 'center' },
      startY: 80,
      margin: { top: 70, left: 20, right: 20 },
      columnStyles: {
        5: { cellWidth: 85, halign: 'right' }, // Nominal
        6: { cellWidth: 70 },                  // Tanggal
        7: { cellWidth: 55 },                  // Jam
        8: { cellWidth: 70, halign: 'center' },// Status
      },
      didDrawPage: () => {
        const page = doc.getNumberOfPages();
        const pSize: any = doc.internal.pageSize;
        const pH = pSize.getHeight ? pSize.getHeight() : pSize.height;
        const pW = pSize.getWidth ? pSize.getWidth() : pSize.width;
        doc.setFontSize(9);
        doc.text(`Halaman ${page}`, pW - 80, pH - 20);
      },
    });

    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    doc.save(`Laporan_pembayaran_${ts}.pdf`);
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      completed: 'bg-green-100 text-green-800 border-green-200',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      failed: 'bg-red-100 text-red-800 border-red-200',
    };

    const labels = {
      completed: 'Berhasil',
      pending: 'Pending',
      failed: 'Gagal',
    };

    const icons = {
      completed: CheckCircle,
      pending: Clock,
      failed: XCircle,
    };

    const Icon = icons[status as keyof typeof icons];

    return (
      <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium border ${badges[status as keyof typeof badges]}`}>
        <Icon className="w-3 h-3" />
        <span>{labels[status as keyof typeof labels]}</span>
      </span>
    );
  };

  const getMethodBadge = (method: string) => {
    const badges = {
      'Transfer Bank': 'bg-blue-100 text-blue-800 border-blue-200',
      'Virtual Account': 'bg-purple-100 text-purple-800 border-purple-200',
      'E-Wallet': 'bg-green-100 text-green-800 border-green-200',
      'Cash': 'bg-gray-100 text-gray-800 border-gray-200',
    };

    return (
      <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium border ${badges[method as keyof typeof badges] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
        {method}
      </span>
    );
  };

  const stats = {
    total: statsGlobal.total,
    completed: statsGlobal.completed,
    pending: statsGlobal.pending,
    failed: statsGlobal.failed,
    totalAmount: statsGlobal.totalAmountCompleted,
    todayAmount: statsGlobal.todayAmountCompleted,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Status Pembayaran</h1>
          <p className="text-gray-600 mt-1">Monitor dan kelola status pembayaran mahasiswa</p>
          {/* Receipt Modal */}
      {receiptId && (
        <ReceiptModal
          isOpen={!!receiptId}
          onClose={() => setReceiptId(null)}
          paymentId={receiptId}
        />
      )}
    </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            className="flex items-center space-x-2 px-4 py-2 bg-[#540002] text-white rounded-lg hover:bg-[#6d0003] transition-colors"
            onClick={handleExportPaymentsPDF}
            title="Export PDF"
          >
            <Download className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
          <button
            className="flex items-center space-x-2 px-4 py-2 bg-white text-[#540002] border border-[#540002] rounded-lg hover:bg-[#540002]/5 transition-colors"
            onClick={handleExportPaymentsExcel}
            title="Export Excel"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Pembayaran</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <CreditCard className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Berhasil</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Nilai</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(stats.totalAmount)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Hari Ini</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(stats.todayAmount)}</p>
            </div>
            <Calendar className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari pembayaran (mahasiswa, NIM, receipt, kategori)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full lg:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
            >
              <option value="all">Semua Status</option>
              <option value="completed">Berhasil</option>
              <option value="pending">Pending</option>
              <option value="failed">Gagal</option>
            </select>
            <select
              value={methodFilter}
              onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
            >
              <option value="all">Semua Metode</option>
              <option value="Transfer Bank">Transfer Bank</option>
              <option value="Virtual Account">Virtual Account</option>
              <option value="E-Wallet">E-Wallet</option>
              <option value="Cash">Cash</option>
            </select>
            <select
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
            >
              <option value="all">Semua Waktu</option>
              <option value="today">Hari Ini</option>
              <option value="week">7 Hari Terakhir</option>
              <option value="month">30 Hari Terakhir</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payments List (mobile) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {/* Cards - show on small screens */}
        <div className="block sm:hidden">
          {loading ? (
            <div className="px-4 py-12 text-center text-gray-500">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-[#540002]/30 border-t-[#540002] rounded-full animate-spin"></div>
                <span>Memuat data...</span>
              </div>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-500">Tidak ada data pembayaran yang ditemukan</div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
              {filteredPayments.map((payment) => (
                <li key={payment.id} className="p-4 border border-gray-100 rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-500">Receipt</p>
                      <p className="text-base font-semibold text-gray-900">{payment.receipt_number}</p>
                    </div>
                    {getStatusBadge(payment.status)}
                  </div>
                  <div className="mt-3">
                    <p className="text-sm text-gray-500">Mahasiswa</p>
                    <p className="text-sm font-medium text-gray-900">{payment.students?.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      KASHIF: {payment.students?.nim_kashif}
                      {payment.students?.nim_dikti && <span className="ml-1">• DIKTI: {payment.students?.nim_dikti}</span>}
                    </p>
                  </div>
                  <div className="mt-3">
                    <p className="text-sm text-gray-500">Tagihan</p>
                    <p className="text-sm font-medium text-gray-900">{payment.bills?.category}</p>
                    {payment.bills?.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{payment.bills?.description}</p>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Nominal</p>
                      <p className="text-base font-semibold text-gray-900">{formatCurrency(payment.amount)}</p>
                    </div>
                    <div className="ml-4">{getMethodBadge(payment.payment_method)}</div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <div className="text-gray-700">
                      {new Date(payment.payment_date).toLocaleDateString('id-ID')}
                      <span className="mx-1">•</span>
                      {new Date(payment.payment_date).toLocaleTimeString('id-ID')}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        className="text-[#540002] font-medium hover:underline"
                        onClick={() => setReceiptId(payment.id)}
                      >
                        Lihat
                      </button>
                      <button
                        className="text-red-600 hover:text-red-700"
                        title="Hapus"
                        onClick={() => handleDeletePayment(payment.id)}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Table - show on sm and above */}
        <div className="hidden sm:block">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Receipt
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mahasiswa
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tagihan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nominal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Metode
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tanggal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-[#540002]/30 border-t-[#540002] rounded-full animate-spin"></div>
                      <span>Memuat data...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    Tidak ada data pembayaran yang ditemukan
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {payment.receipt_number}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {payment.student_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          KASHIF: {payment.student_nim}
                          {payment.student_nim_dikti && (
                            <span className="ml-2">• DIKTI: {payment.student_nim_dikti}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{payment.bill_category || payment.category_name}</div>
                        <div className="text-sm text-gray-500">{payment.bill_description}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(payment.amount)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getMethodBadge(payment.payment_method)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {new Date(payment.payment_date).toLocaleDateString('id-ID')}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(payment.payment_date).toLocaleTimeString('id-ID')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(payment.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                          title="Lihat Detail"
                          onClick={() => setReceiptId(payment.id)}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1 text-red-600 hover:text-red-800 transition-colors"
                          title="Hapus"
                          onClick={() => handleDeletePayment(payment.id)}
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(
          filteredPayments.length > 0 || total > 0
        ) && (
          <div className="px-6 py-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {(() => {
                  const fromIdx = (page - 1) * pageSize + 1;
                  const toIdx = (page - 1) * pageSize + filteredPayments.length;
                  const totalPages = Math.max(1, Math.ceil(total / pageSize));
                  return `Menampilkan ${total === 0 ? 0 : fromIdx}-${Math.min(total, toIdx)} dari ${total} pembayaran (Hal. ${page} / ${totalPages})`;
                })()}
              </p>
              <div className="flex space-x-2">
                <button
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
                  disabled={page === 1 || loading}
                  onClick={() => { if (page > 1) setPage(page - 1); }}
                >
                  Sebelumnya
                </button>
                <button
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
                  disabled={page >= Math.ceil(total / pageSize) || loading}
                  onClick={() => { const tp = Math.ceil(total / pageSize); if (page < tp) setPage(page + 1); }}
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentsManagement;