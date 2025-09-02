import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Eye
} from 'lucide-react';
import StatCard from '../components/Dashboard/StatCard';
import BillCard from '../components/Bills/BillCard';
// import { supabase, dbService, Bill, Payment, Student as DbStudent } from '../lib/supabase'; // Original Supabase
import { supabase, dbService, Bill, Payment, Student as DbStudent } from '../lib/mysql'; // MySQL Testing
import { useToast } from '../components/Toast/ToastProvider';
import ReceiptModal from '../components/Receipts/ReceiptModal';
import { currencyIDR } from '../lib/receipt';

interface StudentDashboardProps {
  onPayBill: (billId: string) => void;
  initialTab?: 'bills' | 'history';
  hideTabs?: boolean;
  summaryOnly?: boolean;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ onPayBill: _onPayBill, initialTab = 'bills', hideTabs = false, summaryOnly = false }) => {
  const [activeTab, setActiveTab] = useState<'bills' | 'history'>(initialTab);
  const [student, setStudent] = useState<DbStudent | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailBill, setDetailBill] = useState<Bill | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const init = async () => {
      try {
        setLoading(true);
        setError(null);

        // For MySQL testing: get current user from localStorage
        const savedUser = localStorage.getItem('campuspay_user');
        if (!savedUser) {
          setError('Anda belum login.');
          setLoading(false);
          return;
        }

        const user = JSON.parse(savedUser);
        if (user.role !== 'student') {
          setError('Akses hanya untuk mahasiswa.');
          setLoading(false);
          return;
        }

        try {
          // Load student profile from API by matching user email
          const students = await dbService.getStudents();
          const currentStudent = students.find(s => s.email === user.email);
          
          if (!currentStudent) {
            setError('Data mahasiswa tidak ditemukan.');
            setLoading(false);
            return;
          }

          // Convert to DbStudent format
          const dbStudent: DbStudent = {
            id: currentStudent.id,
            nim_kashif: currentStudent.nim_kashif,
            nim_dikti: currentStudent.nim_dikti,
            name: currentStudent.name,
            email: currentStudent.email,
            phone: currentStudent.phone,
            prodi: currentStudent.prodi,
            angkatan: currentStudent.angkatan,
            address: currentStudent.address,
            status: currentStudent.status,
            created_at: currentStudent.created_at,
            updated_at: currentStudent.updated_at,
            program_id: currentStudent.program_id
          };
          setStudent(dbStudent);

          // Load real bills and payments data for this student
          const [realBills, allPayments] = await Promise.all([
            dbService.getBills(currentStudent.id),
            dbService.getPaymentsAllFiltered()
          ]);

          // Filter payments for this student
          const studentPayments = allPayments.filter(payment => payment.student_id === currentStudent.id);
          
          setBills(realBills);
          setPayments(studentPayments);
        } catch (apiError: any) {
          console.error('Error loading student data:', apiError);
          setError('Gagal memuat data dari server: ' + (apiError.message || 'Unknown error'));
        }

        /* Original Supabase implementation - commented for MySQL testing
        // Prefer getSession (reads from local storage, no network) to avoid CORS issues
        const { data: sessionData } = await supabase.auth.getSession();
        let userId = sessionData.session?.user?.id;
        if (!userId) {
          const { data: auth } = await supabase.auth.getUser();
          userId = auth.user?.id;
        }
        if (!userId) {
          setError('Anda belum login.');
          setLoading(false);
          return;
        }

        // Ambil row mahasiswa berdasarkan user_id
        const { data: srow, error: sErr } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        if (sErr) throw sErr;
        if (!srow) {
          setError('Data mahasiswa tidak ditemukan.');
          setLoading(false);
          return;
        }
        setStudent(srow as DbStudent);

        // Load data awal (dengan retry ringan)
        const loadData = async (attempt = 1): Promise<void> => {
          try {
            const [b, p] = await Promise.all([
              dbService.getBills(srow.id) as Promise<Bill[]>,
              dbService.getPayments(srow.id) as Promise<Payment[]>,
            ]);
            setBills(b);
            setPayments(p);
          } catch (err) {
            if (attempt < 2) {
              await new Promise(res => setTimeout(res, 400));
              return loadData(attempt + 1);
            }
            throw err;
          }
        };
        await loadData();

        // Realtime subscription
        channel = supabase
          .channel(`student:${srow.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'bills', filter: `student_id=eq.${srow.id}` },
            async () => {
              const fresh = await dbService.getBills(srow.id);
              setBills(fresh as Bill[]);
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'payments', filter: `student_id=eq.${srow.id}` },
            async () => {
              const fresh = await dbService.getPayments(srow.id);
              setPayments(fresh as Payment[]);
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'students', filter: `id=eq.${srow.id}` },
            async () => {
              const { data: updated, error: uErr } = await supabase
                .from('students')
                .select('*')
                .eq('id', srow.id)
                .single();
              if (!uErr) setStudent(updated as DbStudent);
            }
          )
          .subscribe();
        */
      } catch (e: any) {
        console.error('StudentDashboard init error:', e);
        setError(e?.message || 'Gagal memuat data.');
      } finally {
        setLoading(false);
      }
    };

    init();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Sync active tab when parent changes initialTab (e.g., switching menus)
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Hitung statistik dari data nyata
  const { totalBills, totalPaid, totalOutstanding, activeBillsCount } = useMemo(() => {
    const tb = bills.reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0);
    const tp = bills.reduce((sum, bill) => sum + (Number(bill.paid_amount) || 0), 0);
    const to = tb - tp;
    const active = bills.filter((b) => b.status !== 'paid').length;
    
    // Ensure we don't have NaN values
    return { 
      totalBills: isNaN(tb) ? 0 : tb, 
      totalPaid: isNaN(tp) ? 0 : tp, 
      totalOutstanding: isNaN(to) ? 0 : to, 
      activeBillsCount: isNaN(active) ? 0 : active 
    };
  }, [bills]);

  const stats = [
    {
      title: 'Total Tagihan',
      value: currencyIDR(isNaN(totalBills) ? 0 : totalBills),
      subtitle: `${bills.length} tagihan`,
      icon: FileText,
      color: 'blue' as const
    },
    {
      title: 'Sudah Dibayar',
      value: currencyIDR(isNaN(totalPaid) ? 0 : totalPaid),
      subtitle: `${totalBills > 0 ? Math.round((totalPaid / totalBills) * 100) : 0}% terbayar`,
      icon: CheckCircle,
      color: 'green' as const
    },
    {
      title: 'Sisa Tagihan',
      value: currencyIDR(isNaN(totalOutstanding) ? 0 : totalOutstanding),
      subtitle: `${activeBillsCount} tagihan belum lunas`,
      icon: AlertCircle,
      color: 'red' as const
    },
    {
      title: 'Rata-rata/Bulan',
      value: currencyIDR(isNaN(totalOutstanding) || totalOutstanding <= 0 ? 0 : Math.round(totalOutstanding / 6)),
      subtitle: 'Estimasi cicilan',
      icon: TrendingUp,
      color: 'purple' as const
    }
  ];

  // Helper: resolve display category name
  const displayCategory = (b: any) => (b?.category || b?.bill_categories?.name || '-');

  // Format due date safely
  const formatDueDate = (dateString: string) => {
    if (!dateString) return 'Tanggal tidak valid';
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? 'Tanggal tidak valid' : date.toLocaleDateString('id-ID');
    } catch (e) {
      return 'Tanggal tidak valid';
    }
  };

  const handlePay = (_billId: string) => {
    // Mahasiswa tidak bisa melakukan pembayaran langsung
    showToast({ type: 'info', title: 'Informasi', message: 'Pembayaran dilakukan oleh admin. Silakan hubungi administrasi.' });
  };

  const handleViewDetails = (billId: string) => {
    const b = bills.find((x) => x.id === billId) || null;
    if (!b) {
      showToast({ type: 'warning', message: 'Tagihan tidak ditemukan.' });
      return;
    }
    setDetailBill(b);
  };

  const handleDownloadReceipt = async (id: string) => {
    try {
      // Terima either paymentId atau billId
      // 1) Coba sebagai paymentId
      let target = payments.find((p) => p.id === id && p.status === 'completed');
      
      // 2) Jika tidak ketemu, anggap billId dan ambil pembayaran terakhir yang completed
      if (!target) {
        const related = payments
          .filter((p) => p.bill_id === id && p.status === 'completed')
          .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
        target = related[0];
      }
      
      // 3) Jika masih tidak ada, coba cari dari API
      if (!target && student) {
        try {
          const allPayments = await dbService.getPaymentsAllFiltered();
          const studentPayments = allPayments.filter(p => p.student_id === student.id && p.status === 'completed');
          
          // Update payments state dengan data terbaru
          setPayments(studentPayments);
          
          // Coba lagi dengan data terbaru
          target = studentPayments.find((p) => p.id === id) || 
                   studentPayments.filter((p) => p.bill_id === id).sort((a, b) => 
                     new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())[0];
        } catch (apiError) {
          console.error('Error fetching payments:', apiError);
        }
      }
      
      if (!target) {
        showToast({ type: 'info', message: 'Belum ada bukti pembayaran untuk tagihan ini.' });
        return;
      }
      
      // Open receipt modal
      setReceiptId(target.id);
    } catch (error) {
      console.error('Error in handleDownloadReceipt:', error);
      showToast({ type: 'error', message: 'Gagal membuka kwitansi.' });
    }
  };

  if (loading) {
    return <div className="p-6">Memuat data...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  if (!student) {
    return <div className="p-6">Data mahasiswa tidak ditemukan.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Receipt Modal */}
      {receiptId && (
        <ReceiptModal
          isOpen={!!receiptId}
          onClose={() => setReceiptId(null)}
          paymentId={receiptId}
        />
      )}
      {/* Student Info Card */}
      <div className="bg-gradient-to-r from-[#540002] to-[#7d0003] text-white p-6 rounded-lg shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">{student.name}</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-red-100">NIM</p>
                <p className="font-medium">{student.nim_kashif}</p>
              </div>
              <div>
                <p className="text-red-100">NIM DIKTI</p>
                <p className="font-medium">
                  {student.nim_dikti || (
                    <span className="text-red-200 italic">Belum diisi</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-red-100">Program Studi</p>
                <p className="font-medium">{student.prodi}</p>
              </div>
              <div>
                <p className="text-red-100">Status</p>
                <span className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-green-500 text-white">
                  {student.status}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold">{student.name.split(' ').map(n => n[0]).join('')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      {/* Tabs (hidden in summaryOnly mode) */}
      {!hideTabs && !summaryOnly && (
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'bills', label: 'Tagihan Aktif', count: activeBillsCount },
              { id: 'history', label: 'Riwayat Pembayaran', count: payments.length }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'bills' | 'history')}
                className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === (tab.id as 'bills' | 'history')
                    ? 'border-[#540002] text-[#540002]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Summary-only content for Dashboard */}
      {summaryOnly && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Ringkasan Tagihan</h3>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden">
              {bills.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">Tidak ada tagihan</div>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-1">
                  {bills
                    .slice() // Create a copy to avoid mutating the original array
                    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()) // Sort by updated_at descending
                    .map((b) => (
                    <li key={b.id} className="p-4 border border-gray-100 rounded-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-gray-500">Jenis</p>
                          <p className="text-base font-semibold text-gray-900">{displayCategory(b)}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-md text-xs font-medium border ${
                          b.status === 'paid' ? 'bg-green-100 text-green-800 border-green-200' : b.status === 'partial' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-red-100 text-red-800 border-red-200'
                        }`}>
                          {b.status === 'paid' ? 'Lunas' : b.status === 'partial' ? 'Cicilan' : 'Belum Lunas'}
                        </span>
                      </div>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-600">Jumlah</span><span className="font-medium">{currencyIDR(b.amount)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Terbayar</span><span className="font-medium text-green-700">{currencyIDR(b.paid_amount || 0)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Sisa</span><span className="font-medium text-[#540002]">{currencyIDR(Math.max(0, b.amount - (b.paid_amount || 0)))}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Jatuh Tempo</span><span className="font-medium">{formatDueDate(b.due_date)}</span></div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Desktop Table */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Jenis Tagihan</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Terbayar</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Sisa</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Jatuh Tempo</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bills
                    .slice() // Create a copy to avoid mutating the original array
                    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()) // Sort by updated_at descending
                    .map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm text-gray-900 text-center">{displayCategory(b)}</td>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900 text-center">{currencyIDR(b.amount)}</td>
                      <td className="px-6 py-3 text-sm text-green-700 text-center">{currencyIDR(b.paid_amount || 0)}</td>
                      <td className="px-6 py-3 text-sm text-[#540002] text-center">{currencyIDR(Math.max(0, b.amount - (b.paid_amount || 0)))}</td>
                      <td className="px-6 py-3 text-sm text-gray-700 text-center">{formatDueDate(b.due_date)}</td>
                      <td className="px-6 py-3 text-sm text-center">
                        <span className={`px-2 py-1 rounded-md text-xs font-medium border ${
                          b.status === 'paid' ? 'bg-green-100 text-green-800 border-green-200' : b.status === 'partial' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-red-100 text-red-800 border-red-200'
                        }`}>
                          {b.status === 'paid' ? 'Lunas' : b.status === 'partial' ? 'Cicilan' : 'Belum Lunas'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {!summaryOnly && activeTab === 'bills' && (
        <div className="space-y-6">
          {/* Header Tagihan Aktif (tanpa menu cetak/ekspor) */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Tagihan Aktif</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Anda memiliki {activeBillsCount} tagihan yang belum lunas
                </p>
              </div>
            </div>
          </div>

          {/* Bills Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {bills
              .filter(bill => bill.status !== 'paid')
              .slice() // Create a copy to avoid mutating the original array
              .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()) // Sort by updated_at descending
              .map((bill) => (
              <BillCard
                key={bill.id}
                bill={{
                  id: bill.id,
                  description: bill.description,
                  amount: bill.amount,
                  paid_amount: bill.paid_amount,
                  due_date: bill.due_date,
                  status: bill.status,
                  installment_count: bill.installment_count,
                  category: bill.category,
                  category_name: bill.category_name,
                }}
                onPay={handlePay}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>

          {/* Completed Bills */}
          {bills.filter(bill => bill.status === 'paid').length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tagihan Lunas</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {bills
                  .filter(bill => bill.status === 'paid')
                  .slice() // Create a copy to avoid mutating the original array
                  .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()) // Sort by updated_at descending
                  .map((bill) => (
                  <BillCard
                    key={bill.id}
                    bill={{
                      id: bill.id,
                      description: bill.description,
                      amount: bill.amount,
                      paid_amount: bill.paid_amount,
                      due_date: bill.due_date,
                      status: bill.status,
                      installment_count: bill.installment_count,
                      category: bill.category,
                      category_name: bill.category_name,
                    }}
                    onPay={handlePay}
                    onViewDetails={handleViewDetails}
                    onDownloadReceipt={handleDownloadReceipt}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!summaryOnly && activeTab === 'history' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-lg font-semibold text-gray-900">Riwayat Pembayaran</h3>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden">
            {payments.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-500">Belum ada pembayaran</div>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
                {payments
                  .slice() // Create a copy to avoid mutating the original array
                  .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()) // Sort by payment date descending
                  .map((payment) => (
                  <li key={payment.id} className="p-4 border border-gray-100 rounded-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-gray-500">Tagihan</p>
                        <p className="text-base font-semibold text-gray-900">{payment.bill_id}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{payment.receipt_number}</p>
                      </div>
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-800 border border-green-200">Berhasil</span>
                    </div>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-600">Nominal</span><span className="font-medium">{currencyIDR(payment.amount)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Metode</span><span className="font-medium">{payment.payment_method}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Tanggal</span><span className="font-medium">{new Date(payment.payment_date).toLocaleDateString('id-ID')}</span></div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button 
                        onClick={() => setReceiptId(payment.id)}
                        className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 transition-colors"
                        title="Lihat Detail"
                      >
                        <Eye className="w-4 h-4" />
                        <span className="text-sm">Lihat</span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Desktop Table */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Jenis Tagihan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nominal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tanggal Bayar
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Metode
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
                {payments
                  .slice() // Create a copy to avoid mutating the original array
                  .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()) // Sort by payment date descending
                  .map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {payment.bill_id}
                      </div>
                      <div className="text-sm text-gray-500">{payment.receipt_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {currencyIDR(payment.amount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(payment.payment_date).toLocaleDateString('id-ID')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{payment.payment_method}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-800 border border-green-200">
                        Berhasil
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button 
                        onClick={() => setReceiptId(payment.id)}
                        className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 transition-colors"
                        title="Lihat Detail"
                      >
                        <Eye className="w-4 h-4" />
                        <span className="text-sm">Lihat</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Bill Modal */}
      {detailBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h4 className="text-lg font-semibold">Detail Tagihan</h4>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setDetailBill(null)}>×</button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Jenis</span><span className="font-medium">{displayCategory(detailBill)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Deskripsi</span><span className="font-medium text-right max-w-[60%]">{detailBill.description}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Jumlah</span><span className="font-medium">{currencyIDR(detailBill.amount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Sudah Dibayar</span><span className="font-medium text-green-700">{currencyIDR(detailBill.paid_amount || 0)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Sisa</span><span className="font-medium text-[#540002]">{currencyIDR(Math.max(0, detailBill.amount - (detailBill.paid_amount || 0)))}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Jatuh Tempo</span><span className="font-medium">{formatDueDate(detailBill.due_date)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Status</span><span className="font-medium">{detailBill.status}</span></div>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
              {detailBill.status === 'paid' ? (
                <button
                  onClick={() => { const id = detailBill?.id; setDetailBill(null); if (id) handleDownloadReceipt(id); }}
                  className="px-4 py-2 border border-[#540002] text-[#540002] rounded hover:bg-[#540002] hover:text-white"
                >
                  Unduh Bukti
                </button>
              ) : (
                <button
                  onClick={() => { setDetailBill(null); showToast({ type: 'info', message: 'Pembayaran dilakukan oleh admin.' }); }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded cursor-not-allowed"
                >
                  Bayar (Nonaktif)
                </button>
              )}
              <button onClick={() => setDetailBill(null)} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;