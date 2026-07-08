import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle } from 'lucide-react';

interface BarcodeScannerModalProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({ onScan, onClose }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);

  useEffect(() => {
    // Initialize the core scanner
    const html5QrCode = new Html5Qrcode("barcode-reader");
    scannerRef.current = html5QrCode;

    html5QrCode.start(
      { facingMode: "environment" }, // Prefer back camera
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      },
      (decodedText) => {
        // Success callback
        html5QrCode.stop().then(() => {
          onScan(decodedText);
        }).catch(() => {
          onScan(decodedText);
        });
      },
      (errorMessage) => {
        // Ignore continuous frame errors
      }
    ).then(() => {
      setIsStarting(false);
    }).catch((err: any) => {
      setIsStarting(false);
      setError('يرجى السماح للمتصفح باستخدام الكاميرا أو التأكد من عدم استخدامها في تطبيق آخر.');
      console.error("Camera start error:", err);
    });

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
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
        <div className="p-4 bg-surface flex-1 flex flex-col items-center justify-center min-h-[350px]">
          {error ? (
            <div className="w-full p-4 bg-red-900/20 border border-red-500/30 rounded-xl flex flex-col items-center text-center gap-3">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-red-200 text-sm">{error}</p>
              <button onClick={onClose} className="btn-secondary btn-sm mt-2">إغلاق</button>
            </div>
          ) : (
            <>
              {isStarting && (
                <div className="absolute flex flex-col items-center justify-center text-sira-400 gap-2">
                  <div className="w-8 h-8 border-4 border-sira-500/30 border-t-sira-400 rounded-full animate-spin" />
                  <span className="text-sm">جاري تشغيل الكاميرا...</span>
                </div>
              )}
              <div className={`w-full max-w-[300px] overflow-hidden rounded-xl border-2 ${isStarting ? 'border-transparent' : 'border-dashed border-sira-500'} bg-black relative z-10`}>
                <div id="barcode-reader" className="w-full h-full min-h-[250px]"></div>
              </div>
              
              <p className="mt-6 text-sm text-slate-400 text-center leading-relaxed">
                قم بتوجيه الكاميرا نحو الـ QR Code أو الباركود الموجود على الجهاز ليتم قراءته تلقائياً.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
