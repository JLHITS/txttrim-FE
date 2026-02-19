import React, { useEffect } from "react";
import QRCode from "react-qr-code";

export function QRDialog({ text, onClose }) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="QR code for testing on device"
    >
      <div
        className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center transform transition-all scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Test on Device
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
          Scan to open in WhatsApp
        </p>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-inner inline-block">
          <QRCode
            value={`https://wa.me/?text=${encodeURIComponent(text)}`}
            size={200}
            fgColor="#1e293b"
          />
        </div>

        <p className="mt-6 text-xs text-slate-400">
          Works with iOS & Android Camera
        </p>
        <button
          onClick={onClose}
          className="mt-6 w-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 py-3 rounded-xl font-bold transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}
