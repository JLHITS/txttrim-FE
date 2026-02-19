import React from "react";

export function PhonePreview({ response }) {
  const hasResult = !!response;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border-[3px] border-slate-900 dark:border-slate-950 overflow-hidden transition-all duration-500 ease-in-out">
      {/* Status bar */}
      <div className="bg-slate-900 dark:bg-black px-6 pt-3 pb-2 flex items-center justify-between">
        <span className="text-[10px] text-white/70 font-medium">9:41</span>
        <div className="w-20 h-5 bg-slate-800 dark:bg-slate-900 rounded-full mx-auto" />
        <div className="flex items-center gap-1">
          <svg className="w-3 h-3 text-white/70" fill="currentColor" viewBox="0 0 24 24">
            <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
          </svg>
          <svg className="w-3 h-3 text-white/70" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z" />
          </svg>
        </div>
      </div>

      {/* Messages header */}
      <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2.5 border-b border-slate-200 dark:border-slate-600 flex items-center gap-3">
        <svg className="w-4 h-4 text-nhs-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <div className="flex-1 text-center">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">NHS Surgery</p>
          <p className="text-[9px] text-slate-400">SMS</p>
        </div>
        <div className="w-4" />
      </div>

      {/* Message area */}
      <div className="px-4 pt-4 pb-6 bg-slate-50 dark:bg-slate-900 min-h-[280px] flex flex-col">
        <div className="text-center text-[10px] text-slate-400 mb-3">Today</div>

        {hasResult ? (
          <>
            <div className="self-end max-w-[85%] p-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm bg-nhs-blue text-white animate-fade-in">
              {response.shortened_text}
            </div>
            <div className="self-end text-[10px] text-slate-400 dark:text-slate-500 pr-1 mt-1 animate-fade-in">
              Delivered &bull; {response.shortened_length} chars
            </div>
          </>
        ) : (
          <>
            <div className="self-end max-w-[85%] p-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed bg-slate-200 dark:bg-slate-800">
              <div className="flex flex-col gap-2">
                <div className="h-3 w-48 bg-slate-300 dark:bg-slate-700 rounded-full" />
                <div className="h-3 w-36 bg-slate-300 dark:bg-slate-700 rounded-full" />
                <div className="h-3 w-24 bg-slate-300 dark:bg-slate-700 rounded-full" />
              </div>
            </div>
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6 italic">
              Your optimised message will appear here
            </p>
          </>
        )}

        <div className="flex-1" />

        {/* iMessage-style input bar */}
        <div className="mt-4 flex items-center gap-2 px-1">
          <div className="flex-1 h-8 bg-white dark:bg-slate-800 rounded-full border border-slate-300 dark:border-slate-600 px-3 flex items-center">
            <span className="text-[10px] text-slate-400">iMessage</span>
          </div>
          <div className="w-7 h-7 rounded-full bg-nhs-blue flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-7-7l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Home indicator */}
      <div className="bg-slate-50 dark:bg-slate-900 pb-2 flex justify-center">
        <div className="w-28 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
      </div>
    </div>
  );
}
