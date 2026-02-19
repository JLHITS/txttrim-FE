import React from "react";

export function SettingsPanel({
  maxChars,
  onMaxCharsChange,
  businessSector,
  onBusinessSectorChange,
  targetLanguage,
  onTargetLanguageChange,
  signature,
  onSignatureChange,
  shortenUrls,
  onShortenUrlsChange,
  protectVariables,
  onProtectVariablesChange,
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 grid grid-cols-1 sm:grid-cols-2 gap-5 transition-colors">
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          Target Limit
        </label>
        <select
          value={maxChars}
          onChange={(e) => onMaxCharsChange(Number(e.target.value))}
          className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-nhs-blue outline-none"
        >
          <option value={160}>Strict (160 chars - 1 SMS)</option>
          <option value={320}>Standard (320 chars - 2 SMS)</option>
          <option value={480}>Long (480 chars - 3 SMS)</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          Tone / Sector
        </label>
        <select
          value={businessSector}
          onChange={(e) => onBusinessSectorChange(e.target.value)}
          className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-nhs-blue outline-none"
        >
          <option value="General">General (Neutral)</option>
          <option value="Healthcare">Healthcare (Empathetic)</option>
          <option value="Retail">Retail (Upbeat)</option>
          <option value="Finance">Finance (Trustworthy)</option>
          <option value="Education">Education (Supportive)</option>
          <option value="Legal">Legal (Formal)</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          Translate To
        </label>
        <select
          value={targetLanguage}
          onChange={(e) => onTargetLanguageChange(e.target.value)}
          className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-nhs-blue outline-none"
        >
          <option value="English">English</option>
          <option value="Polish">Polish (Polski)</option>
          <option value="Urdu">Urdu (اردو)</option>
          <option value="Romanian">Romanian (Română)</option>
          <option value="Punjabi">Punjabi (ਪੰਜਾਬੀ)</option>
          <option value="Arabic">Arabic (العربية)</option>
          <option value="Chinese">Chinese (Simplified)</option>
          <option value="Ukrainian">Ukrainian</option>
          <option value="French">French</option>
          <option value="Spanish">Spanish</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          Auto Sign-off
        </label>
        <input
          type="text"
          placeholder="- Dr Smith"
          value={signature}
          onChange={(e) => onSignatureChange(e.target.value)}
          className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-nhs-blue outline-none"
        />
      </div>

      <div className="sm:col-span-2 flex flex-col gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="shortenUrl"
            checked={shortenUrls}
            onChange={() => onShortenUrlsChange(!shortenUrls)}
            className="w-4 h-4 text-nhs-blue rounded focus:ring-nhs-blue"
          />
          <label
            htmlFor="shortenUrl"
            className="text-sm text-blue-900 dark:text-blue-200 cursor-pointer select-none"
          >
            Automatically shorten URLs using <strong>is.gd</strong>
          </label>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="protectVars"
            checked={protectVariables}
            onChange={() => onProtectVariablesChange(!protectVariables)}
            className="w-4 h-4 text-nhs-blue rounded focus:ring-nhs-blue"
          />
          <label
            htmlFor="protectVars"
            className="text-sm text-blue-900 dark:text-blue-200 cursor-pointer select-none"
          >
            Keep merge fields (e.g. <strong>[Date]</strong>,{" "}
            <strong>[Name]</strong>)
          </label>
        </div>
      </div>
    </div>
  );
}
