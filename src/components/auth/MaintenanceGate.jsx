import React, { useState } from "react";
import { API_BASE_URL } from "../../lib/constants";
import logo from "../../assets/logo.png";

export function MaintenanceGate({ onUnlock }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Enter password to continue.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setError("Incorrect password.");
        return;
      }

      sessionStorage.setItem("txttrim_maintenance_unlocked", "1");
      onUnlock();
    } catch {
      setError("Unable to verify password. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-200 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-md bg-white/95 dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-8">
        <div className="flex items-center gap-4 mb-6">
          <img src={logo} alt="TxtTrim" className="h-14 w-14 object-contain" />
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
              TxtTrim
            </h1>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mt-1">
              AI SMS Optimiser
            </p>
          </div>
        </div>

        <p className="text-sm font-semibold uppercase tracking-wider text-nhs-blue">
          Undergoing maintenance
        </p>
        <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
          Service temporarily gated
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          We are improving message quality and shortening behavior. Enter the
          maintenance password to continue.
        </p>

        <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
          <label
            htmlFor="maintenance-pw"
            className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
          >
            Maintenance Password
          </label>
          <input
            id="maintenance-pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-nhs-blue focus:border-nhs-blue outline-none transition"
            placeholder="Enter password"
          />

          {error && (
            <div
              role="alert"
              className="text-sm text-nhs-red bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className={`w-full py-3 rounded-xl text-base font-bold text-white transition ${
              loading || !password.trim()
                ? "bg-slate-300 dark:bg-slate-700 cursor-not-allowed"
                : "bg-nhs-blue hover:bg-nhs-dark-blue"
            }`}
          >
            {loading ? "Checking..." : "Enter App"}
          </button>
        </form>
      </div>
    </div>
  );
}
