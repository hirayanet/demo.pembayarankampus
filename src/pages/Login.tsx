import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
// import { supabase } from '../lib/supabase'; // Original Supabase (backup)
import { authService } from '../lib/mysql'; // MySQL Testing
import { useToast } from '../components/Toast/ToastProvider';

interface LoginProps {
  onLogin: (userData: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState<{ required: boolean; user?: any }>({ required: false });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const submitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword || newPassword.length < 6) {
      setErrors({ general: 'Password baru minimal 6 karakter' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrors({ general: 'Konfirmasi password tidak sama' });
      return;
    }

    setIsLoading(true);
    setErrors(prev => ({ ...prev, general: '' }));
    try {
      // Change password via API
      const response = await fetch('http://localhost:3001/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: formData.email, // Send email for password change
          currentPassword: formData.password, // Original password
          newPassword: newPassword
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Gagal mengganti password');
      }

      // After successful password change, login normally
      const loginResult = await authService.login(formData.email, newPassword);
      
      if (!loginResult.user) {
        const msg = 'Email atau password tidak valid';
        setErrors({ general: msg });
        showToast({ type: 'error', title: 'Login gagal', message: msg });
        return;
      }

      // Login berhasil
      onLogin({
        email: loginResult.user.email,
        role: loginResult.user.role as 'admin' | 'staff' | 'student',
        name: loginResult.user.full_name || loginResult.user.email,
      });

      showToast({ 
        type: 'success', 
        title: 'Login berhasil', 
        message: `Selamat datang, ${loginResult.user.full_name || loginResult.user.email}!` 
      });

    } catch (err: any) {
      setErrors({ general: err?.message || 'Terjadi kesalahan saat mengganti password' });
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email wajib diisi';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Format email tidak valid';
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password wajib diisi';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password minimal 6 karakter';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors(prev => ({ ...prev, general: '' }));
    try {
      // 1) Sign in via MySQL Auth
      const result = await authService.login(formData.email, formData.password);
      
      // Check if password change is required
      if (result.mustChangePassword) {
        setMustChangePassword({ required: true, user: result.user });
        return;
      }
      
      if (!result.user) {
        const msg = 'Email atau password tidak valid';
        setErrors({ general: msg });
        showToast({ type: 'error', title: 'Login gagal', message: msg });
        return;
      }

      const user = result.user;

      // 2) Login berhasil, langsung set user data
      onLogin({
        email: user.email,
        role: user.role as 'admin' | 'staff' | 'student',
        name: user.full_name || user.email,
        // Additional student data will be loaded separately if needed
      });

      showToast({ 
        type: 'success', 
        title: 'Login berhasil', 
        message: `Selamat datang, ${user.full_name || user.email}!` 
      });

    } catch (err: any) {
      const msg = err?.message || 'Terjadi kesalahan saat login';
      setErrors({ general: msg });
      showToast({ type: 'error', title: 'Login gagal', message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    if (errors.general) {
      setErrors(prev => ({ ...prev, general: '' }));
    }
  };

  const handleForgotPassword = async () => {
    // Temporarily disabled untuk MySQL testing
    setErrors({ general: 'Fitur reset password belum tersedia dalam mode testing MySQL. Gunakan akun default: admin@kampus.edu dengan password: password' });
    return;
    
    // Original Supabase implementation (commented for testing)
    /*
    // Validasi email terlebih dahulu
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setErrors({ email: 'Isi email valid untuk reset password' });
      return;
    }

    setIsLoading(true);
    setErrors(prev => ({ ...prev, general: '' }));
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setErrors({ general: error.message });
      } else {
        setErrors({ general: 'Link reset telah dikirim ke email Anda. Periksa kotak masuk/spam.' });
      }
    } catch (err: any) {
      setErrors({ general: err?.message || 'Gagal mengirim link reset password' });
    } finally {
      setIsLoading(false);
    }
    */
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-[#540002] to-[#7d0003] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <img
              src="/images/logo-login.png"
              alt="Kamal Al Shifaa"
              className="mx-auto h-16 w-auto"
            />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Kamal Al Shifaa</h1>
          <p className="text-red-100">Manajemen Pembayaran Kampus</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">
            {mustChangePassword.required ? 'Ganti Password Baru' : 'Masuk ke Akun Anda'}
          </h2>

          {errors.general && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {errors.general}
            </div>
          )}

          {!mustChangePassword.required ? (
            <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent transition-colors ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Masukkan email Anda"
                />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent transition-colors ${
                    errors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Masukkan password Anda"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            {/* Remember Me and Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="remember"
                  className="h-4 w-4 text-[#540002] focus:ring-[#540002] border-gray-300 rounded"
                />
                <label htmlFor="remember" className="ml-2 text-sm text-gray-600">
                  Ingat saya
                </label>
              </div>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-[#540002] hover:text-[#6d0003] transition-colors"
              >
                Lupa password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#540002] text-white py-3 px-4 rounded-lg font-medium hover:bg-[#6d0003] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Memproses...</span>
                </div>
              ) : (
                'Masuk'
              )}
            </button>
          </form>
          ) : (
            <form onSubmit={submitNewPassword} className="space-y-6">
              <div className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg text-sm">
                Anda login dengan password default. Demi keamanan, silakan buat password baru.
              </div>
              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password Baru</label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent transition-colors ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="Minimal 6 karakter"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              {/* Confirm */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Konfirmasi Password Baru</label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent transition-colors border-gray-300"
                    placeholder="Ulangi password baru"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#540002] text-white py-3 px-4 rounded-lg font-medium hover:bg-[#6d0003] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Menyimpan...</span>
                  </div>
                ) : (
                  'Simpan Password Baru'
                )}
              </button>
            </form>
          )}

          
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-red-100">
          <p className="text-sm">
            © 2025 Kamal Al Shifaa. Semua hak cipta dilindungi.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;