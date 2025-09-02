import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  ArrowLeft, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Copy,
  Download
} from 'lucide-react';
import { dbService } from '../../lib/mysql';

interface PaymentPageProps {
  billId: string;
  onBack: () => void;
}

const PaymentPage: React.FC<PaymentPageProps> = ({ billId, onBack }) => {
  const [bill, setBill] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('transfer');
  const [paymentStep, setPaymentStep] = useState('method'); // method, process, success
  const [paymentData, setPaymentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBillDetails();
  }, [billId]);

  const loadBillDetails = async () => {
    try {
      setLoading(true);
      // Mock bill data - in real app, fetch from database
      const mockBill = {
        id: billId,
        type: 'BPP Semester Gasal',
        description: 'Biaya Penyelenggaraan Pendidikan Semester Gasal 2024/2025',
        amount: 2220000,
        paidAmount: 1110000,
        remainingAmount: 1110000,
        dueDate: '2024-02-28',
        status: 'partial',
        installmentInfo: {
          currentInstallment: 3,
          totalInstallments: 6,
          nextDueDate: '2024-02-15'
        }
      };
      setBill(mockBill);
    } catch (error) {
      console.error('Error loading bill:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handlePayment = async () => {
    setPaymentStep('process');
    
    // Simulate payment processing
    setTimeout(() => {
      const receiptNumber = `RCP-${Date.now()}`;
      setPaymentData({
        receiptNumber,
        amount: bill.remainingAmount,
        method: paymentMethod,
        date: new Date().toISOString(),
        status: 'completed'
      });
      setPaymentStep('success');
    }, 3000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-[#540002]/30 border-t-[#540002] rounded-full animate-spin"></div>
          <span>Memuat data tagihan...</span>
        </div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Tagihan tidak ditemukan</p>
        <button onClick={onBack} className="mt-4 text-[#540002] hover:text-[#6d0003]">
          Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pembayaran Tagihan</h1>
          <p className="text-gray-600 mt-1">Proses pembayaran untuk tagihan Anda</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center space-x-4 mb-8">
        <div className={`flex items-center space-x-2 ${paymentStep === 'method' ? 'text-[#540002]' : paymentStep === 'process' || paymentStep === 'success' ? 'text-green-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${paymentStep === 'method' ? 'bg-[#540002] text-white' : paymentStep === 'process' || paymentStep === 'success' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
            {paymentStep === 'process' || paymentStep === 'success' ? <CheckCircle className="w-4 h-4" /> : '1'}
          </div>
          <span className="text-sm font-medium">Pilih Metode</span>
        </div>
        
        <div className={`w-12 h-0.5 ${paymentStep === 'process' || paymentStep === 'success' ? 'bg-green-600' : 'bg-gray-200'}`}></div>
        
        <div className={`flex items-center space-x-2 ${paymentStep === 'process' ? 'text-[#540002]' : paymentStep === 'success' ? 'text-green-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${paymentStep === 'process' ? 'bg-[#540002] text-white' : paymentStep === 'success' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
            {paymentStep === 'success' ? <CheckCircle className="w-4 h-4" /> : paymentStep === 'process' ? <Clock className="w-4 h-4" /> : '2'}
          </div>
          <span className="text-sm font-medium">Proses</span>
        </div>
        
        <div className={`w-12 h-0.5 ${paymentStep === 'success' ? 'bg-green-600' : 'bg-gray-200'}`}></div>
        
        <div className={`flex items-center space-x-2 ${paymentStep === 'success' ? 'text-green-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${paymentStep === 'success' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
            {paymentStep === 'success' ? <CheckCircle className="w-4 h-4" /> : '3'}
          </div>
          <span className="text-sm font-medium">Selesai</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bill Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 sticky top-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ringkasan Tagihan</h3>
            
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-gray-900">{bill.type}</h4>
                <p className="text-sm text-gray-600">{bill.description}</p>
              </div>
              
              <div className="border-t pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Tagihan:</span>
                  <span className="font-medium">{formatCurrency(bill.amount)}</span>
                </div>
                {bill.paidAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Sudah Dibayar:</span>
                    <span className="text-green-600 font-medium">{formatCurrency(bill.paidAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-2">
                  <span>Sisa Tagihan:</span>
                  <span className="text-[#540002]">{formatCurrency(bill.remainingAmount)}</span>
                </div>
              </div>
              
              <div className="border-t pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Jatuh Tempo:</span>
                  <span className="font-medium">{new Date(bill.dueDate).toLocaleDateString('id-ID')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Content */}
        <div className="lg:col-span-2">
          {paymentStep === 'method' && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Pilih Metode Pembayaran</h3>
              
              <div className="space-y-4 mb-6">
                <div
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    paymentMethod === 'transfer' ? 'border-[#540002] bg-red-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setPaymentMethod('transfer')}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      checked={paymentMethod === 'transfer'}
                      onChange={() => setPaymentMethod('transfer')}
                      className="text-[#540002] focus:ring-[#540002]"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">Transfer Bank</h4>
                      <p className="text-sm text-gray-600">Transfer ke rekening bank institusi</p>
                    </div>
                  </div>
                </div>
                
                <div
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    paymentMethod === 'va' ? 'border-[#540002] bg-red-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setPaymentMethod('va')}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      checked={paymentMethod === 'va'}
                      onChange={() => setPaymentMethod('va')}
                      className="text-[#540002] focus:ring-[#540002]"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">Virtual Account</h4>
                      <p className="text-sm text-gray-600">Bayar melalui virtual account</p>
                    </div>
                  </div>
                </div>
                
                <div
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    paymentMethod === 'ewallet' ? 'border-[#540002] bg-red-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setPaymentMethod('ewallet')}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      checked={paymentMethod === 'ewallet'}
                      onChange={() => setPaymentMethod('ewallet')}
                      className="text-[#540002] focus:ring-[#540002]"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">E-Wallet</h4>
                      <p className="text-sm text-gray-600">Bayar dengan GoPay, OVO, DANA</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handlePayment}
                className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-[#540002] text-white rounded-lg hover:bg-[#6d0003] transition-colors"
              >
                <CreditCard className="w-5 h-5" />
                <span>Lanjutkan Pembayaran</span>
              </button>
            </div>
          )}

          {paymentStep === 'process' && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-blue-600 animate-pulse" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Memproses Pembayaran</h3>
                <p className="text-gray-600 mb-6">Mohon tunggu, pembayaran Anda sedang diproses...</p>
                
                {paymentMethod === 'transfer' && (
                  <div className="bg-gray-50 p-4 rounded-lg text-left">
                    <h4 className="font-medium text-gray-900 mb-3">Informasi Transfer</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Bank:</span>
                        <span className="font-medium">Bank Mandiri</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>No. Rekening:</span>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">1234567890</span>
                          <button
                            onClick={() => copyToClipboard('1234567890')}
                            className="p-1 text-gray-500 hover:text-gray-700"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span>Atas Nama:</span>
                        <span className="font-medium">Universitas Teknologi Indonesia</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Jumlah:</span>
                        <span className="font-medium text-[#540002]">{formatCurrency(bill.remainingAmount)}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mt-6">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-[#540002] h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">Memverifikasi pembayaran...</p>
                </div>
              </div>
            </div>
          )}

          {paymentStep === 'success' && paymentData && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Pembayaran Berhasil!</h3>
                <p className="text-gray-600 mb-6">Terima kasih, pembayaran Anda telah berhasil diproses.</p>
                
                <div className="bg-gray-50 p-4 rounded-lg text-left mb-6">
                  <h4 className="font-medium text-gray-900 mb-3">Detail Pembayaran</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>No. Receipt:</span>
                      <span className="font-medium">{paymentData.receiptNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Jumlah:</span>
                      <span className="font-medium">{formatCurrency(paymentData.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Metode:</span>
                      <span className="font-medium">
                        {paymentMethod === 'transfer' ? 'Transfer Bank' : 
                         paymentMethod === 'va' ? 'Virtual Account' : 'E-Wallet'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tanggal:</span>
                      <span className="font-medium">
                        {new Date(paymentData.date).toLocaleDateString('id-ID')} {new Date(paymentData.date).toLocaleTimeString('id-ID')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className="text-green-600 font-medium">Berhasil</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={onBack}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Kembali ke Dashboard
                  </button>
                  <button className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-[#540002] text-white rounded-lg hover:bg-[#6d0003] transition-colors">
                    <Download className="w-4 h-4" />
                    <span>Download Receipt</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;