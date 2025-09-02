import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Download, 
  Search, 
  Eye,
  Calendar,
  CheckCircle
} from 'lucide-react';
import { dbService, supabase, Payment } from '../../lib/mysql';
import ReceiptModal from '../../components/Receipts/ReceiptModal';

const ReceiptsPage: React.FC = () => {
  const [receipts, setReceipts] = useState<Payment[]>([]);
  const [filteredReceipts, setFilteredReceipts] = useState<Payment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const init = async () => {
      try {
        setLoading(true);
        
        // For MySQL testing: get current user from localStorage
        const savedUser = localStorage.getItem('campuspay_user');
        if (!savedUser) {
          console.warn('No user found in localStorage for ReceiptsPage');
          setReceipts([]);
          setLoading(false);
          return;
        }

        const user = JSON.parse(savedUser);
        if (user.role !== 'student') {
          console.warn('User is not a student, cannot access receipts');
          setReceipts([]);
          setLoading(false);
          return;
        }

        // Find the student by email instead of using user ID
        const students = await dbService.getStudents();
        const currentStudent = students.find(s => s.email === user.email);
        
        if (!currentStudent) {
          console.warn('Student data not found for user');
          setReceipts([]);
          setLoading(false);
          return;
        }
        
        // Load receipts (payments) for this student
        await loadReceipts(currentStudent.id);

        /* Original Supabase implementation - commented for MySQL testing
        // Auth: prefer local session (no network), fallback to getUser
        const { data: sessionData } = await supabase.auth.getSession();
        let uid = sessionData.session?.user?.id;
        if (!uid) {
          const { data: auth } = await supabase.auth.getUser();
          uid = auth.user?.id;
        }
        if (!uid) {
          setReceipts([]);
          setLoading(false);
          return;
        }

        // Get student row
        const { data: srow, error: sErr } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', uid)
          .maybeSingle();
        if (sErr || !srow?.id) {
          setReceipts([]);
          setLoading(false);
          return;
        }
        // Load receipts (payments)
        await loadReceipts(srow.id);

        // Realtime subscription for payments of this student
        channel = supabase
          .channel(`receipts:${srow.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'payments', filter: `student_id=eq.${srow.id}` },
            async () => {
              await loadReceipts(srow.id);
            }
          )
          .subscribe();
        */
      } catch (error) {
        console.error('Error loading receipts:', error);
        setReceipts([]);
      } finally {
        setLoading(false);
      }
    };

    init();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    filterReceipts();
  }, [receipts, searchTerm, dateFilter]);

  const loadReceipts = async (sid: string) => {
    const data = (await dbService.getPayments(sid)) as any[];
    // Ensure each item has expected fields
    setReceipts(data as Payment[]);
  };

  const filterReceipts = () => {
    let filtered = receipts;

    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.receipt_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ((r as any).bills?.category || (r as any).bills?.bill_categories?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.payment_method.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          filtered = filtered.filter(r => new Date(r.payment_date) >= filterDate);
          break;
        case 'quarter':
          filterDate.setMonth(now.getMonth() - 3);
          filtered = filtered.filter(r => new Date(r.payment_date) >= filterDate);
          break;
        case 'year':
          filterDate.setFullYear(now.getFullYear() - 1);
          filtered = filtered.filter(r => new Date(r.payment_date) >= filterDate);
          break;
      }
    }

    setFilteredReceipts(filtered);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
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

  const handleView = (paymentId: string) => {
    setReceiptId(paymentId);
  };

  const totalAmount = filteredReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {receiptId && (
        <ReceiptModal
          isOpen={!!receiptId}
          onClose={() => setReceiptId(null)}
          paymentId={receiptId}
        />
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bukti Pembayaran</h1>
          <p className="text-gray-600 mt-1">Kelola dan unduh bukti pembayaran Anda</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button disabled className="flex items-center space-x-2 px-4 py-2 bg-gray-300 text-white rounded-lg cursor-not-allowed">
            <Download className="w-4 h-4" />
            <span>Download Semua</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Receipt</p>
              <p className="text-2xl font-bold text-gray-900">{filteredReceipts.length}</p>
            </div>
            <Receipt className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Pembayaran</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(totalAmount)}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Bulan Ini</p>
              <p className="text-lg font-bold text-purple-600">
                {filteredReceipts.filter(r => {
                  const receiptDate = new Date(r.payment_date);
                  const now = new Date();
                  return receiptDate.getMonth() === now.getMonth() && receiptDate.getFullYear() === now.getFullYear();
                }).length}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-purple-500" />
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
                placeholder="Cari receipt (nomor, jenis tagihan, metode)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
              />
            </div>
          </div>
          <div className="w-full sm:w-auto">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
            >
              <option value="all">Semua Waktu</option>
              <option value="month">30 Hari Terakhir</option>
              <option value="quarter">3 Bulan Terakhir</option>
              <option value="year">1 Tahun Terakhir</option>
            </select>
          </div>
        </div>
      </div>

    {/* Receipts List - Mobile Cards */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 md:hidden">
      {loading ? (
        <div className="px-4 py-12 text-center text-gray-500">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-4 h-4 border-2 border-[#540002]/30 border-t-[#540002] rounded-full animate-spin"></div>
            <span>Memuat data...</span>
          </div>
        </div>
      ) : filteredReceipts.length === 0 ? (
        <div className="px-4 py-12 text-center text-gray-500">
          <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p>Tidak ada bukti pembayaran yang ditemukan</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
          {filteredReceipts.map((receipt) => (
            <li key={receipt.id} className="p-4 border border-gray-100 rounded-lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-500">No. Receipt</p>
                  <p className="text-base font-semibold text-gray-900">{receipt.receipt_number}</p>
                </div>
                <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium border bg-green-100 text-green-800 border-green-200">
                  <CheckCircle className="w-3 h-3" />
                  <span>Berhasil</span>
                </span>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Jenis</span><span className="font-medium">{(receipt as any).bills?.bill_categories?.name || (receipt as any).bills?.category || receipt.bill_id}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Nominal</span><span className="font-medium">{formatCurrency(receipt.amount)}</span></div>
                <div className="flex justify-between items-center"><span className="text-gray-600">Metode</span><span>{getMethodBadge(receipt.payment_method)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Tanggal</span><span className="font-medium">{new Date(receipt.payment_date).toLocaleDateString('id-ID')} {new Date(receipt.payment_date).toLocaleTimeString('id-ID')}</span></div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => handleView(receipt.id)}
                  className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 transition-colors"
                  title="Lihat"
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

    {/* Receipts Table - Desktop */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hidden md:block">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No. Receipt</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jenis Tagihan</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nominal</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metode</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-[#540002]/30 border-t-[#540002] rounded-full animate-spin"></div>
                    <span>Memuat data...</span>
                  </div>
                </td>
              </tr>
            ) : filteredReceipts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p>Tidak ada bukti pembayaran yang ditemukan</p>
                </td>
              </tr>
            ) : (
              filteredReceipts.map((receipt) => (
                <tr key={receipt.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{receipt.receipt_number}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{(receipt as any).bills?.bill_categories?.name || (receipt as any).bills?.category || receipt.bill_id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{formatCurrency(receipt.amount)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getMethodBadge(receipt.payment_method)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{new Date(receipt.payment_date).toLocaleDateString('id-ID')}</div>
                    <div className="text-sm text-gray-500">{new Date(receipt.payment_date).toLocaleTimeString('id-ID')}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium border bg-green-100 text-green-800 border-green-200">
                      <CheckCircle className="w-3 h-3" />
                      <span>Berhasil</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <button onClick={() => handleView(receipt.id)} className="p-1 text-blue-600 hover:text-blue-800 transition-colors" title="Lihat">
                        <Eye className="w-4 h-4" />
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
      {filteredReceipts.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Menampilkan {filteredReceipts.length} dari {receipts.length} receipt</p>
            <div className="flex space-x-2">
              <button className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors">Sebelumnya</button>
              <button className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors">Selanjutnya</button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);
};

export default ReceiptsPage;