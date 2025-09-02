import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/mysql';
import { Lock, CheckCircle, AlertCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ResetPassword: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      try {
        // Ekstrak token dari URL
        const params = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        // Jika tidak ada token, tampilkan pesan error
        if (!accessToken || !refreshToken || type !== 'recovery') {
          setError('Tautan reset password tidak valid. Pastikan Anda mengklik tautan lengkap dari email.');
          setLoading(false);
          return;
        }

        // Set session dengan token yang didapat
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (sessionError) throw sessionError;

        // Verifikasi session
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          throw new Error(userError?.message || 'Tidak dapat memverifikasi pengguna');
        }

      } catch (e: any) {
        console.error('Error setting up password reset:', e);
        setError(e?.message || 'Gagal memproses tautan reset. Silakan coba lagi atau minta tautan baru.');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validasi input
    if (!password || password.length < 6) {
      setError('Password baru minimal 6 karakter');
      return;
    }
    if (password !== confirm) {
      setError('Konfirmasi password tidak sama');
      return;
    }

    setSubmitting(true);
    setError(null);
    
    try {
      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;
      
      // Setelah berhasil, sign out dari semua sesi
      await supabase.auth.signOut();
      
      setDone(true);
      
      // Redirect ke halaman login setelah 3 detik
      setTimeout(() => {
        window.location.href = '/login'; // Gunakan window.location untuk navigasi penuh
      }, 3000);
      
    } catch (e: any) {
      console.error('Error updating password:', e);
      setError(e?.message || 'Terjadi kesalahan saat mengubah password. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#540002] to-[#7d0003] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <button 
          onClick={() => window.location.href = '/login'} 
          className="flex items-center text-white hover:text-gray-200 mb-6"
        >
          <ArrowLeft className="w-5 h-5 mr-1" /> Kembali ke Login
        </button>
        
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#540002] text-white rounded-full mb-4 shadow-lg">
              <Lock className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Reset Password</h1>
            <p className="text-gray-600">Masukkan password baru untuk akun Anda</p>
          </div>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#540002] mx-auto mb-4"></div>
              <p className="text-gray-600">Memproses tautan reset...</p>
            </div>
          ) : error ? (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
              <div className="flex">
                <AlertCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-medium">Gagal Memproses</h3>
                  <p className="text-sm">{error}</p>
                  {error.includes('tidak valid') && (
                    <button 
                      onClick={() => window.location.href = '/forgot-password'}
                      className="mt-2 text-sm text-red-700 hover:underline font-medium"
                    >
                      Minta tautan reset baru
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : done ? (
            <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded">
              <div className="flex">
                <CheckCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-medium">Password Berhasil Diubah!</h3>
                  <p className="text-sm">Anda akan diarahkan ke halaman login dalam beberapa detik...</p>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password Baru
                </label>
                <div className="relative">
                  <div className="flex items-center bg-white border border-gray-300 rounded-lg">
                    <span className="pl-3 text-gray-400 flex items-center">
                      <Lock className="w-5 h-5" />
                    </span>
                    <input
                      id="new_password"
                      name="new_password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      className="flex-1 px-3 py-3 bg-transparent border-0 outline-none appearance-none focus:outline-none focus-visible:outline-none focus:ring-0 focus:shadow-none focus:border-transparent"
                      placeholder="Minimal 6 karakter"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="pr-3 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Konfirmasi Password
                </label>
                <div className="relative">
                  <div className="flex items-center bg-white border border-gray-300 rounded-lg transition-colors focus-within:ring-2 focus-within:ring-[#540002] focus-within:border-transparent">
                    <span className="pl-3 text-gray-400 flex items-center">
                      <Lock className="w-5 h-5" />
                    </span>
                    <input
                      id="new_password_confirm"
                      name="new_password_confirm"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      autoComplete="new-password"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      className="flex-1 px-3 py-3 bg-transparent border-0 outline-none appearance-none focus:outline-none focus-visible:outline-none focus:ring-0 focus:shadow-none focus:border-transparent"
                      placeholder="Ketik ulang password baru"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="pr-3 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#540002] text-white py-3 px-4 rounded-lg font-medium hover:bg-[#6d0003] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {submitting ? (
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
      </div>
    </div>
  );
};

export default ResetPassword;
