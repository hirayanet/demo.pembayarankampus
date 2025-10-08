const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Helper function untuk API calls
async function apiCall(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('auth_token');
  
  // Debug logging
  console.log(`[API Call] ${endpoint}`, {
    hasToken: !!token,
    tokenPreview: token ? `${token.substring(0, 10)}...` : 'None'
  });
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    console.error(`[API Error] ${endpoint}`, {
      status: response.status,
      statusText: response.statusText,
      error
    });
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Authentication Service
export const authService = {
  async login(email: string, password: string) {
    const result = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (result.token) {
      localStorage.setItem('auth_token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
    }
    
    return result;
  },

  async register(email: string, password: string, full_name: string, role: string = 'student') {
    return await apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name, role }),
    });
  },

  async getCurrentUser() {
    return await apiCall('/auth/user');
  },

  async logout() {
    try {
      await apiCall('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
    }
  },

  getCurrentUserFromStorage() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  isAuthenticated() {
    return !!localStorage.getItem('auth_token');
  }
};

// Database types (same as Supabase types)
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
  program_id?: string | null;
}

export interface Bill {
  id: string;
  student_id: string;
  category?: string | null;
  description: string;
  amount: number;
  due_date: string;
  status: 'paid' | 'unpaid' | 'partial';
  paid_amount: number;
  installment_count?: number;
  installment_amount?: number;
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

export interface Settings {
  id: string;
  security: {
    sessionTimeout: number;
    passwordMinLength: number;
    requireSpecialChars: boolean;
    maxLoginAttempts: number;
    twoFactorAuth: boolean;
  };
}

// Database Service (compatible dengan Supabase API)
export const dbService = {
  // Programs - Real API Implementation
  async getPrograms(): Promise<Program[]> {
    return await apiCall('/api/programs');
  },

  // Create Program - Real API Implementation
  async createProgram(program: Omit<Program, 'id' | 'created_at' | 'updated_at'>): Promise<Program> {
    return await apiCall('/api/programs', {
      method: 'POST',
      body: JSON.stringify(program)
    });
  },

  // Update Program - Real API Implementation
  async updateProgram(id: string, updates: Partial<Program>): Promise<Program> {
    return await apiCall(`/api/programs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  },

  // Delete Program - Real API Implementation
  async deleteProgram(id: string): Promise<void> {
    await apiCall(`/api/programs/${id}`, {
      method: 'DELETE'
    });
  },

  // Bill Categories
  async getBillCategories(onlyActive: boolean = true): Promise<BillCategory[]> {
    const queryParams = `?onlyActive=${onlyActive}`;
    return await apiCall(`/api/bill-categories${queryParams}`);
  },

  // Create Bill Category - Real API Implementation
  async createBillCategory(category: Omit<BillCategory, 'id' | 'created_at' | 'updated_at'>): Promise<BillCategory> {
    return await apiCall('/api/bill-categories', {
      method: 'POST',
      body: JSON.stringify(category)
    });
  },

  // Update Bill Category - Real API Implementation
  async updateBillCategory(id: string, updates: Partial<BillCategory>): Promise<BillCategory> {
    return await apiCall(`/api/bill-categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  },

  // Delete Bill Category - Real API Implementation
  async deleteBillCategory(id: string): Promise<void> {
    await apiCall(`/api/bill-categories/${id}`, {
      method: 'DELETE'
    });
  },

  // Statistics - Real API Implementation
  async getStatistics() {
    return await apiCall('/api/reports/statistics');
  },

  // Students global stats - Real API Implementation (using getStudentStats)
  async getStudentsGlobalStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    graduated: number;
  }> {
    const stats = await this.getStudentStats();
    return {
      total: stats.total,
      active: stats.active,
      inactive: stats.inactive,
      graduated: stats.graduated
    };
  },

  // Bills global stats - Real API Implementation
  async getBillsGlobalStats(): Promise<{
    total: number;
    paid: number;
    unpaid: number;
    partial: number;
    totalAmount: number;
    paidAmount: number;
  }> {
    const stats = await apiCall('/api/bills/stats');
    return {
      total: parseInt(stats.total) || 0,
      paid: parseInt(stats.paid) || 0,
      unpaid: parseInt(stats.unpaid) || 0,
      partial: parseInt(stats.partial) || 0,
      totalAmount: parseFloat(stats.total_amount) || 0,
      paidAmount: parseFloat(stats.total_paid) || 0
    };
  },

  // Payments global stats - Real API Implementation
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
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.method && params.method !== 'all') queryParams.append('method', params.method);
    if (params?.dateRange && params.dateRange !== 'all') queryParams.append('dateRange', params.dateRange);
    
    const stats = await apiCall(`/api/payments/stats?${queryParams.toString()}`);
    return {
      total: parseInt(stats.total) || 0,
      completed: parseInt(stats.completed) || 0,
      pending: parseInt(stats.pending) || 0,
      failed: parseInt(stats.failed) || 0,
      totalAmountCompleted: parseFloat(stats.total_amount_completed) || 0,
      todayAmountCompleted: parseFloat(stats.today_amount_completed) || 0
    };
  },

  // Students - Real API Implementation
  async getStudents(): Promise<Student[]> {
    return await apiCall('/api/students/all');
  },

  // Students paginated - Real API Implementation
  async getStudentsPaged(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    prodi?: string;
    angkatan?: string;
  }): Promise<{ data: Student[]; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.prodi) queryParams.append('prodi', params.prodi);
    if (params?.angkatan) queryParams.append('angkatan', params.angkatan);
    
    return await apiCall(`/api/students?${queryParams.toString()}`);
  },

  // Students filtered - Real API Implementation
  async getStudentsAllFiltered(params?: {
    search?: string;
    status?: string;
    prodi?: string;
    angkatan?: string;
  }): Promise<Student[]> {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.prodi) queryParams.append('prodi', params.prodi);
    if (params?.angkatan) queryParams.append('angkatan', params.angkatan);
    
    return await apiCall(`/api/students/all?${queryParams.toString()}`);
  },

  // Create student - Real API Implementation
  async createStudent(student: Omit<Student, 'id' | 'created_at' | 'updated_at'>): Promise<Student> {
    return await apiCall('/api/students', {
      method: 'POST',
      body: JSON.stringify(student)
    });
  },

  // Update student - Real API Implementation
  async updateStudent(id: string, updates: Partial<Student>): Promise<Student> {
    return await apiCall(`/api/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  },

  // Delete student - Real API Implementation
  async deleteStudent(id: string): Promise<void> {
    await apiCall(`/api/students/${id}`, {
      method: 'DELETE'
    });
  },



  // Payments - Real API Implementation
  async getPayments(studentId?: string): Promise<Payment[]> {
    const endpoint = studentId ? `/api/payments/all?student_id=${studentId}` : '/api/payments/all';
    return await apiCall(endpoint);
  },

  // Get payment by ID - Real API Implementation
  async getPaymentById(id: string): Promise<any> {
    try {
      const response = await apiCall(`/api/payments/${id}`);
      
      // Log the response for debugging
      console.log(`[Payment API] Response for payment ${id}:`, response);
      
      // Ensure the response has the expected structure for ReceiptModal
      // Transform the response to match the expected format if needed
      const transformedResponse = {
        id: response.id || id,
        amount: parseFloat(response.amount) || 0,
        payment_date: response.payment_date || new Date().toISOString().split('T')[0],
        payment_method: response.payment_method || 'Unknown',
        receipt_number: response.receipt_number || `KW-${id}`,
        status: response.status || 'unknown',
        student_name: response.student_name || response.students?.name || 'Data Tidak Tersedia',
        student_nim: response.student_nim || response.students?.nim_kashif || 'N/A',
        student_nim_dikti: response.student_nim_dikti || response.students?.nim_dikti || null,
        student_prodi: response.student_prodi || response.students?.prodi || 'N/A',
        students: {
          name: response.student_name || response.students?.name || 'Data Tidak Tersedia',
          nim_kashif: response.student_nim || response.students?.nim_kashif || 'N/A',
          nim_dikti: response.student_nim_dikti || response.students?.nim_dikti || null,
          prodi: response.student_prodi || response.students?.prodi || 'N/A'
        },
        bill_description: response.bill_description || response.bills?.description || 'Pembayaran',
        bill_category: response.bill_category || response.bills?.category || null,
        bill_amount: parseFloat(response.bill_amount) || parseFloat(response.bills?.amount) || 0,
        bill_status: response.bill_status || response.bills?.status || 'unknown',
        bill_paid_amount: parseFloat(response.bill_paid_amount) || parseFloat(response.bills?.paid_amount) || 0,
        bill_type: response.bill_type || response.bills?.type || null,
        bills: {
          description: response.bill_description || response.bills?.description || 'Pembayaran',
          category: response.bill_category || response.bills?.category || null,
          amount: parseFloat(response.bill_amount) || parseFloat(response.bills?.amount) || 0,
          status: response.bill_status || response.bills?.status || 'unknown',
          paid_amount: parseFloat(response.bill_paid_amount) || parseFloat(response.bills?.paid_amount) || 0,
          type: response.bill_type || response.bills?.type || null
        },
        category_name: response.category_name || null
      };
      
      return transformedResponse;
    } catch (error: any) {
      console.error(`Failed to fetch payment with ID ${id}:`, error);
      
      // Check if it's an authentication error
      if (error.message && error.message.includes('Access token required')) {
        // Return a minimal payment object with authentication error information
        return {
          id,
          error: true,
          authError: true,
          message: 'Sesi Anda telah kedaluwarsa. Silakan login kembali.',
          amount: 0,
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'Unknown',
          receipt_number: 'AUTH-ERROR-' + id,
          students: {
            name: 'Data Tidak Tersedia',
            nim_kashif: 'N/A',
            prodi: 'N/A'
          },
          bills: {
            description: 'Data pembayaran tidak dapat dimuat karena masalah autentikasi',
            amount: 0,
            paid_amount: 0,
            status: 'error'
          }
        };
      }
      
      // Check if it's a server error (500) or network error
      if (error.message && (error.message.includes('Failed to fetch payment') || 
                           error.message.includes('500') || 
                           error.message.includes('ECONNREFUSED') ||
                           error.message.includes('Network Error'))) {
        // Return a minimal payment object with server error information
        return {
          id,
          error: true,
          serverError: true,
          message: 'Server sedang mengalami masalah. Silakan coba lagi dalam beberapa menit.',
          amount: 0,
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'Unknown',
          receipt_number: 'SERVER-ERROR-' + id,
          students: {
            name: 'Data Tidak Tersedia',
            nim_kashif: 'N/A',
            prodi: 'N/A'
          },
          bills: {
            description: 'Data pembayaran tidak dapat dimuat karena masalah server',
            amount: 0,
            paid_amount: 0,
            status: 'error'
          }
        };
      }
      
      // Check if it's a not found error (404)
      if (error.message && error.message.includes('404')) {
        return {
          id,
          error: true,
          notFound: true,
          message: 'Data pembayaran tidak ditemukan.',
          amount: 0,
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'Unknown',
          receipt_number: 'NOT-FOUND-' + id,
          students: {
            name: 'Data Tidak Tersedia',
            nim_kashif: 'N/A',
            prodi: 'N/A'
          },
          bills: {
            description: 'Data pembayaran tidak ditemukan',
            amount: 0,
            paid_amount: 0,
            status: 'error'
          }
        };
      }
      
      // Return a minimal payment object with general error information
      return {
        id,
        error: true,
        message: `Gagal memuat data pembayaran dengan ID ${id}. Silakan coba lagi.`,
        amount: 0,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'Unknown',
        receipt_number: 'ERROR-' + id,
        students: {
          name: 'Data Tidak Tersedia',
          nim_kashif: 'N/A',
          prodi: 'N/A'
        },
        bills: {
          description: 'Data pembayaran tidak dapat dimuat',
          amount: 0,
          paid_amount: 0,
          status: 'error'
        }
      };
    }
  },

  // Get latest payment for a specific bill - Real API Implementation  
  async getLatestPaymentForBill(billId: string): Promise<any> {
    const payments = await apiCall(`/api/payments/all?bill_id=${billId}`);
    if (!Array.isArray(payments) || payments.length === 0) {
      return null;
    }
    // Sort by payment_date descending to get the latest
    const sortedPayments = payments.sort((a, b) => {
      const dateA = new Date(a.payment_date).getTime();
      const dateB = new Date(b.payment_date).getTime();
      return dateB - dateA; // descending order
    });
    return sortedPayments[0];
  },

  // Create payment - Real API Implementation
  async createPayment(payment: Omit<Payment, 'id' | 'created_at'>): Promise<Payment> {
    return await apiCall('/api/payments', {
      method: 'POST',
      body: JSON.stringify(payment)
    });
  },

  // Delete payment - Real API Implementation
  async deletePayment(id: string): Promise<void> {
    await apiCall(`/api/payments/${id}`, {
      method: 'DELETE'
    });
  },

  // Payments paginated - Real API Implementation
  async getPaymentsPaged(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    method?: string;
    dateRange?: string;
  }): Promise<{ data: any[]; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.method) queryParams.append('method', params.method);
    if (params?.dateRange) queryParams.append('dateRange', params.dateRange);
    
    return await apiCall(`/api/payments?${queryParams.toString()}`);
  },

  // Payments filtered - Real API Implementation
  async getPaymentsAllFiltered(params?: {
    search?: string;
    status?: string;
    method?: string;
    dateRange?: string;
  }): Promise<any[]> {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.method) queryParams.append('method', params.method);
    if (params?.dateRange) queryParams.append('dateRange', params.dateRange);
    
    return await apiCall(`/api/payments/all?${queryParams.toString()}`);
  },

  // Payment stats - Real API Implementation
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
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.method) queryParams.append('method', params.method);
    if (params?.dateRange) queryParams.append('dateRange', params.dateRange);
    
    return await apiCall(`/api/payments/stats?${queryParams.toString()}`);
  },

  // Bills - Real API Implementation
  async getBills(studentId?: string): Promise<Bill[]> {
    const endpoint = studentId ? `/api/bills/all?student_id=${studentId}` : '/api/bills/all';
    return await apiCall(endpoint);
  },

  // Bills paginated - Real API Implementation
  async getBillsPaged(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
  }): Promise<{ data: any[]; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status) queryParams.append('status', params.status);
    
    return await apiCall(`/api/bills?${queryParams.toString()}`);
  },

  // Bills filtered - Real API Implementation
  async getBillsAllFiltered(params?: {
    search?: string;
    status?: string;
  }): Promise<any[]> {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status) queryParams.append('status', params.status);
    
    return await apiCall(`/api/bills/all?${queryParams.toString()}`);
  },

  // Create bill - Real API Implementation
  async createBill(bill: Omit<Bill, 'id' | 'created_at' | 'updated_at'>): Promise<Bill> {
    return await apiCall('/api/bills', {
      method: 'POST',
      body: JSON.stringify(bill)
    });
  },

  // Create multiple bills - Real API Implementation (using single create for now)
  async createBills(bills: Array<Omit<Bill, 'id' | 'created_at' | 'updated_at'>>): Promise<Bill[]> {
    // Create bills one by one since we don't have batch endpoint yet
    const results: Bill[] = [];
    for (const bill of bills) {
      const created = await this.createBill(bill);
      results.push(created);
    }
    return results;
  },

  // Update bill - Real API Implementation
  async updateBill(id: string, updates: Partial<Bill>): Promise<Bill> {
    return await apiCall(`/api/bills/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  },

  // Delete bill - Real API Implementation
  async deleteBill(id: string): Promise<void> {
    await apiCall(`/api/bills/${id}`, {
      method: 'DELETE'
    });
  },

  // Monthly Income - Real API Implementation
  async getMonthlyIncome(monthsCount: number = 12): Promise<Array<{ month: string; income: number }>> {
    return await apiCall(`/api/reports/monthly-income?months=${monthsCount}`);
  },

  // Payment Method Distribution - Real API Implementation
  async getPaymentMethodDistribution(days: number = 30): Promise<Array<{ method: string; count: number; percentage: number }>> {
    return await apiCall(`/api/reports/payment-methods?days=${days}`);
  },

  // Top Programs - Real API Implementation
  async getTopPrograms(limit: number = 5, days: number = 30): Promise<Array<{ prodi: string; students: number; revenue: number }>> {
    return await apiCall(`/api/reports/top-programs?limit=${limit}&days=${days}`);
  },

  // Dashboard Stats - Real API Implementation
  async getDashboardStats(days: number = 7): Promise<Array<{ date: string; amount: number }>> {
    return await apiCall(`/api/reports/dashboard-stats?days=${days}`);
  },

  // Student Stats - Real API Implementation
  async getStudentStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    graduated: number;
    byProgram: Array<{ program: string; count: number }>;
  }> {
    return await apiCall('/api/reports/student-stats');
  },

  // Mock RPC functions untuk kompatibilitas dengan Supabase
  rpc: {
    async get_payment_stats() {
      // TODO: Implementasi RPC endpoint
      return { data: null, error: null };
    },
    async get_student_stats() {
      // TODO: Implementasi RPC endpoint  
      return { data: null, error: null };
    }
  }
};

// Mock Supabase object untuk kompatibilitas dengan real-time subscriptions
export const supabase = {
  channel: (name: string) => {
    const mockChannel = {
      on: (event: string, config: any, callback: () => void) => {
        // Mock subscription - tidak ada real-time update untuk sementara
        if (process.env.NODE_ENV === 'development') {
          console.debug('[MySQL Mock] Channel subscription:', name, event);
        }
        return mockChannel;
      },
      subscribe: () => {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[MySQL Mock] Channel subscribed:', name);
        }
        return { unsubscribe: () => {} };
      }
    };
    return mockChannel;
  },
  removeChannel: (channel: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[MySQL Mock] Channel removed');
    }
  },
  functions: {
    invoke: async (name: string, options?: any) => {
      // Hanya log untuk debugging jika diperlukan
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[MySQL Mock] Function: ${name}`, options ? 'with options' : '');
      }
      
      // Mock implementation berdasarkan function name
      switch (name) {
        case 'create-admin':
          // Use real API endpoint instead of mock
          try {
            const { body } = options || {};
            const { email, role } = body || {};
            
            if (!email) {
              return {
                data: null,
                error: { message: 'Email is required' }
              };
            }
            
            // Call the real API endpoint
            const response = await apiCall('/api/admins', {
              method: 'POST',
              body: JSON.stringify({ email, role })
            });
            
            // Return in the same format as the Edge Function
            return {
              data: {
                ok: true,
                user: {
                  id: response.user.id,
                  email: response.user.email
                },
                role: response.user.role,
                default_password: response.user.default_password
              },
              error: null
            };
          } catch (error: any) {
            return {
              data: null,
              error: { message: error.message || 'Failed to create admin/staff user' }
            };
          }
          
        case 'delete-managed-user':
          // Mock user deletion - simulate success
          return {
            data: { ok: true },
            error: null
          };
          
        case 'create-student-user':
          // Mock student user creation - simulate success
          return {
            data: {
              ok: true,
              user: {
                id: 'mock-student-' + Date.now()
              }
            },
            error: null
          };
          
        default:
          return {
            data: null,
            error: { message: `Function ${name} not implemented in MySQL mode` }
          };
      }
    }
  },
  // Mock RPC functions untuk admin management
  rpc: async (functionName: string, params?: any) => {
    // Hanya log untuk debugging jika diperlukan
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[MySQL Mock] RPC: ${functionName}`, params ? `with params: ${JSON.stringify(params)}` : '');
    }
    
    // Mock implementation berdasarkan function name
    switch (functionName) {
      case 'managed_users_list':
        // Use real API endpoint instead of mock
        try {
          // Call the real API to get all users with admin/staff roles
          const response = await apiCall('/api/users/admins-staff');
          
          // Transform the response to match the expected format
          const users = response.map((user: any) => ({
            user_id: user.uuid, // Use uuid for consistency with frontend
            email: user.email,
            role: user.role,
            active: user.email_verified // Assuming email_verified indicates active status
          }));
          
          return {
            data: users,
            error: null
          };
        } catch (error: any) {
          console.error('Error fetching admin/staff users:', error);
          // Return empty array instead of null to prevent UI blank
          return {
            data: [],
            error: null
          };
        }
        
      case 'role_set':
        // Mock role update - just return success
        return {
          data: null,
          error: null
        };
        
      case 'is_admin':
        // Check if current user is admin from localStorage
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          const user = JSON.parse(savedUser);
          return {
            data: user.role === 'admin',
            error: null
          };
        }
        return {
          data: false,
          error: null
        };
        
      case 'is_staff':
        // Check if current user is staff from localStorage
        const savedUserStaff = localStorage.getItem('user');
        if (savedUserStaff) {
          const user = JSON.parse(savedUserStaff);
          return {
            data: user.role === 'staff' || user.role === 'admin',
            error: null
          };
        }
        return {
          data: false,
          error: null
        };
        
      default:
        return {
          data: null,
          error: { message: `RPC function ${functionName} not implemented in MySQL mode` }
        };
    }
  },
  // Mock auth object untuk kompatibilitas
  auth: {
    getSession: async () => {
      const token = localStorage.getItem('auth_token');
      const user = localStorage.getItem('user');
      if (token && user) {
        const userData = JSON.parse(user);
        return {
          data: {
            session: {
              access_token: token,
              user: {
                id: userData.id || 'mock-user-id',
                email: userData.email,
                role: userData.role
              }
            }
          },
          error: null
        };
      }
      return {
        data: { session: null },
        error: null
      };
    },
    getUser: async () => {
      const user = localStorage.getItem('user');
      if (user) {
        const userData = JSON.parse(user);
        return {
          data: {
            user: {
              id: userData.id || 'mock-user-id',
              email: userData.email,
              role: userData.role
            }
          },
          error: null
        };
      }
      return {
        data: { user: null },
        error: null
      };
    }
  },
  // Mock from() method untuk kompatibilitas dengan Supabase queries
  from: (table: string) => {
    return {
      select: (columns?: string) => {
        const queryBuilder = {
          eq: (column: string, value: any) => ({
            maybeSingle: async () => {
              // Mock untuk query students berdasarkan user_id
              if (table === 'students' && column === 'user_id') {
                // Return mock student data untuk user mahasiswa
                const user = localStorage.getItem('user');
                if (user) {
                  const userData = JSON.parse(user);
                  if (userData.role === 'student') {
                    return {
                      data: {
                        id: userData.id || 'mock-student-id',
                        name: userData.full_name || 'Mahasiswa Test',
                        email: userData.email,
                        nim_kashif: '2024001',
                        user_id: userData.id || 'mock-user-id'
                      },
                      error: null
                    };
                  }
                }
                // Jika bukan student atau tidak ada user, return null
                return {
                  data: null,
                  error: null
                };
              }
              
              // Mock settings table query
              if (table === 'settings' && column === 'id' && value === 'system') {
                return {
                  data: {
                    id: 'system',
                    security: {
                      sessionTimeout: 30,
                      passwordMinLength: 8,
                      requireSpecialChars: false,
                      maxLoginAttempts: 3,
                      twoFactorAuth: false
                    }
                  },
                  error: null
                };
              }
              
              return {
                data: null,
                error: { message: 'Not found' }
              };
            },
            single: async () => {
              // Mock settings table query
              if (table === 'settings' && column === 'id' && value === 'system') {
                return {
                  data: {
                    id: 'system',
                    security: {
                      sessionTimeout: 30,
                      passwordMinLength: 8,
                      requireSpecialChars: false,
                      maxLoginAttempts: 3,
                      twoFactorAuth: false
                    }
                  },
                  error: null
                };
              }
              return {
                data: null,
                error: { message: 'Not found' }
              };
            }
          }),
          order: (column: string, options?: any) => ({
            then: async (callback?: Function) => {
              // Mock order query - return empty data for now
              const result = { data: [], error: null };
              if (callback) callback(result);
              return result;
            }
          })
        };
        
        return {
          ...queryBuilder,
          order: (column: string, options?: any) => {
            return Promise.resolve({ data: [], error: null });
          }
        };
      },
      upsert: (data: any, options?: any) => {
        return Promise.resolve({ data: data, error: null });
      },
      insert: (data: any) => ({
        select: () => {
          return Promise.resolve({ data: [data], error: null });
        }
      })
    };
  }
};

// Deklarasi untuk global mock storage
declare global {
  var mockUsers: Array<{ user_id: string; email: string; role: string; active: boolean }> | undefined;
}

// Fungsi untuk menginisialisasi mock users jika belum ada
const initializeMockUsers = () => {
  if (!globalThis.mockUsers) {
    globalThis.mockUsers = [
      {
        user_id: 'admin-1',
        email: 'admin@kampus.edu',
        role: 'admin',
        active: true
      },
      {
        user_id: 'staff-1', 
        email: 'staff@kampus.edu',
        role: 'staff',
        active: true
      }
    ];
  }
};

// Fungsi untuk mendapatkan mock users
const getMockUsers = () => {
  initializeMockUsers();
  return globalThis.mockUsers || [];
};

// Fungsi untuk menambahkan user baru ke mock storage
const addMockUser = (user: { user_id: string; email: string; role: string; active: boolean }) => {
  initializeMockUsers();
  globalThis.mockUsers!.push(user);
};
