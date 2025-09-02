import React, { useEffect, useState } from 'react';
import { X, Save, FileText, Calendar, DollarSign, Users } from 'lucide-react';
import { dbService, BillCategory } from '../../lib/mysql';
import { currencyIDR } from '../../lib/receipt';

interface BillFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (billData: any) => void;
  students: Array<{ nim_kashif: string; nim_dikti?: string | null; name: string; prodi: string }>;
}

const BillForm: React.FC<BillFormProps> = ({ isOpen, onClose, onSubmit, students }) => {
  const [formData, setFormData] = useState({
    category: '',
    categoryId: '' as string,
    description: '',
    amount: '',
    dueDate: '',
    targetStudents: 'all',
    selectedStudents: [] as string[],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<BillCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingCategories(true);
        const list = await dbService.getBillCategories(true);
        if (!mounted) return;
        setCategories(list);
      } catch (e) {
        console.warn('Gagal memuat kategori tagihan:', e);
      } finally {
        setLoadingCategories(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.categoryId) newErrors.category = 'Kategori tagihan wajib dipilih';
    if (!formData.description.trim()) newErrors.description = 'Deskripsi wajib diisi';
    if (!formData.amount.trim()) newErrors.amount = 'Nominal wajib diisi';
    if (!formData.dueDate) newErrors.dueDate = 'Tanggal jatuh tempo wajib dipilih';

    if (formData.targetStudents === 'selected' && formData.selectedStudents.length === 0) {
      newErrors.selectedStudents = 'Pilih minimal satu mahasiswa';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      try {
        setSubmitting(true);
        await Promise.resolve(onSubmit({
          ...formData,
          categoryId: formData.categoryId || null,
          amount: parseInt(formData.amount),
        }));
        onClose();
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const categoryId = e.target.value;
    const selected = categories.find(c => String(c.id) === String(categoryId));
    
    if (!selected) {
      // Reset to empty values if no category selected
      setFormData(prev => ({
        ...prev,
        categoryId: '',
        category: '',
        description: '',
        amount: '',
        dueDate: '',
      }));
      return;
    }
    
    // Auto-populate due date from default_due_days
    let dueDate = formData.dueDate;
    if (selected.default_due_days && Number(selected.default_due_days) > 0) {
      const d = new Date();
      d.setDate(d.getDate() + Number(selected.default_due_days));
      dueDate = d.toISOString().slice(0,10);
    }
    
    // Auto-populate amount from category
    const autoAmount = selected.default_amount ? String(Math.floor(Number(selected.default_amount))) : '';
    
    const newFormData = {
      ...formData,
      categoryId: String(categoryId), // Ensure consistent string type
      category: selected.name || '',
      description: selected.name || formData.description,
      amount: autoAmount, // Always auto-populate amount when category is selected
      dueDate,
    };
    
    setFormData(newFormData);
    
    // Clear any validation errors
    setErrors(prev => ({
      ...prev,
      category: '',
      amount: '',
      dueDate: '',
    }));
  };

  const handleStudentSelection = (nim_kashif: string) => {
    setFormData(prev => ({
      ...prev,
      selectedStudents: prev.selectedStudents.includes(nim_kashif)
        ? prev.selectedStudents.filter(s => s !== nim_kashif)
        : [...prev.selectedStudents, nim_kashif]
    }));
  };

  // Show all active categories (no type filtering needed)
  const visibleCategories = categories.filter(c => c.active !== false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Buat Tagihan Baru</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Bill Category (from master) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kategori Tagihan
                  <span className="text-xs text-blue-600 ml-1">(Pilih kategori untuk mengisi nominal otomatis)</span>
                </label>
                <select
                  name="categoryId"
                  value={formData.categoryId}
                  onChange={handleCategoryChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent ${
                    errors.category ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">{loadingCategories ? 'Memuat...' : 'Pilih Kategori Tagihan'}</option>
                  {visibleCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
                {visibleCategories.length === 0 && (
                  <p className="text-sm text-amber-600 mt-1">
                    ⚠️ Tidak ada kategori tagihan tersedia. 
                    <span className="text-blue-600 underline cursor-pointer">Tambahkan di Pengaturan → Kategori Tagihan</span>
                  </p>
                )}
                {formData.categoryId && (() => {
                  const selectedCat = categories.find(c => c.id === formData.categoryId);
                  return selectedCat && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-xs text-blue-700 font-medium">✓ Data otomatis terisi dari kategori:</p>
                      <ul className="text-xs text-blue-600 mt-1 space-y-1">
                        {selectedCat.default_amount && <li>• Nominal: {currencyIDR(selectedCat.default_amount)}</li>}
                        {selectedCat.default_due_days && <li>• Jatuh tempo: {selectedCat.default_due_days} hari</li>}
                      </ul>
                    </div>
                  );
                })()}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deskripsi
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent ${
                    errors.description ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Deskripsi tagihan..."
                />
                {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  Nominal (Rp)
                  {(() => {
                    const selectedCat = categories.find(c => c.id === formData.categoryId);
                    return selectedCat?.default_amount && formData.amount === String(selectedCat.default_amount) && (
                      <span className="text-xs text-green-600 ml-1">✓ Otomatis dari kategori</span>
                    );
                  })()}
                </label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent ${
                    errors.amount ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0"
                />
                {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
                {formData.amount && Number(formData.amount) > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Akan tampil sebagai: <span className="font-medium">{currencyIDR(Number(formData.amount))}</span>
                  </p>
                )}
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Tanggal Jatuh Tempo
                  {(() => {
                    const selectedCat = categories.find(c => c.id === formData.categoryId);
                    return selectedCat?.default_due_days && formData.dueDate && (
                      <span className="text-xs text-green-600 ml-1">✓ {selectedCat.default_due_days} hari dari hari ini</span>
                    );
                  })()}
                </label>
                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent ${
                    errors.dueDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.dueDate && <p className="text-red-500 text-xs mt-1">{errors.dueDate}</p>}
              </div>
            </div>

            {/* Right Column - Target Students */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Users className="w-4 h-4 inline mr-1" />
                  Target Mahasiswa
                </label>
                <select
                  name="targetStudents"
                  value={formData.targetStudents}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
                >
                  <option value="all">Semua Mahasiswa Aktif</option>
                  <option value="selected">Mahasiswa Terpilih</option>
                </select>
              </div>

              {formData.targetStudents === 'selected' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pilih Mahasiswa ({formData.selectedStudents.length} dipilih)
                  </label>
                  <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
                    {students.map((student) => (
                      <div
                        key={student.nim_kashif}
                        className="flex items-center space-x-3 p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={formData.selectedStudents.includes(student.nim_kashif)}
                          onChange={() => handleStudentSelection(student.nim_kashif)}
                          className="rounded border-gray-300 text-[#540002] focus:ring-[#540002]"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{student.name}</p>
                          <p className="text-xs text-gray-500">
                            KASHIF: {student.nim_kashif}
                            {student.nim_dikti && ` • DIKTI: ${student.nim_dikti}`}
                            {` • ${student.prodi}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {errors.selectedStudents && (
                    <div>
                      <p className="text-red-500 text-xs mt-1">{errors.selectedStudents}</p>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Jatuh Tempo:</span>
                        <span>{formData.dueDate && new Date(formData.dueDate).toLocaleDateString('id-ID')}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 mt-6">
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
                  <span>Membuat…</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Buat Tagihan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BillForm;