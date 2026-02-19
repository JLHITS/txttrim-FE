import React, { useState, useEffect, useCallback } from "react";
import { track } from "./lib/analytics";

import { useDarkMode } from "./hooks/useDarkMode";
import { useHistory } from "./hooks/useHistory";
import { usePreferences } from "./hooks/usePreferences";
import { useShorten } from "./hooks/useShorten";

import { MaintenanceGate } from "./components/auth/MaintenanceGate";
import { Header } from "./components/layout/Header";
import { MessageInput } from "./components/input/MessageInput";
import { SettingsPanel } from "./components/input/SettingsPanel";
import { ShortenButton } from "./components/input/ShortenButton";
import { ResultsCard } from "./components/output/ResultsCard";
import { CostSavings } from "./components/output/CostSavings";
import { HistorySheet } from "./components/modals/HistorySheet";
import { QRDialog } from "./components/modals/QRDialog";
import { AboutDialog } from "./components/modals/AboutDialog";

function App() {
  const [text, setText] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const { darkMode, toggleDarkMode } = useDarkMode();
  const { history, addToHistory } = useHistory();
  const prefs = usePreferences();
  const {
    response,
    loading,
    copied,
    errorMessage,
    setErrorMessage,
    handleShorten,
    handleCopy,
    setResponse,
  } = useShorten({ addToHistory });

  // Check maintenance unlock on mount
  useEffect(() => {
    if (sessionStorage.getItem("txttrim_maintenance_unlocked") === "1") {
      setIsUnlocked(true);
    }
  }, []);

  const triggerShorten = useCallback(
    (overrides = {}) => {
      handleShorten({
        text: overrides.text || text,
        maxChars: overrides.maxChars || prefs.maxChars,
        businessSector: overrides.businessSector || prefs.businessSector,
        targetLanguage: overrides.targetLanguage || prefs.targetLanguage,
        signature: prefs.signature,
        shortenUrls: prefs.shortenUrls,
        protectVariables: prefs.protectVariables,
      });
    },
    [text, prefs, handleShorten],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        triggerShorten();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "C" || e.key === "c")) {
        e.preventDefault();
        handleCopy();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [triggerShorten, handleCopy]);

  const refineSimple = () => {
    track("refine_simple");
    triggerShorten({ businessSector: "Plain English (Simple)" });
  };

  const loadFromHistory = (item) => {
    setText(item.original);
    setResponse(item.response);
    setShowHistory(false);
    track("history_loaded");
  };

  if (!isUnlocked) {
    return <MaintenanceGate onUnlock={() => setIsUnlocked(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 selection:bg-blue-100 dark:selection:bg-blue-900 transition-colors duration-300">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg"
      >
        Skip to content
      </a>

      <Header
        darkMode={darkMode}
        onToggleDark={toggleDarkMode}
        onShowHistory={() => setShowHistory(true)}
        onShowAbout={() => setShowAbout(!showAbout)}
      />

      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <MessageInput
          text={text}
          onTextChange={setText}
          errorMessage={errorMessage}
          onClearError={() => setErrorMessage("")}
        />

        <SettingsPanel
          maxChars={prefs.maxChars}
          onMaxCharsChange={prefs.setMaxChars}
          businessSector={prefs.businessSector}
          onBusinessSectorChange={prefs.setBusinessSector}
          targetLanguage={prefs.targetLanguage}
          onTargetLanguageChange={prefs.setTargetLanguage}
          signature={prefs.signature}
          onSignatureChange={prefs.setSignature}
          shortenUrls={prefs.shortenUrls}
          onShortenUrlsChange={prefs.setShortenUrls}
          protectVariables={prefs.protectVariables}
          onProtectVariablesChange={prefs.setProtectVariables}
        />

        <ShortenButton
          loading={loading}
          disabled={!text.trim()}
          onShorten={() => triggerShorten()}
        />

        <ResultsCard
          response={response}
          copied={copied}
          onCopy={handleCopy}
          onShowQR={() => setShowQR(true)}
          onSimplify={refineSimple}
        />

        <CostSavings response={response} />

        <div className="text-center">
          <button
            onClick={() => setShowDisclaimer(!showDisclaimer)}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline"
          >
            {showDisclaimer ? "Hide Disclaimer" : "Legal Disclaimer"}
          </button>
          {showDisclaimer && (
            <div className="mt-4 text-xs text-slate-500 dark:text-slate-400 text-left bg-slate-100 dark:bg-slate-800 p-4 rounded-lg">
              <strong>Disclaimer:</strong> Do not enter confidential/PII data.
              TxtTrim is an automated tool. Always verify messages.
            </div>
          )}
        </div>
      </main>

      {showHistory && (
        <HistorySheet
          history={history}
          onLoadItem={loadFromHistory}
          onClose={() => setShowHistory(false)}
        />
      )}

      {showQR && response && (
        <QRDialog
          text={response.shortened_text}
          onClose={() => setShowQR(false)}
        />
      )}

      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
    </div>
  );
}

export default App;
