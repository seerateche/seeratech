import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, Image as ImageIcon } from 'lucide-react';

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (scannerRef.current) {
        setIsStarting(true);
        scannerRef.current.scanFile(file, true)
          .then(decodedText => {
            if (scannerRef.current?.isScanning) {
              scannerRef.current.stop().catch(console.error);
            }
            onScan(decodedText);
          })
          .catch(err => {
            setIsStarting(false);
            setError('لم يتم العثور على باركود في الصورة. يرجى اختيار صورة أوضح.');
          });
      }
    }
  };

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
              <button onClick={() => setError(null)} className="btn-secondary btn-sm mt-2">حاول مرة أخرى</button>
            </div>
          ) : (
            <>
              {isStarting && (
                <div className="absolute flex flex-col items-center justify-center text-sira-400 gap-2 z-20 bg-surface/80 inset-0 rounded-xl">
                  <div className="w-8 h-8 border-4 border-sira-500/30 border-t-sira-400 rounded-full animate-spin" />
                  <span className="text-sm">جاري المعالجة...</span>
                </div>
              )}
              <div className={`w-full max-w-[300px] overflow-hidden rounded-xl border-2 ${isStarting ? 'border-transparent' : 'border-dashed border-sira-500'} bg-black relative z-10`}>
                <div id="barcode-reader" className="w-full h-full min-h-[250px]"></div>
              </div>
              
              <div className="mt-6 w-full flex flex-col items-center gap-3">
                <p className="text-sm text-slate-400 text-center leading-relaxed">
                  قم بتوجيه الكاميرا نحو الـ QR Code أو الباركود ليتم قراءته تلقائياً.
                </p>
                <div className="flex items-center gap-2 w-full mt-2">
                  <div className="h-px bg-surface-2 flex-1" />
                  <span className="text-xs text-slate-500 font-medium px-2">أو</span>
                  <div className="h-px bg-surface-2 flex-1" />
                </div>
                <label className="btn-secondary w-full justify-center cursor-pointer relative overflow-hidden">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  اختيار صورة من المعرض
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
