import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Download, 
  Edit, 
  Trash2,
  UserCheck,
  UserX,
  GraduationCap,
  Upload
} from 'lucide-react';
import Papa from 'papaparse';
import StudentForm from '../../components/Forms/StudentForm';
import { dbService, Student, supabase, Program } from '../../lib/mysql';
import { useToast } from '../../components/Toast/ToastProvider';

const StudentsManagement: React.FC = () => {
  const { showToast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [prodiFilter, setProdiFilter] = useState('all');
  const [jenjangFilter, setJenjangFilter] = useState('all');
  const [angkatanFilter, setAngkatanFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<{ open: boolean; unknownProdis: string[]; errors: string[] }>({ open: false, unknownProdis: [], errors: [] });
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [total, setTotal] = useState(0);
  const [globalStats, setGlobalStats] = useState<{ total: number; active: number; inactive: number; graduated: number }>({ total: 0, active: 0, inactive: 0, graduated: 0 });

  useEffect(() => {
    // initial: load programs
    loadPrograms();
    fetchStudentsGlobalStats();
  }, []);

  useEffect(() => {
    // fetch students whenever page or filters change
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchTerm, statusFilter, prodiFilter, jenjangFilter, angkatanFilter]);

  const loadStudents = async () => {
    const maxRetries = 2;
    const baseDelay = 300; // ms
    let attempt = 0;
    try {
      setLoading(true);
      while (attempt <= maxRetries) {
        try {
          const { data, total } = await dbService.getStudentsPaged({
            page,
            pageSize,
            search: searchTerm,
            status: statusFilter,
            prodi: prodiFilter,
            angkatan: angkatanFilter,
          });
          setStudents(data);
          setFilteredStudents(data);
          setTotal(total);
          break; // success
        } catch (err) {
          console.error('Error loading students (attempt %d):', attempt + 1, err);
          if (attempt < maxRetries) {
            const backoff = baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
            await new Promise((r) => setTimeout(r, backoff));
            attempt++;
            continue;
          }
          throw err;
        }
      }
    } catch (error) {
      console.error('Error loading students:', error);
      showToast({ type: 'error', title: 'Gagal memuat', message: 'Tidak dapat memuat data mahasiswa.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentsGlobalStats = async () => {
    try {
      const s = await dbService.getStudentsGlobalStats();
      setGlobalStats(s);
    } catch (error) {
      console.error('Error loading global student stats:', error);
    }
  };

  // (buildExportRows removed; export now fetches all filtered rows from server)

  const handleExportStudentsPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    // F4 (210 x 330 mm) in points ~ [595.28, 935.43]; use landscape
    const F4_PORTRAIT_PT: [number, number] = [595.28, 935.43];
    const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: F4_PORTRAIT_PT });
    const pageSize = doc.internal.pageSize;
    const pageWidth = (pageSize.getWidth ? pageSize.getWidth() : pageSize.width) as number;
    const title = 'Daftar Mahasiswa';
    doc.setFontSize(14);
    // Center title
    doc.text(title, pageWidth / 2, 40, { align: 'center' });
    // Filters summary
    const summary = [
      `Status: ${statusFilter === 'all' ? 'Semua' : statusFilter}`,
      `Prodi: ${prodiFilter === 'all' ? 'Semua' : prodiFilter}`,
      searchTerm ? `Cari: ${searchTerm}` : '',
      jenjangFilter !== 'all' ? `Jenjang: ${jenjangFilter}` : '',
      angkatanFilter !== 'all' ? `Angkatan: ${angkatanFilter}` : '',
    ].filter(Boolean).join(' | ');
    if (summary) {
      doc.setFontSize(10);
      doc.text(summary, 40, 58);
    }
    const headers = [
      'Nama', 'Email', 'NIM KASHIF', 'NIM DIKTI', 'Prodi', 'Jenjang', 'Angkatan', 'Status', 'Telepon', 'Alamat'
    ];
    // Fetch all filtered students (no pagination) for full export
    const allFiltered = await dbService.getStudentsAllFiltered({
      search: searchTerm,
      status: statusFilter,
      prodi: prodiFilter,
      angkatan: angkatanFilter,
    });
    const rows = allFiltered.map((s) => [
      s.name,
      s.email,
      s.nim_kashif,
      s.nim_dikti || '',
      s.prodi || '',
      getJenjang(s),
      s.angkatan || '',
      s.status,
      s.phone || '',
      s.address || '',
    ]);
    autoTable(doc, {
      startY: 70,
      head: [headers],
      body: rows,
      theme: 'grid',
      // allow wrapping so data is never cut; rows grow in height when needed
      styles: { fontSize: 9, cellPadding: 2, valign: 'middle', overflow: 'linebreak', minCellHeight: 14, halign: 'center' },
      headStyles: { fillColor: [84, 0, 2], textColor: [255,255,255], halign: 'center' },
      bodyStyles: { textColor: [40, 40, 40], halign: 'center' },
      margin: { top: 70, left: 20, right: 20 },
      columnStyles: {
        0: { cellWidth: 130 },   // Nama (wrap if needed)
        1: { cellWidth: 130 },  // Email (wider)
        2: { cellWidth: 60 },   // NIM KASHIF
        3: { cellWidth: 60 },   // NIM DIKTI
        4: { cellWidth: 90 },   // Prodi (a bit tighter)
        5: { cellWidth: 40 },   // Jenjang (narrow)
        6: { cellWidth: 45 },   // Angkatan (narrow)
        7: { cellWidth: 50 },   // Status (tighter)
        8: { cellWidth: 75 },   // Telepon (tighter)
        9: { cellWidth: 140 },  // Alamat (wider, wraps if needed)
      },
      didDrawPage: () => {
        // Footer page number
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.getHeight ? pageSize.getHeight() : pageSize.height;
        const pageWidth = pageSize.getWidth ? pageSize.getWidth() : pageSize.width;
        const page = doc.getNumberOfPages();
        doc.setFontSize(9);
        doc.text(`Halaman ${page}`, pageWidth - 80, pageHeight - 20);
      },
    });
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    doc.save(`Laporan_students_${ts}.pdf`);
  };

  const handleExportStudentsExcel = async () => {
    const ExcelJS: any = await import('exceljs');
    const maroon = 'FF540002';
    const white = 'FFFFFFFF';

    const wb = new ExcelJS.Workbook();
    wb.creator = 'PembayaranKampus';
    wb.created = new Date();

    const ws = wb.addWorksheet('Mahasiswa');
    ws.columns = [
      { width: 25 }, // Nama
      { width: 28 }, // Email
      { width: 14 }, // NIM KASHIF
      { width: 14 }, // NIM DIKTI
      { width: 22 }, // Prodi
      { width: 12 }, // Jenjang
      { width: 10 }, // Angkatan
      { width: 12 }, // Status
      { width: 16 }, // Telepon
      { width: 40 }, // Alamat
    ];

    const styleHeader = (rowIndex: number, colCount: number) => {
      const row = ws.getRow(rowIndex);
      for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: maroon } } as any;
        cell.font = { color: { argb: white }, bold: true } as any;
        cell.alignment = { vertical: 'middle', horizontal: 'left' } as any;
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        } as any;
      }
    };

    const header = ws.addRow(['Nama','Email','NIM KASHIF','NIM DIKTI','Prodi','Jenjang','Angkatan','Status','Telepon','Alamat']);
    styleHeader(header.number, 10);

    // Fetch all filtered students (no pagination) for full export
    const allFiltered = await dbService.getStudentsAllFiltered({
      search: searchTerm,
      status: statusFilter,
      prodi: prodiFilter,
      angkatan: angkatanFilter,
    });
    allFiltered.forEach((s) => {
      ws.addRow([
        s.name,
        s.email,
        s.nim_kashif,
        s.nim_dikti || '',
        s.prodi || '',
        getJenjang(s),
        s.angkatan || '',
        s.status,
        s.phone || '',
        s.address || '',
      ]);
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    a.download = `Laporan_students_${ts}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadPrograms = async () => {
    const maxRetries = 2;
    const baseDelay = 300;
    let attempt = 0;
    try {
      while (attempt <= maxRetries) {
        try {
          const list = await dbService.getPrograms();
          setPrograms(list);
          break;
        } catch (err) {
          if (attempt < maxRetries) {
            const backoff = baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
            await new Promise((r) => setTimeout(r, backoff));
            attempt++;
            continue;
          }
          throw err;
        }
      }
    } catch (error) {
      console.error('Error loading programs:', error);
      showToast({ type: 'error', title: 'Gagal memuat', message: 'Tidak dapat memuat daftar program studi.' });
    }
  };

  const getJenjang = (student: Student): string => {
    // Prefer lookup by program_id, fallback to prodi name match
    if (student.program_id) {
      const p = programs.find(p => p.id === student.program_id);
      if (p?.level) return p.level;
    }
    if (student.prodi) {
      const p = programs.find(p => p.name?.toLowerCase() === String(student.prodi).toLowerCase());
      if (p?.level) return p.level;
    }
    return '-';
  };

  const handleDownloadTemplate = () => {
    const header = ['name','email','nim_kashif','prodi','angkatan','nim_dikti','status','phone','address'];
    const example = ['Budi Santoso','budi@example.com','23A0001','Teknik Informatika','2023','23-12345','active','08123456789','Jl. Contoh 123'];
    const csvContent = [header.join(','), example.map(v => `"${String(v || '').replace(/"/g,'""')}"`).join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_mahasiswa.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  type CsvRow = Partial<Pick<Student, 'name'|'email'|'nim_kashif'|'nim_dikti'|'prodi'|'angkatan'|'status'>> & { phone?: string; address?: string };

  const openImportDialog = () => {
    fileInputRef.current?.click();
  };

  // Normalize phone numbers to Indonesian mobile format
  // - Keep leading zero
  // - Convert +62 / 62 prefix to 0
  // - If starts with 8 (likely Excel stripped 0), prepend 0
  const normalizePhone = (val: any): string | undefined => {
    let s = (val ?? '').toString().trim();
    if (!s) return undefined;
    // remove spaces and common separators
    s = s.replace(/[^0-9+]/g, '');
    if (!s) return undefined;
    if (s.startsWith('+62')) s = '0' + s.slice(3);
    else if (s.startsWith('62')) s = '0' + s.slice(2);
    else if (s.startsWith('8')) s = '0' + s; // Excel often drops leading 0
    // Ensure only digits
    s = s.replace(/\D/g, '');
    // Final sanity: must start with 0
    if (!s.startsWith('0') && s.length >= 9) s = '0' + s;
    return s || undefined;
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const parsed = await new Promise<Papa.ParseResult<CsvRow>>((resolve, reject) => {
        Papa.parse<CsvRow>(file, { header: true, skipEmptyLines: true, complete: resolve, error: reject });
      });

      // Track original row number for precise error messages (header at row 1)
      let rows = (parsed.data || []).map((r: CsvRow, i: number) => ({
        name: (r as any)?.name?.trim?.() || '',
        email: (r as any)?.email?.trim?.() || '',
        nim_kashif: (r as any)?.nim_kashif?.trim?.() || '',
        nim_dikti: (r as any)?.nim_dikti?.trim?.() || null,
        prodi: (r as any)?.prodi?.trim?.() || '',
        angkatan: (r as any)?.angkatan?.toString?.().trim?.() || '',
        status: ((r as any)?.status?.trim?.() || 'active') as Student['status'],
        phone: normalizePhone((r as any)?.phone),
        address: (r as any)?.address?.trim?.() || undefined,
        _rowNum: i + 2, // header row is 1
      }));

      // Basic validation and filtering
      const errors: string[] = [];
      rows = rows.filter((row: ReturnType<typeof Object> & any) => {
        const issues: string[] = [];
        if (!row.name) issues.push('name kosong');
        if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) issues.push('email tidak valid');
        if (!row.nim_kashif) issues.push('nim_kashif kosong');
        if (!row.prodi) issues.push('prodi kosong');
        if (!row.angkatan) issues.push('angkatan kosong');
        if (issues.length) {
          errors.push(`Baris ${row._rowNum}: ${issues.join(', ')}`);
          return false;
        }
        return true;
      });

      // Policy A: validate Program Studi strictly against programs list
      const normalize = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
      let programList = programs;
      if (!programList || programList.length === 0) {
        try {
          programList = await dbService.getPrograms();
        } catch (e) {
          console.warn('Gagal memuat daftar Program Studi saat import, menggunakan cache kosong.');
        }
      }
      const progMap = new Map<string, Program>((programList || []).map((p) => [normalize(p.name || ''), p]));

      const validatedRows: any[] = [];
      const unknownSet = new Set<string>();
      for (const row of rows) {
        const key = normalize(row.prodi);
        const p = progMap.get(key);
        if (!p) {
          errors.push(`Baris ${row._rowNum}: Program Studi '${row.prodi}' tidak terdaftar. Tambahkan di Pengaturan > Program Studi.`);
          if (row.prodi) unknownSet.add(row.prodi);
          continue; // fail-per-row
        }
        validatedRows.push({ ...row, program_id: p.id, prodi: p.name }); // standardize prodi label
      }

      if (validatedRows.length === 0) {
        showToast({ type: 'error', title: 'Import dibatalkan', message: 'Tidak ada baris valid pada CSV (cek kolom wajib dan Program Studi).' });
        if (errors.length) console.warn('CSV validation errors:', errors);
        // Show dialog summary so admin can jump to settings
        setImportSummary({ open: true, unknownProdis: Array.from(unknownSet), errors });
        return;
      }

      if (!window.confirm(`Import ${validatedRows.length} mahasiswa? Data dengan email/NIM sama akan diperbarui.`)) {
        return;
      }

      // Batch upsert students
      const BATCH = 100;
      let success = 0;
      let fail = 0;
      for (let i = 0; i < validatedRows.length; i += BATCH) {
        const batch = validatedRows.slice(i, i + BATCH);
        // Only send valid DB columns; drop helper fields like _rowNum
        const payload = batch.map((r: any) => ({
          name: r.name,
          email: String(r.email || '').toLowerCase().trim(),
          nim_kashif: r.nim_kashif,
          nim_dikti: r.nim_dikti ?? null,
          prodi: r.prodi,
          angkatan: r.angkatan,
          status: r.status,
          phone: r.phone ?? null,
          address: r.address ?? null,
          program_id: r.program_id ?? null,
        }));
        try {
          const { data, error } = await supabase
            .from('students')
            .upsert(payload as any, { onConflict: 'email' })
            .select();
          if (error) throw error;

          // Try to create auth user for each row in batch (function should be idempotent)
          for (const s of (data as any[]) || []) {
            try {
              await supabase.functions.invoke('create-student-user', {
                body: { studentId: s.id, email: s.email, name: s.name, mode: 'bulk' }
              });
            } catch (e) {
              // ignore per-row errors; will be summarized
            }
          }
          success += batch.length;
        } catch (err) {
          console.error('Batch upsert failed:', err);
          fail += batch.length;
        }
      }

      await loadStudents();
      await fetchStudentsGlobalStats();
      const msg = `Import selesai: ${success} sukses, ${fail} gagal${errors.length ? `, ${errors.length} baris dilewati (validasi)` : ''}.`;
      showToast({ type: fail ? 'warning' : 'success', title: 'Import CSV', message: msg });
      // Open summary dialog if there are unknown programs or validation errors
      if (errors.length || unknownSet.size) {
        setImportSummary({ open: true, unknownProdis: Array.from(unknownSet), errors });
      }
    } catch (err: any) {
      console.error('Import error:', err);
      showToast({ type: 'error', title: 'Gagal import', message: err?.message || 'Terjadi kesalahan saat membaca CSV.' });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Client-side filter is replaced by server-side filters; keep filteredStudents in sync with fetched page.

  const handleSubmit = async (studentData: any) => {
    try {
      if (editingStudent) {
        await dbService.updateStudent(editingStudent.id, studentData);
        showToast({ type: 'success', title: 'Tersimpan', message: 'Data mahasiswa berhasil diperbarui.' });
      } else {
        const created = await dbService.createStudent(studentData);
        // After creating student, invoke Edge Function to create auth user (default pwd) and link
        try {
          const { data: fnData, error: fnErr } = await supabase.functions.invoke('create-student-user', {
            body: {
              studentId: created.id,
              email: created.email,
              name: created.name,
              mode: 'direct'
            }
          });
          console.log('create-student-user response:', { fnData, fnErr });
          if (fnErr) {
            console.error('Error invoking create-student-user:', fnErr);
            const msg = typeof (fnErr as any)?.message === 'string' ? (fnErr as any).message : 'Akun auth gagal dibuat. Coba ulang dari menu aksi.';
            showToast({ type: 'warning', title: 'Mahasiswa dibuat', message: msg });
          } else if ((fnData as any)?.ok) {
            showToast({ type: 'success', title: 'Berhasil', message: 'Mahasiswa dibuat dan akun login disiapkan (password default: kamal123).' });
          } else {
            const msg = typeof (fnData as any)?.error === 'string' ? (fnData as any).error : 'Akun auth gagal dibuat. Coba ulang dari menu aksi.';
            showToast({ type: 'warning', title: 'Mahasiswa dibuat', message: msg });
          }
        } catch (err) {
          console.error('Failed to call create-student-user function:', err);
          showToast({ type: 'warning', title: 'Mahasiswa dibuat', message: 'Gagal membuat akun auth. Coba lagi nanti.' });
        }
      }
      await loadStudents();
      await fetchStudentsGlobalStats();
      setIsFormOpen(false);
      setEditingStudent(null);
    } catch (error: any) {
      console.error('Error saving student:', error);
      // Detail duplicate hints
      const msg: string = typeof error?.message === 'string' ? error.message : 'Terjadi kesalahan saat menyimpan data.';
      const isConflict = /duplicate|unique/i.test(msg);
      showToast({ type: 'error', title: isConflict ? 'Data duplikat' : 'Gagal menyimpan', message: isConflict ? 'Email atau NIM sudah terdaftar.' : msg });
    }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setIsFormOpen(true);
  };

  const handleDelete = async (student: Student) => {
    const warning = [
      `Anda akan menghapus mahasiswa: ${student.name}`,
      '',
      'CATATAN: Jika mahasiswa memiliki tagihan atau pembayaran,',
      'hapus data tersebut terlebih dahulu atau gunakan status "Tidak Aktif".',
      '',
      'Tindakan ini tidak dapat dibatalkan.',
      'Lanjutkan?'
    ].join('\n');
    if (window.confirm(warning)) {
      try {
        setDeletingId(student.id);
        
        // Try Edge Function first (for Supabase auth deletion)
        let edgeFunctionSuccess = false;
        try {
          const { data: fnData, error: fnErr } = await supabase.functions.invoke('delete-student-user', {
            body: { studentId: student.id, email: student.email },
          });
          
          if (!fnErr && (fnData as any)?.ok) {
            edgeFunctionSuccess = true;
          }
        } catch (edgeError) {
          console.warn('Edge function failed, using fallback:', edgeError);
        }
        
        // If Edge Function failed, use MySQL API as fallback
        if (!edgeFunctionSuccess) {
          console.log('Using MySQL API fallback for student deletion');
          try {
            await dbService.deleteStudent(student.id);
          } catch (deleteError: any) {
            // Handle specific case where student has related bills/payments
            if (deleteError.message && deleteError.message.includes('Cannot delete student')) {
              const errorMsg = deleteError.message;
              showToast({ 
                type: 'error', 
                title: 'Tidak dapat menghapus', 
                message: `Mahasiswa ${student.name} memiliki data tagihan atau pembayaran. Hapus tagihan/pembayaran terlebih dahulu atau gunakan fitur arsip.` 
              });
              return;
            }
            throw deleteError;
          }
        }
        
        await loadStudents();
        await fetchStudentsGlobalStats();
        showToast({ 
          type: 'success', 
          title: 'Terhapus', 
          message: edgeFunctionSuccess 
            ? 'Mahasiswa dan akun login berhasil dihapus permanen.' 
            : 'Mahasiswa berhasil dihapus dari database.' 
        });
      } catch (error) {
        console.error('Error deleting student:', error);
        showToast({ type: 'error', title: 'Gagal menghapus', message: 'Terjadi kesalahan saat menghapus mahasiswa.' });
      } finally {
        setDeletingId(null);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      active: 'bg-green-100 text-green-800 border-green-200',
      inactive: 'bg-red-100 text-red-800 border-red-200',
      graduated: 'bg-blue-100 text-blue-800 border-blue-200',
    };

    const labels = {
      active: 'Aktif',
      inactive: 'Tidak Aktif',
      graduated: 'Lulus',
    };

    const icons = {
      active: UserCheck,
      inactive: UserX,
      graduated: GraduationCap,
    };

    const Icon = icons[status as keyof typeof icons];

    return (
      <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium border ${badges[status as keyof typeof badges]}`}>
        <Icon className="w-3 h-3" />
        <span>{labels[status as keyof typeof labels]}</span>
      </span>
    );
  };

  const uniqueProdis = [...new Set(students.map(s => s.prodi))];
  const uniqueJenjangs = [...new Set(programs.map(p => p.level).filter(Boolean))] as string[];
  const uniqueAngkatans = [...new Set(students.map(s => s.angkatan).filter(Boolean))] as string[];

  // Invite flow removed; accounts are created directly with default password

  const stats = {
    total: globalStats.total,
    active: globalStats.active,
    inactive: globalStats.inactive,
    graduated: globalStats.graduated,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Import Summary Dialog */}
      {importSummary.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-xl rounded-lg shadow-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Ringkasan Import</h3>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setImportSummary({ open: false, unknownProdis: [], errors: [] })}
                aria-label="Tutup"
              >×</button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              {importSummary.errors.length > 0 && (
                <div>
                  <p className="font-medium text-gray-900 mb-2">Baris yang dilewati (validasi):</p>
                  <ul className="list-disc pl-5 space-y-1 text-gray-700 max-h-40 overflow-auto">
                    {importSummary.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              {importSummary.unknownProdis.length > 0 && (
                <div>
                  <p className="font-medium text-gray-900 mb-2">Program Studi tidak terdaftar:</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {importSummary.unknownProdis.map((p) => (
                      <span key={p} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">{p}</span>
                    ))}
                  </div>
                  <p className="text-gray-600">Tambahkan Program Studi di menu Pengaturan, lalu ulangi import.</p>
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
              <button
                className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => setImportSummary({ open: false, unknownProdis: [], errors: [] })}
              >Tutup</button>
              <button
                className="px-3 py-2 rounded-lg bg-[#540002] text-white hover:bg-[#6d0003]"
                onClick={() => { setImportSummary({ open: false, unknownProdis: [], errors: [] }); window.location.href = '/admin/settings'; }}
              >Buka Pengaturan Program Studi</button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kelola Mahasiswa</h1>
          <p className="text-gray-600 mt-1">Manajemen data mahasiswa dan informasi akademik</p>
        </div>
        
        <div className="w-full sm:w-auto flex flex-wrap items-center justify-start sm:justify-end gap-2">
          {/* Primary action */}
          <button
            onClick={() => {
              setEditingStudent(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center gap-2 h-10 px-4 bg-[#540002] text-white rounded-lg hover:bg-[#6d0003] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Mahasiswa</span>
          </button>

          {/* Secondary actions grouped */}
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-2 h-10 px-3 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Template CSV</span>
              <span className="sm:hidden">Template</span>
            </button>
            <button
              type="button"
              onClick={openImportDialog}
              disabled={isImporting}
              className="inline-flex items-center gap-2 h-10 px-3 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 border-l border-gray-200"
            >
              <Upload className="w-4 h-4" />
              <span>{isImporting ? 'Mengimpor…' : 'Import CSV'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportStudentsPDF}
              className="inline-flex items-center gap-2 h-10 px-3 text-gray-700 hover:bg-gray-50 transition-colors border-l border-gray-200"
              title="Export PDF (mengikuti filter)"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export PDF</span>
              <span className="sm:hidden">PDF</span>
            </button>
            <button
              type="button"
              onClick={handleExportStudentsExcel}
              className="inline-flex items-center gap-2 h-10 px-3 text-gray-700 hover:bg-gray-50 transition-colors border-l border-gray-200"
              title="Export Excel (mengikuti filter)"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export Excel</span>
              <span className="sm:hidden">Excel</span>
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onFileSelected}
          />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Mahasiswa</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Mahasiswa Aktif</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
            <UserCheck className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tidak Aktif</p>
              <p className="text-2xl font-bold text-red-600">{stats.inactive}</p>
            </div>
            <UserX className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Lulus</p>
              <p className="text-2xl font-bold text-blue-600">{stats.graduated}</p>
            </div>
            <GraduationCap className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 min-w-[280px]">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari mahasiswa (nama, NIM KASHIF, NIM DIKTI, email)..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 w-full lg:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Tidak Aktif</option>
              <option value="graduated">Lulus</option>
            </select>
            <select
              value={prodiFilter}
              onChange={(e) => { setProdiFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
            >
              <option value="all">Semua Prodi</option>
              {uniqueProdis.map(prodi => (
                <option key={prodi} value={prodi}>{prodi}</option>
              ))}
            </select>
            <select
              value={jenjangFilter}
              onChange={(e) => { setJenjangFilter(e.target.value); setPage(1); }}
              className="w-full sm:w-40 lg:w-36 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
            >
              <option value="all">Semua Jenjang</option>
              {uniqueJenjangs.map(j => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
            <select
              value={angkatanFilter}
              onChange={(e) => { setAngkatanFilter(e.target.value); setPage(1); }}
              className="w-full sm:w-40 lg:w-36 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#540002] focus:border-transparent"
            >
              <option value="all">Semua Angkatan</option>
              {uniqueAngkatans.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Students List (mobile) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {/* Cards - show on small screens */}
        <div className="block sm:hidden">
          {loading ? (
            <div className="px-4 py-12 text-center text-gray-500">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-[#540002]/30 border-t-[#540002] rounded-full animate-spin"></div>
                <span>Memuat data...</span>
              </div>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-500">Tidak ada data mahasiswa yang ditemukan</div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
              {filteredStudents.map((student) => (
                <li key={student.id} className="p-4 border border-gray-100 rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-500">Mahasiswa</p>
                      <p className="text-base font-semibold text-gray-900">{student.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        KASHIF: {student.nim_kashif}
                        {student.nim_dikti && <span className="ml-1">• DIKTI: {student.nim_dikti}</span>}
                      </p>
                    </div>
                    {getStatusBadge(student.status)}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Program Studi</p>
                      <p className="font-medium text-gray-900">{student.prodi || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Jenjang</p>
                      <p className="font-medium text-gray-900">{getJenjang(student)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Angkatan</p>
                      <p className="font-medium text-gray-900">{student.angkatan || '-'}</p>
                    </div>
                  </div>
                  <div className="mt-3 text-sm">
                    <p className="text-gray-500">Kontak</p>
                    <p className="text-gray-900">{student.email}</p>
                    {student.phone && <p className="text-gray-500">{student.phone}</p>}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={() => handleEdit(student)}
                      className="px-3 py-1.5 rounded border border-gray-300 text-blue-700 hover:bg-gray-50 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(student)}
                      disabled={deletingId === student.id}
                      className="px-3 py-1.5 rounded border border-red-300 text-red-700 hover:bg-red-50 text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {deletingId === student.id ? (
                        <>
                          <div className="w-4 h-4 border-2 border-red-300/60 border-t-red-600 rounded-full animate-spin" />
                          <span>Menghapus…</span>
                        </>
                      ) : (
                        <span>Hapus</span>
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Table - show on sm and above */}
        <div className="hidden sm:block">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Mahasiswa
                </th>
                <th className="px-4 py-2 text-center text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Program Studi
                </th>
                <th className="px-4 py-2 text-center text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Jenjang
                </th>
                <th className="px-4 py-2 text-center text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Angkatan
                </th>
                <th className="px-4 py-2 text-center text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Status
                </th>
                <th className="px-4 py-2 text-center text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Kontak
                </th>
                <th className="px-4 py-2 text-center text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Aksi
                </th>
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
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    Tidak ada data mahasiswa yang ditemukan
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {student.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          KASHIF: {student.nim_kashif}
                          {student.nim_dikti && (
                            <span className="ml-2">• DIKTI: {student.nim_dikti}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm text-gray-900">{student.prodi}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm text-gray-900">{getJenjang(student)}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm text-gray-900">{student.angkatan}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getStatusBadge(student.status)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm text-gray-900">{student.email}</div>
                      {student.phone && (
                        <div className="text-sm text-gray-500">{student.phone}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleEdit(student)}
                          className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(student)}
                          disabled={deletingId === student.id}
                          className={`p-1 transition-colors ${deletingId === student.id ? 'text-red-300 cursor-wait' : 'text-red-600 hover:text-red-800'}`}
                          title="Hapus"
                        >
                          {deletingId === student.id ? (
                            <div className="w-4 h-4 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
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
        {filteredStudents.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              {(() => {
                const start = (page - 1) * pageSize + 1;
                const end = Math.min(page * pageSize, total);
                const totalPages = Math.max(1, Math.ceil(total / pageSize));
                return (
                  <>
                    <p className="text-sm text-gray-500">
                      Menampilkan {start}-{end} dari {total} mahasiswa
                    </p>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className={`px-3 py-1 text-sm border border-gray-300 rounded transition-colors ${page <= 1 ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                        aria-label="Halaman sebelumnya"
                      >
                        Sebelumnya
                      </button>
                      <span className="text-sm text-gray-500">Hal. {page} / {totalPages}</span>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className={`px-3 py-1 text-sm border border-gray-300 rounded transition-colors ${page >= totalPages ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                        aria-label="Halaman selanjutnya"
                      >
                        Selanjutnya
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Student Form Modal */}
      <StudentForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingStudent(null);
        }}
        onSubmit={handleSubmit}
        initialData={editingStudent}
      />
    </div>
  );
};

export default StudentsManagement;