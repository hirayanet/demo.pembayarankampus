import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Settings as SettingsIcon, 
  Shield, 
  Database,
  Plus,
  Power,
  Trash2,
  RefreshCw,
  BookOpen,
  Tag,
  Save,
  Download,
  Pencil
} from 'lucide-react';
import { supabase, dbService } from '../../lib/mysql';
import { useToast } from '../../components/Toast/ToastProvider';
import type { Student, Program, BillCategory } from '../../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
import { currencyIDR } from '../../lib/receipt';

const SettingsManagement: React.FC = () => {
  // Debugging: Check if icons are properly imported
  console.log('Icons imported:', { BookOpen, Tag, Save, Download, Pencil, Shield, Database });
  
  const showToast = (opts: { type: 'success'|'error'|'info'; title?: string; message: string }) => {
    if (typeof window !== 'undefined') {
      if (opts.type === 'success') { alert(opts.message); return; }
      if (opts.type === 'error') { alert(`Error: ${opts.message}`); return; }
      alert(opts.message);
      return;
    }
    console.log(`[${opts.type}]`, opts.title || '', opts.message);
  };
  const [activeTab, setActiveTab] = useState('security');
  const [settings, setSettings] = useState({
    general: {
      institutionName: 'Universitas Teknologi Indonesia',
      institutionCode: 'UTI',
      academicYear: '2024/2025',
      semester: 'Gasal',
      currency: 'IDR',
      timezone: 'Asia/Jakarta',
      language: 'id'
    },
    payment: {
      bankName: 'Bank Mandiri',
      accountNumber: '1234567890',
      accountName: 'Universitas Teknologi Indonesia',
      virtualAccountPrefix: 'UTI',
      paymentMethods: ['Transfer Bank', 'Virtual Account', 'E-Wallet'],
      lateFeePercentage: 2,
      gracePeriodDays: 7
    },
    notification: {
      emailEnabled: true,
      emailSender: 'noreply@kampus.ac.id',
      overdueReminderDays: 7
    },
    security: {
      sessionTimeout: 30,
      passwordMinLength: 8,
      requireSpecialChars: false,
      maxLoginAttempts: 3,
      twoFactorAuth: false
    }
  });

  // Backup tab state
  const [backupSelect, setBackupSelect] = useState({ students: true, programs: true, bills: true, payments: true });
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [restoreFiles, setRestoreFiles] = useState<{ students?: File | null; programs?: File | null; bills?: File | null; payments?: File | null }>({});

  const [programs, setPrograms] = useState<Program[]>([]);
  const [programForm, setProgramForm] = useState<{ code: string; name: string; faculty?: string; level?: string; status: 'active' | 'inactive' }>({
    code: '',
    name: '',
    faculty: '',
    level: '',
    status: 'active'
  });
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [savingProgram, setSavingProgram] = useState(false);
  const [programError, setProgramError] = useState<string>('');

  // Bill Categories state
  const [categories, setCategories] = useState<BillCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string>('');
  const [categoryForm, setCategoryForm] = useState<{ name: string; default_amount: string }>({
    name: '',
    default_amount: ''
  });
  const [editingCategory, setEditingCategory] = useState<BillCategory | null>(null);
  const [editForm, setEditForm] = useState<{ default_amount: string; default_due_days: string }>({
    default_amount: '',
    default_due_days: ''
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string>('');

  // Admin management state
  const [adminUsers, setAdminUsers] = useState<Array<{ id: string; email: string | null; role: 'admin' | 'staff'; active: boolean }>>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [adminActionLoading, setAdminActionLoading] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  // Loading state for creating admin/staff (Edge Function create-admin)
  const [creatingRole, setCreatingRole] = useState<null | 'admin' | 'staff'>(null);

  const getAccessToken = async (): Promise<string | null> => {
    try {
      const s = await supabase.auth.getSession();
      return s.data.session?.access_token || null;
    } catch {
      return null;
    }
  };

  // Admin management now uses unified roles RPCs

  const loadAdmins = async () => {
    setLoadingAdmins(true);
    try {
      // For MySQL testing: use supabase.rpc which now returns mock data
      const { data, error } = await supabase.rpc('managed_users_list');
      if (error) throw error;
      
      // Ensure data is always an array
      const usersData = Array.isArray(data) ? data : [];
      const users = usersData.map((r: any) => ({
        id: r.user_id,
        email: r.email,
        role: (r.role === 'admin' ? 'admin' : 'staff') as 'admin' | 'staff',
        active: r.active !== false // Default ke true jika null/undefined
      }));
      setAdminUsers(users);
    } catch (e: any) {
      console.error(e);
      showToast({ type: 'error', message: e?.message || 'Gagal memuat daftar admin.' });
    } finally {
      setLoadingAdmins(false);
    }
  };

  const setUserRole = async (userId: string, role: 'admin' | 'staff') => {
    setAdminActionLoading(userId + ':' + role);
    try {
      // For MySQL testing: use supabase.rpc which now has mock implementation
      const { error } = await supabase.rpc('role_set', { p_user_id: userId, p_role: role, p_active: true });
      if (error) throw error;
      
      // Optimistic update
      setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
      showToast({ type: 'success', message: `Role user diperbarui menjadi ${role}.` });
    } catch (e: any) {
      console.error(e);
      showToast({ type: 'error', message: e?.message || 'Gagal mengubah role user.' });
    } finally {
      setAdminActionLoading(null);
    }
  };

  // Toggle status aktif/tidak aktif user
  const deactivateManagedUser = async (userId: string) => {
    setAdminActionLoading(userId + ':deactivate');
    try {
      // Dapatkan status aktif saat ini
      const currentUser = adminUsers.find(u => u.id === userId);
      if (!currentUser) throw new Error('User tidak ditemukan');
      
      const newStatus = !currentUser.active;
      
      // For MySQL testing: use supabase.rpc which now has mock implementation
      const { error } = await supabase.rpc('role_set', { 
        p_user_id: userId, 
        p_role: currentUser.role, 
        p_active: newStatus 
      });
      
      if (error) throw error;
      
      // Update status di local state
      setAdminUsers(prev => 
        prev.map(u => 
          u.id === userId 
            ? { ...u, active: newStatus } 
            : u
        )
      );
      
      showToast({ 
        type: 'success', 
        message: `Akun berhasil ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}.` 
      });
    } catch (e: any) {
      console.error(e);
      showToast({ 
        type: 'error', 
        message: e?.message || 'Gagal mengubah status akun.' 
      });
    } finally {
      setAdminActionLoading(null);
    }
  };

  // Hapus akun (HARD DELETE) melalui API endpoint
  const deleteManagedUser = async (userId: string) => {
    setAdminActionLoading(userId + ':delete');
    try {
      // For MySQL testing: use direct API call instead of Supabase function
      const token = localStorage.getItem('auth_token');
      if (!token) { 
        showToast({ type: 'error', message: 'Anda belum login. Silakan login ulang.' }); 
        return; 
      }
      
      const response = await fetch(`${API_BASE_URL}/api/admins/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Gagal menghapus akun');
      }
      
      setAdminUsers(prev => prev.filter(u => u.id !== userId));
      showToast({ type: 'success', message: 'Akun berhasil dihapus.' });
    } catch (e: any) {
      console.error(e);
      showToast({ type: 'error', message: e?.message || 'Gagal menghapus akun.' });
    } finally {
      setAdminActionLoading(null);
    }
  };

  // inviteAdmin flow removed: using createAdminDirect instead (supports role)

  // Create admin/staff directly via Edge Function (default password per role)
  const createAdminDirect = async (role: 'admin' | 'staff') => {
    try {
      const email = inviteEmail.trim();
      if (!email) { showToast({ type: 'error', message: 'Masukkan email.' }); return; }
      const token = await getAccessToken();
      if (!token) { showToast({ type: 'error', message: 'Anda belum login. Silakan login ulang.' }); return; }
      setCreatingRole(role);
      showToast({ type: 'info', message: `Memproses pembuatan ${role === 'staff' ? 'staff' : 'admin'}...` });
      const { data, error } = await supabase.functions.invoke('create-admin', {
        body: { email, role },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error as any;
      const pwd = (data as any)?.default_password || (role === 'staff' ? 'staff123' : 'admin123');
      const roleLabel = role === 'staff' ? 'Staff' : 'Admin';
      showToast({ type: 'success', message: `${roleLabel} dibuat untuk ${email}. Password awal: ${pwd} (harap segera diganti).` });
      setInviteEmail('');
      try { await loadAdmins(); } catch {}
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || e?.error || 'Gagal membuat admin.';
      showToast({ type: 'error', message: msg });
    } finally {
      setCreatingRole(null);
    }
  };

  // Check admin access for this settings page
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // For MySQL testing: assume admin access based on localStorage user role
        const savedUser = localStorage.getItem('user'); // Changed from 'campuspay_user' to 'user'
        if (savedUser) {
          const user = JSON.parse(savedUser);
          const hasAdminAccess = user.role === 'admin';
          if (!mounted) return;
          setIsAdmin(hasAdminAccess);
          // Only load admins list once when component mounts and user is admin
          if (hasAdminAccess && adminUsers.length === 0) {
            try { 
              await loadAdmins(); 
            } catch (e) {
              console.debug('Failed to load admins on mount:', e);
            }
          }
        } else {
          setIsAdmin(false);
        }
        
        /* Original Supabase implementation - commented for MySQL testing
        const { data, error } = await supabase.rpc('is_admin');
        if (error) throw error;
        if (!mounted) return;
        setIsAdmin(Boolean(data));
        if (Boolean(data)) {
          // preload admins list for admins
          try { await loadAdmins(); } catch {}
        }
        */
      } catch (e) {
        setIsAdmin(false);
      }
    })();
    return () => { mounted = false; };
  }, []); // Empty dependency array to run only once

  // Separate function to load programs that can be called for refreshing
  const loadPrograms = async () => {
    try {
      setLoadingPrograms(true);
      const list = await dbService.getPrograms();
      setPrograms(list);
    } catch (e) {
      console.error('Gagal memuat program studi:', e);
      showToast({ type: 'error', message: 'Gagal memuat daftar program studi.' });
    } finally {
      setLoadingPrograms(false);
    }
  };

  // ===== Backup & Restore Handlers =====
  const toggleBackupSelect = (key: keyof typeof backupSelect) => {
    setBackupSelect((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const exportBackup = async () => {
    try {
      setIsExporting(true);
      const payload: any = { meta: { exported_at: new Date().toISOString(), version: 1 } };
      if (backupSelect.students) payload.students = await dbService.getStudents();
      if (backupSelect.programs) payload.programs = await dbService.getPrograms();
      if (backupSelect.bills) payload.bills = await dbService.getBills();
      if (backupSelect.payments) payload.payments = await dbService.getPayments();

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_kampus_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast({ type: 'success', message: 'Backup berhasil dibuat dan diunduh.' });
    } catch (e: any) {
      console.error(e);
      showToast({ type: 'error', message: e?.message || 'Gagal melakukan backup.' });
    } finally {
      setIsExporting(false);
    }
  };

  const onRestoreFileChange = (key: keyof typeof restoreFiles, file?: File | null) => {
    setRestoreFiles((prev) => ({ ...prev, [key]: file || null }));
  };

  const importRestore = async () => {
    try {
      setIsImporting(true);
      // Prioritas: jika ada file students/programs/bills/payments terpisah, gunakan. Jika tidak, coba 1 file gabungan di 'students'.
      const readJson = async (file: File): Promise<any> => JSON.parse(await file.text());

      let combined: any = null;
      if (restoreFiles.students && (!restoreFiles.programs && !restoreFiles.bills && !restoreFiles.payments)) {
        try { combined = await readJson(restoreFiles.students); } catch {}
      }

      // Import Programs
      if (restoreFiles.programs) {
        const data = await readJson(restoreFiles.programs);
        if (Array.isArray(data)) {
          for (const item of data) {
            try {
              await dbService.createProgram({
                code: String(item.code || ''),
                name: String(item.name || ''),
                faculty: item.faculty ?? null,
                level: item.level ?? null,
                status: (item.status === 'inactive' ? 'inactive' : 'active'),
              });
            } catch (e) { console.warn('Skip program error', e); }
          }
        }
      } else if (combined?.programs && Array.isArray(combined.programs)) {
        for (const item of combined.programs) {
          try {
            await dbService.createProgram({
              code: String(item.code || ''),
              name: String(item.name || ''),
              faculty: item.faculty ?? null,
              level: item.level ?? null,
              status: (item.status === 'inactive' ? 'inactive' : 'active'),
            });
          } catch (e) { console.warn('Skip program error', e); }
        }
      }

      // Import Bill Categories tidak didukung oleh backup UI ini (opsional), fokus ke bills/payments/students/programs

      // Import Students
      if (restoreFiles.students && !combined) {
        const data = await readJson(restoreFiles.students);
        if (Array.isArray(data)) {
          for (const s of data) {
            try {
              await dbService.createStudent({
                id: undefined as any, // backend akan generate
                nim_kashif: String(s.nim_kashif || ''),
                nim_dikti: s.nim_dikti ?? null,
                name: String(s.name || ''),
                email: String(s.email || ''),
                phone: s.phone ?? '',
                prodi: String(s.prodi || ''),
                angkatan: String(s.angkatan || ''),
                address: s.address ?? '',
                status: (s.status === 'inactive' ? 'inactive' : s.status === 'graduated' ? 'graduated' : 'active'),
                program_id: s.program_id ?? null,
              } as any);
            } catch (e) { console.warn('Skip student error', e); }
          }
        }
      } else if (combined?.students && Array.isArray(combined.students)) {
        for (const s of combined.students) {
          try {
            await dbService.createStudent({
              id: undefined as any,
              nim_kashif: String(s.nim_kashif || ''),
              nim_dikti: s.nim_dikti ?? null,
              name: String(s.name || ''),
              email: String(s.email || ''),
              phone: s.phone ?? '',
              prodi: String(s.prodi || ''),
              angkatan: String(s.angkatan || ''),
              address: s.address ?? '',
              status: (s.status === 'inactive' ? 'inactive' : s.status === 'graduated' ? 'graduated' : 'active'),
              program_id: s.program_id ?? null,
            } as any);
          } catch (e) { console.warn('Skip student error', e); }
        }
      }

      // Import Bills
      if (restoreFiles.bills) {
        const data = await readJson(restoreFiles.bills);
        if (Array.isArray(data)) {
          for (const b of data) {
            try {
              await dbService.createBill({
                student_id: String(b.student_id || ''),
                description: String(b.description || ''),
                amount: Number(b.amount || 0),
                due_date: String(b.due_date || new Date().toISOString().slice(0, 10)),
                status: (b.status === 'paid' ? 'paid' : b.status === 'partial' ? 'partial' : 'unpaid'),
                paid_amount: Number(b.paid_amount || 0),
                installment_count: b.installment_count ?? undefined,
                installment_amount: b.installment_amount ?? undefined,
                category: b.category ?? undefined,
                category_id: b.category_id ?? undefined,
              } as any);
            } catch (e) { console.warn('Skip bill error', e); }
          }
        }
      } else if (combined?.bills && Array.isArray(combined.bills)) {
        for (const b of combined.bills) {
          try {
            await dbService.createBill({
              student_id: String(b.student_id || ''),
              description: String(b.description || ''),
              amount: Number(b.amount || 0),
              due_date: String(b.due_date || new Date().toISOString().slice(0, 10)),
              status: (b.status === 'paid' ? 'paid' : b.status === 'partial' ? 'partial' : 'unpaid'),
              paid_amount: Number(b.paid_amount || 0),
              installment_count: b.installment_count ?? undefined,
              installment_amount: b.installment_amount ?? undefined,
              category: b.category ?? undefined,
              category_id: b.category_id ?? undefined,
            } as any);
          } catch (e) { console.warn('Skip bill error', e); }
        }
      }

      // Import Payments
      if (restoreFiles.payments) {
        const data = await readJson(restoreFiles.payments);
        if (Array.isArray(data)) {
          for (const p of data) {
            try {
              await dbService.createPayment({
                bill_id: String(p.bill_id || ''),
                student_id: String(p.student_id || ''),
                amount: Number(p.amount || 0),
                payment_method: String(p.payment_method || 'Transfer Bank'),
                payment_date: String(p.payment_date || new Date().toISOString().slice(0, 10)),
                receipt_number: String(p.receipt_number || ''),
                status: (p.status === 'completed' ? 'completed' : p.status === 'failed' ? 'failed' : 'pending'),
              });
            } catch (e) { console.warn('Skip payment error', e); }
          }
        }
      } else if (combined?.payments && Array.isArray(combined.payments)) {
        for (const p of combined.payments) {
          try {
            await dbService.createPayment({
              bill_id: String(p.bill_id || ''),
              student_id: String(p.student_id || ''),
              amount: Number(p.amount || 0),
              payment_method: String(p.payment_method || 'Transfer Bank'),
              payment_date: String(p.payment_date || new Date().toISOString().slice(0, 10)),
              receipt_number: String(p.receipt_number || ''),
              status: (p.status === 'completed' ? 'completed' : p.status === 'failed' ? 'failed' : 'pending'),
            });
          } catch (e) { console.warn('Skip payment error', e); }
        }
      }

      showToast({ type: 'success', message: 'Restore selesai. Periksa data pada menu terkait.' });
    } catch (e: any) {
      console.error(e);
      showToast({ type: 'error', message: e?.message || 'Gagal melakukan restore.' });
    } finally {
      setIsImporting(false);
    }
  };

  // ===== Program Studi Handlers =====
  const resetProgramForm = () => {
    setProgramForm({ code: '', name: '', faculty: '', level: '', status: 'active' });
  };

  const submitProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    setProgramError('');
    try {
      setSavingProgram(true);
      const payload = {
        code: programForm.code.trim(),
        name: programForm.name.trim(),
        faculty: (programForm.faculty || '').trim() || null,
        level: (programForm.level || '').trim() || null,
        status: programForm.status,
      } as Omit<Program, 'id' | 'created_at' | 'updated_at'>;
      await dbService.createProgram(payload);
      showToast({ type: 'success', message: 'Program studi berhasil ditambahkan.' });
      resetProgramForm();
      await loadPrograms();
    } catch (e: any) {
      console.error(e);
      setProgramError(e?.message || 'Gagal menambahkan program studi');
    } finally {
      setSavingProgram(false);
    }
  };

  const updateProgram = async (id: string, updates: Partial<Program>) => {
    try {
      await dbService.updateProgram(id, updates);
      await loadPrograms();
      showToast({ type: 'success', message: 'Program studi diperbarui.' });
    } catch (e: any) {
      console.error(e);
      showToast({ type: 'error', message: e?.message || 'Gagal memperbarui program studi.' });
    }
  };

  const deleteProgram = async (id: string) => {
    try {
      await dbService.deleteProgram(id);
      await loadPrograms();
      showToast({ type: 'success', message: 'Program studi dihapus.' });
    } catch (e: any) {
      console.error(e);
      showToast({ type: 'error', message: e?.message || 'Gagal menghapus program studi.' });
    }
  };

  // ===== Kategori Tagihan Handlers =====
  const handleCategoryCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryError('');
    try {
      setSavingCategory(true);
      const payload = {
        name: categoryForm.name.trim(),
        active: true,
        default_amount: categoryForm.default_amount ? Number(categoryForm.default_amount) : null,
        default_due_days: null,
        default_type: null,
        default_installment_count: null,
        default_installment_amount: null,
      } as Omit<BillCategory, 'id' | 'created_at' | 'updated_at'>;
      await dbService.createBillCategory(payload);
      showToast({ type: 'success', message: 'Kategori tagihan berhasil ditambahkan.' });
      setCategoryForm({ name: '', default_amount: '' });
      await loadCategories();
    } catch (e: any) {
      console.error(e);
      setCategoryError(e?.message || 'Gagal menambahkan kategori tagihan');
    } finally {
      setSavingCategory(false);
    }
  };

  const startEditCategory = (cat: BillCategory) => {
    setEditingCategory(cat);
    setEditForm({
      default_amount: String(cat.default_amount ?? ''),
      default_due_days: String(cat.default_due_days ?? ''),
    });
    setEditError('');
  };

  const saveEditCategory = async () => {
    if (!editingCategory) return;
    setEditError('');
    try {
      setSavingEdit(true);
      const updates: Partial<BillCategory> = {
        default_amount: editForm.default_amount !== '' ? Number(editForm.default_amount) : null,
        default_due_days: editForm.default_due_days !== '' ? Number(editForm.default_due_days) : null,
      };
      await dbService.updateBillCategory(editingCategory.id, updates);
      setEditingCategory(null);
      await loadCategories();
      showToast({ type: 'success', message: 'Kategori tagihan diperbarui.' });
    } catch (e: any) {
      console.error(e);
      setEditError(e?.message || 'Gagal menyimpan perubahan');
    } finally {
      setSavingEdit(false);
    }
  };

  const cancelEditCategory = () => {
    setEditingCategory(null);
    setEditForm({ default_amount: '', default_due_days: '' });
    setEditError('');
  };

  const deleteCategory = async (id: string) => {
    try {
      await dbService.deleteBillCategory(id);
      await loadCategories();
      showToast({ type: 'success', message: 'Kategori tagihan dihapus.' });
    } catch (e: any) {
      console.error(e);
      showToast({ type: 'error', message: e?.message || 'Gagal menghapus kategori tagihan.' });
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoadingPrograms(true);
        const list = await dbService.getPrograms();
        if (!mounted) return;
        setPrograms(list);
      } catch (e) {
        console.error('Gagal memuat program studi:', e);
      } finally {
        setLoadingPrograms(false);
      }
    };
    load();

    const channel = supabase
      .channel('settings-programs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'programs' }, () => {
        setTimeout(() => load(), 250);
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
      mounted = false;
    };
  }, []);

  // Separate function to load categories that can be called for refreshing
  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const list = await dbService.getBillCategories(false);
      setCategories(list);
    } catch (e) {
      console.error('Gagal memuat kategori tagihan:', e);
      showToast({ type: 'error', message: 'Gagal memuat daftar kategori tagihan.' });
    } finally {
      setLoadingCategories(false);
    }
  };

  // Load bill categories
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoadingCategories(true);
        const list = await dbService.getBillCategories(false);
        if (!mounted) return;
        setCategories(list);
      } catch (e) {
        console.error('Gagal memuat kategori tagihan:', e);
      } finally {
        setLoadingCategories(false);
      }
    };
    load();

    const channel = supabase
      .channel('settings-bill-categories-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bill_categories' }, () => {
        setTimeout(() => load(), 250);
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
      mounted = false;
    };
  }, []);

  // Load security settings from Supabase settings table
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('id, security')
          .eq('id', 'system')
          .single();
        if (error) throw error;
        if (!mounted || !data) return;
        const sec = (data as any).security || {};
        setSettings((prev) => ({
          ...prev,
          security: {
            sessionTimeout: Number(sec.sessionTimeout ?? prev.security.sessionTimeout ?? 30),
            passwordMinLength: Number(sec.passwordMinLength ?? prev.security.passwordMinLength ?? 8),
            requireSpecialChars: Boolean(sec.requireSpecialChars ?? prev.security.requireSpecialChars ?? false),
            maxLoginAttempts: Number(sec.maxLoginAttempts ?? prev.security.maxLoginAttempts ?? 3),
            // Keep in state for type compatibility (UI removed)
            twoFactorAuth: Boolean(sec.twoFactorAuth ?? prev.security.twoFactorAuth ?? false),
          }
        }));
      } catch (e: any) {
        console.warn('Gagal memuat settings (security):', e?.message || e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleSettingChange = (category: string, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category as keyof typeof prev],
        [key]: value
      }
    }));
  };

  const handleSave = async () => {
    try {
      const payload = {
        id: 'system',
        security: {
          sessionTimeout: settings.security.sessionTimeout,
          passwordMinLength: settings.security.passwordMinLength,
          requireSpecialChars: settings.security.requireSpecialChars,
          maxLoginAttempts: settings.security.maxLoginAttempts,
        }
      };
      const { error } = await supabase
        .from('settings')
        .upsert(payload, { onConflict: 'id' });
      if (error) throw error;
      showToast({ type: 'success', title: 'Tersimpan', message: 'Pengaturan keamanan berhasil disimpan.' });
    } catch (e: any) {
      console.error('Gagal menyimpan settings:', e);
      showToast({ type: 'error', title: 'Gagal', message: e?.message || 'Gagal menyimpan pengaturan.' });
    }
  };

  const tabs = [
    { id: 'security', label: 'Keamanan', icon: Shield },
    { id: 'programs', label: 'Program Studi', icon: BookOpen },
    { id: 'billCategories', label: 'Kategori Tagihan', icon: Tag },
    { id: 'admin', label: 'Admin', icon: Shield },
    { id: 'backup', label: 'Backup', icon: Database },
    { id: 'restore', label: 'Restore', icon: Database },
  ];
  
  // Debugging: Check if tabs are properly defined
  console.log('Tabs defined:', tabs);

  return (
    <div className="p-6 space-y-6">
      {/* Debugging: Check if component is rendering */}
      <div style={{ display: 'none' }}>
        {BookOpen && <BookOpen />}
        {Tag && <Tag />}
        {Save && <Save />}
        {Download && <Download />}
        {Pencil && <Pencil />}
        {Shield && <Shield />}
        {Database && <Database />}
      </div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pengaturan Sistem</h1>
          <p className="text-gray-600 mt-1">Konfigurasi sistem pembayaran kampus</p>
        </div>
        
        <button
          onClick={handleSave}
          className="flex items-center space-x-2 px-4 py-2 bg-[#540002] text-white rounded-lg hover:bg-[#6d0003] transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>Simpan Perubahan</span>
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Tabs */}
        <div className="lg:w-64">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-[#540002] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            {/* Tab 'general' disembunyikan untuk saat ini */}
            {/* Tab 'payment' disembunyikan untuk saat ini */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Pengaturan Keamanan</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Session Timeout (menit)</label>
                    <input
                      type="number"
                      value={settings.security.sessionTimeout}
                      onChange={(e) => handleSettingChange('security', 'sessionTimeout', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Panjang Minimum Password</label>
                    <input
                      type="number"
                      value={settings.security.passwordMinLength}
                      onChange={(e) => handleSettingChange('security', 'passwordMinLength', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Wajib Karakter Khusus</label>
                    <select
                      value={settings.security.requireSpecialChars ? 'yes' : 'no'}
                      onChange={(e) => handleSettingChange('security', 'requireSpecialChars', e.target.value === 'yes')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
                    >
                      <option value="no">Tidak</option>
                      <option value="yes">Ya</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Maksimal Percobaan Login</label>
                    <input
                      type="number"
                      value={settings.security.maxLoginAttempts}
                      onChange={(e) => handleSettingChange('security', 'maxLoginAttempts', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
                    />
                  </div>
                </div>
                <p className="text-sm text-gray-500">Klik "Simpan Perubahan" di kanan atas untuk menyimpan.</p>
              </div>
            )}
            {activeTab === 'programs' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Program Studi</h3>
                  <button
                    onClick={loadPrograms}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    {loadingPrograms ? 'Memuat...' : 'Muat Ulang'}
                  </button>
                </div>

                <form onSubmit={submitProgram} className="bg-gray-50 rounded-lg p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kode</label>
                    <input value={programForm.code} onChange={(e) => setProgramForm({ ...programForm, code: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent" required />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
                    <input value={programForm.name} onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent" required />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fakultas</label>
                    <input value={programForm.faculty} onChange={(e) => setProgramForm({ ...programForm, faculty: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent" />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jenjang</label>
                    <input value={programForm.level} onChange={(e) => setProgramForm({ ...programForm, level: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent" />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select value={programForm.status} onChange={(e) => setProgramForm({ ...programForm, status: e.target.value as 'active' | 'inactive' })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent">
                      <option value="active">Aktif</option>
                      <option value="inactive">Nonaktif</option>
                    </select>
                  </div>
                  <div className="md:col-span-6 flex items-center gap-2">
                    <button type="submit" disabled={savingProgram} className="px-4 py-2 bg-white text-[#540002] border border-[#540002] rounded-lg hover:bg-[#540002] hover:text-white disabled:opacity-60">
                      {savingProgram ? 'Menyimpan...' : 'Tambah Program'}
                    </button>
                    {programError && <span className="text-sm text-red-600">{programError}</span>}
                  </div>
                </form>

                <div className="overflow-hidden border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kode</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fakultas</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jenjang</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {programs.map((p) => (
                        <tr key={p.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.code}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.faculty || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.level || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={p.status}
                              onChange={(e) => updateProgram(p.id, { status: e.target.value as 'active' | 'inactive' })}
                              className="border rounded px-2 py-1 text-sm"
                            >
                              <option value="active">Aktif</option>
                              <option value="inactive">Nonaktif</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button onClick={() => deleteProgram(p.id)} className="inline-flex items-center justify-center p-2 rounded-full border text-red-600 border-red-300 hover:bg-red-50">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'backup' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Backup Data</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={backupSelect.students} onChange={() => toggleBackupSelect('students')} />
                      Mahasiswa
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={backupSelect.programs} onChange={() => toggleBackupSelect('programs')} />
                      Program Studi
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={backupSelect.bills} onChange={() => toggleBackupSelect('bills')} />
                      Tagihan
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={backupSelect.payments} onChange={() => toggleBackupSelect('payments')} />
                      Pembayaran
                    </label>
                  </div>
                  <div className="mt-4">
                    <button onClick={exportBackup} disabled={isExporting} className="px-4 py-2 bg-white text-[#540002] border border-[#540002] rounded-lg hover:bg-[#540002] hover:text-white disabled:opacity-60 inline-flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      {isExporting ? 'Menyiapkan...' : 'Unduh Backup JSON'}
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-500">Backup dalam format JSON berisi data yang dipilih.</p>
              </div>
            )}

            {activeTab === 'restore' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Restore Data</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <p className="text-sm text-gray-600">Pilih file JSON hasil backup gabungan (unggah di kolom Mahasiswa) atau unggah file per entitas.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mahasiswa (JSON)</label>
                      <input type="file" accept="application/json" onChange={(e) => onRestoreFileChange('students', e.target.files?.[0])} className="block w-full text-sm text-gray-700" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Program Studi (JSON)</label>
                      <input type="file" accept="application/json" onChange={(e) => onRestoreFileChange('programs', e.target.files?.[0])} className="block w-full text-sm text-gray-700" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tagihan (JSON)</label>
                      <input type="file" accept="application/json" onChange={(e) => onRestoreFileChange('bills', e.target.files?.[0])} className="block w-full text-sm text-gray-700" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pembayaran (JSON)</label>
                      <input type="file" accept="application/json" onChange={(e) => onRestoreFileChange('payments', e.target.files?.[0])} className="block w-full text-sm text-gray-700" />
                    </div>
                  </div>
                  <div>
                    <button onClick={importRestore} disabled={isImporting} className="px-4 py-2 bg-white text-[#540002] border border-[#540002] rounded-lg hover:bg-[#540002] hover:text-white disabled:opacity-60">
                      {isImporting ? 'Mengimpor...' : 'Mulai Restore'}
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-500">Catatan: proses restore akan mencoba memasukkan data satu per satu. Baris yang gagal akan dilewati.</p>
              </div>
            )}

            {activeTab === 'billCategories' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Kategori Tagihan</h3>
                  <button
                    onClick={loadCategories}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    {loadingCategories ? 'Memuat...' : 'Muat Ulang'}
                  </button>
                </div>

                <form onSubmit={handleCategoryCreate} className="bg-gray-50 rounded-lg p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Kategori</label>
                    <input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent" required />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nominal Default</label>
                    <input type="number" inputMode="numeric" value={categoryForm.default_amount} onChange={(e) => setCategoryForm({ ...categoryForm, default_amount: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent" placeholder="cth: 1500000" />
                  </div>
                  <div className="md:col-span-1 flex items-end">
                    <button type="submit" disabled={savingCategory} className="w-full px-4 py-2 bg-white text-[#540002] border border-[#540002] rounded-lg hover:bg-[#540002] hover:text-white disabled:opacity-60">
                      {savingCategory ? 'Menyimpan...' : 'Tambah'}
                    </button>
                  </div>
                  {categoryError && <div className="md:col-span-6 text-sm text-red-600">{categoryError}</div>}
                </form>

                <div className="overflow-hidden border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nominal Default</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jatuh Tempo (hari)</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {categories.map((c) => {
                        const isEdit = editingCategory?.id === c.id;
                        return (
                          <tr key={c.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{c.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {isEdit ? (
                                <input
                                  type="number"
                                  value={editForm.default_amount}
                                  onChange={(e) => setEditForm({ ...editForm, default_amount: e.target.value })}
                                  className="w-40 px-2 py-1 border border-gray-300 rounded"
                                />
                              ) : (
                                c.default_amount ? currencyIDR(Number(c.default_amount)) : '-'
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {isEdit ? (
                                <input
                                  type="number"
                                  value={editForm.default_due_days}
                                  onChange={(e) => setEditForm({ ...editForm, default_due_days: e.target.value })}
                                  className="w-28 px-2 py-1 border border-gray-300 rounded"
                                />
                              ) : (
                                c.default_due_days ?? '-'
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                              {isEdit ? (
                                <>
                                  <button onClick={saveEditCategory} disabled={savingEdit} className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60">{savingEdit ? 'Menyimpan...' : 'Simpan'}</button>
                                  <button onClick={cancelEditCategory} className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Batal</button>
                                  {editError && <div className="text-sm text-red-600 mt-1">{editError}</div>}
                                </>
                              ) : (
                                <>
                                  <button onClick={() => startEditCategory(c)} className="inline-flex items-center justify-center p-2 rounded-full border text-gray-700 border-gray-300 hover:bg-gray-50">
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => deleteCategory(c.id)} className="inline-flex items-center justify-center p-2 rounded-full border text-red-600 border-red-300 hover:bg-red-50">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'admin' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Manajemen Admin</h3>
                  <button
                    onClick={loadAdmins}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    {loadingAdmins ? 'Memuat...' : 'Muat Ulang'}
                  </button>
                </div>
                {/* Invite Admin */}
                <div className="bg-gray-50 rounded-lg p-4 flex flex-col md:flex-row gap-3 md:items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="invite-email">Masukan Email</label>
                    <input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      disabled={creatingRole !== null}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
                      placeholder="nama@kampus.ac.id"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => createAdminDirect('admin')}
                      className="px-4 py-2 bg-white text-[#540002] border border-[#540002] rounded-lg hover:bg-[#540002] hover:text-white disabled:opacity-60"
                      disabled={creatingRole !== null}
                      aria-busy={creatingRole === 'admin'}
                    >
                      {creatingRole === 'admin' ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Menambah Admin...
                        </span>
                      ) : (
                        'Tambah Admin '
                      )}
                    </button>
                    <button
                      onClick={() => createAdminDirect('staff')}
                      className="px-4 py-2 bg-white text-[#540002] border border-[#540002] rounded-lg hover:bg-[#540002] hover:text-white disabled:opacity-60"
                      disabled={creatingRole !== null}
                      aria-busy={creatingRole === 'staff'}
                    >
                      {creatingRole === 'staff' ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Menambah Staff...
                        </span>
                      ) : (
                        'Tambah Staff '
                      )}
                    </button>
                  </div>
                </div>
                {/* List Users */}
                <div className="border rounded-lg">
                  <div className="grid grid-cols-12 gap-4 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 border-b">
                    <div className="col-span-6">Email</div>
                    <div className="col-span-3 text-center">Role</div>
                    <div className="col-span-3 text-center">Aksi</div>
                  </div>
                  {loadingAdmins ? (
                    <div className="p-4 text-sm text-gray-500">Memuat data...</div>
                  ) : adminUsers.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">Belum ada data user. Klik "Muat Ulang" untuk memuat.</div>
                  ) : (
                    <div className="overflow-hidden border border-gray-200 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {adminUsers.map((user) => (
                            <tr key={user.id} className={!user.active ? 'bg-gray-50' : ''}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {user.email || '(tanpa email)'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <select
                                  value={user.role}
                                  onChange={(e) => setUserRole(user.id, e.target.value as 'admin' | 'staff')}
                                  className={`border rounded px-2 py-1 text-sm ${!user.active ? 'bg-gray-100' : ''}`}
                                  disabled={adminActionLoading === `${user.id}:${user.role === 'admin' ? 'staff' : 'admin'}` || !user.active}
                                >
                                  <option value="admin">Admin</option>
                                  <option value="staff">Staff</option>
                                </select>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                  {user.active ? 'Aktif' : 'Nonaktif'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                <button
                                  onClick={() => deactivateManagedUser(user.id)}
                                  title={user.active ? 'Nonaktifkan akun' : 'Aktifkan akun'}
                                  aria-label={user.active ? 'Nonaktifkan akun' : 'Aktifkan akun'}
                                  className={`inline-flex items-center justify-center p-2 rounded-full border ${user.active ? 'text-red-600 border-red-300 hover:bg-red-50' : 'text-green-600 border-green-300 hover:bg-green-50'} disabled:opacity-50`}
                                  disabled={adminActionLoading === `${user.id}:deactivate`}
                                >
                                  {adminActionLoading === `${user.id}:deactivate` ? (
                                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Power className="w-4 h-4" />
                                  )}
                                </button>
                                {!user.active && (
                                  <button
                                    onClick={() => deleteManagedUser(user.id)}
                                    title="Hapus akun (nonaktif)"
                                    aria-label="Hapus akun (nonaktif)"
                                    className="inline-flex items-center justify-center p-2 rounded-full border text-red-600 border-red-300 hover:bg-red-50 disabled:opacity-50 ml-2"
                                    disabled={adminActionLoading === `${user.id}:delete`}
                                  >
                                    {adminActionLoading === `${user.id}:delete` ? (
                                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsManagement;
