import React, { useState, useEffect } from 'react';
import { currencyIDR } from '../../lib/receipt';
import { X, Save, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface PaymentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    amount: number;
    payment_method: string;
    payment_date: string;
    note?: string;
  }) => Promise<any> | void;
  maxAmount: number;
  defaultDate?: string;
  billData?: {
    totalAmount: number;
    paidAmount?: number;
    description?: string;
  };
}

const PaymentForm: React.FC<PaymentFormProps> = ({ isOpen, onClose, onSubmit, maxAmount, defaultDate, billData }) => {
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<string>('Transfer Bank');
  const [date, setDate] = useState<string>(defaultDate || new Date().toISOString().slice(0,10));
  const [note, setNote] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);
  const [confirmationType, setConfirmationType] = useState<'partial' | 'excess' | null>(null);
  
  // Real-time validation state
  const [validationError, setValidationError] = useState<string>('');
  const [isAmountValid, setIsAmountValid] = useState<boolean>(true);

  // Real-time validation for amount input
  useEffect(() => {
    const amountValue = Number(amount);
    
    if (amount === '' || amount === '0') {
      setValidationError('');
      setIsAmountValid(false); // Invalid if empty or zero
      return;
    }
    
    if (amountValue <= 0) {
      setValidationError('Nominal harus lebih dari 0');
      setIsAmountValid(false);
    } else if (amountValue > maxAmount) {
      setValidationError(`Nominal melebihi sisa tagihan (Maksimal: ${currencyIDR(maxAmount)})`);
      setIsAmountValid(true); // Still allow submission, will show confirmation
    } else {
      setValidationError('');
      setIsAmountValid(true);
    }
  }, [amount, maxAmount]);

  // Auto-fill amount and note when modal opens
  useEffect(() => {
    if (isOpen && maxAmount > 0) {
      // Auto-fill with remaining amount for any bill that has previous payment
      // For new bills, let user choose the amount
      if (billData?.paidAmount && billData.paidAmount > 0) {
        setAmount(String(maxAmount)); // Use remaining amount for partial bills
        // Set default note for partial payment
        setNote('Pembayaran cicilan');
      } else {
        setAmount(''); // For new bills, let user choose
        setNote(''); // Clear note for new bills
      }
    } else if (isOpen) {
      setAmount('');
      setNote(''); // Clear note when opening with no maxAmount
    }
  }, [isOpen, billData?.paidAmount, maxAmount]);

  // Update note when amount changes
  useEffect(() => {
    if (!isOpen) return;
    
    const amountValue = Number(amount);
    if (amountValue > 0 && amountValue === maxAmount) {
      // Set default note for full payment
      setNote('Pembayaran penuh / Tagihan lunas');
    } else if (amountValue > 0 && amountValue < maxAmount) {
      // Set default note for partial payment
      if (!note || note === 'Pembayaran penuh / Tagihan lunas') {
        setNote('Pembayaran cicilan');
      }
    }
  }, [amount, maxAmount, isOpen, note]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setAmount('');
      setError('');
      setValidationError('');
      setIsAmountValid(true);
      setShowConfirmation(false);
      setConfirmationType(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) {
      return; // guard double submit
    }
    
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError('Nominal harus lebih dari 0');
      return;
    }
    
    // Check for partial payment (less than remaining amount)
    if (amt < maxAmount) {
      setConfirmationType('partial');
      setShowConfirmation(true);
      return;
    }
    
    // Check for excess payment (more than remaining amount)
    if (amt > maxAmount) {
      setConfirmationType('excess');
      setShowConfirmation(true);
      return;
    }
    
    // Exact amount - proceed directly
    processPayment(amt);
  };
  
  const processPayment = (amt: number) => {
    setError('');
    setValidationError('');
    setIsSubmitting(true);
    setShowConfirmation(false);
    
    try {
      const ret = onSubmit({ amount: amt, payment_method: method, payment_date: date, note });
      
      // If onSubmit returns a Promise, reset isSubmitting after it settles
      if (ret && typeof (ret as any).then === 'function') {
        (ret as Promise<any>)
          .then((result) => {
            // Payment successful, form will be closed by parent component
            if (result?.id) {
              setTimeout(() => {
                // Small delay to allow backend to process the payment
              }, 500);
            }
          })
          .catch((error) => {
            // Check if it's an authentication error
            if (error?.message && error.message.includes('Access token required')) {
              setError('Sesi Anda telah kedaluwarsa. Silakan refresh halaman dan login kembali.');
            } 
            // Check if it's a server error
            else if (error?.message && (error.message.includes('Failed to fetch') || error.message.includes('500'))) {
              setError('Server sedang mengalami masalah. Silakan coba lagi dalam beberapa menit.');
            }
            else {
              setError(error?.message || 'Gagal memproses pembayaran');
            }
          })
          .finally(() => {
            setIsSubmitting(false);
          });
      } else {
        // Synchronous onSubmit
        setIsSubmitting(false);
      }
    } catch (error: any) {
      // Check if it's an authentication error
      if (error?.message && error.message.includes('Access token required')) {
        setError('Sesi Anda telah kedaluwarsa. Silakan refresh halaman dan login kembali.');
      } 
      // Check if it's a server error
      else if (error?.message && (error.message.includes('Failed to fetch') || error.message.includes('500'))) {
        setError('Server sedang mengalami masalah. Silakan coba lagi dalam beberapa menit.');
      }
      else {
        setError(error?.message || 'Gagal memproses pembayaran');
      }
      
      setIsSubmitting(false);
    }
  };
  
  const handleConfirmPayment = () => {
    const amt = Number(amount);
    if (confirmationType === 'excess') {
      // For excess payment, limit to maxAmount
      processPayment(maxAmount);
    } else {
      // For partial payment, use entered amount
      processPayment(amt);
    }
  };
  
  const handleQuickFill = (fillAmount: number) => {
    setAmount(String(fillAmount));
    setError('');
  };

  return (
    <>
      {/* Main Payment Form */}
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold text-gray-900">Catat Pembayaran</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={submit} className="p-4 space-y-3">
            {/* Payment Info Display - Dynamic Update */}
            {billData && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Info Tagihan {billData.description}</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-blue-700">Total Tagihan:</span>
                    <span className="font-semibold text-blue-900">{currencyIDR(Number(billData?.totalAmount) || 0)}</span>
                  </div>
                  {billData.paidAmount && Number(billData.paidAmount) > 0 ? (
                    <div className="flex justify-between items-center">
                      <span className="text-blue-700">Sudah Dibayar:</span>
                      <span className="font-semibold text-green-700">{currencyIDR(Number(billData.paidAmount))}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between items-center">
                    <span className="text-blue-700">Sisa Tagihan:</span>
                    <span className="font-semibold text-orange-700">{currencyIDR(Number(maxAmount) || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-blue-700">Akan Bayar:</span>
                    <span className="font-semibold text-green-700">
                      {amount ? currencyIDR(Number(amount)) : currencyIDR(0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-blue-700">Sisa Setelah Bayar:</span>
                    <span className="font-semibold text-red-700">
                      {currencyIDR(Math.max((Number(maxAmount) || 0) - (Number(amount) || 0), 0))}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Quick Fill Buttons - More Compact */}
            {maxAmount > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Pilihan Cepat:</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickFill(maxAmount)}
                    className="flex-1 px-2 py-1 text-xs bg-green-100 text-green-800 border border-green-300 rounded hover:bg-green-200 transition-colors"
                  >
                    Lunas
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFill(Math.floor(maxAmount / 2))}
                    className="flex-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 border border-blue-300 rounded hover:bg-blue-200 transition-colors"
                  >
                    Cicilan
                  </button>
                </div>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nominal Pembayaran
              </label>
              <input 
                type="number" 
                value={amount} 
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(''); // Clear general error when user types
                }} 
                className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:border-transparent transition-colors ${
                  !isAmountValid 
                    ? 'border-red-300 focus:ring-red-500 bg-red-50' 
                    : 'border-gray-300 focus:ring-[#540002]'
                }`}
                placeholder="Masukkan nominal pembayaran" 
              />
              {/* Real-time validation message */}
              {validationError && (
                <div className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {validationError}
                </div>
              )}
              {/* Maksimal info */}
              <div className="mt-1 text-xs text-gray-500">
                Maksimal: {currencyIDR(maxAmount)}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Metode Pembayaran</label>
              <select value={method} onChange={(e)=>setMethod(e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#540002] focus:border-transparent">
                <option>Transfer Bank</option>
                <option>Virtual Account</option>
                <option>E-Wallet</option>
                <option>Cash</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Bayar</label>
              <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#540002] focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan (opsional)</label>
              <textarea value={note} onChange={(e)=>setNote(e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#540002] focus:border-transparent" rows={3} />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {error}
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors" disabled={isSubmitting}>
                Batal
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting || !amount || Number(amount) <= 0} 
                className={`px-4 py-2 rounded-lg flex items-center gap-2 text-white transition-colors ${
                  isSubmitting || !amount || Number(amount) <= 0
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-[#540002] hover:bg-[#6d0003]'
                }`}
              >
                <Save className="w-4 h-4" /> {isSubmitting ? 'Menyimpan...' : 'Proses Pembayaran'}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                {confirmationType === 'excess' ? (
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-yellow-500" />
                )}
                <h3 className="text-lg font-semibold text-gray-900">
                  {confirmationType === 'excess' ? 'Pembayaran Melebihi Tagihan' : 'Konfirmasi Pembayaran Sebagian'}
                </h3>
              </div>
            
              <div className="space-y-3 mb-6">
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Sisa Tagihan:</span>
                    <span className="font-semibold">{currencyIDR(maxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Akan Dibayar:</span>
                    <span className="font-semibold text-blue-600">{currencyIDR(Number(amount))}</span>
                  </div>
                  {confirmationType === 'partial' && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Sisa Setelah Bayar:</span>
                      <span className="font-semibold text-red-600">{currencyIDR(maxAmount - Number(amount))}</span>
                    </div>
                  )}
                  {confirmationType === 'excess' && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Kelebihan:</span>
                      <span className="font-semibold text-red-600">{currencyIDR(Number(amount) - maxAmount)}</span>
                    </div>
                  )}
                </div>
                
                {confirmationType === 'partial' ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      <strong>Pembayaran sebagian:</strong> Status tagihan akan menjadi "Cicilan". 
                      Sisa <strong>{currencyIDR(maxAmount - Number(amount))}</strong> masih perlu dibayar di kemudian hari.
                    </p>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">
                      <strong>Nominal melebihi tagihan:</strong> Pembayaran akan dipotong menjadi {currencyIDR(maxAmount)}. 
                      Kelebihan <strong>{currencyIDR(Number(amount) - maxAmount)}</strong> tidak akan diproses.
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowConfirmation(false);
                    setConfirmationType(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmPayment}
                  className={`px-4 py-2 rounded-lg text-white transition-colors ${
                    confirmationType === 'excess' ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'
                  }`}
                >
                  {confirmationType === 'excess' ? 'Ya, Potong ke Maksimal' : 'Ya, Lanjutkan Pembayaran'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PaymentForm;
