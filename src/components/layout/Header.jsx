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
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0">
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
        <div className="flex items-center gap-1.5">
          <button
            onClick={onShowHistory}
            className="group relative h-9 px-3 flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-nhs-blue dark:hover:border-nhs-light-blue hover:shadow-sm transition-all text-slate-500 dark:text-slate-300 hover:text-nhs-blue dark:hover:text-nhs-light-blue"
            aria-label="View history"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-medium hidden md:inline">History</span>
          </button>
          <button
            onClick={onToggleDark}
            className="group relative h-9 px-3 flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-nhs-blue dark:hover:border-nhs-light-blue hover:shadow-sm transition-all text-slate-500 dark:text-slate-300 hover:text-nhs-blue dark:hover:text-nhs-light-blue"
            aria-label={
              darkMode ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {darkMode ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
            <span className="text-xs font-medium hidden md:inline">{darkMode ? "Light" : "Dark"}</span>
          </button>
          <button
            onClick={onShowAbout}
            className="group relative h-9 px-3 flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-nhs-blue dark:hover:border-nhs-light-blue hover:shadow-sm transition-all text-slate-500 dark:text-slate-300 hover:text-nhs-blue dark:hover:text-nhs-light-blue"
            aria-label="About TxtTrim"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-medium hidden md:inline">About</span>
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
