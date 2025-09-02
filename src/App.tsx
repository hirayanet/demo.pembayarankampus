import { useState, useEffect } from 'react';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import AdminDashboard from './pages/AdminDashboard';
import StudentDashboard from './pages/StudentDashboard';
import StudentsManagement from './pages/admin/StudentsManagement';
import BillsManagement from './pages/admin/BillsManagement';
import PaymentsManagement from './pages/admin/PaymentsManagement';
import ReportsManagement from './pages/admin/ReportsManagement';
import SettingsManagement from './pages/admin/SettingsManagement';
// import PaymentPage from './pages/student/PaymentPage';
import ReceiptsPage from './pages/student/ReceiptsPage';
import { ToastProvider } from './components/Toast/ToastProvider';
import ReceiptPrint from './pages/ReceiptPrint';
// import { supabase } from './lib/supabase'; // Original Supabase (backup)
import { supabase } from './lib/mysql'; // MySQL Testing

interface User {
  email: string;
  role: 'admin' | 'staff' | 'student';
  name: string;
  nim_kashif?: string;
  nim_dikti?: string;
  prodi?: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeMenu, setActiveMenu] = useState('dashboard');
  // payment state removed: mahasiswa view-only
  const [hashRoute, setHashRoute] = useState<{ type: 'receipt'; id: string } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // session timeout in minutes
  const [sessionTimeoutMin, setSessionTimeoutMin] = useState<number>(30);
  const [inactivityTimer, setInactivityTimer] = useState<number | null>(null);

  useEffect(() => {
    // Check if user is already logged in (from localStorage)
    const savedUser = localStorage.getItem('campuspay_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    const parseHash = () => {
      const h = window.location.hash;
      const m = h.match(/^#\/receipt\/(.+)$/);
      if (m) {
        const idPart = m[1].split('?')[0];
        setHashRoute({ type: 'receipt', id: idPart });
      } else setHashRoute(null);
    };
    parseHash();
    window.addEventListener('hashchange', parseHash);
    return () => window.removeEventListener('hashchange', parseHash);
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem('campuspay_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('campuspay_user');
    // clear inactivity timer
    if (inactivityTimer) {
      window.clearTimeout(inactivityTimer);
      setInactivityTimer(null);
    }
  };

  const handleMenuClick = (menu: string) => {
    setActiveMenu(menu);
    setIsSidebarOpen(false); // close drawer on navigation (mobile)
  };

  const handlePayBill = (_billId: string) => {
    // Mahasiswa view-only: tidak mengarahkan ke halaman pembayaran
  };

  // no payment flow for students
  // Load sessionTimeout from settings when user logs in
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const loadTimeout = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('security')
          .eq('id', 'system')
          .single();
        if (!mounted) return;
        if (!error && data?.security?.sessionTimeout) {
          const min = Number(data.security.sessionTimeout) || 30;
          setSessionTimeoutMin(min);
        } else {
          setSessionTimeoutMin(30);
        }
      } catch {
        setSessionTimeoutMin(30);
      }
    };
    loadTimeout();

    // subscribe to changes
    const channel = supabase
      .channel('settings_session_timeout')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: 'id=eq.system' }, (payload) => {
        try {
          const sec = (payload.new as any)?.security;
          if (sec && typeof sec.sessionTimeout !== 'undefined') {
            const min = Number(sec.sessionTimeout) || 30;
            setSessionTimeoutMin(min);
          }
        } catch {}
      })
      .subscribe();

    return () => {
      mounted = false;
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [user]);

  // Inactivity timer: reset on user activity, logout after sessionTimeoutMin
  useEffect(() => {
    if (!user) return;

    const activity = () => {
      if (inactivityTimer) window.clearTimeout(inactivityTimer);
      const id = window.setTimeout(() => {
        alert('Sesi Anda berakhir karena tidak ada aktivitas. Anda akan keluar.');
        handleLogout();
      }, Math.max(1, sessionTimeoutMin) * 60 * 1000);
      setInactivityTimer(id);
    };

    // initial set
    activity();

    const events = ['mousemove', 'keydown', 'click', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, activity));

    // reset when timeout value changes
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, activity));
      if (inactivityTimer) window.clearTimeout(inactivityTimer);
    };
  }, [user, sessionTimeoutMin]);

  const renderContent = () => {
    if (user?.role === 'admin' || user?.role === 'staff') {
      switch (activeMenu) {
        case 'dashboard':
          return <AdminDashboard />;
        case 'students':
          return <StudentsManagement />;
        case 'bills':
          return <BillsManagement />;
        case 'payments':
          return <PaymentsManagement />;
        case 'reports':
          return <ReportsManagement />;
        case 'settings':
          // Staff tidak boleh akses Settings; fallback ke dashboard
          return user.role === 'admin' ? <SettingsManagement /> : <AdminDashboard />;
        default:
          return <AdminDashboard />;
      }
    } else {
      switch (activeMenu) {
        case 'dashboard':
          return <StudentDashboard onPayBill={handlePayBill} summaryOnly hideTabs />;
        case 'bills':
          return <StudentDashboard onPayBill={handlePayBill} initialTab="bills" hideTabs />;
        case 'receipts':
          return <ReceiptsPage />;
        default:
          return <StudentDashboard onPayBill={handlePayBill} summaryOnly hideTabs />;
      }
    }
  };

  if (hashRoute?.type === 'receipt') {
    return (
      <ToastProvider>
        <ReceiptPrint paymentId={hashRoute.id} />
      </ToastProvider>
    );
  }

  if (!user) {
    // Simple routing: tampilkan halaman reset password jika URL pathname cocok
    if (typeof window !== 'undefined' && window.location.pathname === '/reset-password') {
      return (
        <ToastProvider>
          <ResetPassword />
        </ToastProvider>
      );
    }
    return (
      <ToastProvider>
        <Login onLogin={handleLogin} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar - Desktop (md+) */}
        <div className="hidden md:block w-64 lg:w-72 flex-shrink-0">
          <Sidebar
            userRole={user.role}
            activeMenu={activeMenu}
            onMenuClick={handleMenuClick}
            onLogout={handleLogout}
          />
        </div>

        {/* Sidebar - Mobile Drawer */}
        {isSidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-40 md:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
            <div className={`fixed inset-y-0 left-0 w-64 bg-white shadow-xl border-r border-gray-100 z-50 md:hidden transform transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
              <Sidebar
                userRole={user.role}
                activeMenu={activeMenu}
                onMenuClick={handleMenuClick}
                onLogout={handleLogout}
                showLabelsOnMobile
              />
            </div>
          </>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <Header user={user} onToggleSidebar={() => setIsSidebarOpen((v) => !v)} />

          {/* Content Area */}
          <main className="flex-1 overflow-y-auto bg-gray-50">
            {renderContent()}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

export default App;