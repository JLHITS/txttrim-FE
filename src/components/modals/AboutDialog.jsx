import React, { useEffect } from "react";

export function AboutDialog({ onClose }) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="About TxtTrim"
    >
      <div
        className="bg-white dark:bg-slate-800 max-w-lg w-full rounded-2xl p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold mb-4 dark:text-white">
          About TxtTrim
        </h2>
        <p className="text-slate-600 dark:text-slate-300 mb-4">
          TxtTrim reduces SMS costs for healthcare and businesses by using AI to
          shorten messages without losing meaning.
        </p>
        <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-lg mb-6 text-sm dark:text-slate-200">
          <strong>Open Source:</strong> View code on{" "}
          <a
            href="https://github.com/JLHITS/txttrim-FE"
            className="text-nhs-blue dark:text-nhs-light-blue underline"
          >
            GitHub
          </a>
          .<br />
          <strong>Contact:</strong>{" "}
          <a
            href="mailto:lhits@lhits.co.uk"
            className="text-nhs-blue dark:text-nhs-light-blue underline"
          >
            lhits@lhits.co.uk
          </a>
        </div>
        <button
          onClick={onClose}
          className="w-full bg-slate-900 dark:bg-black text-white py-3 rounded-xl font-bold"
        >
          Close
        </button>
      </div>
    </div>
  );
}
