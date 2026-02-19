import React from "react";

export function ShortenButton({ loading, disabled, onShorten }) {
  return (
    <button
      onClick={onShorten}
      disabled={loading || disabled}
      aria-busy={loading}
      className={`w-full py-4 rounded-xl text-lg font-bold text-white shadow-md transition-all transform active:scale-[0.99] relative overflow-hidden ${
        loading || disabled
          ? "bg-slate-300 dark:bg-slate-700 cursor-not-allowed shadow-none"
          : "bg-nhs-blue hover:bg-nhs-dark-blue hover:shadow-lg"
      }`}
    >
      {loading && (
        <span className="absolute inset-0 animate-shimmer" />
      )}
      <span className="relative">
        {loading ? "Optimising..." : "Shorten Message"}
      </span>
      {!loading && !disabled && (
        <kbd className="ml-2 text-xs opacity-60 font-normal">Ctrl+Enter</kbd>
      )}
    </button>
  );
}
