import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL. Create .env.local from .env.example and set your Supabase URL.');
}

if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY. Create .env.local from .env.example and set your Supabase anon public key.');
}

// A resilient fetch with timeout and retry for transient network issues
const defaultFetch: typeof fetch = (typeof window !== 'undefined' && window.fetch) ? window.fetch.bind(window) : fetch;

async function fetchWithTimeoutRetry(input: RequestInfo | URL, init?: RequestInit, options?: { timeoutMs?: number; retries?: number; baseDelayMs?: number }) {
  const method = (init?.method || 'GET').toUpperCase();
  const isIdempotent = method === 'GET' || method === 'HEAD';
  const urlStr = typeof input === 'string'
    ? input
    : (input instanceof URL
        ? input.toString()
        : (typeof (input as any)?.url === 'string' ? (input as any).url : String(input)));
  const isSupabaseRpc = urlStr.includes('/rest/v1/rpc/');
  const isSupabaseFunction = urlStr.includes('.functions.supabase.co') || urlStr.includes('/functions/v1/');
  const isSupabaseAuth = urlStr.includes('/auth/v1/');

  // Functions can cold-start and take longer; Auth endpoints may also need more time under load.
  const timeoutMs = options?.timeoutMs ?? (
    isSupabaseFunction ? 20000 :
    isSupabaseRpc ? 15000 :
    isSupabaseAuth ? 20000 :
    8000
  );
  // Avoid retrying non-idempotent methods to prevent duplicate writes, but allow 1 retry for Auth (safe sign-in retry)
  const retries = options?.retries ?? (isIdempotent ? 2 : (isSupabaseAuth ? 1 : 0)); // total attempts = retries + 1
  const baseDelayMs = options?.baseDelayMs ?? 300;

  let attempt = 0;
  let lastError: any = null;

  // Helper: sleep with jitter
  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

  while (attempt <= retries) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await defaultFetch(input, { ...init, signal: controller.signal });
      clearTimeout(id);
      // Retry on certain transient server errors
      if ([502, 503, 504].includes(res.status)) {
        lastError = new Error(`Transient HTTP ${res.status}`);
        throw lastError;
      }
      return res;
    } catch (err: any) {
      clearTimeout(id);
      lastError = err;
      const isAbort = err?.name === 'AbortError';
      const isNetwork = err instanceof TypeError; // fetch network failure commonly TypeError
      if (attempt < retries && (isAbort || isNetwork)) {
        const backoff = baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
        await sleep(backoff);
        attempt++;
        continue;
      }
      // Add clearer context for aborted/timeouts
      if (isAbort) {
        const e = new Error(`AbortError: request timed out after ${timeoutMs}ms (${method} ${urlStr})`);
        (e as any).name = 'AbortError';
        throw e;
      }
      throw err;
    }
  }

  // Should not reach here, but throw last error just in case
  throw lastError ?? new Error('Unknown fetch error');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    // Let the wrapper decide timeout/retries based on method and URL
    fetch: (input, init) => fetchWithTimeoutRetry(input, init),
  },
});

// Sanitize user search string to be safe inside PostgREST or() expression
// - Remove commas which are used as separators in or()
// - Trim and collapse excessive spaces
// - Keep basic characters; this avoids 400 parse errors on complex inputs
function sanitizeSearch(s?: string): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  // Replace commas to avoid breaking the or() CSV syntax
  const noCommas = trimmed.replace(/[,]/g, ' ');
  // Basic collapse spaces
  return noCommas.replace(/\s+/g, ' ');
}

// Database types
export interface Student {
  id: string;
  nim_kashif: string;
  nim_dikti?: string | null;
  name: string;
  email: string;
  phone?: string;
  prodi: string;
  angkatan: string;
  address?: string;
  status: 'active' | 'inactive' | 'graduated';
  created_at: string;
  updated_at: string;
  // normalized relation to programs table (optional for backward compatibility)
  program_id?: string | null;
}

export interface Bill {
  id: string;
  student_id: string;
  type: 'fixed' | 'installment';
  category?: string | null;
  description: string;
  amount: number;
  due_date: string;
  status: 'paid' | 'unpaid' | 'partial';
  paid_amount: number;
  installment_count?: number;
  installment_amount?: number;
  // normalized relation to bill_categories (optional for backward compatibility)
  category_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillCategory {
  id: string;
  name: string;
  active: boolean;
  default_amount?: number | null;
  default_due_days?: number | null;
  // New defaults for type and installment behavior (all optional)
  default_type?: 'fixed' | 'installment' | null;
  default_installment_count?: number | null;
  default_installment_amount?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  bill_id: string;
  student_id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  receipt_number: string;
  status: 'completed' | 'pending' | 'failed';
  created_at: string;
}

export interface Program {
  id: string;
  code: string;
  name: string;
  faculty?: string | null;
  level?: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

// Database functions
export const dbService = {
  // Students
  async getStudents() {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async deletePayment(id: string): Promise<void> {
    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Payments global statistics via client-side aggregation (robust)
  async getPaymentsGlobalStats(params?: {
    search?: string;
    method?: string | 'all';
    dateRange?: 'all' | 'today' | 'week' | 'month';
  }): Promise<{
    total: number;
    completed: number;
    pending: number;
    failed: number;
    totalAmountCompleted: number;
    todayAmountCompleted: number;
  }> {
    const rows = await this.getPaymentsAllFiltered({
      search: params?.search,
      status: 'all',
      method: params?.method,
      dateRange: params?.dateRange,
    });

    let total = 0, completed = 0, pending = 0, failed = 0;
    let totalAmountCompleted = 0, todayAmountCompleted = 0;
    const todayStr = new Date().toISOString().split('T')[0];

    for (const p of rows as any[]) {
      total += 1;
      if (p.status === 'completed') {
        completed += 1;
        const amt = Number(p.amount || 0);
        totalAmountCompleted += amt;
        const payDateStr = String(p.payment_date).slice(0, 10);
        if (payDateStr >= todayStr) todayAmountCompleted += amt;
      } else if (p.status === 'pending') {
        pending += 1;
      } else if (p.status === 'failed') {
        failed += 1;
      }
    }

    return { total, completed, pending, failed, totalAmountCompleted, todayAmountCompleted };
  },

  // Students (paginated + basic filters)
  async getStudentsPaged(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string; // 'active' | 'inactive' | 'graduated'
    prodi?: string;
    angkatan?: string;
  }): Promise<{ data: Student[]; total: number }> {
    const page = Math.max(1, params?.page ?? 1);
    const pageSize = Math.max(1, params?.pageSize ?? 20);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('students')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (params?.status && params.status !== 'all') {
      query = query.eq('status', params.status);
    }
    if (params?.prodi && params.prodi !== 'all') {
      query = query.eq('prodi', params.prodi);
    }
    if (params?.angkatan && params.angkatan !== 'all') {
      query = query.eq('angkatan', params.angkatan);
    }
    if (params?.search && params.search.trim()) {
      const s = params.search.trim();
      // Match name, nim_kashif, nim_dikti, email
      query = query.or(
        [
          `name.ilike.%${s}%`,
          `nim_kashif.ilike.%${s}%`,
          `nim_dikti.ilike.%${s}%`,
          `email.ilike.%${s}%`,
        ].join(',')
      );
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: (data as Student[]) || [], total: count ?? 0 };
  },

  // Students (non-paginated, for export-all with same filters)
  async getStudentsAllFiltered(params?: {
    search?: string;
    status?: string; // 'active' | 'inactive' | 'graduated' | 'all'
    prodi?: string;  // specific prodi or 'all'
    angkatan?: string; // specific year or 'all'
  }): Promise<Student[]> {
    let query = supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false });

    if (params?.status && params.status !== 'all') {
      query = query.eq('status', params.status);
    }
    if (params?.prodi && params.prodi !== 'all') {
      query = query.eq('prodi', params.prodi);
    }
    if (params?.angkatan && params.angkatan !== 'all') {
      query = query.eq('angkatan', params.angkatan);
    }
    if (params?.search && params.search.trim()) {
      const s = params.search.trim();
      query = query.or([
        `name.ilike.%${s}%`,
        `nim_kashif.ilike.%${s}%`,
        `nim_dikti.ilike.%${s}%`,
        `email.ilike.%${s}%`,
      ].join(','));
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as Student[]) || [];
  },

  // Get latest payment for a specific bill (to show receipt)
  async getLatestPaymentForBill(billId: string) {
    const { data, error } = await supabase
      .from('payments')
      .select('id')
      .eq('bill_id', billId)
      .order('payment_date', { ascending: false })
      .limit(1);
    if (error) throw error;
    return (data && data[0]) ? data[0] : null;
  },

  // Programs (Program Studi)
  async getPrograms(): Promise<Program[]> {
    const { data, error } = await supabase
      .from('programs')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data as Program[];
  },

  async createProgram(program: Omit<Program, 'id' | 'created_at' | 'updated_at'>): Promise<Program> {
    const { data, error } = await supabase
      .from('programs')
      .insert([program])
      .select()
      .single();
    if (error) throw error;
    return data as Program;
  },

  async updateProgram(id: string, updates: Partial<Omit<Program, 'id' | 'created_at' | 'updated_at'>>): Promise<Program> {
    const { data, error } = await supabase
      .from('programs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Program;
  },

  async deleteProgram(id: string): Promise<void> {
    const { error } = await supabase.from('programs').delete().eq('id', id);
    if (error) throw error;
  },

  async createStudent(student: Omit<Student, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('students')
      .insert([student])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateStudent(id: string, updates: Partial<Student>) {
    const { data, error } = await supabase
      .from('students')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteStudent(id: string) {
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Bills
  async getBills(studentId?: string) {
    let query = supabase
      .from('bills')
      .select(`
        *,
        bill_categories (
          id,
          name
        ),
        students (
          nim_kashif,
          nim_dikti,
          name,
          prodi
        )
      `)
      .order('created_at', { ascending: false });

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // Bills (paginated + basic filters)
  async getBillsPaged(params?: {
    page?: number;
    pageSize?: number;
    search?: string; // match description/category name
    status?: 'paid' | 'unpaid' | 'partial' | 'all';
    type?: 'fixed' | 'installment' | 'all';
  }): Promise<{ data: any[]; total: number }> {
    const page = Math.max(1, params?.page ?? 1);
    const pageSize = Math.max(1, params?.pageSize ?? 20);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Count first (safer with joins)
    let countQuery = supabase.from('bills').select('*', { count: 'exact', head: true });
    if (params?.status && params.status !== 'all') countQuery = countQuery.eq('status', params.status);
    if (params?.type && params.type !== 'all') countQuery = countQuery.eq('type', params.type);
    const safeSearch = sanitizeSearch(params?.search || undefined);
    if (safeSearch) {
      countQuery = countQuery.or(
        [
          `description.ilike.%${safeSearch}%`,
          `category.ilike.%${safeSearch}%`,
        ].join(',')
      );
    }
    const { count, error: countErr } = await countQuery;
    if (countErr) throw countErr;

    let query = supabase
      .from('bills')
      .select(`
        *,
        bill_categories ( id, name ),
        students ( nim_kashif, nim_dikti, name, prodi )
      `)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (params?.status && params.status !== 'all') query = query.eq('status', params.status);
    if (params?.type && params.type !== 'all') query = query.eq('type', params.type);
    if (safeSearch) {
      // Try to also match by related category name safely by prefetching matching category IDs
      let categoryIds: string[] = [];
      // And match by student (name/nim) by prefetching matching student IDs
      let studentIds: string[] = [];
      try {
        const [catsRes, studsRes] = await Promise.all([
          supabase
            .from('bill_categories')
            .select('id')
            .ilike('name', `%${safeSearch}%`)
            .limit(100),
          supabase
            .from('students')
            .select('id')
            .or([
              `name.ilike.%${safeSearch}%`,
              `nim_kashif.ilike.%${safeSearch}%`,
              `nim_dikti.ilike.%${safeSearch}%`,
            ].join(','))
            .limit(200),
        ] as any);
        if (catsRes?.error) throw catsRes.error;
        if (studsRes?.error) throw studsRes.error;
        categoryIds = (catsRes?.data || []).map((c: any) => c.id).filter(Boolean);
        studentIds = (studsRes?.data || []).map((s: any) => s.id).filter(Boolean);
      } catch (_) {
        // ignore lookup failure; fallback to base fields only
      }

      const orParts = [
        `description.ilike.%${safeSearch}%`,
        `category.ilike.%${safeSearch}%`,
      ];
      if (categoryIds.length > 0) {
        // Build in.(...)
        const inList = categoryIds.join(',');
        orParts.push(`category_id.in.(${inList})`);
      }
      if (studentIds.length > 0) {
        const inListStud = studentIds.join(',');
        orParts.push(`student_id.in.(${inListStud})`);
      }
      query = query.or(orParts.join(','));
    }

    const { data, error } = await query;
    if (error) throw error;
    return { data: (data as any[]) || [], total: count ?? 0 };
  },

  // Payments (non-paginated, for export-all with same filters)
  async getPaymentsAllFiltered(params?: {
    search?: string; // match receipt_number or bill category/description
    status?: 'completed' | 'pending' | 'failed' | 'all';
    method?: string | 'all';
    dateRange?: 'all' | 'today' | 'week' | 'month';
  }): Promise<any[]> {
    // Build date filter boundaries (same as paged)
    let dateFrom: string | null = null;
    if (params?.dateRange && params.dateRange !== 'all') {
      const now = new Date();
      const d = new Date(now);
      if (params.dateRange === 'today') {
        d.setHours(0, 0, 0, 0);
      } else if (params.dateRange === 'week') {
        d.setDate(now.getDate() - 7);
      } else if (params.dateRange === 'month') {
        d.setMonth(now.getMonth() - 1);
      }
      dateFrom = d.toISOString().split('T')[0];
    }

    let query = supabase
      .from('payments')
      .select(`
        *,
        bills (
          category,
          description,
          bill_categories ( name )
        ),
        students (
          nim_kashif,
          nim_dikti,
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (params?.status && params.status !== 'all') query = query.eq('status', params.status);
    if (params?.method && params.method !== 'all') query = query.eq('payment_method', params.method);
    if (dateFrom) query = query.gte('payment_date', dateFrom);
    const safeSearch2 = sanitizeSearch(params?.search || undefined);
    if (safeSearch2) {
      // Lookup matching bill IDs by description/category/category name to avoid complex or across relations
      let billIds: string[] = [];
      // Lookup matching student IDs by name or NIM
      let studentIds: string[] = [];
      try {
        const [billsMatchRes, billsByCatNameRes, studentsRes] = await Promise.all([
          supabase
            .from('bills')
            .select('id')
            .or([
              `description.ilike.%${safeSearch2}%`,
              `category.ilike.%${safeSearch2}%`,
            ].join(','))
            .limit(200),
          supabase
            .from('bills')
            .select('id, bill_categories!inner(name)')
            .ilike('bill_categories.name', `%${safeSearch2}%`)
            .limit(200),
          supabase
            .from('students')
            .select('id')
            .or([
              `name.ilike.%${safeSearch2}%`,
              `nim_kashif.ilike.%${safeSearch2}%`,
              `nim_dikti.ilike.%${safeSearch2}%`,
            ].join(','))
            .limit(200),
        ] as any);
        if (billsMatchRes?.error) throw billsMatchRes.error;
        if (billsByCatNameRes?.error) throw billsByCatNameRes.error;
        if (studentsRes?.error) throw studentsRes.error;
        const ids1 = (billsMatchRes?.data || []).map((b: any) => b.id).filter(Boolean);
        const ids2 = (billsByCatNameRes?.data || []).map((b: any) => b.id).filter(Boolean);
        billIds = Array.from(new Set([...ids1, ...ids2]));
        studentIds = (studentsRes?.data || []).map((s: any) => s.id).filter(Boolean);
      } catch (_) {
        // ignore lookup failures
      }

      const orParts = [`receipt_number.ilike.%${safeSearch2}%`];
      if (billIds.length > 0) orParts.push(`bill_id.in.(${billIds.join(',')})`);
      if (studentIds.length > 0) orParts.push(`student_id.in.(${studentIds.join(',')})`);
      query = query.or(orParts.join(','));
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as any[]) || [];
  },

  // Bills (non-paginated, for export-all with same filters)
  async getBillsAllFiltered(params?: {
    search?: string; // match description/category name or category from relation
    status?: 'paid' | 'unpaid' | 'partial' | 'all';
    type?: 'fixed' | 'installment' | 'all';
  }): Promise<any[]> {
    let query = supabase
      .from('bills')
      .select(`
        *,
        bill_categories ( id, name ),
        students ( nim_kashif, nim_dikti, name, prodi )
      `)
      .order('created_at', { ascending: false });

    if (params?.status && params.status !== 'all') query = query.eq('status', params.status);
    if (params?.type && params.type !== 'all') query = query.eq('type', params.type);
    const safeSearch3 = sanitizeSearch(params?.search || undefined);
    if (safeSearch3) {
      // Pre-resolve category IDs and student IDs to avoid heavy or() across relations
      let categoryIds: string[] = [];
      let studentIds: string[] = [];
      try {
        const [{ data: cats }, { data: studs }] = await Promise.all([
          supabase.from('bill_categories').select('id').ilike('name', `%${safeSearch3}%`).limit(100),
          supabase
            .from('students')
            .select('id')
            .or([
              `name.ilike.%${safeSearch3}%`,
              `nim_kashif.ilike.%${safeSearch3}%`,
              `nim_dikti.ilike.%${safeSearch3}%`,
            ].join(','))
            .limit(200),
        ] as any);
        categoryIds = (cats || []).map((c: any) => c.id).filter(Boolean);
        studentIds = (studs || []).map((s: any) => s.id).filter(Boolean);
      } catch (_) {}

      const orParts = [
        `description.ilike.%${safeSearch3}%`,
        `category.ilike.%${safeSearch3}%`,
      ];
      if (categoryIds.length > 0) orParts.push(`category_id.in.(${categoryIds.join(',')})`);
      if (studentIds.length > 0) orParts.push(`student_id.in.(${studentIds.join(',')})`);
      query = query.or(orParts.join(','));
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as any[]) || [];
  },

  // Payments global statistics with filters (matches count logic above)
  async getPaymentsStats(params?: {
    search?: string;
    method?: string | 'all';
    dateRange?: 'all' | 'today' | 'week' | 'month';
  }): Promise<{
    total: number;
    completed: number;
    pending: number;
    failed: number;
    totalAmountCompleted: number;
    todayAmountCompleted: number;
  }> {
    // Build date filter boundaries
    let dateFrom: string | null = null;
    if (params?.dateRange && params.dateRange !== 'all') {
      const now = new Date();
      const d = new Date(now);
      if (params.dateRange === 'today') {
        d.setHours(0, 0, 0, 0);
      } else if (params.dateRange === 'week') {
        d.setDate(now.getDate() - 7);
      } else if (params.dateRange === 'month') {
        d.setMonth(now.getMonth() - 1);
      }
      dateFrom = d.toISOString().split('T')[0];
    }

    const applyCommonFilters = (q: any) => {
      let query = q;
      if (params?.method && params.method !== 'all') query = query.eq('payment_method', params.method);
      if (dateFrom) query = query.gte('payment_date', dateFrom);
      if (params?.search && params.search.trim()) {
        const s = params.search.trim();
        query = query.or([`receipt_number.ilike.%${s}%`].join(','));
      }
      return query;
    };

    // Counts
    const totalCountPromise = applyCommonFilters(supabase.from('payments').select('*', { count: 'exact', head: true }));
    const completedCountPromise = applyCommonFilters(supabase.from('payments').select('*', { count: 'exact', head: true })).eq('status', 'completed');
    const pendingCountPromise = applyCommonFilters(supabase.from('payments').select('*', { count: 'exact', head: true })).eq('status', 'pending');
    const failedCountPromise = applyCommonFilters(supabase.from('payments').select('*', { count: 'exact', head: true })).eq('status', 'failed');

    // Sums for completed
    const totalAmountCompletedPromise = applyCommonFilters(supabase.from('payments').select('total:amount.sum()')).eq('status', 'completed');
    const todayStr = new Date().toISOString().split('T')[0];
    const todayAmountCompletedPromise = applyCommonFilters(supabase.from('payments').select('total:amount.sum()')).eq('status', 'completed').gte('payment_date', todayStr);

    const [totalRes, compRes, pendRes, failRes, sumRes, sumTodayRes] = await Promise.all([
      totalCountPromise,
      completedCountPromise,
      pendingCountPromise,
      failedCountPromise,
      totalAmountCompletedPromise,
      todayAmountCompletedPromise,
    ]);

    if (totalRes.error) throw totalRes.error;
    if (compRes.error) throw compRes.error;
    if (pendRes.error) throw pendRes.error;
    if (failRes.error) throw failRes.error;
    if (sumRes.error) throw sumRes.error;
    if (sumTodayRes.error) throw sumTodayRes.error;

    const total = (totalRes.count ?? 0);
    const completed = (compRes.count ?? 0);
    const pending = (pendRes.count ?? 0);
    const failed = (failRes.count ?? 0);

    // sum result comes as [{ total: number | null }] or []
    const totalAmountCompleted = Array.isArray(sumRes.data) && sumRes.data[0] && typeof (sumRes.data[0] as any).total === 'number'
      ? (sumRes.data[0] as any).total
      : 0;
    const todayAmountCompleted = Array.isArray(sumTodayRes.data) && sumTodayRes.data[0] && typeof (sumTodayRes.data[0] as any).total === 'number'
      ? (sumTodayRes.data[0] as any).total
      : 0;

    return { total, completed, pending, failed, totalAmountCompleted, todayAmountCompleted };
  },

  async createBill(bill: Omit<Bill, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('bills')
      .insert([bill])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async createBills(bills: Array<Omit<Bill, 'id' | 'created_at' | 'updated_at'>>) {
    const { data, error } = await supabase
      .from('bills')
      .insert(bills)
      .select();
    if (error) throw error;
    return data;
  },

  async deleteBill(id: string) {
    const { error } = await supabase
      .from('bills')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async updateBill(id: string, updates: Partial<Bill>) {
    const { data, error } = await supabase
      .from('bills')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Bill Categories (master)
  async getBillCategories(onlyActive: boolean = true): Promise<BillCategory[]> {
    let q = supabase
      .from('bill_categories')
      .select('*')
      .order('name', { ascending: true });
    if (onlyActive) q = q.eq('active', true);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as BillCategory[];
  },

  async createBillCategory(category: Omit<BillCategory, 'id' | 'created_at' | 'updated_at'>): Promise<BillCategory> {
    const { data, error } = await supabase
      .from('bill_categories')
      .insert([category])
      .select()
      .single();
    if (error) throw error;
    return data as BillCategory;
  },

  async updateBillCategory(id: string, updates: Partial<Omit<BillCategory, 'id' | 'created_at' | 'updated_at'>>): Promise<BillCategory> {
    const { data, error } = await supabase
      .from('bill_categories')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data as BillCategory;
  },

  async deleteBillCategory(id: string): Promise<void> {
    const { error } = await supabase
      .from('bill_categories')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Payments
  async getPayments(studentId?: string) {
    let query = supabase
      .from('payments')
      .select(`
        *,
        bills (
          category,
          description,
          bill_categories (
            name
          )
        ),
        students (
          nim_kashif,
          nim_dikti,
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // Payments (paginated + basic filters)
  async getPaymentsPaged(params?: {
    page?: number;
    pageSize?: number;
    search?: string; // match receipt_number or bill category/description
    status?: 'completed' | 'pending' | 'failed' | 'all';
    method?: string | 'all';
    dateRange?: 'all' | 'today' | 'week' | 'month';
  }): Promise<{ data: any[]; total: number }> {
    const page = Math.max(1, params?.page ?? 1);
    const pageSize = Math.max(1, params?.pageSize ?? 20);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Build date filter boundaries
    let dateFrom: string | null = null;
    if (params?.dateRange && params.dateRange !== 'all') {
      const now = new Date();
      const d = new Date(now);
      if (params.dateRange === 'today') {
        d.setHours(0, 0, 0, 0);
      } else if (params.dateRange === 'week') {
        d.setDate(now.getDate() - 7);
      } else if (params.dateRange === 'month') {
        d.setMonth(now.getMonth() - 1);
      }
      dateFrom = d.toISOString().split('T')[0];
    }

    // Count query (no joins for safety), but mirror search via prefetch IDs
    let countQuery = supabase.from('payments').select('*', { count: 'exact', head: true });
    if (params?.status && params.status !== 'all') countQuery = countQuery.eq('status', params.status);
    if (params?.method && params.method !== 'all') countQuery = countQuery.eq('payment_method', params.method);
    if (dateFrom) countQuery = countQuery.gte('payment_date', dateFrom);
    const safeSearch4 = sanitizeSearch(params?.search || undefined);
    if (safeSearch4) {
      let billIdsC: string[] = [];
      let studentIdsC: string[] = [];
      try {
        const [billsMatchResC, billsByCatNameResC, studentsResC] = await Promise.all([
          supabase
            .from('bills')
            .select('id')
            .or([
              `description.ilike.%${safeSearch4}%`,
              `category.ilike.%${safeSearch4}%`,
            ].join(','))
            .limit(200),
          supabase
            .from('bills')
            .select('id, bill_categories!inner(name)')
            .ilike('bill_categories.name', `%${safeSearch4}%`)
            .limit(200),
          supabase
            .from('students')
            .select('id')
            .or([
              `name.ilike.%${safeSearch4}%`,
              `nim_kashif.ilike.%${safeSearch4}%`,
              `nim_dikti.ilike.%${safeSearch4}%`,
            ].join(','))
            .limit(200),
        ] as any);
        if (billsMatchResC?.error) throw billsMatchResC.error;
        if (billsByCatNameResC?.error) throw billsByCatNameResC.error;
        if (studentsResC?.error) throw studentsResC.error;
        const ids1 = (billsMatchResC?.data || []).map((b: any) => b.id).filter(Boolean);
        const ids2 = (billsByCatNameResC?.data || []).map((b: any) => b.id).filter(Boolean);
        billIdsC = Array.from(new Set([...ids1, ...ids2]));
        studentIdsC = (studentsResC?.data || []).map((s: any) => s.id).filter(Boolean);
      } catch (_) {}

      const orPartsC = [`receipt_number.ilike.%${safeSearch4}%`];
      if (billIdsC.length > 0) orPartsC.push(`bill_id.in.(${billIdsC.join(',')})`);
      if (studentIdsC.length > 0) orPartsC.push(`student_id.in.(${studentIdsC.join(',')})`);
      countQuery = countQuery.or(orPartsC.join(','));
    }
    const { count, error: countErr } = await countQuery;
    if (countErr) throw countErr;

    let query = supabase
      .from('payments')
      .select(`
        *,
        bills (
          category,
          description,
          bill_categories ( name )
        ),
        students (
          nim_kashif,
          nim_dikti,
          name
        )
      `)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (params?.status && params.status !== 'all') query = query.eq('status', params.status);
    if (params?.method && params.method !== 'all') query = query.eq('payment_method', params.method);
    if (dateFrom) query = query.gte('payment_date', dateFrom);
    {
      const safeSearch4 = sanitizeSearch(params?.search || undefined);
      if (safeSearch4) {
        // Resolve matching bill IDs and student IDs first to avoid complex or across relations
        let billIds: string[] = [];
        let studentIds: string[] = [];
        try {
          const [billsMatchRes, billsByCatNameRes, studentsRes] = await Promise.all([
            supabase
              .from('bills')
              .select('id')
              .or([
                `description.ilike.%${safeSearch4}%`,
                `category.ilike.%${safeSearch4}%`,
              ].join(','))
              .limit(200),
            supabase
              .from('bills')
              .select('id, bill_categories!inner(name)')
              .ilike('bill_categories.name', `%${safeSearch4}%`)
              .limit(200),
            supabase
              .from('students')
              .select('id')
              .or([
                `name.ilike.%${safeSearch4}%`,
                `nim_kashif.ilike.%${safeSearch4}%`,
                `nim_dikti.ilike.%${safeSearch4}%`,
              ].join(','))
              .limit(200),
          ] as any);
          if (billsMatchRes?.error) throw billsMatchRes.error;
          if (billsByCatNameRes?.error) throw billsByCatNameRes.error;
          if (studentsRes?.error) throw studentsRes.error;
          const ids1 = (billsMatchRes?.data || []).map((b: any) => b.id).filter(Boolean);
          const ids2 = (billsByCatNameRes?.data || []).map((b: any) => b.id).filter(Boolean);
          billIds = Array.from(new Set([...ids1, ...ids2]));
          studentIds = (studentsRes?.data || []).map((s: any) => s.id).filter(Boolean);
        } catch (_) {}

        const orParts = [`receipt_number.ilike.%${safeSearch4}%`];
        if (billIds.length > 0) orParts.push(`bill_id.in.(${billIds.join(',')})`);
        if (studentIds.length > 0) orParts.push(`student_id.in.(${studentIds.join(',')})`);
        query = query.or(orParts.join(','));
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return { data: (data as any[]) || [], total: count ?? 0 };
  },

  async createPayment(payment: Omit<Payment, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('payments')
      .insert([payment])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getPaymentById(id: string) {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        bills (
          id,
          category,
          type,
          status,
          description,
          amount,
          paid_amount
        ),
        students (
          id,
          nim_kashif,
          nim_dikti,
          name,
          prodi
        )
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  // Statistics
  async getStatistics() {
    const [studentsResult, billsResult, paymentsResult] = await Promise.all([
      supabase.from('students').select('id, status'),
      supabase.from('bills').select('id, amount, status, paid_amount'),
      supabase.from('payments').select('id, amount, payment_date').gte('payment_date', new Date().toISOString().split('T')[0])
    ]);

    const students = studentsResult.data || [];
    const bills = billsResult.data || [];
    const todayPayments = paymentsResult.data || [];

    const totalStudents = students.filter(s => s.status === 'active').length;
    const totalBills = bills.reduce((sum, bill) => sum + bill.amount, 0);
    const totalPaid = bills.reduce((sum, bill) => sum + (bill.paid_amount || 0), 0);
    const todayPaymentsAmount = todayPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const collectibilityRate = totalBills > 0 ? (totalPaid / totalBills) * 100 : 0;

    return {
      totalStudents,
      totalBills,
      totalPaid,
      todayPaymentsAmount,
      todayPaymentsCount: todayPayments.length,
      collectibilityRate
    };
  },

  // Global stats for students (unfiltered, no pagination)
  async getStudentsGlobalStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    graduated: number;
  }> {
    const totalPromise = supabase.from('students').select('*', { count: 'exact', head: true });
    const activePromise = supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'active');
    const inactivePromise = supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'inactive');
    const graduatedPromise = supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'graduated');

    const [totalRes, activeRes, inactiveRes, graduatedRes] = await Promise.all([
      totalPromise,
      activePromise,
      inactivePromise,
      graduatedPromise,
    ]);

    if (totalRes.error) throw totalRes.error;
    if (activeRes.error) throw activeRes.error;
    if (inactiveRes.error) throw inactiveRes.error;
    if (graduatedRes.error) throw graduatedRes.error;

    return {
      total: totalRes.count ?? 0,
      active: activeRes.count ?? 0,
      inactive: inactiveRes.count ?? 0,
      graduated: graduatedRes.count ?? 0,
    };
  },

  // Global stats for bills (unfiltered, no pagination)
  async getBillsGlobalStats(): Promise<{
    total: number;
    paid: number;
    unpaid: number;
    partial: number;
    totalAmount: number;
    paidAmount: number;
  }> {
    // Single fetch then aggregate locally for reliability
    const { data, error } = await supabase
      .from('bills')
      .select('id, status, amount, paid_amount');
    if (error) throw error;

    const rows = (data || []) as Array<{ id: string; status: string; amount: number; paid_amount: number }>;
    let total = 0, paid = 0, unpaid = 0, partial = 0, totalAmount = 0, paidAmount = 0;
    for (const r of rows) {
      total += 1;
      if (r.status === 'paid') paid += 1; else if (r.status === 'unpaid') unpaid += 1; else if (r.status === 'partial') partial += 1;
      totalAmount += Number(r.amount || 0);
      paidAmount += Number(r.paid_amount || 0);
    }
    return { total, paid, unpaid, partial, totalAmount, paidAmount };
  },

  // Aggregations for reports
  async getMonthlyIncome(months: number = 6): Promise<Array<{ month: string; income: number }>> {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const fromStr = from.toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('payments')
      .select('amount, payment_date')
      .gte('payment_date', fromStr);
    if (error) throw error;

    // Build month buckets
    const buckets: Record<string, number> = {};
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
      const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      buckets[key] = 0;
    }
    (data || []).forEach((p: any) => {
      const d = new Date(p.payment_date);
      const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      if (key in buckets) buckets[key] += p.amount || 0;
    });

    // Return in chronological order with localized month short name
    const result: Array<{ month: string; income: number }> = [];
    Object.keys(buckets).sort().forEach((key) => {
      const [y, m] = key.split('-').map(Number);
      const label = new Date(y, (m - 1), 1).toLocaleString('id-ID', { month: 'short' });
      result.push({ month: label.charAt(0).toUpperCase() + label.slice(1), income: buckets[key] });
    });
    return result;
  },

  async getPaymentMethodDistribution(days: number = 30): Promise<Array<{ method: string; count: number; percentage: number }>> {
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - days + 1);
    const fromStr = from.toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('payments')
      .select('payment_method')
      .gte('payment_date', fromStr);
    if (error) throw error;

    const counts: Record<string, number> = {};
    (data || []).forEach((p: any) => {
      const key = p.payment_method || 'Lainnya';
      counts[key] = (counts[key] || 0) + 1;
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([method, count]) => ({ method, count, percentage: Math.round((count / total) * 100) }));
  },

  async getTopPrograms(limit: number = 4, days: number = 180): Promise<Array<{ prodi: string; students: number; revenue: number }>> {
    // Aggregasi berdasarkan relasi normalized program_id -> programs, fallback ke string prodi jika null
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - days + 1);
    const fromStr = from.toISOString().split('T')[0];

    const [paymentsRes, studentsRes, programsRes] = await Promise.all([
      supabase.from('payments').select('student_id, amount').gte('payment_date', fromStr),
      // Ambil id, program_id, dan prodi (fallback)
      supabase.from('students').select('id, program_id, prodi'),
      supabase.from('programs').select('id, name'),
    ]);

    if (paymentsRes.error) throw paymentsRes.error;
    if (studentsRes.error) throw studentsRes.error;
    if (programsRes.error) throw programsRes.error;

    const payments = paymentsRes.data || [];
    const students = studentsRes.data || [];
    const programs = programsRes.data || [];

    const programNameById: Record<string, string> = {};
    (programs as any[]).forEach((p) => { if (p?.id) programNameById[p.id] = p.name || 'Lainnya'; });

    const programByStudent: Record<string, string> = {};
    (students as any[]).forEach((s) => {
      const name = (s.program_id && programNameById[s.program_id]) ? programNameById[s.program_id] : (s.prodi || 'Lainnya');
      programByStudent[s.id] = name;
    });

    const revenueByProgram: Record<string, number> = {};
    const studentSetByProgram: Record<string, Set<string>> = {};
    (payments as any[]).forEach((p) => {
      const prog = programByStudent[p.student_id] || 'Lainnya';
      revenueByProgram[prog] = (revenueByProgram[prog] || 0) + (p.amount || 0);
      if (!studentSetByProgram[prog]) studentSetByProgram[prog] = new Set();
      studentSetByProgram[prog].add(p.student_id);
    });

    const rows = Object.keys(revenueByProgram).map((name) => ({
      prodi: name,
      revenue: revenueByProgram[name],
      students: studentSetByProgram[name]?.size || 0,
    }));
    return rows.sort((a, b) => b.revenue - a.revenue).slice(0, limit);
  }
};