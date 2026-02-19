import React from "react";
import logo from "../../assets/logo.png";
import logoInv from "../../assets/logoINV.png";
import rushcliffeLogo from "../../assets/rushcliffepcn.png";
import nottsWestLogo from "../../assets/nottinghamwestpcn.png";

export function Header({
  darkMode,
  onToggleDark,
  onShowHistory,
  onShowAbout,
}) {
  return (
    <header className="w-full bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 py-4 shadow-sm sticky top-0 z-20 transition-colors">
      <div className="max-w-3xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0">
        {/* Logo & Title */}
        <div className="flex items-center gap-4">
          <img
            src={darkMode ? logoInv : logo}
            alt="TxtTrim"
            className="h-14 w-14 object-contain"
            loading="lazy"
          />
          <div className="flex flex-col">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
              TxtTrim
            </h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
              AI SMS Optimiser
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onShowHistory}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition text-slate-600 dark:text-slate-200"
            aria-label="View history"
          >
            <span className="text-lg">📜</span>
          </button>
          <button
            onClick={onToggleDark}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
            aria-label={
              darkMode ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
          <button
            onClick={onShowAbout}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
            aria-label="About TxtTrim"
          >
            <span className="text-lg">ℹ️</span>
          </button>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />
          <div className="hidden sm:flex items-center gap-3 bg-white dark:bg-slate-700 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Made in
            </span>
            <a
              href="https://www.rushcliffehealth.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={rushcliffeLogo}
                alt="Rushcliffe PCN"
                className="h-9 w-auto grayscale hover:grayscale-0 transition-all duration-300 opacity-80 hover:opacity-100 mix-blend-multiply dark:mix-blend-normal dark:brightness-125"
                loading="lazy"
              />
            </a>
            <a
              href="https://www.nottinghamwestpcn.co.uk"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={nottsWestLogo}
                alt="Nottingham West PCN"
                className="h-9 w-auto grayscale hover:grayscale-0 transition-all duration-300 opacity-80 hover:opacity-100 mix-blend-multiply dark:mix-blend-normal dark:brightness-125"
                loading="lazy"
              />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
