import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';

interface BarcodeScannerModalProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({ onScan, onClose }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize the scanner
    scannerRef.current = new Html5QrcodeScanner(
      'barcode-reader',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        rememberLastUsedCamera: true,
      },
      false
    );

    const onScanSuccess = (decodedText: string) => {
      // Stop scanner automatically after successful scan
      scannerRef.current?.clear().then(() => {
        onScan(decodedText);
      }).catch(err => {
        console.error('Failed to clear scanner', err);
        onScan(decodedText);
      });
    };

    const onScanFailure = (errorMessage: string) => {
      // Usually called constantly as it tries to scan, we only care about success
      // console.warn(errorMessage);
    };

    try {
      scannerRef.current.render(onScanSuccess, onScanFailure);
    } catch (err: any) {
      setError(err?.message || 'Failed to initialize camera');
    }

    return () => {
      scannerRef.current?.clear().catch(console.error);
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md bg-surface border border-surface-2 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-2 bg-surface-1/50">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-sira-400" />
            <h3 className="font-semibold text-slate-100">مسح الباركود</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-2 text-slate-400 hover:text-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scanner Container */}
        <div className="p-4 bg-surface flex-1 flex flex-col items-center">
          {error && (
            <div className="w-full p-3 mb-4 bg-red-900/50 border border-red-500/50 rounded-lg text-red-200 text-sm text-center">
              {error}
            </div>
          )}
          
          <div className="w-full max-w-[300px] overflow-hidden rounded-xl border-2 border-dashed border-sira-500/50 bg-black">
            <div id="barcode-reader" className="w-full"></div>
          </div>
          
          <p className="mt-6 text-sm text-slate-400 text-center leading-relaxed">
            قم بتوجيه الكاميرا نحو الـ QR Code أو الباركود الموجود على الجهاز ليتم قراءته تلقائياً.
          </p>
        </div>
      </div>
    </div>
  );
};
