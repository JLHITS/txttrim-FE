import React, { useEffect, useRef } from "react";

export function HistorySheet({ history, onLoadItem, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Recent history">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl p-6 overflow-y-auto transition-colors"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold dark:text-white">Recent History</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            Close
          </button>
        </div>
        {history.length === 0 ? (
          <p className="text-slate-400 text-center mt-10">
            No history yet. Start shortening!
          </p>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <div
                key={item.id}
                onClick={() => onLoadItem(item)}
                className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 hover:border-nhs-blue cursor-pointer transition group"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onLoadItem(item);
                }}
              >
                <div className="flex justify-between text-xs text-slate-400 mb-2">
                  <span>{item.timestamp}</span>
                  <span className="group-hover:text-nhs-blue">Load</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 font-mono bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-700">
                  {item.response.shortened_text}
                </p>
                <div className="mt-2 flex gap-2 text-xs">
                  <span className="text-green-600 dark:text-green-400">
                    {item.response.shortened_length} chars
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
