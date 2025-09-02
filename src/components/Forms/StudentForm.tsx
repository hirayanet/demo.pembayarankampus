import React, { useEffect, useState } from 'react';
import { X, Save, User, BookOpen, Hash, Mail, Phone, MapPin } from 'lucide-react';
import { dbService, Program } from '../../lib/mysql';

interface StudentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (studentData: any) => void;
  initialData?: any;
}

const StudentForm: React.FC<StudentFormProps> = ({ isOpen, onClose, onSubmit, initialData }) => {
  const [formData, setFormData] = useState({
    nim_kashif: initialData?.nim_kashif || '',
    nim_dikti: initialData?.nim_dikti || '',
    name: initialData?.name || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    prodi: initialData?.prodi || '',
    program_id: initialData?.program_id || null as string | null,
    address: initialData?.address || '',
    angkatan: initialData?.angkatan || '',
    status: initialData?.status || 'active',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoadingPrograms(true);
        const list = await dbService.getPrograms();
        if (!mounted) return;
        setPrograms(list.filter(p => p.status !== 'inactive'));
        // Try to resolve program_id from prodi if missing
        if (!initialData?.program_id && initialData?.prodi) {
          const match = list.find(p => p.name.toLowerCase() === String(initialData.prodi).toLowerCase());
          if (match) {
            setFormData(prev => ({ ...prev, program_id: match.id }));
          }
        }
      } catch (e) {
        console.error('Gagal memuat program studi:', e);
      } finally {
        setLoadingPrograms(false);
      }
    };
    load();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset form ketika modal dibuka untuk tambah baru, atau saat beralih antara edit dan add
  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      setFormData({
        nim_kashif: initialData.nim_kashif || '',
        nim_dikti: initialData.nim_dikti || '',
        name: initialData.name || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        prodi: initialData.prodi || '',
        program_id: initialData.program_id || null,
        address: initialData.address || '',
        angkatan: initialData.angkatan || '',
        status: initialData.status || 'active',
      });
    } else {
      setFormData({
        nim_kashif: '',
        nim_dikti: '',
        name: '',
        email: '',
        phone: '',
        prodi: '',
        program_id: null,
        address: '',
        angkatan: '',
        status: 'active',
      });
    }
    setErrors({});
  }, [isOpen, initialData]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.nim_kashif.trim()) newErrors.nim_kashif = 'NIM KASHIF wajib diisi';
    if (!formData.name.trim()) newErrors.name = 'Nama wajib diisi';
    if (!formData.email.trim()) newErrors.email = 'Email wajib diisi';
    if (!formData.prodi.trim()) newErrors.prodi = 'Program Studi wajib diisi';
    if (!formData.angkatan.trim()) newErrors.angkatan = 'Angkatan wajib diisi';

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Format email tidak valid';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      try {
        setSubmitting(true);
        // Dukung onSubmit sinkron atau async tanpa cek truthiness hasil
        await Promise.resolve(onSubmit(formData));
      } finally {
        setSubmitting(false);
        // Reset form setelah submit agar siap input baru tanpa refresh
        setFormData({
          nim_kashif: '',
          nim_dikti: '',
          name: '',
          email: '',
          phone: '',
          prodi: '',
          program_id: null,
          address: '',
          angkatan: '',
          status: 'active',
        });
        setErrors({});
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    // Special handling for program select: keep both program_id and prodi name in sync
    if (name === 'program_id') {
      const selected = programs.find(p => String(p.id) === String(value)) || null;
      setFormData(prev => ({ 
        ...prev, 
        program_id: value || null, 
        prodi: selected?.name || '' 
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Get current selected program for better reactivity - handle both string and number IDs
  const selectedProgram = programs.find(p => String(p.id) === String(formData.program_id)) || null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {initialData ? 'Edit Mahasiswa' : 'Tambah Mahasiswa Baru'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* NIM KASHIF */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Hash className="w-4 h-4 inline mr-1" />
                NIM KASHIF
              </label>
              <input
                type="text"
                name="nim_kashif"
                value={formData.nim_kashif}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent ${
                  errors.nim_kashif ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Masukkan NIM KASHIF"
              />
              {errors.nim_kashif && <p className="text-red-500 text-xs mt-1">{errors.nim_kashif}</p>}
            </div>

            {/* NIM DIKTI */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Hash className="w-4 h-4 inline mr-1" />
                NIM DIKTI
                <span className="text-xs text-gray-500 ml-1">(Opsional)</span>
              </label>
              <input
                type="text"
                name="nim_dikti"
                value={formData.nim_dikti}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
                placeholder="Masukkan NIM DIKTI (akan diisi kemudian)"
              />
              <p className="text-xs text-gray-500 mt-1">NIM DIKTI akan diisi setelah data tersedia</p>
            </div>

            {/* Nama */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                Nama Lengkap
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Masukkan nama lengkap"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="w-4 h-4 inline mr-1" />
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="email@example.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="w-4 h-4 inline mr-1" />
                No. Telepon
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
                placeholder="081234567890"
              />
            </div>

            {/* Program Studi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <BookOpen className="w-4 h-4 inline mr-1" />
                Program Studi
              </label>
              <select
                name="program_id"
                value={formData.program_id || ''}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent ${
                  errors.prodi ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={loadingPrograms}
              >
                <option value="">Pilih Program Studi</option>
                {programs.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {errors.prodi && <p className="text-red-500 text-xs mt-1">{errors.prodi}</p>}
              {/* Jenjang (auto-populated from selected program) */}
              <div className="mt-2 p-2 bg-gray-50 rounded-lg border">
                <div className="text-sm">
                  <span className="text-gray-600 font-medium">Jenjang:</span>{' '}
                  <span className="font-semibold text-gray-900">
                    {selectedProgram?.level || (formData.program_id ? 'Tidak tersedia' : 'Pilih program studi terlebih dahulu')}
                  </span>
                </div>
                {selectedProgram?.faculty && (
                  <div className="text-xs text-gray-500 mt-1">
                    Fakultas: {selectedProgram.faculty}
                  </div>
                )}
              </div>
            </div>

            {/* Angkatan */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Angkatan
              </label>
              <input
                type="number"
                name="angkatan"
                value={formData.angkatan}
                onChange={handleChange}
                min="2000"
                max="2030"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent ${
                  errors.angkatan ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="2024"
              />
              {errors.angkatan && <p className="text-red-500 text-xs mt-1">{errors.angkatan}</p>}
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
              >
                <option value="active">Aktif</option>
                <option value="inactive">Tidak Aktif</option>
                <option value="graduated">Lulus</option>
              </select>
            </div>

            {/* Alamat */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="w-4 h-4 inline mr-1" />
                Alamat
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
                placeholder="Masukkan alamat lengkap"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-[#540002] rounded-lg hover:bg-[#6d0003] transition-colors flex items-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>{initialData ? 'Mengupdate…' : 'Menyimpan…'}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{initialData ? 'Update' : 'Simpan'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentForm;