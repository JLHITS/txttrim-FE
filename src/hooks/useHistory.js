import { useState, useEffect } from "react";

const STORAGE_KEY = "txttrim_history";

export function useHistory() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (stored.length) setHistory(stored);
  }, []);

  const addToHistory = (item) => {
    setHistory((prev) => {
      const updated = [item, ...prev].slice(0, 10);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return { history, addToHistory, clearHistory };
}
