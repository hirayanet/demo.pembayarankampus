import React, { useEffect, useRef, useState } from 'react';
import { dbService } from '../lib/mysql';
import { currencyIDR, numberToBahasa } from '../lib/receipt';

interface Props {
  paymentId: string;
}

const ReceiptPrint: React.FC<Props> = ({ paymentId }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const logoUrl = (import.meta.env.VITE_RECEIPT_LOGO_URL as string) || '/logo.png';
  const lunasUrl = '/images/lunas.png';
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await dbService.getPaymentById(paymentId);
        setData(res);
      } finally {
        setLoading(false);
      }
    })();
  }, [paymentId]);

  // Handle receipt actions from URL (download only; print removed)
  // Helper: wait for fonts and images to be fully ready
  const ensureAssetsReady = async () => {
    // Wait webfonts
    if ((document as any).fonts?.ready) {
      try { await (document as any).fonts.ready; } catch {}
    }
    // Wait images inside content
    const el = contentRef.current;
    if (!el) return;
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
  };

  useEffect(() => {
    if (loading) return;
    if (!data) return;
    const h = typeof window !== 'undefined' ? window.location.hash : '';
    const qIndex = h.indexOf('?');
    if (qIndex !== -1) {
      const params = new URLSearchParams(h.substring(qIndex + 1));
      if (params.get('download') === '1') {
        // small delay to ensure render complete
        setTimeout(async () => {
          const el = contentRef.current;
          if (!el) return;
          const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
            import('html2canvas'),
            import('jspdf') as any,
          ]);
          // Ensure assets are fully ready
          await ensureAssetsReady();

          // Normalize layout as A4 width regardless of device viewport
          const TARGET_WIDTH = 794; // px ~210mm at 96dpi
          const originalStyle = {
            width: el.style.width,
            maxWidth: el.style.maxWidth,
          } as const;
          el.style.width = `${TARGET_WIDTH}px`;
          el.style.maxWidth = `${TARGET_WIDTH}px`;
          // Scroll to top to avoid off-screen rendering quirks on mobile
          window.scrollTo(0, 0);

          const canvas = await html2canvas(el, {
            backgroundColor: '#ffffff',
            useCORS: true,
            imageTimeout: 0,
            scale: 2,           // constant DPI across devices
            width: TARGET_WIDTH,
            windowWidth: TARGET_WIDTH, // compute layout at A4 width so breakpoints behave like desktop
            windowHeight: Math.max(el.scrollHeight, el.clientHeight),
            removeContainer: true,
          });
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const imgWidth = pageWidth;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          if (imgHeight <= pageHeight) {
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
          } else {
            let remainingHeight = imgHeight;
            let position = 0;
            while (remainingHeight > 0) {
              pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
              remainingHeight -= pageHeight;
              if (remainingHeight > 0) { pdf.addPage(); position -= pageHeight; }
            }
          // After adding page image(s), optionally draw LUNAS stamp directly to PDF
          try {
            const billStatus = String(data?.bills?.status ?? '').toLowerCase();
            const billTotal = Number((data as any)?.bills?.amount ?? 0);
            const billPaid = Number((data as any)?.bills?.paid_amount ?? 0);
            const statusPaid = ['paid','lunas','completed','complete','settlement','verified'].includes(billStatus);
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
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.src = lunasUrl;
              await new Promise<void>((resolve) => {
                const done = () => resolve();
                img.addEventListener('load', done, { once: true });
                img.addEventListener('error', done, { once: true });
              });
              if (img.naturalWidth && img.naturalHeight) {
                const targetW = pageWidth * 0.35; // a bit smaller for signature area
                const ratio = img.naturalHeight / img.naturalWidth;
                const targetH = targetW * ratio;
                // Position near "Yang Menerima" area: right-bottom third
                const x = pageWidth * 0.62;
                const y = pageHeight * 0.70;
                pdf.addImage(img, 'PNG', x, y, targetW, targetH);
              }
            }
          } catch {}
          }
          // Restore original styles
          el.style.width = originalStyle.width;
          el.style.maxWidth = originalStyle.maxWidth;

          const filename = (data?.receipt_number ? `Kwitansi-${data.receipt_number}` : `Kwitansi-${paymentId}`) + '.pdf';
          if (params.get('mode') === 'save') {
            // Force save/download
            pdf.save(filename);
          } else {
            // Open PDF in a new tab instead of saving, so shared links directly show the PDF
            const blobUrl = pdf.output('bloburl');
            // Replace current location to avoid keeping print styles/page
            window.location.replace(blobUrl);
          }
        }, 400);
      }
    }
  }, [loading, data]);

  return (
    <div className="min-h-screen bg-white text-gray-900 p-6 print:p-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; }
        }
        /* Ensure a stable A4 width container for rasterization */
        .receipt-a4 { width: 794px; max-width: 794px; }
      `}</style>
      <div className="relative max-w-3xl mx-auto border border-gray-200 rounded-md p-6 print:max-w-none print:mx-0 print:border-0 print:rounded-none print:p-10 receipt-a4" ref={contentRef}>
        {loading ? (
          <p>Memuat...</p>
        ) : data ? (
          <div>
            {/* Lunas watermark overlay for paid receipts */}
            {(() => {
              const billStatus = String(data?.bills?.status ?? '').toLowerCase();
              const billType = String(data?.bills?.type ?? '').toLowerCase();
              const billTotal = Number((data as any)?.bills?.amount ?? 0);
              const billPaid = Number((data as any)?.bills?.paid_amount ?? 0);
              const statusPaid = ['paid','lunas','completed','complete','settlement','verified'].includes(billStatus);
              const amountPaidEnough = billTotal > 0 ? billPaid >= billTotal : false;
              const isPartial = billStatus === 'partial' || (billTotal > 0 && billPaid > 0 && billPaid < billTotal) || billType === 'installment';
              // Allow force show via query or hash (?showLunas=1)
              let forceShow = false;
              try {
                const searchParams = new URLSearchParams(window.location.search || '');
                const hash = window.location.hash || '';
                const hashQuery = hash.includes('?') ? hash.substring(hash.indexOf('?') + 1) : '';
                const hashParams = new URLSearchParams(hashQuery);
                forceShow = searchParams.get('showLunas') === '1' || hashParams.get('showLunas') === '1';
              } catch {}

              const isPaid = statusPaid || amountPaidEnough || isPartial || forceShow;

              return (
                <>
                  <div className="absolute right-2 top-2 text-[10px] bg-yellow-50 text-yellow-700 border border-yellow-200 rounded px-1 py-0.5 z-20 opacity-80">
                    bill: {billStatus || '-'} | paidSum: {isNaN(billPaid)?'-':billPaid} / {isNaN(billTotal)?'-':billTotal}
                  </div>
                  {isPaid && (
                    <img
                      src={lunasUrl}
                      alt="Lunas"
                      className="pointer-events-none select-none opacity-50 absolute z-10"
                      style={{
                        width: 200,              // sedikit lebih kecil
                        maxWidth: '60%',
                        left: '74%',            // geser ke kanan (area tanda tangan)
                        top: '89%',             // turun ke area antara teks dan garis
                        transform: 'translate(-50%, -50%) rotate(0deg)',
                      }}
                    />
                  )}
                </>
              );
            })()}
            <div className="flex items-center gap-4 mb-4">
              <img src={logoUrl} alt="Logo" className="h-14" />
              <div>
                <div className="text-lg font-semibold">Kwitansi Pembayaran</div>
                <div className="text-gray-600 text-sm">Nomor Bukti: {data.receipt_number}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-4">
              <div>
                <div>Diterima dari: <span className="font-medium">{data.students?.name}</span></div>
                <div>NIM KASHIF: {data.students?.nim_kashif}</div>
                {data.students?.nim_dikti && <div>NIM DIKTI: {data.students?.nim_dikti}</div>}
                {(() => {
                  const s = String(data?.status ?? '').toLowerCase();
                  const billStatus = String(data?.bills?.status ?? '').toLowerCase();
                  const billType = String(data?.bills?.type ?? '').toLowerCase();
                  const total = Number((data as any)?.bills?.amount ?? 0);
                  const paid = Number((data as any)?.bills?.paid_amount ?? 0);
                  const isPaidByStatus = [s, billStatus].some(v => ['paid','success','approved','lunas','completed','complete','settlement','verified'].includes(v));
                  const isPaidByAmount = total > 0 ? paid >= total : false;
                  const isPartial = billStatus === 'partial' || (total > 0 && paid > 0 && paid < total) || billType === 'installment';
                  let label = 'BELUM LUNAS';
                  if (isPartial) label = 'CICILAN';
                  if (isPaidByStatus || isPaidByAmount) label = 'LUNAS';
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
                <div>Nomor Bukti: {data.receipt_number}</div>
                <div>Metode: {data.payment_method}</div>
              </div>
            </div>

            <hr className="my-2"/>

            <table className="w-full text-sm border border-gray-300 mb-2">
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

            <div className="flex justify-between text-sm mb-10">
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
                <div className="border border-amber-200 bg-amber-50 text-amber-900 rounded-md p-3 mb-6 text-sm">
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

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Catatan:</div>
                <p>Simpan lembaran ini sebagai bukti pembayaran yang sah.</p>
              </div>
              <div className="text-center">
                <div className="mb-12">Yang Menerima,</div>
                <div>(________________________)</div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-red-600">Bukti tidak ditemukan.</p>
        )}
      </div>
    </div>
  );
};

export default ReceiptPrint;
