import React, { useState, useEffect } from "react";
import posthog from 'posthog-js'; 
import QRCode from "react-qr-code"; 

// --- ASSETS ---
import logo from "./assets/logo.png"; 
import logoInv from "./assets/logoINV.png"; 
import rushcliffeLogo from "./assets/rushcliffepcn.png";
import nottsWestLogo from "./assets/nottinghamwestpcn.png";

// --- CONFIG ---
const API_BASE_URL = "/api";
const COST_PER_FRAGMENT = 0.022; 

// --- TEMPLATES DATA ---
const TEMPLATES = {
  "none": "",
  "flu_invite": "Dear Patient, this is a message from the surgery. We are writing to invite you to book your seasonal flu vaccination. We have clinics running this Saturday. Please book your appointment online by clicking this link: https://www.nhs.uk/conditions/vaccinations/flu-influenza-vaccine/",
  "appt_reminder": "Dear Patient, this is a reminder for your upcoming appointment at the surgery on [Date] at [Time]. If you are unable to attend, please cancel so we can offer the slot to another patient. Call us on 0115 000 0000.",
  "test_results": "Dear Patient, your recent test results have returned and the doctor has reviewed them. They are normal and no further action is required. You do not need to contact the surgery.",
  "dna_warning": "Dear Patient, our records show you missed your appointment today. Please be aware that missed appointments cost the NHS time and money. If you cannot attend in future, please cancel in advance."
};

// --- HELPERS: Reading Age Calculator (Flesch-Kincaid) ---
const countSyllables = (word) => {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const syllables = word.match(/[aeiouy]{1,2}/g);
  return syllables ? syllables.length : 1;
};

const calculateReadingAge = (text) => {
  if (!text.trim()) return null;
  
  const cleanText = text.replace(/[^\w\s.?!]/g, "");
  const words = cleanText.split(/\s+/).filter(w => w.length > 0);
  const sentences = cleanText.split(/[.?!]+/).filter(s => s.trim().length > 0);
  
  if (words.length === 0 || sentences.length === 0) return null;

  const totalWords = words.length;
  const totalSentences = sentences.length;
  const totalSyllables = words.reduce((acc, word) => acc + countSyllables(word), 0);

  const asl = totalWords / totalSentences;
  const asw = totalSyllables / totalWords;
  const grade = (0.39 * asl) + (11.8 * asw) - 15.59;
  const age = Math.round(grade + 5);
  
  if (age < 6) return { score: age, label: "Very Simple", color: "text-green-600 bg-green-50 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800" };
  if (age <= 11) return { score: age, label: "Perfect (NHS Standard)", color: "text-green-700 bg-green-100 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700" };
  if (age <= 14) return { score: age, label: "Moderate", color: "text-yellow-700 bg-yellow-100 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700" };
  return { score: age, label: "Complex", color: "text-red-700 bg-red-100 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700" };
};

function App() {
  // --- STATE ---
  const [text, setText] = useState("");
  const [maxChars, setMaxChars] = useState(160);
  const [businessSector, setBusinessSector] = useState("General");
  const [shortenUrls, setShortenUrls] = useState(true);
  const [protectVariables, setProtectVariables] = useState(true);
  
  // New States
  const [patientCount, setPatientCount] = useState(5000);
  const [signature, setSignature] = useState(""); 
  const [targetLanguage, setTargetLanguage] = useState("English");

  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  // UI Toggles
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [history, setHistory] = useState([]);
  const [maintenancePassword, setMaintenancePassword] = useState("");
  const [maintenanceError, setMaintenanceError] = useState("");
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // --- EFFECTS ---
  useEffect(() => {
    // --- POSTHOG INIT REMOVED (Handled in index.js) ---
    
    const storedSector = localStorage.getItem("preferredSector");
    const storedMaxChars = localStorage.getItem("preferredMaxChars");
    const storedHistory = JSON.parse(localStorage.getItem("txttrim_history") || "[]");
    const storedSig = localStorage.getItem("txttrim_signature");
    
    if (storedSector) setBusinessSector(storedSector);
    if (storedMaxChars) setMaxChars(Number(storedMaxChars));
    if (storedHistory) setHistory(storedHistory);
    if (storedSig) setSignature(storedSig);

    if (sessionStorage.getItem("txttrim_maintenance_unlocked") === "1") {
      setIsUnlocked(true);
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // --- ACTIONS ---
  const addToHistory = (newItem) => {
    const updated = [newItem, ...history].slice(0, 10);
    setHistory(updated);
    localStorage.setItem("txttrim_history", JSON.stringify(updated));
  };

  const loadFromHistory = (item) => {
    setText(item.original);
    setResponse(item.response);
    setShowHistory(false);
    posthog.capture('history_loaded'); // Track usage
  };

  const handleUnlock = async () => {
    if (!maintenancePassword.trim()) {
      setMaintenanceError("Enter password to continue.");
      return;
    }

    setMaintenanceError("");
    setMaintenanceLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: maintenancePassword }),
      });

      if (!res.ok) {
        setMaintenanceError("Incorrect password.");
        return;
      }

      sessionStorage.setItem("txttrim_maintenance_unlocked", "1");
      setIsUnlocked(true);
      setMaintenancePassword("");
    } catch (error) {
      console.error("Unlock error:", error);
      setMaintenanceError("Unable to verify password. Try again.");
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleShorten = async (overrideParams = {}) => {
    const txtToUse = overrideParams.text || text;
    const charsToUse = overrideParams.max_chars || maxChars;
    const sectorToUse = overrideParams.business_sector || businessSector;
    const langToUse = overrideParams.target_language || targetLanguage;

    if (!txtToUse.trim()) {
      setErrorMessage("⚠️ Please enter a message first.");
      return;
    }
    
    setErrorMessage("");
    setLoading(true);
    setCopied(false);

    if (overrideParams.max_chars) setMaxChars(overrideParams.max_chars);
    if (overrideParams.business_sector) setBusinessSector(overrideParams.business_sector);
    if (overrideParams.target_language) setTargetLanguage(overrideParams.target_language);

    // --- POSTHOG TRACKING ---
    posthog.capture('clicked_shorten', {
      sector: sectorToUse,
      language: langToUse,
      limit: charsToUse,
      has_signature: !!signature
    });

    // Calculate available chars for AI (Total limit - Signature length)
    const sigLength = signature ? signature.length + 1 : 0; 
    const aiMaxChars = charsToUse - sigLength;

    if (aiMaxChars < 1) {
      setLoading(false);
      setErrorMessage("Signature is too long for the selected SMS limit. Shorten signature or increase target limit.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/shorten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: txtToUse, 
          max_chars: aiMaxChars, 
          shorten_urls: shortenUrls, 
          business_sector: sectorToUse,
          protect_variables: protectVariables,
          target_language: langToUse
        }),
      });

      const rawBody = await res.text();
      let data = {};
      try {
        data = rawBody ? JSON.parse(rawBody) : {};
      } catch (parseError) {
        if (!res.ok) {
          throw new Error(`Server error (${res.status}). Please try again.`);
        }
        throw new Error("Server returned an invalid response.");
      }

      if (!res.ok) {
        const serverError = data?.error || `Server error (${res.status}).`;
        throw new Error(serverError);
      }
      
      // Append Signature locally
      if (signature && typeof data.shortened_text === "string") {
        data.shortened_text = `${data.shortened_text} ${signature}`;
        data.shortened_length = data.shortened_text.length;
      }

      setResponse(data);
      
      addToHistory({
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        original: txtToUse,
        response: data
      });

    } catch (error) {
      console.error("Error:", error);
      if ((error.message || "").includes("504")) {
        setErrorMessage("The server timed out. Please retry once or reduce message length.");
      } else {
        setErrorMessage(error.message || "Connection error. Please try again.");
      }
      posthog.capture('error_shorten', { message: error.message });
    }
    setLoading(false);
  };

  // Refinement Handlers
  const refineShorter = () => {
    if (!response) return;
    if (response.shortened_length <= 50) {
      setErrorMessage("⚠️ Maximum brevity reached.");
      return;
    }
    posthog.capture('refine_shorter');
    const newLimit = Math.max(40, response.shortened_length - 20);
    handleShorten({ max_chars: newLimit });
  };
  const refinePolite = () => {
    posthog.capture('refine_polite');
    handleShorten({ business_sector: "Healthcare" });
  };
  const refineFormal = () => {
    posthog.capture('refine_formal');
    handleShorten({ business_sector: "Legal" });
  };
  const refineSimple = () => {
    posthog.capture('refine_simple');
    handleShorten({ business_sector: "Plain English (Simple)" });
  };

  const handleCopy = () => {
    if (response?.shortened_text) {
      navigator.clipboard.writeText(response.shortened_text);
      setCopied(true);
      posthog.capture('copied_text'); // Track copy
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getFragmentCount = (len) => Math.ceil(len / 160);
  const getFragmentColor = (count) => count === 1 ? "text-green-600 dark:text-green-400" : count === 2 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";

  // --- RENDERERS ---

  const renderReadingAge = () => {
    if (!response) return null;
    const analysis = calculateReadingAge(response.shortened_text);
    if (!analysis) return null;

    return (
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${analysis.color}`}>
          <span>🎓 Reading Age: {analysis.score}</span>
          <span className="opacity-75 font-normal">({analysis.label})</span>
        </div>
        
        {analysis.score > 10 && (
          <button 
            onClick={refineSimple}
            className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold hover:bg-blue-200 dark:hover:bg-blue-800 transition flex items-center gap-1"
          >
            <span>📉</span> Simplify
          </button>
        )}
      </div>
    );
  };

  const renderSavings = () => {
    if (!response) return null;
    const oldFrags = getFragmentCount(response.original_length);
    const newFrags = getFragmentCount(response.shortened_length);
    const savedFrags = oldFrags - newFrags;
    if (savedFrags <= 0) return null;
    const savedPerMsg = savedFrags * COST_PER_FRAGMENT;

    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5 animate-fade-in-up shadow-sm transition-colors">
        <div className="flex items-center gap-2 mb-3 text-amber-800 dark:text-amber-400">
           <span className="text-xl">💰</span>
           <h3 className="font-bold">Potential Cost Savings</h3>
        </div>
        <p className="text-sm text-amber-900 dark:text-amber-300 mb-4">
          You saved <strong>{savedFrags} SMS fragments</strong> per patient!
        </p>
        
        <div className="space-y-4">
           {/* Per Message Line */}
           <div className="flex justify-between items-center text-sm border-b border-amber-100 dark:border-amber-800 pb-2">
              <span className="text-amber-700 dark:text-amber-400">Single Message</span>
              <span className="font-bold text-amber-900 dark:text-amber-200">£{savedPerMsg.toFixed(3)}</span>
           </div>

           {/* Interactive Slider Section */}
           <div className="pt-1">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  List Size: {patientCount.toLocaleString()} patients
                </label>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  £{(savedPerMsg * patientCount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="100000" 
                step="100"
                value={patientCount} 
                onChange={(e) => setPatientCount(Number(e.target.value))}
                className="w-full h-2 bg-amber-200 dark:bg-amber-800 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <div className="flex justify-between text-[10px] text-amber-500 dark:text-amber-500 mt-1">
                <span>1</span>
                <span>50k</span>
                <span>100k</span>
              </div>
           </div>
        </div>
      </div>
    );
  };

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-200 px-4 py-8 flex items-center justify-center">
        <div className="w-full max-w-md bg-white/95 border border-slate-200 rounded-2xl shadow-xl p-8">
          <div className="flex items-center gap-4 mb-6">
            <img src={logo} alt="TxtTrim" className="h-14 w-14 object-contain" />
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 leading-none">TxtTrim</h1>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">AI SMS Optimiser</p>
            </div>
          </div>

          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Undergoing maintenance</p>
          <h2 className="mt-2 text-xl font-bold text-slate-900">Service temporarily gated</h2>
          <p className="mt-2 text-sm text-slate-600">
            We are improving message quality and shortening behavior. Enter the maintenance password to continue.
          </p>

          <form
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              handleUnlock();
            }}
          >
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
              Maintenance Password
            </label>
            <input
              type="password"
              value={maintenancePassword}
              onChange={(e) => setMaintenancePassword(e.target.value)}
              autoComplete="current-password"
              className="w-full p-3 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="Enter password"
            />

            {maintenanceError && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {maintenanceError}
              </div>
            )}

            <button
              type="submit"
              disabled={maintenanceLoading || !maintenancePassword.trim()}
              className={`w-full py-3 rounded-xl text-base font-bold text-white transition ${
                maintenanceLoading || !maintenancePassword.trim()
                  ? "bg-slate-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {maintenanceLoading ? "Checking..." : "Enter App"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans selection:bg-blue-100 dark:selection:bg-blue-900 transition-colors duration-300">
      
      {/* --- HEADER --- */}
      <header className="w-full bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 py-4 shadow-sm sticky top-0 z-20 transition-colors">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
          
          {/* LEFT: LOGO & HEADER */}
          <div className="flex items-center gap-5">
            <img 
              src={darkMode ? logoInv : logo} 
              alt="TxtTrim" 
              className="h-16 w-16 object-contain" 
            />
            <div className="flex flex-col">
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">TxtTrim</h1>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">AI SMS Optimiser</p>
            </div>
          </div>

          {/* RIGHT: CREDITS & ACTIONS */}
          <div className="flex items-center gap-3 mt-4 md:mt-0">
            <button onClick={() => setShowHistory(true)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition text-slate-600 dark:text-slate-200" title="History"><span className="text-lg">📜</span></button>
            <button onClick={() => setDarkMode(!darkMode)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition" title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}>{darkMode ? "☀️" : "🌙"}</button>
            <button onClick={() => setShowAbout(!showAbout)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition" title="About TxtTrim"><span className="text-lg">ℹ️</span></button>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>
            <div className="hidden sm:flex items-center gap-3 bg-white dark:bg-slate-700 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Made in</span>
                <a href="https://www.rushcliffehealth.org" target="_blank" rel="noopener noreferrer"><img src={rushcliffeLogo} alt="Rushcliffe PCN" className="h-9 w-auto grayscale hover:grayscale-0 transition-all duration-300 opacity-80 hover:opacity-100 mix-blend-multiply dark:mix-blend-normal dark:brightness-125" /></a>
                <a href="https://www.nottinghamwestpcn.co.uk" target="_blank" rel="noopener noreferrer"><img src={nottsWestLogo} alt="Nottingham West PCN" className="h-9 w-auto grayscale hover:grayscale-0 transition-all duration-300 opacity-80 hover:opacity-100 mix-blend-multiply dark:mix-blend-normal dark:brightness-125" /></a>
            </div>
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
        
        {/* LEFT COLUMN: INPUTS */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Input Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-colors">
            <div className="flex justify-between items-end mb-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Original Message</label>
              <select className="text-xs bg-slate-100 dark:bg-slate-700 border-none rounded-lg py-1 px-3 text-slate-600 dark:text-slate-300 font-medium cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 focus:ring-0 transition-colors" onChange={(e) => { if (e.target.value !== "none") { setText(TEMPLATES[e.target.value]); setErrorMessage(""); }}} defaultValue="none">
                <option value="none">✨ Load a Template...</option>
                <option value="flu_invite">💉 Flu Invitation</option>
                <option value="appt_reminder">📅 Appt Reminder</option>
                <option value="test_results">✅ Normal Results</option>
                <option value="dna_warning">🚫 Missed Appt (DNA)</option>
              </select>
            </div>

            <textarea className="w-full h-40 p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-base resize-none" placeholder="Paste your long message here..." value={text} onChange={(e) => { setText(e.target.value); if (e.target.value) setErrorMessage(""); }} />
            
            <div className="flex justify-between items-center mt-3 text-sm text-slate-500 dark:text-slate-400">
              <span>{text.length} chars</span>
              <span className={`font-medium ${getFragmentColor(getFragmentCount(text.length))}`}>
                {getFragmentCount(text.length)} SMS Fragment{getFragmentCount(text.length) !== 1 && 's'}
              </span>
            </div>

            {errorMessage && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm rounded-lg border border-red-100 dark:border-red-800 flex items-center gap-2 animate-shake">
                <span>🚨</span> {errorMessage}
              </div>
            )}
          </div>

          {/* Settings Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 grid grid-cols-1 md:grid-cols-2 gap-6 transition-colors">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Target Limit</label>
              <select value={maxChars} onChange={(e) => { setMaxChars(Number(e.target.value)); localStorage.setItem("preferredMaxChars", e.target.value); }} className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value={160}>Strict (160 chars - 1 SMS)</option>
                <option value={320}>Standard (320 chars - 2 SMS)</option>
                <option value={480}>Long (480 chars - 3 SMS)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Tone / Sector</label>
              <select value={businessSector} onChange={(e) => { setBusinessSector(e.target.value); localStorage.setItem("preferredSector", e.target.value); }} className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="General">General (Neutral)</option>
                <option value="Healthcare">Healthcare (Empathetic)</option>
                <option value="Retail">Retail (Upbeat)</option>
                <option value="Finance">Finance (Trustworthy)</option>
                <option value="Education">Education (Supportive)</option>
                <option value="Legal">Legal (Formal)</option>
              </select>
            </div>

            {/* NEW: LANGUAGE DROPDOWN */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Translate To</label>
              <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="English">🇬🇧 English</option>
                <option value="Polish">🇵🇱 Polish (Polski)</option>
                <option value="Urdu">🇵🇰 Urdu (اردو)</option>
                <option value="Romanian">🇷🇴 Romanian (Română)</option>
                <option value="Punjabi">🇮🇳 Punjabi (ਪੰਜਾਬੀ)</option>
                <option value="Arabic">🇸🇦 Arabic (العربية)</option>
                <option value="Chinese">🇨🇳 Chinese (Simplified)</option>
                <option value="Ukrainian">🇺🇦 Ukrainian</option>
                <option value="French">🇫🇷 French</option>
                <option value="Spanish">🇪🇸 Spanish</option>
              </select>
            </div>

            {/* NEW: SIGNATURE INPUT */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Auto Sign-off</label>
              <input 
                type="text" 
                placeholder="- Dr Smith" 
                value={signature} 
                onChange={(e) => { setSignature(e.target.value); localStorage.setItem("txttrim_signature", e.target.value); }} 
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            
            <div className="md:col-span-2 flex flex-col gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
              <div className="flex items-center gap-3">
                <input type="checkbox" id="shortenUrl" checked={shortenUrls} onChange={() => setShortenUrls(!shortenUrls)} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                <label htmlFor="shortenUrl" className="text-sm text-blue-900 dark:text-blue-200 cursor-pointer select-none">Automatically shorten URLs using <strong>is.gd</strong></label>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="protectVars" checked={protectVariables} onChange={() => setProtectVariables(!protectVariables)} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                <label htmlFor="protectVars" className="text-sm text-blue-900 dark:text-blue-200 cursor-pointer select-none">Keep merge fields (e.g. <strong>[Date]</strong>, <strong>[Name]</strong>)</label>
              </div>
            </div>
          </div>

          <button onClick={() => handleShorten()} disabled={loading || !text.trim()} className={`w-full py-4 rounded-xl text-lg font-bold text-white shadow-md transition-all transform active:scale-[0.99] ${loading || !text.trim() ? "bg-slate-300 dark:bg-slate-700 cursor-not-allowed shadow-none" : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 hover:shadow-lg"}`}>{loading ? "Optimising..." : "Shorten Message ✨"}</button>
        </div>

        {/* RIGHT COLUMN: RESULTS */}
        <div className="lg:col-span-5 space-y-6">
            
            {/* PHONE PREVIEW & SUGGESTIONS */}
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border-4 border-slate-800 dark:border-slate-950 overflow-hidden relative min-h-[300px] transition-all duration-500 ease-in-out">
              {/* Notch/Header */}
              <div className="bg-slate-100 dark:bg-slate-700 h-10 border-b border-slate-200 dark:border-slate-600 flex items-center justify-center">
                 <div className="w-14 h-3 bg-slate-300 dark:bg-slate-500 rounded-full opacity-50"></div>
              </div>

              {/* Screen Content */}
              <div className="px-4 pt-4 pb-2 bg-slate-50 dark:bg-slate-900 flex flex-col gap-3">
                <div className="text-center text-[10px] text-slate-400 my-1">Today 10:23 AM</div>
                
                {/* Message Bubble */}
                <div className={`self-end max-w-[90%] p-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm transition-all duration-500 
                  ${response ? "bg-blue-500 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 italic"}`}>
                  {response ? response.shortened_text : "Your shortened message will appear here..."}
                </div>
                
                {response && (
                  <>
                    <div className="self-end text-[10px] text-slate-500 dark:text-slate-400 pr-1 -mt-1 animate-fade-in">
                       Sent • {response.shortened_length} chars
                    </div>

                    {/* SMART SUGGESTIONS */}
                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                      <p className="text-[9px] uppercase font-bold text-slate-400 text-center mb-2 tracking-widest">Quick Refine</p>
                      <div className="flex gap-2 justify-center overflow-x-auto pb-1 hide-scrollbar">
                         <button onClick={refineShorter} className="whitespace-nowrap px-3 py-1.5 rounded-full bg-slate-200 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition flex items-center gap-1">
                           <span>✂️</span> Shorter
                         </button>
                         <button onClick={refinePolite} className="whitespace-nowrap px-3 py-1.5 rounded-full bg-slate-200 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition flex items-center gap-1">
                           <span>🙏</span> Polite
                         </button>
                         <button onClick={refineFormal} className="whitespace-nowrap px-3 py-1.5 rounded-full bg-slate-200 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition flex items-center gap-1">
                           <span>👔</span> Formal
                         </button>
                      </div>
                    </div>
                  </>
                )}
                
                <div className="h-1"></div>
              </div>
            </div>

            {/* RESULTS METRICS */}
            {response && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl p-5 animate-fade-in-up transition-colors">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="font-bold text-emerald-800 dark:text-emerald-400">Optimisation Results</h3>
                   <span className="text-xs bg-white dark:bg-emerald-900 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-700 font-mono text-emerald-600 dark:text-emerald-300">-{((1 - (response.shortened_length / response.original_length)) * 100).toFixed(0)}% Size</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div><p className="text-xs text-emerald-600 dark:text-emerald-500 uppercase font-bold">Original</p><p className="text-lg font-mono text-slate-700 dark:text-slate-300">{response.original_length} chars</p></div>
                    <div><p className="text-xs text-emerald-600 dark:text-emerald-500 uppercase font-bold">New Length</p><p className="text-lg font-mono text-slate-900 dark:text-white font-bold">{response.shortened_length} chars</p></div>
                </div>
                
                {renderReadingAge()}
                
                <div className="flex gap-3 mt-4">
                  <button onClick={handleCopy} className={`flex-1 py-3 rounded-xl font-bold text-lg shadow-sm transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 ${copied ? "bg-emerald-700 text-white ring-2 ring-emerald-200" : "bg-emerald-500 hover:bg-emerald-600 text-white hover:shadow-emerald-200"}`}>{copied ? <><span>✅</span> Copied!</> : <><span>📋</span> Copy</>}</button>
                  <button onClick={() => setShowQR(true)} className="px-5 py-3 rounded-xl bg-slate-800 dark:bg-slate-700 text-white font-bold shadow-sm hover:bg-slate-700 dark:hover:bg-slate-600 transition" title="Test on Phone"><span className="text-lg">📱</span></button>
                </div>
              </div>
            )}

            {renderSavings()}
            
            <div className="text-center">
                <button onClick={() => setShowDisclaimer(!showDisclaimer)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline">{showDisclaimer ? "Hide Disclaimer" : "Legal Disclaimer"}</button>
                {showDisclaimer && <div className="mt-4 text-xs text-slate-500 dark:text-slate-400 text-left bg-slate-100 dark:bg-slate-800 p-4 rounded-lg"><strong>Disclaimer:</strong> Do not enter confidential/PII data. TxtTrim is an automated tool. Always verify messages.</div>}
            </div>
        </div>
      </main>

      {/* --- HISTORY SIDEBAR (DRAWER) --- */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowHistory(false)}></div>
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl p-6 overflow-y-auto transition-colors">
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold dark:text-white">Recent History</h2><button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">Close</button></div>
            {history.length === 0 ? <p className="text-slate-400 text-center mt-10">No history yet. Start shortening!</p> : (
              <div className="space-y-4">
                {history.map((item) => (
                  <div key={item.id} onClick={() => loadFromHistory(item)} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 hover:border-blue-300 cursor-pointer transition group">
                    <div className="flex justify-between text-xs text-slate-400 mb-2"><span>{item.timestamp}</span><span className="group-hover:text-blue-500">Load ↺</span></div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 font-mono bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-700">{item.response.shortened_text}</p>
                    <div className="mt-2 flex gap-2 text-xs"><span className="text-green-600 dark:text-green-400">{item.response.shortened_length} chars</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- QR CODE MODAL --- */}
      {showQR && response && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowQR(false)}>
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center transform transition-all scale-100" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Test on Device</h2>
            <p className="text-slate-500 text-sm mb-6">Scan to open in WhatsApp</p>
            
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-inner inline-block">
              <QRCode 
                value={`https://wa.me/?text=${encodeURIComponent(response.shortened_text)}`}
                size={200}
                fgColor="#1e293b"
              />
            </div>
            
            <p className="mt-6 text-xs text-slate-400">Works with iOS & Android Camera</p>
            <button onClick={() => setShowQR(false)} className="mt-6 w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-bold transition">Close</button>
          </div>
        </div>
      )}

      {/* ABOUT MODAL */}
      {showAbout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAbout(false)}>
          <div className="bg-white dark:bg-slate-800 max-w-lg w-full rounded-2xl p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-4 dark:text-white">About TxtTrim</h2>
            <p className="text-slate-600 dark:text-slate-300 mb-4">TxtTrim reduces SMS costs for healthcare and businesses by using AI to shorten messages without losing meaning.</p>
            <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-lg mb-6 text-sm dark:text-slate-200"><strong>Open Source:</strong> View code on <a href="https://github.com/JLHITS/txttrim-FE" className="text-blue-600 dark:text-blue-400 underline">GitHub</a>.<br/><strong>Contact:</strong> <a href="mailto:lhits@lhits.co.uk" className="text-blue-600 dark:text-blue-400 underline">lhits@lhits.co.uk</a></div>
            <button onClick={() => setShowAbout(false)} className="w-full bg-slate-900 dark:bg-black text-white py-3 rounded-xl font-bold">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
