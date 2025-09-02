import React, { useState, useEffect } from 'react';
import { 
  Users, 
  CreditCard, 
  FileText, 
  TrendingUp,
  Plus,
  Search,
  Filter,
  Download
} from 'lucide-react';
import StatCard from '../components/Dashboard/StatCard';
import StudentForm from '../components/Forms/StudentForm';
import BillForm from '../components/Forms/BillForm';
import { dbService, supabase } from '../lib/mysql';
import { useToast } from '../components/Toast/ToastProvider';
import { currencyIDR } from '../lib/receipt';

const AdminDashboard: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [isStudentFormOpen, setIsStudentFormOpen] = useState(false);
  const [isBillFormOpen, setIsBillFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Array<{ nim_kashif: string; nim_dikti?: string | null; name: string; prodi: string }>>([]);
  const [recentPayments, setRecentPayments] = useState<Array<{ id: string | number; studentName: string; nim_kashif: string; nim_dikti?: string | null; billType: string; amount: number; status: string; paymentDate: string }>>([]);
  const [statsData, setStatsData] = useState<{ totalStudents: number; totalBills: number; totalPaid: number; todayPaymentsAmount: number; todayPaymentsCount: number; collectibilityRate: number } | null>(null);
  const [chartRangeDays, setChartRangeDays] = useState<number>(30);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

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
          const [statsRes, paymentsRes, studentsRes] = await Promise.all([
            dbService.getStatistics(),
            dbService.getPayments(),
            dbService.getStudents(),
          ]);

          if (!mounted) return;

          // Ensure responses are arrays
          const safePaymentsRes = Array.isArray(paymentsRes) ? paymentsRes : [];
          const safeStudentsRes = Array.isArray(studentsRes) ? studentsRes : [];

          // Payments mapping for table (limit 10) and chart (use all data)
          const mappedPayments = safePaymentsRes.map((p: any, idx: number) => ({
            id: p.id ?? idx,
            studentName: p.students?.name ?? p.student_name ?? '-',
            nim_kashif: p.students?.nim_kashif ?? p.student_nim ?? '-',
            nim_dikti: p.students?.nim_dikti ?? p.student_nim_dikti ?? null,
            billType: p.bills?.description || p.bills?.category || p.bill_description || p.bill_category || '-',
            amount: isNaN(p.amount) || !isFinite(p.amount) ? 0 : parseFloat(p.amount) || 0,
            status: p.status ?? p.payment_status ?? 'paid',
            paymentDate: p.payment_date ?? p.created_at ?? new Date().toISOString(),
          })).sort((a, b) => {
            // Sort by payment date descending (most recent first)
            const dateA = new Date(a.paymentDate).getTime();
            const dateB = new Date(b.paymentDate).getTime();
            return dateB - dateA;
          });

          // For the table, we still only show the first 10 payments
          const tablePayments = mappedPayments.slice(0, 10);

          // Students mapping for BillForm
          const mappedStudents = safeStudentsRes.map((s: any) => ({
            nim_kashif: s.nim_kashif,
            nim_dikti: s.nim_dikti ?? null,
            name: s.name,
            prodi: s.prodi,
          }));

          setRecentPayments(tablePayments);
          setStudents(mappedStudents);
          // Ensure statsData values are valid numbers
          if (statsRes) {
            const validStats = {
              totalStudents: isNaN(statsRes.totalStudents) || !isFinite(statsRes.totalStudents) ? 0 : Math.floor(statsRes.totalStudents),
              totalBills: isNaN(statsRes.totalBills) || !isFinite(statsRes.totalBills) ? 0 : Math.floor(statsRes.totalBills),
              totalPaid: isNaN(statsRes.totalPaid) || !isFinite(statsRes.totalPaid) ? 0 : Math.floor(statsRes.totalPaid),
              todayPaymentsAmount: isNaN(statsRes.todayPaymentsAmount) || !isFinite(statsRes.todayPaymentsAmount) ? 0 : Math.floor(statsRes.todayPaymentsAmount),
              todayPaymentsCount: isNaN(statsRes.todayPaymentsCount) || !isFinite(statsRes.todayPaymentsCount) ? 0 : Math.floor(statsRes.todayPaymentsCount),
              collectibilityRate: isNaN(statsRes.collectibilityRate) || !isFinite(statsRes.collectibilityRate) ? 0 : statsRes.collectibilityRate,
            };
            setStatsData(validStats);
          } else {
            setStatsData(null);
          }
          break; // success
        } catch (e: any) {
          console.error('Failed to load dashboard data (attempt %d)', attempt + 1, e);
          if (attempt < maxRetries) {
            const backoff = baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
            await new Promise((r) => setTimeout(r, backoff));
            attempt++;
            continue;
          }
          if (!mounted) return;
          showToast({ type: 'error', title: 'Gagal memuat', message: 'Tidak dapat memuat data dashboard.' });
        } finally {
          if (attempt >= maxRetries) {
            setLoading(false);
          }
        }
      }
      // ensure loading ends on success
      setLoading(false);
    };
    loadWithRetry();

    // Realtime: subscribe to changes and reload dashboard data (debounced)
    const scheduleReload = () => {
      if (!mounted) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadWithRetry();
      }, 400);
    };

    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => scheduleReload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, () => scheduleReload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => scheduleReload())
      .subscribe();
    return () => {
      mounted = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      try { supabase.removeChannel(channel); } catch {}
    };
  }, []);

  const formatCurrency = (amount: number) => {
    // Ensure amount is a valid number and is an integer
    const validAmount = isNaN(amount) || !isFinite(amount) ? 0 : Math.floor(amount);
    return currencyIDR(validAmount);
  };

  const formatShortCurrency = (amount: number) => {
    // Ensure amount is a valid number and is an integer
    const validAmount = isNaN(amount) || !isFinite(amount) ? 0 : Math.floor(amount);
    const abs = Math.abs(validAmount);
    if (abs >= 1_000_000_000) return `Rp ${(validAmount / 1_000_000_000).toFixed(1)} M`;
    if (abs >= 1_000_000) return `Rp ${(validAmount / 1_000_000).toFixed(1)} jt`;
    if (abs >= 1_000) return `Rp ${(validAmount / 1_000).toFixed(1)} rb`;
    return formatCurrency(validAmount);
  };

  // Format currency for chart labels with better precision
  const formatChartCurrency = (amount: number) => {
    // Ensure amount is a valid number and is an integer
    const validAmount = isNaN(amount) || !isFinite(amount) ? 0 : Math.floor(amount);
    const abs = Math.abs(validAmount);
    if (abs >= 1_000_000_000) return `${(validAmount / 1_000_000_000).toFixed(1)}M`;
    if (abs >= 1_000_000) return `${(validAmount / 1_000_000).toFixed(1)}jt`;
    if (abs >= 1_000) return `${(validAmount / 1_000).toFixed(1)}rb`;
    return `Rp${validAmount}`;
  };

  // Build time-series data for the mini chart (sum per day)
  const buildPaymentSeries = (days: number) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999); // Set to end of day
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0); // Set to start of day

    // helper to yyy-mm-dd with proper timezone handling
    const keyOf = (d: Date) => {
      const date = new Date(d);
      date.setHours(0, 0, 0, 0); // Normalize to start of day
      return date.toISOString().split('T')[0];
    };

    // init all days with 0 to make continuous axis
    const dayKeys: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      dayKeys.push(keyOf(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    const sums = new Map<string, number>(dayKeys.map(k => [k, 0] as [string, number]));

    // Use recentPayments for chart data - this should include all payments fetched
    (recentPayments || []).forEach((p) => {
      const d = new Date(p.paymentDate);
      // Validate that d is a valid date and normalize it
      if (d instanceof Date && !isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0); // Normalize to start of day
        const k = keyOf(d);
        // Check if the date is within our range
        if (d >= start && d <= end) {
          // Ensure p.amount is a valid number
          const amount = isNaN(p.amount) || !isFinite(p.amount) ? 0 : p.amount;
          // Add to the daily sum
          const currentSum = sums.get(k) || 0;
          sums.set(k, currentSum + amount);
        }
      }
    });

    return dayKeys.map(k => ({ date: k, value: sums.get(k) || 0 }));
  };

  const handleStudentSubmit = async (studentData: any) => {
    try {
      // Insert student to DB
      const created = await dbService.createStudent(studentData);
      showToast({ type: 'success', title: 'Mahasiswa dibuat', message: 'Data mahasiswa berhasil disimpan.' });
      // Invoke Edge Function to create auth user in direct mode (default password)
      try {
        const { error: fnErr } = await supabase.functions.invoke('create-student-user', {
          body: {
            studentId: created.id,
            email: created.email,
            name: created.name,
            mode: 'direct'
          }
        });
        if (fnErr) {
          console.error('Error invoking create-student-user:', fnErr);
          showToast({ type: 'warning', title: 'Akun auth gagal dibuat', message: 'Coba jalankan ulang dari menu aksi.' });
        }
      } catch (err) {
        console.error('Failed to call create-student-user function:', err);
        const msg = (err as any)?.message || (err as any)?.error || JSON.stringify(err);
        showToast({ type: 'warning', title: 'Gagal membuat akun auth', message: String(msg) });
      }
      // Close modal on success
      setIsStudentFormOpen(false);
    } catch (e) {
      console.error('Gagal menyimpan mahasiswa:', e);
      const se: any = e;
      const msg = se?.message || se?.error_description || se?.hint || se?.details || JSON.stringify(se);
      const isConflict = /duplicate|unique/i.test(String(msg));
      showToast({ type: 'error', title: isConflict ? 'Data duplikat' : 'Gagal menyimpan', message: isConflict ? 'Email atau NIM sudah terdaftar.' : String(msg) });
    }
  };

  const handleBillSubmit = (billData: any) => {
    console.log('Bill data:', billData);
    // Handle bill creation logic here
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Admin</h1>
          <p className="text-gray-600 mt-1">Kelola pembayaran dan tagihan mahasiswa</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsStudentFormOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-[#540002] text-white rounded-lg hover:bg-[#6d0003] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Mahasiswa</span>
          </button>
          <button
            onClick={() => setIsBillFormOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 border border-[#540002] text-[#540002] rounded-lg hover:bg-[#540002] hover:text-white transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>Buat Tagihan</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {(() => {
          const numberFmt = (n: number) => {
            // Ensure n is a valid number
            const validN = isNaN(n) || !isFinite(n) ? 0 : n;
            return new Intl.NumberFormat('id-ID').format(validN);
          };
          const currencyFmt = (n: number) => {
            // Ensure n is a valid number
            const validN = isNaN(n) || !isFinite(n) ? 0 : n;
            return currencyIDR(validN);
          };
          const s = statsData;
          const cards = [
            {
              title: 'Total Mahasiswa',
              value: s ? numberFmt(s.totalStudents) : (loading ? '...' : '0'),
              subtitle: 'Mahasiswa aktif',
              icon: Users,
              color: 'blue' as const,
              trend: undefined,
            },
            {
              title: 'Total Tagihan',
              value: s ? currencyFmt(s.totalBills) : (loading ? '...' : 'Rp 0'),
              subtitle: 'Tagihan aktif',
              icon: FileText,
              color: 'yellow' as const,
              trend: undefined,
            },
            {
              title: 'Pembayaran Hari Ini',
              value: s ? currencyFmt(s.todayPaymentsAmount) : (loading ? '...' : 'Rp 0'),
              subtitle: s ? `${numberFmt(s.todayPaymentsCount)} transaksi` : (loading ? '...' : '0 transaksi'),
              icon: CreditCard,
              color: 'green' as const,
              trend: undefined,
            },
            {
              title: 'Tingkat Kolektibilitas',
              value: s ? `${(isNaN(s.collectibilityRate) || !isFinite(s.collectibilityRate) ? 0 : s.collectibilityRate).toFixed(1)}%` : (loading ? '...' : '0%'),
              subtitle: 'Target 90%',
              icon: TrendingUp,
              color: 'purple' as const,
              trend: undefined,
            },
          ];
          return cards.map((c, i) => <StatCard key={i} {...c} />);
        })()}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Ringkasan' },
            { id: 'recent', label: 'Pembayaran Terbaru' },
            { id: 'outstanding', label: 'Tagihan Tertunggak' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-[#540002] text-[#540002]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Mini SVG Line Chart (lightweight, no dependency) */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Trend Pembayaran</h3>
              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center bg-gray-50 rounded overflow-hidden text-xs">
                  {[7,14,30,90,180].map(d => (
                    <button
                      key={d}
                      onClick={() => setChartRangeDays(d)}
                      className={`px-2 py-1 border ${chartRangeDays===d? 'bg-white text-[#540002] border-[#540002]' : 'border-gray-200 text-gray-600 hover:text-gray-800'}`}
                    >{d}h</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setChartType('line')}
                    className={`px-3 py-1 text-xs rounded border ${chartType==='line'?'bg-[#540002] text-white border-[#540002]':'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                    title="Line"
                  >Line</button>
                  <button
                    onClick={() => setChartType('bar')}
                    className={`px-3 py-1 text-xs rounded border ${chartType==='bar'?'bg-[#540002] text-white border-[#540002]':'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                    title="Bar"
                  >Bar</button>
                </div>
                <select
                  className="text-sm border border-gray-300 rounded-md px-3 py-1"
                  value={chartRangeDays}
                  onChange={(e) => setChartRangeDays(Number(e.target.value))}
                >
                  <option value={30}>30 hari terakhir</option>
                  <option value={90}>90 hari terakhir</option>
                  <option value={180}>6 bulan terakhir</option>
                </select>
              </div>
            </div>
            {(() => {
              const series = buildPaymentSeries(chartRangeDays);
              const w = 960; // wider logical width
              const h = 380; // taller logical height
              const pad = 48; // more padding for labels
              const xs = series.map((_, i) => i);
              const ys = series.map(p => p.value);
              const xMin = 0;
              const xMax = Math.max(1, xs[xs.length - 1] ?? 1);
              // Ensure yMax is at least 1 to avoid division by zero
              const yMax = Math.max(1, ...ys.map(v => isNaN(v) || !isFinite(v) ? 0 : v));
              const xScale = (i: number) => {
                // Ensure i and other values are valid numbers
                const validI = isNaN(i) || !isFinite(i) ? 0 : i;
                const validXMin = isNaN(xMin) || !isFinite(xMin) ? 0 : xMin;
                const validXMax = isNaN(xMax) || !isFinite(xMax) ? 1 : xMax;
                const validW = isNaN(w) || !isFinite(w) ? 960 : w;
                const validPad = isNaN(pad) || !isFinite(pad) ? 48 : pad;
                
                if (validXMax === validXMin) return validPad; // Avoid division by zero
                
                return validPad + (validI - validXMin) / (validXMax - validXMin) * (validW - 2 * validPad);
              };
              const yScale = (v: number) => {
                // Ensure v is a valid number to prevent NaN in SVG attributes
                const value = isNaN(v) || !isFinite(v) ? 0 : v;
                const validYMax = isNaN(yMax) || !isFinite(yMax) ? 1 : yMax;
                const validH = isNaN(h) || !isFinite(h) ? 380 : h;
                const validPad = isNaN(pad) || !isFinite(pad) ? 48 : pad;
                
                if (validYMax === 0) return validH - validPad; // Avoid division by zero
                
                return validH - validPad - (value / validYMax) * (validH - 2 * validPad);
              };

              if (!series.length) {
                return (
                  <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                    <p className="text-gray-500">Belum ada data</p>
                  </div>
                );
              }

              // Build path for line and area
              const linePath = series.map((p, i) => {
                const validX = xScale(i);
                const validY = yScale(p.value);
                return `${i === 0 ? 'M' : 'L'} ${isNaN(validX) || !isFinite(validX) ? 0 : validX.toFixed(2)} ${isNaN(validY) || !isFinite(validY) ? 0 : validY.toFixed(2)}`;
              }).join(' ');
              const areaPath = `${linePath} L ${xScale(series.length - 1).toFixed(2)} ${yScale(0).toFixed(2)} L ${xScale(0).toFixed(2)} ${yScale(0).toFixed(2)} Z`;

              // Y ticks (more ticks for readability)
              const yTicks = Array.from({ length: 6 }, (_, i) => {
                const value = Math.round((yMax / 5) * i);
                return isNaN(value) || !isFinite(value) ? 0 : value;
              });

              // Quick stats for the selected range
              const total = ys.reduce((a, b) => {
                const valA = isNaN(a) || !isFinite(a) ? 0 : a;
                const valB = isNaN(b) || !isFinite(b) ? 0 : b;
                return valA + valB;
              }, 0);
              const avg = total / (series.length || 1);
              const maxFromYS = Math.max(...ys.filter(v => !isNaN(v) && isFinite(v)));
              const validMax = isNaN(maxFromYS) || !isFinite(maxFromYS) ? 0 : maxFromYS;

              // SMA-7 (moving average)
              const smaWindow = 7;
              const sma: number[] = ys.map((_, i) => {
                const from = Math.max(0, i - (smaWindow - 1));
                const slice = ys.slice(from, i + 1);
                const s = slice.reduce((a, b) => {
                  const valA = isNaN(a) || !isFinite(a) ? 0 : a;
                  const valB = isNaN(b) || !isFinite(b) ? 0 : b;
                  return valA + valB;
                }, 0);
                const result = s / slice.length;
                return isNaN(result) || !isFinite(result) ? 0 : result;
              });
              const smaPath = sma.map((v, i) => {
                const validX = xScale(i);
                const validY = yScale(v);
                return `${i === 0 ? 'M' : 'L'} ${isNaN(validX) || !isFinite(validX) ? 0 : validX.toFixed(2)} ${isNaN(validY) || !isFinite(validY) ? 0 : validY.toFixed(2)}`;
              }).join(' ');

              // find min/max index
              const validYs = ys.map(v => isNaN(v) || !isFinite(v) ? 0 : v);
              const max = Math.max(...validYs);
              const maxIdx = validYs.indexOf(max);
              const min = Math.min(...validYs.filter(v => v > 0)); // Filter out zeros for min
              const minIdx = validYs.indexOf(min);
              
              // Ensure minIdx is valid
              const validMinIdx = minIdx >= 0 ? minIdx : 0;

              return (
                <div className="overflow-hidden rounded-lg border border-gray-100">
                  {/* Top inline stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 p-4 text-sm">
                    <div>
                      <p className="text-gray-500">Total periode</p>
                      <p className="font-semibold">{formatCurrency(isNaN(total) || !isFinite(total) ? 0 : total)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Rata-rata / hari</p>
                      <p className="font-semibold">{formatCurrency(isNaN(avg) || !isFinite(avg) ? 0 : Math.round(avg))}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Maksimum harian</p>
                      <p className="font-semibold">{formatCurrency(validMax)}</p>
                    </div>
                  </div>
                  <svg
                    viewBox={`0 0 ${w} ${h}`}
                    className="w-full h-64 md:h-96"
                    onMouseMove={(e) => {
                      const rect = (e.target as SVGElement).closest('svg')!.getBoundingClientRect();
                      const px = e.clientX - rect.left;
                      const plotW = w - 2 * pad;
                      const i = Math.round(((px - pad) / plotW) * (series.length - 1));
                      if (i >= 0 && i < series.length) setHoverIndex(i);
                    }}
                    onMouseLeave={() => setHoverIndex(null)}
                  >
                    {/* background */}
                    <rect 
                      x="0" 
                      y="0" 
                      width={isNaN(w) || !isFinite(w) ? 960 : w} 
                      height={isNaN(h) || !isFinite(h) ? 380 : h} 
                      fill="#fafafa" 
                    />
                    {/* grid horizontal */}
                    {yTicks.map((t, i) => {
                      // Ensure all values are valid numbers
                      const validT = isNaN(t) || !isFinite(t) ? 0 : t;
                      const validY = yScale(validT);
                      // Ensure coordinates are valid
                      const validYCoord = isNaN(validY) || !isFinite(validY) ? 0 : validY;
                      const validPad = isNaN(pad) || !isFinite(pad) ? 48 : pad;
                      const validW = isNaN(w) || !isFinite(w) ? 960 : w;
                      return (
                        <g key={i}>
                          <line 
                            x1={validPad} 
                            y1={validYCoord} 
                            x2={validW - validPad} 
                            y2={validYCoord} 
                            stroke="#e5e7eb" 
                            strokeWidth={1} 
                          />
                          <text 
                            x={12} 
                            y={validYCoord + 4} 
                            fontSize={14} 
                            fill="#6b7280"
                          >
                            {formatChartCurrency(validT)}
                          </text>
                        </g>
                      );
                    })}
                    {/* x axis labels: first, middle, last */}
                    {series.length > 2 && [0, Math.floor(series.length / 2), series.length - 1].map((i, idx) => {
                      const validX = xScale(i);
                      const validXValue = isNaN(validX) || !isFinite(validX) ? 0 : validX;
                      return (
                        <text 
                          key={idx} 
                          x={validXValue} 
                          y={h - 8} 
                          fontSize={14} 
                          fill="#6b7280" 
                          textAnchor="middle"
                        >
                          {series[i].date.slice(5)}
                        </text>
                      );
                    })}
                    {/* series */}
                    {chartType === 'line' ? (
                      <>
                        {/* area */}
                        <path d={areaPath} fill="#ef44441a" />
                        {/* line */}
                        <path d={linePath} fill="none" stroke="#ef4444" strokeWidth={3.5} />
                        {/* points */}
                        {series.map((p, i) => {
                          const validX = xScale(i);
                          const validY = yScale(p.value);
                          // Ensure coordinates are valid numbers
                          const cx = isNaN(validX) || !isFinite(validX) ? 0 : validX;
                          const cy = isNaN(validY) || !isFinite(validY) ? 0 : validY;
                          
                          return (
                            <circle 
                              key={i} 
                              cx={cx} 
                              cy={cy} 
                              r={4} 
                              fill="#ef4444" 
                            />
                          );
                        })}
                      </>
                    ) : (
                      // bar chart
                      <>
                        {series.map((p, i) => {
                          const x = xScale(i);
                          const nextX = i < series.length - 1 ? xScale(i + 1) : x + ((w - 2 * pad) / (series.length - 1 || 1));
                          const barW = Math.max(2, (nextX - x) * 0.7);
                          const bx = x - barW / 2;
                          const by = yScale(p.value);
                          const bh = h - pad - by;
                          
                          // Ensure all values are valid
                          const validX = isNaN(x) || !isFinite(x) ? 0 : x;
                          const validBx = isNaN(bx) || !isFinite(bx) ? 0 : bx;
                          const validBy = isNaN(by) || !isFinite(by) ? h - pad : by;
                          const validBh = isNaN(bh) || !isFinite(bh) ? 0 : bh;
                          const validBarW = isNaN(barW) || !isFinite(barW) ? 2 : barW;
                          
                          return (
                            <rect 
                              key={i} 
                              x={validBx} 
                              y={validBy} 
                              width={validBarW} 
                              height={validBh} 
                              fill="#ef4444" 
                              opacity={0.85} 
                            />
                          );
                        })}
                      </>
                    )}

                    {/* SMA-7 line */}
                    <path d={smaPath} fill="none" stroke="#3b82f6" strokeDasharray="4 3" strokeWidth={2} />

                    {/* Min/Max markers */}
                    <g>
                      <circle 
                        cx={isNaN(xScale(maxIdx)) || !isFinite(xScale(maxIdx)) ? 0 : xScale(maxIdx)} 
                        cy={isNaN(yScale(max)) || !isFinite(yScale(max)) ? 0 : yScale(max)} 
                        r={5} 
                        fill="#16a34a" 
                      />
                      <text 
                        x={isNaN(xScale(maxIdx) + 6) || !isFinite(xScale(maxIdx) + 6) ? 6 : xScale(maxIdx) + 6} 
                        y={isNaN(yScale(max) - 6) || !isFinite(yScale(max) - 6) ? -6 : yScale(max) - 6} 
                        fontSize={12} 
                        fill="#166534"
                      >
                        Max {formatChartCurrency(validMax)}
                      </text>
                      {min > 0 && ( // Only show min marker if we have a valid min value
                        <>
                          <circle 
                            cx={isNaN(xScale(validMinIdx)) || !isFinite(xScale(validMinIdx)) ? 0 : xScale(validMinIdx)} 
                            cy={isNaN(yScale(min)) || !isFinite(yScale(min)) ? 0 : yScale(min)} 
                            r={5} 
                            fill="#6b7280" 
                          />
                          <text 
                            x={isNaN(xScale(validMinIdx) + 6) || !isFinite(xScale(validMinIdx) + 6) ? 6 : xScale(validMinIdx) + 6} 
                            y={isNaN(yScale(min) + 16) || !isFinite(yScale(min) + 16) ? 16 : yScale(min) + 16} 
                            fontSize={12} 
                            fill="#374151"
                          >
                            Min {formatChartCurrency(min)}
                          </text>
                        </>
                      )}
                    </g>

                    {/* Hover guideline + tooltip */}
                    {hoverIndex !== null && hoverIndex >= 0 && hoverIndex < series.length && (
                      <g>
                        <line 
                          x1={isNaN(xScale(hoverIndex)) || !isFinite(xScale(hoverIndex)) ? 0 : xScale(hoverIndex)} 
                          y1={pad} 
                          x2={isNaN(xScale(hoverIndex)) || !isFinite(xScale(hoverIndex)) ? 0 : xScale(hoverIndex)} 
                          y2={h - pad} 
                          stroke="#94a3b8" 
                          strokeDasharray="4 3" 
                        />
                        {/* tooltip box */}
                        {(() => {
                          const x = xScale(hoverIndex);
                          const tooltipW = 180;
                          const tooltipH = 64;
                          const leftSide = x > w / 2;
                          const tx = Math.min(Math.max(pad, leftSide ? x - tooltipW - 12 : x + 12), w - pad - tooltipW);
                          const ty = pad + 8;
                          const v = series[hoverIndex].value;
                          const d = series[hoverIndex].date;
                          // Ensure tooltip coordinates are valid
                          const validTx = isNaN(tx) || !isFinite(tx) ? 0 : tx;
                          const validTy = isNaN(ty) || !isFinite(ty) ? 0 : ty;
                          return (
                            <g>
                              <rect 
                                x={validTx} 
                                y={validTy} 
                                width={tooltipW} 
                                height={tooltipH} 
                                rx={8} 
                                fill="#111827" 
                                opacity={0.9} 
                              />
                              <text 
                                x={validTx + 10} 
                                y={validTy + 22} 
                                fontSize={12} 
                                fill="#9ca3af"
                              >
                                {d}
                              </text>
                              <text 
                                x={validTx + 10} 
                                y={validTy + 42} 
                                fontSize={16} 
                                fill="#ffffff" 
                                fontWeight={600}
                              >
                                {formatCurrency(isNaN(v) || !isFinite(v) ? 0 : v)}
                              </text>
                            </g>
                          );
                        })()}
                      </g>
                    )}
                  </svg>
                </div>
              );
            })()}
          </div>

          {/* Top Paying Students (computed) */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Mahasiswa Teratas</h3>
            <div className="space-y-4">
              {(() => {
                if (!recentPayments.length) {
                  return <p className="text-sm text-gray-500">Belum ada data pembayaran.</p>;
                }
                const agg = new Map<string, { name: string; nim: string; total: number }>();
                recentPayments.forEach(p => {
                  const key = p.nim_kashif || p.studentName;
                  const prev = agg.get(key) || { name: p.studentName, nim: p.nim_kashif, total: 0 };
                  // Ensure p.amount is a valid number
                  const amount = isNaN(p.amount) || !isFinite(p.amount) ? 0 : p.amount;
                  prev.total += amount;
                  agg.set(key, prev);
                });
                const top = Array.from(agg.values()).sort((a, b) => b.total - a.total).slice(0, 3);
                return top.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{s.name}</p>
                      <p className="text-sm text-gray-500">{s.nim}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">{formatCurrency(s.total)}</p>
                      <p className="text-xs text-gray-500">Total bayar</p>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'recent' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-lg font-semibold text-gray-900">Pembayaran Terbaru</h3>
              <div className="flex space-x-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari mahasiswa..."
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#540002] focus:border-transparent"
                  />
                </div>
                <button className="flex items-center space-x-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <Filter className="w-4 h-4" />
                  <span className="text-sm">Filter</span>
                </button>
                <button className="flex items-center space-x-1 px-3 py-2 bg-[#540002] text-white rounded-lg hover:bg-[#6d0003] transition-colors">
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Export</span>
                </button>
              </div>
            </div>
          </div>

          <div className="">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col style={{ width: '36%' }} />
                <col style={{ width: '28%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mahasiswa
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Jenis Tagihan
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nominal
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tanggal
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(recentPayments.length ? recentPayments : []).map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-normal break-words text-center align-top">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {payment.studentName || '-'}
                        </div>
                        <div className="text-xs text-gray-500 break-words">
                          KASHIF: {payment.nim_kashif || '-'}
                          {payment.nim_dikti && (
                            <span className="ml-2">• DIKTI: {payment.nim_dikti}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-normal break-words text-center align-top">
                      <div className="text-sm text-gray-900 break-words">{payment.billType || '-'}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-normal break-words text-center align-top">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(isNaN(payment.amount) || !isFinite(payment.amount) ? 0 : Math.floor(payment.amount))}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-normal break-words text-center align-top">
                      <div className="text-sm text-gray-900">
                        {payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('id-ID') : '-'}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-normal break-words text-center align-top">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-800 border border-green-200">
                        {payment.status === 'paid' ? 'Lunas' : payment.status === 'pending' ? 'Pending' : payment.status === 'failed' ? 'Gagal' : 'Lunas'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {recentPayments.length ? `Menampilkan ${recentPayments.length} pembayaran terbaru` : 'Belum ada pembayaran'}
              </p>
              <div className="flex space-x-2">
                <button className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors">
                  Sebelumnya
                </button>
                <button className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors">
                  Selanjutnya
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'outstanding' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-lg font-semibold text-gray-900">Tagihan Tertunggak</h3>
              <div className="flex space-x-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari tagihan..."
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#540002] focus:border-transparent"
                  />
                </div>
                <button className="flex items-center space-x-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <Filter className="w-4 h-4" />
                  <span className="text-sm">Filter</span>
                </button>
                <button className="flex items-center space-x-1 px-3 py-2 bg-[#540002] text-white rounded-lg hover:bg-[#6d0003] transition-colors">
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Export</span>
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 text-center text-gray-500">
            <p>Fitur Tagihan Tertunggak akan segera tersedia.</p>
          </div>
        </div>
      )}

      {/* Modal Forms */}
      <StudentForm
        isOpen={isStudentFormOpen}
        onClose={() => setIsStudentFormOpen(false)}
        onSubmit={handleStudentSubmit}
      />

      <BillForm
        isOpen={isBillFormOpen}
        onClose={() => setIsBillFormOpen(false)}
        onSubmit={handleBillSubmit}
        students={students}
      />
    </div>
  );
};

export default AdminDashboard;