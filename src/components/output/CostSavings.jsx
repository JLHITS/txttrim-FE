import React, { useState } from "react";
import { getFragmentCount } from "../../lib/sms-utils";
import { COST_PER_FRAGMENT } from "../../lib/constants";

export function CostSavings({ response }) {
  const [patientCount, setPatientCount] = useState(5000);
  const [expanded, setExpanded] = useState(true);

  if (!response) return null;

  const oldFrags = getFragmentCount(response.original_length);
  const newFrags = getFragmentCount(response.shortened_length);
  const savedFrags = oldFrags - newFrags;
  if (savedFrags <= 0) return null;

  const savedPerMsg = savedFrags * COST_PER_FRAGMENT;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl shadow-sm transition-colors animate-fade-in-up">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
          <span className="text-xl">💰</span>
          <h3 className="font-bold">Potential Cost Savings</h3>
        </div>
        <span className="text-amber-500 text-sm">
          {expanded ? "Hide" : "Show"}
        </span>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          <p className="text-sm text-amber-900 dark:text-amber-300">
            You saved <strong>{savedFrags} SMS fragments</strong> per patient!
          </p>

          <div className="flex justify-between items-center text-sm border-b border-amber-100 dark:border-amber-800 pb-2">
            <span className="text-amber-700 dark:text-amber-400">
              Single Message
            </span>
            <span className="font-bold text-amber-900 dark:text-amber-200">
              £{savedPerMsg.toFixed(3)}
            </span>
          </div>

          <div className="pt-1">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                List Size: {patientCount.toLocaleString()} patients
              </label>
              <span className="text-lg font-bold text-nhs-green dark:text-green-400">
                £
                {(savedPerMsg * patientCount).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="100000"
              step="100"
              value={patientCount}
              onChange={(e) => setPatientCount(Number(e.target.value))}
              className="w-full h-2 bg-amber-200 dark:bg-amber-800 rounded-lg appearance-none cursor-pointer accent-nhs-green"
            />
            <div className="flex justify-between text-[10px] text-amber-500 dark:text-amber-500 mt-1">
              <span>1</span>
              <span>50k</span>
              <span>100k</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
