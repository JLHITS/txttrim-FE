import React, { useMemo } from "react";
import { calculateReadingAge } from "../../lib/reading-age";

export function ReadingAgeBadge({ text, onSimplify }) {
  const analysis = useMemo(() => calculateReadingAge(text), [text]);

  if (!analysis) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-4">
      <div
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${analysis.color}`}
      >
        <span>Reading Age: {analysis.score}</span>
        <span className="opacity-75 font-normal">({analysis.label})</span>
      </div>

      {analysis.score > 10 && onSimplify && (
        <button
          onClick={onSimplify}
          className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold hover:bg-blue-200 dark:hover:bg-blue-800 transition flex items-center gap-1"
        >
          Simplify
        </button>
      )}
    </div>
  );
}
