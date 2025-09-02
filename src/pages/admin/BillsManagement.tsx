import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Download, 
  Edit, 
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  CreditCard
} from 'lucide-react';
import BillForm from '../../components/Forms/BillForm';
import PaymentForm from '../../components/Forms/PaymentForm';
import ReceiptModal from '../../components/Receipts/ReceiptModal';
import { dbService, Student, Bill } from '../../lib/mysql';
import { generateReceiptNumber, currencyIDR } from '../../lib/receipt';
import { useToast } from '../../components/Toast/ToastProvider';

const BillsManagement: React.FC = () => {
  const { showToast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredBills, setFilteredBills] = useState<any[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [payBill, setPayBill] = useState<any | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [viewBill, setViewBill] = useState<any | null>(null);
  const [editBill, setEditBill] = useState<any | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [saving, setSaving] = useState(false); // Tambahkan state untuk saving
  const pageSize = 20;
  const [globalStats, setGlobalStats] = useState<{ total: number; paid: number; unpaid: number; partial: number; totalAmount: number; paidAmount: number }>({ total: 0, paid: 0, unpaid: 0, partial: 0, totalAmount: 0, paidAmount: 0 });

  // Auto-calc installment amount in edit modal
  useEffect(() => {
    if (!editBill) return;
    if (!editBill.installment_count) return; // Only calculate if installment is enabled
    const amt = Number(editBill.amount || 0);
    const cnt = Number(editBill.installment_count || 0);
    if (amt > 0 && cnt > 0) {
      const per = Math.floor(amt / cnt);
      if (editBill.installment_amount !== per) {
        setEditBill((prev: any) => ({ ...prev, installment_amount: per }));
      }
    }
  }, [editBill?.installment_count, editBill?.amount, editBill?.installment_count]);

  useEffect(() => {
    // load students once for BillForm selection
    (async () => {
      try {
        const studentsData = await dbService.getStudents();
        setStudents(studentsData);
      } catch (error) {
        console.error('Error loading students:', error);
        showToast({ type: 'error', title: 'Gagal memuat', message: 'Tidak dapat memuat data mahasiswa.' });
      }
    })();
  }, []);

  useEffect(() => {
    // fetch bills page whenever page or filters/search change
    fetchBillsPage();
    // Also refresh global stats occasionally (cheap queries) to keep cards up-to-date
    fetchBillsGlobalStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchTerm, statusFilter]);

  const loadData = async () => {
    // kept for backward compatibility; now only reloads current page and students
    await Promise.all([fetchBillsPage(), (async () => {
      try {
        const studentsData = await dbService.getStudents();
        setStudents(studentsData);
      } catch (error) {
        console.error('Error loading students:', error);
      }
    })()]);
  };

  const fetchBillsPage = async () => {
    try {
      setLoading(true);
      const statusParam: 'paid' | 'unpaid' | 'partial' | 'all' | undefined =
        statusFilter === 'all' ? 'all' : (statusFilter as 'paid' | 'unpaid' | 'partial');
      const { data, total: count } = await dbService.getBillsPaged({
        page,
        pageSize,
        search: searchTerm || undefined,
        status: statusParam,
      });
      setFilteredBills(data || []);
      setTotal(count || 0);
    } catch (error) {
      console.error('Error loading bills:', error);
      showToast({ type: 'error', title: 'Gagal memuat', message: 'Tidak dapat memuat data tagihan.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchBillsGlobalStats = async () => {
    try {
      const stats = await dbService.getBillsGlobalStats();
      console.debug('[Bills] Global stats loaded:', stats);
      setGlobalStats(stats);
    } catch (error) {
      console.error('Error loading global bill stats:', error);
      showToast({ type: 'error', title: 'Gagal memuat statistik', message: 'Tidak dapat memuat statistik tagihan.' });
    }
  };

  const onPayClick = (bill: any) => {
    if (bill.status === 'paid') {
      showToast({ type: 'info', title: 'Sudah Lunas', message: 'Tagihan ini sudah lunas.' });
      return;
    }
    setPayBill(bill);
  };

  const handleCreatePayment = async (data: { amount: number; payment_method: string; payment_date: string; note?: string; }) => {
    if (!payBill) return;
    if (savingPayment) return; // guard double trigger
    setSavingPayment(true);
    try {
      // Ensure proper type conversion from API response (strings to numbers)
      const billAmount = parseFloat(String(payBill.amount || 0));
      const billPaidAmount = parseFloat(String(payBill.paid_amount || 0));
      const sisa = billAmount - billPaidAmount;
      const bayar = Math.min(data.amount, sisa);

      // Receipt number derived from student's NIM KASHIF
      const receipt_number = generateReceiptNumber(payBill.student_nim || '', data.payment_date);

      const paymentPayload = {
        bill_id: payBill.id,
        student_id: payBill.student_id,
        amount: bayar,
        payment_method: data.payment_method,
        payment_date: data.payment_date,
        receipt_number,
        status: 'completed' as const,
      };

      const payment = await dbService.createPayment(paymentPayload);

      // Ensure proper type conversion for status calculation
      const newPaid = billPaidAmount + bayar;
      const newStatus: Bill['status'] = newPaid >= billAmount ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');
      
      // Debug log to help troubleshoot
      console.log('💰 Payment Status Calculation:', {
        billAmount,
        billPaidAmount,
        bayar,
        newPaid,
        comparison: `${newPaid} >= ${billAmount}`,
        result: newPaid >= billAmount,
        newStatus
      });
      
      await dbService.updateBill(payBill.id, { paid_amount: newPaid, status: newStatus });

      showToast({ type: 'success', title: 'Pembayaran tercatat', message: `Nominal ${currencyIDR(bayar)} disimpan.` });
      setPayBill(null);
      
      // Add a small delay before setting receipt ID to ensure backend has processed the payment
      setTimeout(() => {
        setReceiptId(payment.id);
      }, 300);
      
      await loadData();
      await fetchBillsGlobalStats();
    } catch (e: any) {
      console.error('Payment creation error:', e);
      
      // Check if it's an authentication error
      if (e?.message && e.message.includes('Access token required')) {
        showToast({ 
          type: 'error', 
          title: 'Sesi Kedaluwarsa', 
          message: 'Sesi Anda telah kedaluwarsa. Silakan login kembali.' 
        });
        // Redirect to login page
        setTimeout(() => {
          window.location.hash = '#/login';
          window.location.reload();
        }, 2000);
      } 
      // Check if it's a server error
      else if (e?.message && (e.message.includes('Failed to fetch') || e.message.includes('500'))) {
        showToast({ 
          type: 'error', 
          title: 'Masalah Server', 
          message: 'Server sedang mengalami masalah. Silakan coba lagi dalam beberapa menit.' 
        });
      }
      else {
        showToast({ 
          type: 'error', 
          title: 'Gagal menyimpan', 
          message: e?.message || 'Tidak bisa menyimpan pembayaran. Silakan coba lagi.' 
        });
      }
      
      // Reset payBill state to allow retry
      setPayBill(null);
    } finally {
      setSavingPayment(false);
    }
  };

  // Client-side filter removed; server-side filtering is applied in fetchBillsPage

  // (buildExportBillRows removed; export now fetches all filtered rows from server)

  const handleExportBillsExcel = async () => {
    const ExcelJS: any = await import('exceljs');
    const maroon = 'FF540002';
    const white = 'FFFFFFFF';
    const currencyFmt = '"Rp" #,##0';

    const wb = new ExcelJS.Workbook();
    wb.creator = 'PembayaranKampus';
    wb.created = new Date();

    const ws = wb.addWorksheet('Tagihan');
    ws.columns = [
      { width: 28 }, // Mahasiswa
      { width: 20 }, // NIM KASHIF
      { width: 40 }, // Deskripsi
      { width: 16 }, // Nominal
      { width: 16 }, // Terbayar
      { width: 16 }, // Jatuh Tempo
      { width: 14 }, // Status
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

    const header = ws.addRow(['Mahasiswa','NIM KASHIF','Deskripsi','Nominal','Terbayar','Jatuh Tempo','Status']);
    styleHeader(header.number, 7);

    // Fetch all filtered bills (no pagination) for full export
    const allFiltered = await dbService.getBillsAllFiltered({
      search: searchTerm || undefined,
      status: (statusFilter as any) || 'all',
    });
    allFiltered.forEach((b: any) => {
      const row = ws.addRow([
        b.student_name || '-',
        [b.student_nim, b.student_nim_dikti].filter(Boolean).join(' / '),
        b.description || b.category_name || b.category || '-',
        b.amount || 0,
        b.paid_amount || 0,
        b.due_date ? new Date(b.due_date).toLocaleDateString('id-ID') : '-',
        b.status === 'paid' ? 'Lunas' : b.status === 'partial' ? 'Cicilan' : 'Belum Bayar',
      ]);
      // Format currency columns
      [4, 5].forEach(colIndex => {
        const cell = row.getCell(colIndex);
        cell.numFmt = currencyFmt;
      });
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tagihan_${new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportBillsPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    // F4 (portrait points) in landscape, sama seperti StudentsManagement
    const F4_PORTRAIT_PT: [number, number] = [595.28, 935.43];
    const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: F4_PORTRAIT_PT });
    const pageSize = doc.internal.pageSize;
    const pageWidth = (pageSize.getWidth ? pageSize.getWidth() : pageSize.width) as number;

    // Judul
    const title = 'Daftar Tagihan';
    doc.setFontSize(14);
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, (pageWidth - titleWidth) / 2, 40);

    // Subjudul: filter aktif
    const statusLabel = statusFilter === 'all' ? 'Semua' : (statusFilter === 'paid' ? 'Lunas' : statusFilter === 'partial' ? 'Cicilan' : 'Belum Lunas');
    const searchLabel = searchTerm ? ` | Pencarian: ${searchTerm}` : '';
    doc.setFontSize(11);
    doc.text(`Status: ${statusLabel}${searchLabel}`.trim(), 20, 58);

    const head = [[
      'Mahasiswa',
      'NIM KASHIF',
      'Deskripsi',
      'Nominal',
      'Terbayar',
      'Jatuh Tempo',
      'Status',
    ]];

    // Fetch all filtered bills (no pagination) for full export
    const allFiltered = await dbService.getBillsAllFiltered({
      search: searchTerm || undefined,
      status: (statusFilter as any) || 'all',
    });
    const rows = allFiltered.map((b: any) => [
      b.students?.name || '-',
      [b.students?.nim_kashif, b.students?.nim_dikti].filter(Boolean).join(' / '),
      b.description || b.bill_categories?.name || b.category || '-',
      currencyIDR(b.amount || 0),
      currencyIDR(b.paid_amount || 0),
      b.due_date ? new Date(b.due_date).toLocaleDateString('id-ID') : '-',
      b.status === 'paid' ? 'Lunas' : (b.status === 'partial' ? 'Cicilan' : 'Belum Lunas'),
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
        // Biarkan kolom teks auto-wrap; tetapkan hanya kolom kompak
        3: { cellWidth: 90, halign: 'right' }, // Nominal
        4: { cellWidth: 90, halign: 'right' }, // Terbayar
        5: { cellWidth: 85 },                  // Jatuh Tempo
        6: { cellWidth: 80, halign: 'center' },// Status
      },
      didDrawPage: () => {
        // Footer nomor halaman sama seperti StudentsManagement
        const page = doc.getNumberOfPages();
        const pSize = doc.internal.pageSize;
        const pH = pSize.getHeight ? pSize.getHeight() : (pSize as any).height;
        const pW = pSize.getWidth ? pSize.getWidth() : (pSize as any).width;
        doc.setFontSize(9);
        doc.text(`Halaman ${page}`, pW - 80, pH - 20);
      },
    });

    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    doc.save(`Laporan_tagihan_${ts}.pdf`);
  };

  const handleSubmit = async (billData: any) => {
    try {
      // billData from BillForm contains: category, description, amount, dueDate,
      // targetStudents ('all' | 'selected'), selectedStudents (array of nim_kashif),
      // allowInstallment, installmentCount, installmentAmount

      // Determine target student IDs
      let targetStudentIds: string[] = [];
      if (billData.targetStudents === 'all') {
        targetStudentIds = students.map(s => s.id);
      } else if (billData.targetStudents === 'selected') {
        const nimSet = new Set<string>(billData.selectedStudents || []);
        targetStudentIds = students.filter(s => nimSet.has(s.nim_kashif)).map(s => s.id);
      }

      if (targetStudentIds.length === 0) {
        showToast({ type: 'warning', title: 'Tidak ada target', message: 'Pilih minimal satu mahasiswa untuk dibuatkan tagihan.' });
        return;
      }

      const payload: Array<Omit<Bill, 'id' | 'created_at' | 'updated_at'>> = targetStudentIds.map((sid) => ({
        student_id: sid,
        // Keep legacy free-text for backward compatibility
        category: billData.category,
        // New foreign key reference to master categories
        category_id: billData.categoryId || null,
        description: billData.description,
        amount: Number(billData.amount) || 0,
        due_date: billData.dueDate,
        status: 'unpaid' as Bill['status'],
        paid_amount: 0,
        installment_count: billData.installmentCount ? Number(billData.installmentCount) : undefined,
        installment_amount: billData.installmentAmount ? Number(billData.installmentAmount) : undefined,
      }));

      // Bulk insert
      await dbService.createBills(payload);
      await loadData();
      await fetchBillsGlobalStats(); // Add this line to refresh dashboard statistics
      setIsFormOpen(false);
      showToast({ type: 'success', title: 'Tagihan dibuat', message: `${payload.length} tagihan berhasil dibuat.` });
    } catch (error) {
      console.error('Error creating bill:', error);
      const msg = (error as any)?.message || 'Terjadi kesalahan saat membuat tagihan.';
      const isConflict = /duplicate|unique/i.test(String(msg));
      showToast({ type: 'error', title: isConflict ? 'Data duplikat' : 'Gagal menyimpan', message: isConflict ? 'Tagihan serupa sudah ada.' : String(msg) });
    }
  };

  const formatCurrency = (amount: number) => currencyIDR(amount);

  const getStatusBadge = (status: string) => {
    const badges = {
      paid: 'bg-green-100 text-green-800 border-green-200',
      unpaid: 'bg-red-100 text-red-800 border-red-200',
      partial: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    };

    const labels = {
      paid: 'Lunas',
      unpaid: 'Belum Lunas',
      partial: 'Cicilan',
    };

    const icons = {
      paid: CheckCircle,
      unpaid: AlertCircle,
      partial: Clock,
    };

    const Icon = icons[status as keyof typeof icons];

    return (
      <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium border ${badges[status as keyof typeof badges]}`}>
        <Icon className="w-3 h-3" />
        <span>{labels[status as keyof typeof labels]}</span>
      </span>
    );
  };

  const handleEditBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBill) return;
    if (saving) return;
    setSaving(true);
    try {
      // Prepare update data - remove type field
      const updateData = {
        student_id: editBill.student_id,
        category: editBill.category,
        description: editBill.description,
        amount: Number(editBill.amount),
        due_date: editBill.due_date,
        status: editBill.status as 'paid' | 'unpaid' | 'partial',
        paid_amount: Number(editBill.paid_amount),
        installment_count: editBill.installment_count ? Number(editBill.installment_count) : undefined,
        installment_amount: editBill.installment_amount ? Number(editBill.installment_amount) : undefined,
        category_id: editBill.category_id,
      };

      await dbService.updateBill(editBill.id, updateData);
      showToast({ type: 'success', title: 'Berhasil', message: 'Tagihan berhasil diperbarui.' });
      setEditBill(null);
      await loadData();
      await fetchBillsGlobalStats(); // Add this line to refresh dashboard statistics
    } catch (e: any) {
      showToast({ type: 'error', title: 'Gagal', message: e?.message || 'Tidak bisa memperbarui tagihan.' });
    } finally {
      setSaving(false);
    }
  };

  const stats = {
    total: globalStats.total,
    paid: globalStats.paid,
    unpaid: globalStats.unpaid,
    partial: globalStats.partial,
    totalAmount: globalStats.totalAmount,
    paidAmount: globalStats.paidAmount,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kelola Tagihan</h1>
          <p className="text-gray-600 mt-1">Manajemen tagihan dan pembayaran mahasiswa</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-[#540002] text-white rounded-lg hover:bg-[#6d0003] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Tagihan</span>
          </button>
          <button
            onClick={handleExportBillsPDF}
            className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
          <button
            onClick={handleExportBillsExcel}
            className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-2 md:grid-cols-[repeat(3,auto)_minmax(0,1fr)] gap-2 sm:gap-3 lg:gap-4 items-stretch">
        <div className="bg-white p-4 sm:p-4 min-w-0 md:min-w-[12rem] md:w-auto rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Tagihan</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 sm:p-4 min-w-0 md:min-w-[12rem] md:w-auto rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Lunas</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.paid}</p>
            </div>
            <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 sm:p-4 min-w-0 md:min-w-[12rem] md:w-auto rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Belum Lunas</p>
              <p className="text-xl sm:text-2xl font-bold text-red-600">{stats.unpaid}</p>
            </div>
            <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" />
          </div>
        </div>
        <div className="bg-white p-3 sm:p-4 min-w-0 md:w-full rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Nilai</p>
              <p className="text-base sm:text-lg font-bold text-gray-900 whitespace-normal break-words leading-tight">{formatCurrency(stats.totalAmount)}</p>
            </div>
            <div className="text-right ml-4 pl-4 border-l border-gray-200">
              <p className="text-xs leading-4 text-gray-500 mb-0.5">Terbayar</p>
              <p className="text-sm font-semibold text-green-600 mt-0.5">{formatCurrency(stats.paidAmount)}</p>
            </div>
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
                placeholder="Cari tagihan (mahasiswa, NIM, kategori, deskripsi)..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-1 gap-2 w-full lg:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
            >
              <option value="all">Semua Status</option>
              <option value="paid">Lunas</option>
              <option value="unpaid">Belum Lunas</option>
              <option value="partial">Cicilan</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bills List (mobile) */}
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
          ) : filteredBills.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-500">Tidak ada data tagihan yang ditemukan</div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
              {filteredBills.map((bill) => (
                <li key={bill.id} className="p-4 border border-gray-100 rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-500">Mahasiswa</p>
                      <p className="text-base font-semibold text-gray-900">{bill.students?.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        KASHIF: {bill.students?.nim_kashif}
                        {bill.students?.nim_dikti && <span className="ml-1">• DIKTI: {bill.students?.nim_dikti}</span>}
                      </p>
                    </div>
                    {getStatusBadge(bill.status)}
                  </div>
                  <div className="mt-3">
                    <p className="text-sm text-gray-500">Tagihan</p>
                    <p className="text-sm font-medium text-gray-900">{bill.bill_categories?.name || bill.category}</p>
                    {bill.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{bill.description}</p>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-gray-500">Nominal</p>
                      <p className="text-base font-semibold text-gray-900">{formatCurrency(bill.amount)}</p>
                      {bill.paid_amount > 0 && (
                        <p className="text-xs text-green-600 mt-0.5">Terbayar: {formatCurrency(bill.paid_amount)}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <div className="text-gray-700">
                      Jatuh tempo: {new Date(bill.due_date).toLocaleDateString('id-ID')}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        className="text-[#540002] font-medium hover:underline"
                        onClick={() => onPayClick(bill)}
                      >
                        Bayar
                      </button>
                      <button
                        className={`text-blue-700 font-medium hover:underline ${bill.status === 'unpaid' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={async () => {
                          // Check if bill is unpaid, if so show info message and return
                          if (bill.status === 'unpaid') {
                            showToast({ type: 'info', title: 'Tidak ada pembayaran', message: 'Tagihan belum memiliki pembayaran.' });
                            return;
                          }
                          
                          try {
                            const latest = await dbService.getLatestPaymentForBill(bill.id);
                            if (!latest?.id) {
                              showToast({ type: 'info', title: 'Belum ada pembayaran', message: 'Tagihan ini belum memiliki pembayaran.' });
                              return;
                            }
                            setReceiptId(latest.id);
                          } catch (e: any) {
                            showToast({ type: 'error', title: 'Gagal membuka kwitansi', message: e?.message || 'Tidak dapat memuat pembayaran.' });
                          }
                        }}
                        disabled={bill.status === 'unpaid'}
                      >
                        Kwitansi
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
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mahasiswa
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tagihan
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nominal
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Jatuh Tempo
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Status
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-[#540002]/30 border-t-[#540002] rounded-full animate-spin"></div>
                      <span>Memuat data...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                    Tidak ada data tagihan yang ditemukan
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-normal break-words text-left align-top leading-tight">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {bill.student_name}
                        </div>
                        <div className="text-xs text-gray-500 break-words">
                          KASHIF: {bill.student_nim}
                          {bill.student_nim_dikti && (
                            <span className="ml-2">• DIKTI: {bill.student_nim_dikti}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-normal break-words text-left align-top leading-tight">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{bill.category_name || bill.category}</div>
                        <div className="text-xs text-gray-500 break-words">{bill.description}</div>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-normal break-words text-left align-top leading-tight">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(bill.amount)}
                        </div>
                        {bill.paid_amount > 0 && (
                          <div className="text-xs text-green-600">
                            Terbayar: {formatCurrency(bill.paid_amount)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-normal break-words text-left align-top leading-tight">
                      <div className="text-sm text-gray-900 break-words">
                        {new Date(bill.due_date).toLocaleDateString('id-ID')}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-center align-top text-xs">
                      <div className="inline-flex shrink-0">{getStatusBadge(bill.status)}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-center align-top text-xs">
                      <div className="inline-flex items-center justify-center gap-1 shrink-0">
                        <button
                          className="p-1 text-[#540002] hover:text-[#6d0003] transition-colors"
                          title="Bayar"
                          onClick={() => onPayClick(bill)}
                        >
                          <CreditCard className="w-4 h-4" />
                        </button>
                        <button
                          className={`p-1 transition-colors ${bill.status === 'unpaid' ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800'}`}
                          title="Lihat Kwitansi Terbaru"
                          onClick={async () => {
                            // Check if bill is unpaid, if so show info message and return
                            if (bill.status === 'unpaid') {
                              showToast({ type: 'info', title: 'Tidak ada pembayaran', message: 'Tagihan belum memiliki pembayaran.' });
                              return;
                            }
                            
                            try {
                              const latest = await dbService.getLatestPaymentForBill(bill.id);
                              if (!latest?.id) {
                                showToast({ type: 'info', title: 'Belum ada pembayaran', message: 'Tagihan ini belum memiliki pembayaran.' });
                                return;
                              }
                              setReceiptId(latest.id);
                            } catch (e: any) {
                              showToast({ type: 'error', title: 'Gagal membuka kwitansi', message: e?.message || 'Tidak dapat memuat pembayaran.' });
                            }
                          }}
                          disabled={bill.status === 'unpaid'}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          className={`p-1 transition-colors ${bill.status === 'paid' ? 'text-gray-400 cursor-not-allowed' : 'text-green-600 hover:text-green-800'}`}
                          title="Edit"
                          onClick={() => {
                            if (bill.status === 'paid') {
                              showToast({ type: 'info', title: 'Tidak bisa diedit', message: 'Tagihan berstatus lunas tidak dapat diedit.' });
                              return;
                            }
                            // Prefill kategori: gunakan legacy free-text jika ada, jika kosong pakai nama master category
                            setEditBill({ ...bill, category: bill.category || bill.category_name || '' });
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          className={`p-1 transition-colors ${deletingId === bill.id ? 'text-red-300 cursor-wait' : 'text-red-600 hover:text-red-800'}`}
                          title="Hapus"
                          disabled={deletingId === bill.id}
                          onClick={async () => {
                            const ok = window.confirm('Hapus tagihan ini? Tindakan tidak dapat dibatalkan.');
                            if (!ok) return;
                            try {
                              setDeletingId(bill.id);
                              await dbService.deleteBill(bill.id);
                              showToast({ type: 'success', title: 'Terhapus', message: 'Tagihan berhasil dihapus.' });
                              await loadData();
                              await fetchBillsGlobalStats(); // Add this line to refresh dashboard statistics
                            } catch (e: any) {
                              showToast({ type: 'error', title: 'Gagal hapus', message: e?.message || 'Tidak dapat menghapus tagihan.' });
                            } finally {
                              setDeletingId(null);
                            }
                          }}
                        >
                          {deletingId === bill.id ? (
                            <div className="w-4 h-4 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
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
        {filteredBills.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {(() => {
                  const start = (page - 1) * pageSize + 1;
                  const end = Math.min(page * pageSize, total);
                  const totalPages = Math.max(1, Math.ceil(total / pageSize));
                  return `Menampilkan ${start}-${end} dari ${total} tagihan (Hal. ${page} / ${totalPages})`;
                })()}
              </p>
              <div className="flex space-x-2">
                <button
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                >
                  Sebelumnya
                </button>
                <button
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(total / pageSize) || loading}
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bill Form Modal */}
      <BillForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSubmit}
        students={students}
      />

      {/* Payment Form Modal */}
      {payBill && (
        <PaymentForm
          isOpen={!!payBill}
          onClose={() => setPayBill(null)}
          onSubmit={handleCreatePayment}
          maxAmount={Math.max(0, (Number(payBill.amount) || 0) - (Number(payBill.paid_amount) || 0))}
          defaultDate={new Date().toISOString().slice(0,10)}
          billData={{
            totalAmount: Number(payBill.amount) || 0,
            paidAmount: Number(payBill.paid_amount) || 0,
            description: payBill.description || payBill.category_name || payBill.category || 'Tagihan'
          }}
        />
      )}

      {/* Receipt Modal */}
      {receiptId && (
        <ReceiptModal
          isOpen={!!receiptId}
          onClose={() => setReceiptId(null)}
          paymentId={receiptId}
        />
      )}

      {/* View Detail Modal */}
      {viewBill && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Detail Tagihan</h3>
              <button onClick={() => setViewBill(null)} className="px-2 py-1 rounded hover:bg-gray-100">Tutup</button>
            </div>
            <div className="p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Mahasiswa</span><span className="font-medium">{viewBill.students?.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">NIM</span><span>{viewBill.students?.nim_kashif}{viewBill.students?.nim_dikti ? ` • ${viewBill.students?.nim_dikti}` : ''}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Program Studi</span><span>{viewBill.students?.prodi}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Kategori</span><span>{viewBill.category}</span></div>
              {/* Show normalized name if available */}
              {viewBill.bill_categories?.name && (
                <div className="flex justify-between"><span className="text-gray-600">Kategori (Master)</span><span>{viewBill.bill_categories?.name}</span></div>
              )}
              <div className="flex justify-between"><span className="text-gray-600">Deskripsi</span><span>{viewBill.description}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Nominal</span><span>{formatCurrency(viewBill.amount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Terbayar</span><span>{formatCurrency(viewBill.paid_amount || 0)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Jatuh Tempo</span><span>{new Date(viewBill.due_date).toLocaleDateString('id-ID')}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Status</span><span>{viewBill.status === 'paid' ? 'Lunas' : viewBill.status === 'partial' ? 'Cicilan' : 'Belum Lunas'}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Bill Modal */}
      {editBill && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit Tagihan</h3>
              <button onClick={() => setEditBill(null)} className="px-2 py-1 rounded hover:bg-gray-100">Batal</button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Kategori</label>
                  <input
                    value={editBill.category || ''}
                    onChange={(e) => setEditBill((prev: any) => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-700 mb-1">Deskripsi</label>
                  <textarea
                    value={editBill.description || ''}
                    onChange={(e) => setEditBill((prev: any) => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Nominal (Rp)</label>
                  <input
                    type="number"
                    value={editBill.amount}
                    onChange={(e) => setEditBill((prev: any) => ({ ...prev, amount: Number(e.target.value || 0) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Jatuh Tempo</label>
                  <input
                    type="date"
                    value={editBill.due_date?.slice(0,10) || ''}
                    onChange={(e) => setEditBill((prev: any) => ({ ...prev, due_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Jumlah Cicilan</label>
                  <input
                    type="number"
                    value={editBill.installment_count || 0}
                    onChange={(e) => setEditBill((prev: any) => ({ ...prev, installment_count: Number(e.target.value || 0) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Nominal per Cicilan (Rp)</label>
                  <input
                    type="number"
                    value={editBill.installment_amount || 0}
                    onChange={(e) => setEditBill((prev: any) => ({ ...prev, installment_amount: Number(e.target.value || 0) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end space-x-2">
              <button
                className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
                onClick={() => setEditBill(null)}
                disabled={savingEdit}
              >Batal</button>
              <button
                className="px-4 py-2 rounded bg-[#540002] text-white hover:bg-[#6d0003] disabled:opacity-60"
                disabled={savingEdit}
                onClick={async () => {
                  try {
                    setSavingEdit(true);
                    const payload: Partial<Bill> = {
                      category: editBill.category,
                      description: editBill.description,
                      amount: Number(editBill.amount) || 0,
                      due_date: editBill.due_date?.slice(0,10),
                      installment_count: Number(editBill.installment_count || 0),
                      installment_amount: Number(editBill.installment_amount || 0),
                    } as any;
                    await dbService.updateBill(editBill.id, payload);
                    showToast({ type: 'success', title: 'Tersimpan', message: 'Perubahan tagihan berhasil disimpan.' });
                    setEditBill(null);
                    await loadData();
                    await fetchBillsGlobalStats(); // Add this line to refresh dashboard statistics
                  } catch (e: any) {
                    showToast({ type: 'error', title: 'Gagal menyimpan', message: e?.message || 'Tidak dapat menyimpan perubahan.' });
                  } finally {
                    setSavingEdit(false);
                  }
                }}
              >{savingEdit ? 'Menyimpan...' : 'Update'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillsManagement;