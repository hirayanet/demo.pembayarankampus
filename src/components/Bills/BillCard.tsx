import React from 'react';
import { FileText, Calendar, DollarSign, CreditCard } from 'lucide-react';
import { currencyIDR } from '../../lib/receipt';

interface BillCardProps {
  bill: {
    id: string;
    description: string;
    amount: number;
    paid_amount: number;
    due_date: string;
    status: 'paid' | 'unpaid' | 'partial';
    installment_count?: number;
    category?: string;
    category_name?: string;
  };
  onPay: (billId: string) => void;
}

const BillCard: React.FC<BillCardProps> = ({ bill, onPay }) => {
  const isInstallment = bill.installment_count && bill.installment_count > 0;
  const remaining = isNaN(bill.amount - bill.paid_amount) ? 0 : bill.amount - bill.paid_amount;
  
  // Status badge styling
  const getStatusBadge = () => {
    switch (bill.status) {
      case 'paid':
        return <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">Lunas</span>;
      case 'partial':
        return <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">Cicilan</span>;
      default:
        return <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">Belum Bayar</span>;
    }
  };

  // Type badge styling
  const getTypeBadge = () => {
    // Only show type badge for installment bills
    if (!isInstallment) return null;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800`}>
        <CreditCard className="w-3 h-3 mr-1" />
        Cicilan
      </span>
    );
  };

  // Format due date safely
  const formatDueDate = () => {
    if (!bill.due_date) return 'Tanggal tidak valid';
    try {
      const date = new Date(bill.due_date);
      return isNaN(date.getTime()) ? 'Tanggal tidak valid' : date.toLocaleDateString('id-ID');
    } catch (e) {
      return 'Tanggal tidak valid';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{bill.description || bill.category_name || bill.category || 'Tagihan'}</h3>
            {getTypeBadge()}
          </div>
          <div className="flex items-center text-gray-600 text-sm mb-1">
            <DollarSign className="w-4 h-4 mr-1" />
            <span>Total: <span className="font-medium">{currencyIDR(bill.amount)}</span></span>
          </div>
          {bill.paid_amount > 0 && (
            <div className="flex items-center text-gray-600 text-sm mb-1">
              <span>Dibayar: <span className="font-medium text-green-600">{currencyIDR(bill.paid_amount)}</span></span>
            </div>
          )}
          <div className="flex items-center text-gray-600 text-sm">
            <Calendar className="w-4 h-4 mr-1" />
            <span>Jatuh Tempo: <span className="font-medium">{formatDueDate()}</span></span>
          </div>
        </div>
        <div className="flex flex-col items-end space-y-2">
          {getStatusBadge()}
          {bill.status !== 'paid' && (
            <button
              onClick={() => onPay(bill.id)}
              className="px-3 py-1 bg-[#540002] text-white text-sm font-medium rounded-lg hover:bg-[#6d0003] transition-colors"
            >
              Bayar
            </button>
          )}
        </div>
      </div>
      
      {bill.status === 'partial' && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Sisa Tagihan:</span>
            <span className="font-medium text-gray-900">{currencyIDR(remaining)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillCard;