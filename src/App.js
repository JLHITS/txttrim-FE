import React, { useState, useEffect, useRef } from "react";
import ReactGA from "react-ga4"; // ✅ Import Google Analytics
import "./styles.css";
import logo from "./assets/logo.png"; // Import your logo (place it inside 'src/assets/')

const API_BASE_URL = "https://txttrim-backend.onrender.com";
const TRACKING_ID = "G-KKM0XZD821";

function App() {
  const [text, setText] = useState("");
  const [maxChars, setMaxChars] = useState(160);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [stats, setStats] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const containerRef = useRef(null); // Reference to scroll the container

  // ✅ Initialize Google Analytics
  useEffect(() => {
    ReactGA.initialize(TRACKING_ID);
    ReactGA.send("pageview");
  }, []);

  // ✅ Fetch usage stats when the app loads
  useEffect(() => {
    fetch(`${API_BASE_URL}/stats`)
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((error) => console.error("Error fetching stats:", error));
  }, []);

  const handleShorten = async () => {
    if (!text.trim()) {
      setErrorMessage("⚠️ Please enter a message before shortening.");
      return;
    }

    setErrorMessage("");
    setLoading(true);
    setCopied(false);

    // ✅ Google Analytics Event: User clicked "Shorten SMS"
    ReactGA.event({
      category: "User",
      action: "Clicked Shorten SMS",
      label: "Shortened an SMS",
    });

    try {
      const res = await fetch(`${API_BASE_URL}/shorten`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text, max_chars: maxChars }),
      });

      const data = await res.json();
      setResponse(data);

      // ✅ Fetch updated stats immediately after shortening an SMS
      fetch(`${API_BASE_URL}/stats`)
        .then((res) => res.json())
        .then((updatedStats) => setStats(updatedStats))
        .catch((error) => console.error("Error updating stats:", error));

      // ✅ Scroll back to the top of the app when output appears
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    } catch (error) {
      console.error("Error:", error);
    }
    setLoading(false);
  };

  const handleCopy = () => {
    if (response && response.shortened_text) {
      navigator.clipboard.writeText(response.shortened_text);
      setCopied(true);

      // ✅ Google Analytics Event: User copied text
      ReactGA.event({
        category: "User",
        action: "Copied SMS",
        label: "Copied shortened SMS to clipboard",
      });

      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="container" ref={containerRef}>
      <img src={logo} alt="TxtTrim Logo" className="logo" />
      <p className="subtitle">Powered by AI for smarter, shorter SMS messages.</p>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);

          // ✅ Google Analytics Event: User is typing
          ReactGA.event({
            category: "User",
            action: "Typing Message",
            label: "User is entering an SMS",
          });

          if (e.target.value.trim() !== "") {
            setErrorMessage("");
          }
        }}
        placeholder="Enter the message..."
      />

      {/* ✅ Display error message if input is empty */}
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      <div className="controls">
        <label>Max SMS Fragments:</label>
        <select
          value={maxChars}
          onChange={(e) => {
            setMaxChars(Number(e.target.value));

            // ✅ Google Analytics Event: User changed max SMS fragments
            ReactGA.event({
              category: "User",
              action: "Changed Max SMS Fragments",
              label: `Set to ${e.target.value} characters`,
            });
          }}
        >
          <option value={160}>1 SMS (160 chars)</option>
          <option value={320}>2 SMS (320 chars)</option>
          <option value={480}>3 SMS (480 chars)</option>
        </select>
        <button onClick={handleShorten} disabled={loading || !text.trim()}>
          {loading ? "Shortening..." : "Shorten SMS"}
        </button>
      </div>

      {response && (
        <div className="output-container">
          <h2>Shortened Message</h2>
          <div className="output-box">
            <p>{response.shortened_text}</p>
          </div>
          <button className="copy-btn" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy to Clipboard"}
          </button>

          <p className="stats">
            <strong>Original Length:</strong> {response.original_length} characters<br />
            <strong>Shortened Length:</strong> {response.shortened_length} characters<br />
            <strong>Cost Saving per SMS sent:</strong> £{response.cost_savings}
          </p>
        </div>
      )}

      {/* Collapsible Disclaimer Box */}
      <div className="disclaimer-container">
        <button
          className="disclaimer-btn"
          onClick={() => {
            setShowDisclaimer(!showDisclaimer);

            // ✅ Google Analytics Event: User opened/closed disclaimer
            ReactGA.event({
              category: "User",
              action: showDisclaimer ? "Closed Disclaimer" : "Opened Disclaimer",
              label: "User toggled disclaimer",
            });
          }}
        >
          {showDisclaimer ? "Hide Disclaimer" : "Show Disclaimer"}
        </button>
        {showDisclaimer && (
          <div className="disclaimer-box">
            <h3>🚨 Disclaimer: Use at Your Own Risk</h3>
            <p>
              This SMS Shortener tool is provided for convenience and informational purposes only.
              <strong> Do not enter confidential or personally identifiable information.</strong>
            </p>
            <ul>
              <li>🔹 <strong>No data is stored</strong>—all processing happens in real-time.</li>
              <li>🔹 The tool does not guarantee accuracy or suitability for communication.</li>
              <li>🔹 You are responsible for ensuring messages comply with GDPR policies.</li>
              <li>🔹 The creators accept <strong>no liability</strong> for misuse or unintended consequences.</li>
            </ul>
            <p>
              If in doubt, consult your organisation's <strong>Data Protection Officer (DPO)</strong> or
              <strong> Information Governance (IG) team</strong>.
            </p>
          </div>
        )}
      </div>

      {/* Stats Section */}
      <div className="stats-container">
        <h3>📊 TxtTrim Usage Statistics</h3>
        {stats ? (
          <div className="stats-grid">
            <div className="stat-box">
              <p className="stat-value">{stats.total_sms_shortened}</p>
              <p className="stat-label">Total SMS Trimmed</p>
            </div>
            <div className="stat-box">
              <p className="stat-value">{stats.total_characters_saved}</p>
              <p className="stat-label">Total Characters Trimmed</p>
            </div>
            <div className="stat-box">
              <p className="stat-value">£{stats.total_cost_saved.toFixed(2)}</p>
              <p className="stat-label">Total Saved Per SMS Sent</p>
            </div>
          </div>
        ) : (
          <p>Loading stats...</p>
        )}
      </div>
    </div>
  );
}

export default App;
