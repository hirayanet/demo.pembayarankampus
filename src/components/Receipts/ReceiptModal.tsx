import React, { useEffect, useRef, useState } from 'react';
import { X, Share2, Download, RefreshCw, AlertTriangle } from 'lucide-react';
import { dbService } from '../../lib/mysql';
import { currencyIDR, numberToBahasa } from '../../lib/receipt';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentId: string;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, paymentId }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [retryCount, setRetryCount] = useState(0);
  const logoUrl = (import.meta.env.VITE_RECEIPT_LOGO_URL as string) || '/logo.png';
  const lunasUrl = '/images/lunas.png';
  const contentRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    if (!isOpen) return;
    try {
      setLoading(true);
      const res = await dbService.getPaymentById(paymentId);
      // Check if there's an error in the response
      if (res.error) {
        throw new Error(res.message);
      }
      setData(res);
    } catch (error: any) {
      console.error('Failed to load payment data:', error);
      // Create a minimal data object with error information
      setData({
        id: paymentId,
        error: true,
        authError: error?.authError || false,
        serverError: error?.serverError || false,
        notFound: error?.notFound || false,
        message: error?.message || 'Gagal memuat data pembayaran. Silakan coba lagi.',
        amount: 0,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'Unknown',
        receipt_number: 'ERROR-' + paymentId,
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
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isOpen, paymentId, retryCount]);

  if (!isOpen) return null;

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  const share = async () => {
    const base = `${window.location.origin}${window.location.pathname}`;
    const downloadUrl = `${base}#/receipt/${paymentId}?download=1&mode=save`;
    const nama = data?.students?.name || '-';
    const nim = data?.students?.nim_kashif || '-';
    const prodi = data?.students?.prodi || '-';
    const tanggal = data?.payment_date ? new Date(data.payment_date).toLocaleDateString('id-ID') : '-';
    const jumlah = currencyIDR(data?.amount || 0);
    const terbilang = numberToBahasa(data?.amount || 0);

    const lines = [
      'Assalamu\u2019alaikum,',
      '',
      `Berikut saya lampirkan bukti pembayaran ${data?.bills?.description || ''}:`,
      '',
      `- Nama: ${nama}`,
      `- NIM KASHIF: ${nim}`,
      `- Program: Strata Satu (S1) - ${prodi}`,
      `- Tanggal: ${tanggal}`,
      `- Jumlah: ${jumlah} (${terbilang})`,
      '',
      `Unduh Bukti Pembayaran (PDF) di sini: ${downloadUrl}`,
      '',
      'Terima kasih.',
    ];
    const text = lines.join('\n');
    // Gunakan WhatsApp link agar template teks selalu terkirim utuh di semua perangkat
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const downloadReceipt = async () => {
    const el = contentRef.current;
    if (!el) return;
    // Lazy import to keep initial bundle small
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf') as any,
    ]);

    // Ensure assets (fonts, images) are ready
    if ((document as any).fonts?.ready) {
      try { await (document as any).fonts.ready; } catch {}
    }
    const imgs = Array.from(el.querySelectorAll('img')) as HTMLImageElement[];
    await Promise.all(
      imgs.map(img =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              const done = () => resolve();
              img.addEventListener('load', done, { once: true });
              img.addEventListener('error', done, { once: true });
            })
      )
    );

    // Normalize layout to stable A4 width regardless of device viewport
    const TARGET_WIDTH = 794; // ~210mm at 96dpi
    const originalStyle = {
      width: el.style.width,
      maxWidth: el.style.maxWidth,
    } as const;
    el.style.width = `${TARGET_WIDTH}px`;
    el.style.maxWidth = `${TARGET_WIDTH}px`;
    window.scrollTo(0, 0);

    // Render to canvas with normalized viewport
    const canvas = await html2canvas(el, {
      backgroundColor: '#ffffff',
      useCORS: true,
      imageTimeout: 0,
      scale: 2,
      width: TARGET_WIDTH,
      windowWidth: TARGET_WIDTH,
      windowHeight: Math.max(el.scrollHeight, el.clientHeight),
      removeContainer: true,
    });
    const imgData = canvas.toDataURL('image/png');

    // Create A4 PDF in portrait (mm)
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Fit image to width, keep aspect ratio
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
    } else {
      // Multi-page if content taller than one page
      let remainingHeight = imgHeight;
      let position = 0;
      while (remainingHeight > 0) {
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        remainingHeight -= pageHeight;
        if (remainingHeight > 0) {
          pdf.addPage();
          position -= pageHeight; // move image up for next slice
        }
      }
    }

    // After raster content, optionally stamp LUNAS directly into the PDF
    try {
      const s = String(data?.status ?? '').toLowerCase();
      const billStatus = String(data?.bills?.status ?? '').toLowerCase();
      const billTotal = Number((data as any)?.bills?.amount ?? 0);
      const billPaid = Number((data as any)?.bills?.paid_amount ?? 0);
      const statusPaid = [s, billStatus].some(v => ['paid','success','approved','lunas','completed','complete','settlement','verified'].includes(v));
      const amountPaidEnough = billTotal > 0 ? billPaid >= billTotal : false;
      let forceShow = false;
      try {
        const searchParams = new URLSearchParams(window.location.search || '');
        const hash = window.location.hash || '';
        const hashQuery = hash.includes('?') ? hash.substring(hash.indexOf('?') + 1) : '';
        const hashParams = new URLSearchParams(hashQuery);
        forceShow = searchParams.get('showLunas') === '1' || hashParams.get('showLunas') === '1';
      } catch {}
      const isPaid = statusPaid || amountPaidEnough || forceShow;
      if (isPaid) {
        const stamp = new Image();
        stamp.crossOrigin = 'anonymous';
        stamp.src = lunasUrl;
        await new Promise<void>((resolve) => {
          const done = () => resolve();
          stamp.addEventListener('load', done, { once: true });
          stamp.addEventListener('error', done, { once: true });
        });
        if (stamp.naturalWidth && stamp.naturalHeight) {
          const targetW = pageWidth * 0.35; // smaller for signature area
          const ratio = stamp.naturalHeight / stamp.naturalWidth;
          const targetH = targetW * ratio;
          // right-bottom third near signature area
          const x = pageWidth * 0.62;
          const y = pageHeight * 0.70;
          pdf.addImage(stamp, 'PNG', x, y, targetW, targetH);
        }
      }
    } catch {}

    const filename = (data?.receipt_number ? `Kwitansi-${data.receipt_number}` : `Kwitansi-${paymentId}`) + '.pdf';
    // Restore original styles
    el.style.width = originalStyle.width;
    el.style.maxWidth = originalStyle.maxWidth;
    pdf.save(filename);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch md:items-center justify-start md:justify-center p-0 md:p-4">
      <div className="bg-white rounded-none md:rounded-lg shadow-xl w-screen h-screen md:w-full md:max-w-3xl md:h-auto md:max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between p-3 md:p-4 border-b print:hidden z-10">
          <h3 className="font-semibold text-gray-900">Bukti Pembayaran</h3>
          <div className="flex items-center gap-2">
            <button onClick={downloadReceipt} className="p-2 hover:bg-gray-100 rounded" title="Download"><Download className="w-5 h-5"/></button>
            <button onClick={share} className="p-2 hover:bg-gray-100 rounded" title="Share"><Share2 className="w-5 h-5"/></button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded" title="Tutup"><X className="w-5 h-5"/></button>
          </div>
        </div>
        <div className="relative p-4 md:p-6" ref={contentRef}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-[#540002] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600">Memuat bukti pembayaran...</p>
            </div>
          ) : data ? (
            <div className="text-[13px] md:text-sm text-gray-900">
              {data.error ? (
                // Display error message
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <h3 className="font-bold text-red-800 mb-2 flex items-center">
                    <AlertTriangle className="w-5 h-5 mr-2" />
                    {data.authError ? 'Sesi Kedaluwarsa' : 
                     data.serverError ? 'Masalah Server' : 
                     data.notFound ? 'Data Tidak Ditemukan' :
                     'Error Memuat Data Pembayaran'}
                  </h3>
                  <p className="text-red-700 mb-4">{data.message}</p>
                  
                  {data.authError && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button 
                        onClick={() => {
                          // Redirect to login page
                          window.location.hash = '#/login';
                          window.location.reload();
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                      >
                        Login Kembali
                      </button>
                    </div>
                  )}
                  
                  {data.serverError && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button 
                        onClick={handleRetry}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Coba Lagi
                      </button>
                      <button 
                        onClick={() => {
                          // Wait a few seconds and then reload
                          setTimeout(() => window.location.reload(), 3000);
                        }}
                        className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
                      >
                        Reload Halaman (3 detik)
                      </button>
                    </div>
                  )}
                  
                  {data.notFound && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button 
                        onClick={handleRetry}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Coba Lagi
                      </button>
                    </div>
                  )}
                  
                  {!data.authError && !data.serverError && !data.notFound && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button 
                        onClick={handleRetry}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Coba Lagi
                      </button>
                    </div>
                  )}
                  
                  <div className="mt-4 pt-4 border-t border-red-200">
                    <p className="text-red-600 text-sm">
                      <span className="font-medium">ID Pembayaran:</span> {data.id}
                    </p>
                    <p className="text-red-600 text-sm mt-1">
                      <span className="font-medium">Percobaan:</span> {retryCount + 1}
                    </p>
                  </div>
                </div>
              ) : (
                // Display normal receipt content
                <>
                  {(() => {
                    const billStatus = String(data?.bills?.status ?? '').toLowerCase();
                    const billType = String(data?.bills?.type ?? '').toLowerCase();
                    const billTotal = Number((data as any)?.bills?.amount ?? 0);
                    const billPaid = Number((data as any)?.bills?.paid_amount ?? 0);
                    const statusPaid = ['paid','lunas','completed','complete','settlement','verified'].includes(billStatus);
                    const amountPaidEnough = billTotal > 0 ? billPaid >= billTotal : false;
                    const isPartial = billStatus === 'partial' || (billTotal > 0 && billPaid > 0 && billPaid < billTotal) || billType === 'installment';
                    let forceShow = false;
                    try {
                      const searchParams = new URLSearchParams(window.location.search || '');
                      const hash = window.location.hash || '';
                      const hashQuery = hash.includes('?') ? hash.substring(hash.indexOf('?') + 1) : '';
                      const hashParams = new URLSearchParams(hashQuery);
                      forceShow = searchParams.get('showLunas') === '1' || hashParams.get('showLunas') === '1';
                    } catch {}
                    const isPaid = statusPaid || amountPaidEnough || isPartial || forceShow;
                    return isPaid ? (
                      <img
                        src={lunasUrl}
                        alt="Lunas"
                        className="pointer-events-none select-none opacity-50 absolute z-10"
                        style={{
                          width: 200,
                          maxWidth: '60%',
                          left: '74%',
                          top: '89%',
                          transform: 'translate(-50%, -50%) rotate(0deg)'
                        }}
                      />
                    ) : null;
                  })()}
                  <div className="flex items-center gap-3 md:gap-4 mb-4">
                    <img src={logoUrl} alt="Logo" className="h-10 md:h-12" />
                    <div>
                      <div className="font-semibold">Kwitansi Pembayaran</div>
                      <div className="text-gray-600">Nomor Bukti: {data.receipt_number}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                    <div>
                      <div>Diterima dari: <span className="font-medium">{data.students?.name}</span></div>
                      <div>NIM KASHIF: {data.students?.nim_kashif}</div>
                      {data.students?.nim_dikti && <div>NIM DIKTI: {data.students?.nim_dikti}</div>}
                      {(() => {
                        const billStatus = String(data?.bills?.status ?? '').toLowerCase();
                        const billType = String(data?.bills?.type ?? '').toLowerCase();
                        const total = Number((data as any)?.bills?.amount ?? 0);
                        const paid = Number((data as any)?.bills?.paid_amount ?? 0);
                        const isFullyPaid = (total > 0 ? paid >= total : false) || ['paid','lunas','completed','complete','settlement','verified'].includes(billStatus);
                        const isPartial = billStatus === 'partial' || (total > 0 && paid > 0 && paid < total) || billType === 'installment';
                        let label = 'BELUM LUNAS';
                        if (isFullyPaid) label = 'LUNAS';
                        else if (isPartial) label = 'CICILAN';
                        return (
                          <>
                            <div>Status: {label}</div>
                            {data?.bills?.category && (
                              <div>Jenis: {String(data.bills.category).toUpperCase()}</div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <div>
                      <div>Program Pendidikan: Strata Satu (S1)</div>
                      <div>Program Studi: {data.students?.prodi}</div>
                      <div>Metode: {data.payment_method}</div>
                      <div>Tanggal: {new Date(data.payment_date).toLocaleDateString('id-ID')}</div>
                    </div>
                  </div>

                  <hr className="my-2"/>

                  <table className="w-full text-[13px] md:text-sm border border-gray-300 mb-2">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border px-2 py-1 w-10">No.</th>
                        <th className="border px-2 py-1">Tanggal Bayar</th>
                        <th className="border px-2 py-1">Keterangan</th>
                        <th className="border px-2 py-1 w-36 text-right">Nominal</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border px-2 py-1 text-center">1</td>
                        <td className="border px-2 py-1">{new Date(data.payment_date).toLocaleDateString('id-ID')}</td>
                        <td className="border px-2 py-1">{data.bills?.description || '-'}</td>
                        <td className="border px-2 py-1 text-right">{currencyIDR(data.amount)}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[13px] md:text-sm mb-4">
                    <div>Terbilang: <em>{numberToBahasa(data.amount)}</em></div>
                    <div className="font-medium">Jumlah: {currencyIDR(data.amount)}</div>
                  </div>

                  {(() => {
                    const bill = (data as any)?.bills || {};
                    const isInstallment = bill?.installment_count && bill.installment_count > 0;
                    const isPartial = String(bill?.status || '').toLowerCase() === 'partial';
                    if (!(isInstallment || isPartial)) return null;
                    const total = Number(bill?.amount || 0);
                    const paidSum = Number(bill?.paid_amount || 0);
                    const remain = Math.max(total - paidSum, 0);
                    return (
                      <div className="border border-amber-200 bg-amber-50 text-amber-900 rounded-md p-3 mb-6 text-[13px] md:text-sm">
                        <div className="font-semibold mb-1">Informasi Cicilan</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>Total Tagihan: <span className="font-medium">{currencyIDR(total)}</span></div>
                          <div>Pembayaran Saat Ini: <span className="font-medium">{currencyIDR(Number(data?.amount || 0))}</span></div>
                          <div>Total Sudah Dibayar: <span className="font-medium">{currencyIDR(paidSum)}</span></div>
                          <div>Sisa Cicilan: <span className="font-semibold">{currencyIDR(remain)}</span></div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px] md:text-sm">
                    <div>
                      <div className="text-gray-600">Catatan:</div>
                      <p>Simpan lembaran ini sebagai bukti pembayaran yang sah.</p>
                    </div>
                    <div className="text-center">
                      <div className="mb-12">Yang Menerima,</div>
                      <div>(________________________)</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-red-600">Gagal memuat bukti pembayaran.</p>
              <button 
                onClick={handleRetry}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Coba Lagi
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;