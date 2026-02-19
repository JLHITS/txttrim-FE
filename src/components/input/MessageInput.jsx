import React from "react";
import { TEMPLATES } from "../../lib/templates";
import { getFragmentCount, getFragmentColor } from "../../lib/sms-utils";

export function MessageInput({ text, onTextChange, errorMessage, onClearError }) {
  const handleTemplateLoad = (e) => {
    if (e.target.value !== "none") {
      onTextChange(TEMPLATES[e.target.value]);
      if (onClearError) onClearError();
    }
  };

  const fragments = getFragmentCount(text.length);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-colors">
      <div className="flex justify-between items-end mb-2">
        <label
          htmlFor="message-input"
          className="text-sm font-semibold text-slate-700 dark:text-slate-300"
        >
          Original Message
        </label>
        <select
          className="text-xs bg-slate-100 dark:bg-slate-700 border-none rounded-lg py-1 px-3 text-slate-600 dark:text-slate-300 font-medium cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 focus:ring-0 transition-colors"
          onChange={handleTemplateLoad}
          defaultValue="none"
          aria-label="Load a template"
        >
          <option value="none">Load a Template...</option>
          <option value="flu_invite">Flu Invitation</option>
          <option value="appt_reminder">Appt Reminder</option>
          <option value="test_results">Normal Results</option>
          <option value="dna_warning">Missed Appt (DNA)</option>
        </select>
      </div>

      <textarea
        id="message-input"
        className="w-full h-40 p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-nhs-blue focus:border-nhs-blue outline-none transition text-base resize-none"
        placeholder="Paste your long message here..."
        value={text}
        onChange={(e) => {
          onTextChange(e.target.value);
          if (e.target.value && onClearError) onClearError();
        }}
      />

      <div className="flex justify-between items-center mt-3 text-sm text-slate-500 dark:text-slate-400">
        <span>{text.length} chars</span>
        <span className={`font-medium ${getFragmentColor(fragments)}`}>
          {fragments} SMS Fragment{fragments !== 1 && "s"}
        </span>
      </div>

      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 text-nhs-red dark:text-red-300 text-sm rounded-lg border border-red-100 dark:border-red-800 flex items-center gap-2 animate-shake"
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
}
