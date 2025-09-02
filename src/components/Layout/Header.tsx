import React from 'react';
import { User, ChevronDown, Menu } from 'lucide-react';

interface HeaderProps {
  user: {
    email: string;
    name: string;
    nim_kashif?: string;
    nim_dikti?: string;
    prodi?: string;
    role: 'admin' | 'staff' | 'student';
  };
  onToggleSidebar?: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onToggleSidebar }) => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-100 px-4 md:px-6 py-3 md:py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Hamburger for mobile */}
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded hover:bg-gray-100 text-gray-700"
            aria-label="Toggle sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold text-gray-900">
            {user.role === 'admin' || user.role === 'staff' ? 'Admin Dashboard' : 'Dashboard Mahasiswa'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {user.role === 'admin' || user.role === 'staff'
              ? 'Kelola pembayaran dan tagihan mahasiswa'
              : 'Lihat tagihan dan riwayat pembayaran Anda'
            }
          </p>
        </div>

        <div className="flex items-center space-x-4">
          {/* User Info */}
          <div className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
            <div className="w-8 h-8 bg-[#540002] rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="hidden md:block text-right">
              {/* Only two lines: Name (bold) and Email (subtle) for all roles */}
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;