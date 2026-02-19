import { useState, useEffect } from "react";

export function useDarkMode() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.matches) setDarkMode(true);

    const handler = (e) => setDarkMode(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((d) => !d);

  return { darkMode, toggleDarkMode };
}
