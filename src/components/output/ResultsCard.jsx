import React from "react";
import { ReadingAgeBadge } from "../shared/ReadingAgeBadge";

export function ResultsCard({
  response,
  copied,
  onCopy,
  onShowQR,
  onSimplify,
}) {
  if (!response) return null;

  const percentSaved = (
    (1 - response.shortened_length / response.original_length) *
    100
  ).toFixed(0);

  return (
    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl p-5 transition-colors animate-fade-in-up">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-emerald-800 dark:text-emerald-400">
          Optimisation Results
        </h3>
        <span className="text-xs bg-white dark:bg-emerald-900 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-700 font-mono text-emerald-600 dark:text-emerald-300">
          -{percentSaved}% Size
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-emerald-600 dark:text-emerald-500 uppercase font-bold">
            Original
          </p>
          <p className="text-lg font-mono text-slate-700 dark:text-slate-300">
            {response.original_length} chars
          </p>
        </div>
        <div>
          <p className="text-xs text-emerald-600 dark:text-emerald-500 uppercase font-bold">
            New Length
          </p>
          <p className="text-lg font-mono text-slate-900 dark:text-white font-bold">
            {response.shortened_length} chars
          </p>
        </div>
      </div>

      <ReadingAgeBadge
        text={response.shortened_text}
        onSimplify={onSimplify}
      />

      <div className="flex gap-3 mt-4">
        <button
          onClick={onCopy}
          className={`flex-1 py-3 rounded-xl font-bold text-lg shadow-sm transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 ${
            copied
              ? "bg-emerald-700 text-white ring-2 ring-emerald-200 animate-scale-bounce"
              : "bg-emerald-500 hover:bg-emerald-600 text-white hover:shadow-emerald-200"
          }`}
        >
          {copied ? "Copied!" : "Copy"}
          {!copied && (
            <kbd className="text-xs opacity-60 font-normal">
              Ctrl+Shift+C
            </kbd>
          )}
        </button>
        <button
          onClick={onShowQR}
          className="px-5 py-3 rounded-xl bg-slate-800 dark:bg-slate-700 text-white font-bold shadow-sm hover:bg-slate-700 dark:hover:bg-slate-600 transition"
          aria-label="Test on phone via QR code"
        >
          <span className="text-lg">📱</span>
        </button>
      </div>
    </div>
  );
}
