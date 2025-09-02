import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  CreditCard, 
  BarChart3, 
  Settings,
  LogOut,
  Receipt
} from 'lucide-react';

interface SidebarProps {
  userRole: 'admin' | 'staff' | 'student';
  activeMenu: string;
  onMenuClick: (menu: string) => void;
  onLogout: () => void;
  // When true, show text labels on mobile (used for mobile drawer)
  showLabelsOnMobile?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ userRole, activeMenu, onMenuClick, onLogout, showLabelsOnMobile = false }) => {
  const adminMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students', label: 'Kelola Mahasiswa', icon: Users },
    { id: 'bills', label: 'Buat & Bayar Tagihan', icon: FileText },
    { id: 'payments', label: 'Status Pembayaran', icon: CreditCard },
    { id: 'reports', label: 'Laporan', icon: BarChart3 },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
  ];

  const studentMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'bills', label: 'Tagihan Aktif', icon: FileText },
    { id: 'receipts', label: 'Bukti Pembayaran', icon: Receipt },
  ];

  // Staff menggunakan admin menu tetapi tanpa 'settings'
  const menuItems = userRole === 'admin'
    ? adminMenuItems
    : (userRole === 'staff'
        ? adminMenuItems.filter((m) => m.id !== 'settings')
        : studentMenuItems);

  return (
    <div className="h-full bg-white shadow-lg border-r border-gray-100 flex flex-col">
      {/* Logo */}
      <div className="flex items-center justify-center py-4 md:py-6 border-b border-gray-100">
        <div className="flex items-center space-x-2">
          <img
            src="/images/favicon.png"
            alt="Logo"
            className="w-9 h-9 md:w-10 md:h-10 rounded-lg object-contain"
          />
          <div className={`${showLabelsOnMobile ? 'block' : 'hidden md:block'}`}>
            <h2 className="text-lg font-bold text-[#540002] truncate">Kamal Al Shifaa</h2>
            <p className="text-xs text-gray-500 truncate">Manajemen Pembayaran Kampus</p>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 py-6">
        <ul className="space-y-2 px-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.id;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => onMenuClick(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 ${
                    isActive 
                      ? 'bg-[#540002] text-white shadow-md' 
                      : 'text-gray-700 hover:bg-gray-50 hover:text-[#540002]'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                  <span className={`${showLabelsOnMobile ? 'block' : 'hidden md:block'} font-medium truncate`}>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Actions */}
      <div className="border-t border-gray-100 p-4">
        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-50 hover:text-[#540002] transition-all duration-200"
        >
          <LogOut className="w-5 h-5 text-gray-500" />
          <span className={`${showLabelsOnMobile ? 'block' : 'hidden md:block'} font-medium truncate`}>Keluar</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;