import React, { useState, useEffect } from "react";
import ReactGA from "react-ga4";

// --- ASSETS ---
import logo from "./assets/logo.png"; 
import rushcliffeLogo from "./assets/rushcliffepcn.png";
import nottsWestLogo from "./assets/nottinghamwestpcn.png";

// --- CONFIG ---
const API_BASE_URL = "https://txttrim-backend.onrender.com";
const TRACKING_ID = "G-KKM0XZD821";
const COST_PER_FRAGMENT = 0.022; // £0.022 per SMS fragment

function App() {
  // State
  const [text, setText] = useState("");
  const [maxChars, setMaxChars] = useState(160);
  const [businessSector, setBusinessSector] = useState("General");
  const [shortenUrls, setShortenUrls] = useState(true);
  
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  // UI Toggles
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  // --- EFFECTS ---
  useEffect(() => {
    ReactGA.initialize(TRACKING_ID);
    ReactGA.send("pageview");
    
    const storedSector = localStorage.getItem("preferredSector");
    const storedMaxChars = localStorage.getItem("preferredMaxChars");
    if (storedSector) setBusinessSector(storedSector);
    if (storedMaxChars) setMaxChars(Number(storedMaxChars));
  }, []);

  // --- HANDLERS ---
  const handleShorten = async () => {
    if (!text.trim()) {
      setErrorMessage("⚠️ Please enter a message first.");
      return;
    }
    setErrorMessage("");
    setLoading(true);
    setCopied(false);

    ReactGA.event({ category: "User", action: "Clicked Shorten", label: "Shorten Attempt" });

    try {
      const res = await fetch(`${API_BASE_URL}/shorten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, max_chars: maxChars, shorten_urls: shortenUrls, business_sector: businessSector }),
      });
      const data = await res.json();
      setResponse(data);
    } catch (error) {
      console.error("Error:", error);
      setErrorMessage("Connection error. Please try again.");
    }
    setLoading(false);
  };

  const handleCopy = () => {
    if (response?.shortened_text) {
      navigator.clipboard.writeText(response.shortened_text);
      setCopied(true);
      ReactGA.event({ category: "User", action: "Copied SMS", label: "Clipboard Copy" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getFragmentCount = (len) => Math.ceil(len / 160);
  const getFragmentColor = (count) => count === 1 ? "text-green-600" : count === 2 ? "text-yellow-600" : "text-red-600";

  // --- SAVINGS CALCULATION ---
  const renderSavings = () => {
    if (!response) return null;

    const oldFrags = getFragmentCount(response.original_length);
    const newFrags = getFragmentCount(response.shortened_length);
    const savedFrags = oldFrags - newFrags;

    // If no money saved, don't show the box
    if (savedFrags <= 0) return null;

    const savedPerMsg = savedFrags * COST_PER_FRAGMENT;

    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 animate-fade-in-up shadow-sm">
        <div className="flex items-center gap-2 mb-3 text-amber-800">
           <span className="text-xl">💰</span>
           <h3 className="font-bold">Potential Cost Savings</h3>
        </div>
        
        <p className="text-sm text-amber-900 mb-4">
          You saved <strong>{savedFrags} SMS fragments</strong> per patient! 
          <br/>At <span className="font-mono">£{COST_PER_FRAGMENT}</span> per fragment, here is what you save:
        </p>

        <div className="space-y-2">
           <div className="flex justify-between items-center text-sm border-b border-amber-100 pb-1">
              <span className="text-amber-700">Single Message</span>
              <span className="font-bold text-amber-900">£{savedPerMsg.toFixed(3)}</span>
           </div>
           <div className="flex justify-between items-center text-sm border-b border-amber-100 pb-1">
              <span className="text-amber-700">List of 1,000 Patients</span>
              <span className="font-bold text-green-700">£{(savedPerMsg * 1000).toFixed(2)}</span>
           </div>
           <div className="flex justify-between items-center text-sm font-medium pt-1">
              <span className="text-amber-700">List of 5,000 Patients</span>
              <span className="font-bold text-green-700">£{(savedPerMsg * 5000).toFixed(2)}</span>
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-100">
      
      {/* --- HEADER --- */}
      <header className="w-full bg-white border-b border-slate-200 py-3 shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
          
          {/* LEFT: LOGO */}
          <div className="flex items-center gap-3">
            <img src={logo} alt="TxtTrim" className="h-12 w-auto object-contain" />
            <div className="flex flex-col justify-center h-full">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI SMS Optimiser</p>
            </div>
          </div>

          {/* RIGHT: CREDITS & ABOUT */}
          <div className="flex items-center gap-6">
            
            {/* Credits Badge (Now with LINKS) */}
            <div className="flex items-center gap-3 bg-white px-4 py-1.5 rounded-full border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Made in</span>
                
                <a href="https://www.rushcliffehealth.org" target="_blank" rel="noopener noreferrer">
                  <img 
                    src={rushcliffeLogo} 
                    alt="Rushcliffe PCN" 
                    className="h-6 w-auto grayscale hover:grayscale-0 transition-all duration-300 opacity-80 hover:opacity-100 mix-blend-multiply" 
                    title="Rushcliffe PCN" 
                  />
                </a>
                
                <a href="https://www.nottinghamwestpcn.co.uk" target="_blank" rel="noopener noreferrer">
                  <img 
                    src={nottsWestLogo} 
                    alt="Nottingham West PCN" 
                    className="h-6 w-auto grayscale hover:grayscale-0 transition-all duration-300 opacity-80 hover:opacity-100 mix-blend-multiply" 
                    title="Nottingham West PCN" 
                  />
                </a>
            </div>

            <button onClick={() => setShowAbout(!showAbout)} className="text-sm font-medium text-slate-500 hover:text-blue-600 transition">
                About
            </button>
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: INPUTS */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Input Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Original Message</label>
            <textarea
              className="w-full h-40 p-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-base resize-none"
              placeholder="Paste your long message here..."
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value) setErrorMessage("");
              }}
            />
            <div className="flex justify-between items-center mt-3 text-sm text-slate-500">
              <span>{text.length} chars</span>
              <span className={`font-medium ${getFragmentColor(getFragmentCount(text.length))}`}>
                {getFragmentCount(text.length)} SMS Fragment{getFragmentCount(text.length) !== 1 && 's'}
              </span>
            </div>
            {errorMessage && (
              <div className="mt-3 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 flex items-center gap-2">
                <span>🚨</span> {errorMessage}
              </div>
            )}
          </div>

          {/* Settings Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Limit</label>
              <select 
                value={maxChars}
                onChange={(e) => {
                  setMaxChars(Number(e.target.value));
                  localStorage.setItem("preferredMaxChars", e.target.value);
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value={160}>Strict (160 chars - 1 SMS)</option>
                <option value={320}>Standard (320 chars - 2 SMS)</option>
                <option value={480}>Long (480 chars - 3 SMS)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tone / Sector</label>
              <select 
                value={businessSector}
                onChange={(e) => {
                  setBusinessSector(e.target.value);
                  localStorage.setItem("preferredSector", e.target.value);
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="General">General (Neutral)</option>
                <option value="Healthcare">Healthcare (Empathetic)</option>
                <option value="Retail">Retail (Upbeat)</option>
                <option value="Finance">Finance (Trustworthy)</option>
                <option value="Education">Education (Supportive)</option>
                <option value="Legal">Legal (Formal)</option>
              </select>
            </div>
            
            <div className="md:col-span-2 flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <input 
                type="checkbox" 
                id="shortenUrl"
                checked={shortenUrls}
                onChange={() => setShortenUrls(!shortenUrls)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="shortenUrl" className="text-sm text-blue-900 cursor-pointer select-none">
                Automatically shorten URLs using <strong>is.gd</strong>
              </label>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleShorten}
            disabled={loading || !text.trim()}
            className={`w-full py-4 rounded-xl text-lg font-bold text-white shadow-md transition-all transform active:scale-[0.99]
              ${loading || !text.trim() 
                ? "bg-slate-300 cursor-not-allowed shadow-none" 
                : "bg-blue-600 hover:bg-blue-700 hover:shadow-lg"
              }`}
          >
            {loading ? "Optimising..." : "Shorten Message ✨"}
          </button>
        </div>


        {/* RIGHT COLUMN: RESULTS */}
        <div className="lg:col-span-5 space-y-6">
            
            {/* PHONE PREVIEW */}
            <div className="bg-white rounded-[2rem] shadow-xl border-4 border-slate-800 overflow-hidden relative min-h-[400px]">
              <div className="bg-slate-100 h-12 border-b border-slate-200 flex items-center justify-center">
                 <div className="w-16 h-4 bg-slate-300 rounded-full opacity-50"></div>
              </div>
              <div className="p-4 bg-slate-50 h-full flex flex-col gap-4 min-h-[300px]">
                <div className="text-center text-xs text-slate-400 my-2">Today 10:23 AM</div>
                <div className={`self-end max-w-[85%] p-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm transition-all duration-500
                  ${response ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-400 italic"}`}>
                  {response ? response.shortened_text : "Your shortened message will appear here..."}
                </div>
                {response && (
                  <div className="self-end text-xs text-slate-500 pr-1 animate-fade-in">
                     Sent • {response.shortened_length} chars
                  </div>
                )}
              </div>
            </div>

            {/* RESULTS METRICS */}
            {response && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 animate-fade-in-up">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="font-bold text-emerald-800">Optimisation Results</h3>
                   <span className="text-xs bg-white px-2 py-1 rounded border border-emerald-200 font-mono text-emerald-600">
                     -{((1 - (response.shortened_length / response.original_length)) * 100).toFixed(0)}% Size
                   </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <p className="text-xs text-emerald-600 uppercase font-bold">Original</p>
                        <p className="text-lg font-mono text-slate-700">{response.original_length} chars</p>
                    </div>
                    <div>
                        <p className="text-xs text-emerald-600 uppercase font-bold">New Length</p>
                        <p className="text-lg font-mono text-slate-900 font-bold">{response.shortened_length} chars</p>
                    </div>
                </div>
                
                {/* COPY BUTTON */}
                <button 
                  onClick={handleCopy}
                  className={`w-full py-3 rounded-xl font-bold text-lg shadow-sm transition-all transform active:scale-[0.98] flex items-center justify-center gap-2
                    ${copied 
                      ? "bg-emerald-700 text-white ring-2 ring-emerald-200" 
                      : "bg-emerald-500 hover:bg-emerald-600 text-white hover:shadow-emerald-200"
                    }`}
                >
                  {copied ? (
                    <><span>✅</span> Copied!</>
                  ) : (
                    <><span>📋</span> Copy Text</>
                  )}
                </button>
              </div>
            )}

            {/* SAVINGS BOX (Only shows if money saved) */}
            {renderSavings()}

            {/* DISCLAIMER TOGGLE */}
            <div className="text-center">
                <button onClick={() => setShowDisclaimer(!showDisclaimer)} className="text-xs text-slate-400 underline">
                    {showDisclaimer ? "Hide Disclaimer" : "Legal Disclaimer"}
                </button>
                {showDisclaimer && (
                    <div className="mt-4 text-xs text-slate-500 text-left bg-slate-100 p-4 rounded-lg">
                        <strong>Disclaimer:</strong> Do not enter confidential/PII data. 
                        TxtTrim is an automated tool and may produce errors. 
                        Always verify message content before sending.
                    </div>
                )}
            </div>
        </div>
      </main>

      {/* ABOUT MODAL */}
      {showAbout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAbout(false)}>
          <div className="bg-white max-w-lg w-full rounded-2xl p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-4">About TxtTrim</h2>
            <p className="text-slate-600 mb-4">
              TxtTrim reduces SMS costs for healthcare and businesses by using AI to shorten messages without losing meaning.
            </p>
            <div className="bg-slate-100 p-4 rounded-lg mb-6 text-sm">
              <strong>Open Source:</strong> View code on <a href="https://github.com/JLHITS/txttrim-FE" className="text-blue-600 underline">GitHub</a>.<br/>
              <strong>Contact:</strong> <a href="mailto:lhits@lhits.co.uk" className="text-blue-600 underline">lhits@lhits.co.uk</a>
            </div>
            <button onClick={() => setShowAbout(false)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;