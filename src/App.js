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
  const [charCount, setCharCount] = useState(0);
  const [showAbout, setShowAbout] = useState(false);
  const [shortenUrls, setShortenUrls] = useState(true);
  const [businessSector, setBusinessSector] = useState("General");



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
  
  useEffect(() => { // For local storage of settings for drop down boxes
  const storedSector = localStorage.getItem("preferredSector");
  const storedMaxChars = localStorage.getItem("preferredMaxChars");

  if (storedSector) setBusinessSector(storedSector);
  if (storedMaxChars) setMaxChars(Number(storedMaxChars));
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
        body: JSON.stringify({ 
		  text, 
		  max_chars: maxChars, 
		  shorten_urls: shortenUrls,
		  business_sector: businessSector 
		}),
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
		  const newText = e.target.value;
		  setText(newText);
		  setCharCount(newText.length); // ✅ Update character count

		  // ✅ Google Analytics Event: User is typing
		  ReactGA.event({
			category: "User",
			action: "Typing Message",
			label: "User is entering an SMS",
		  });

		  if (newText.trim() !== "") {
			setErrorMessage("");
		  }
		}}

        placeholder="Enter the message..."
      />
	  
	 <p className="char-count">
		Characters: {charCount} / {maxChars}
	</p>


      {/* ✅ Display error message if input is empty */}
      {errorMessage && <p className="error-message">{errorMessage}</p>}

			  <div className="controls">
		  <div className="control-group">
			<label>Max SMS Fragments:</label>
			<select
			  value={maxChars}
				onChange={(e) => {
				  const value = Number(e.target.value);
				  setMaxChars(value);
				  localStorage.setItem("preferredMaxChars", value);

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
		  </div>

		  <div className="control-group">
			<label>Business Sector:</label>
			<select
			  value={businessSector}
			  onChange={(e) => {
				  const value = e.target.value;
				  setBusinessSector(value);
				  localStorage.setItem("preferredSector", value);

				  ReactGA.event({
					category: "User",
					action: "Changed Business Sector",
					label: value,
				  });
				}}
			>
			  <option value="General">General</option>
			  <option value="Healthcare">Healthcare</option>
			  <option value="Retail">Retail</option>
			  <option value="Finance">Finance</option>
			  <option value="Education">Education</option>
			  <option value="Legal">Legal</option>
			</select>
		  </div>

		  <button onClick={handleShorten} disabled={loading || !text.trim()}>
			{loading ? "Shortening..." : "Shorten SMS"}
		  </button>
		</div>

		<div className="checkbox-container">
			  <label>
				<input
				  type="checkbox"
				  checked={shortenUrls}
				  onChange={() => setShortenUrls(!shortenUrls)}
				/>
				Shorten URLs?
			  </label>
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

		
				{/* Cost Saving Examples */}
			<div className="cost-savings-examples">
			  <p>💡 Example Savings:</p>
			  <ul>
				<li>📩 500 messages = <strong>£{(500 * response.cost_savings).toFixed(2)}</strong> saved</li>
				<li>📩 1,000 messages = <strong>£{(1000 * response.cost_savings).toFixed(2)}</strong> saved</li>
				<li>📩 5,000 messages = <strong>£{(5000 * response.cost_savings).toFixed(2)}</strong> saved</li>
				<li>📩 10,000 messages = <strong>£{(10000 * response.cost_savings).toFixed(2)}</strong> saved</li>
			  </ul>
			</div>
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
	  
			  {/* Collapsible About Section */}
		<div className="about-container">
		  <button
			className="about-btn"
			onClick={() => setShowAbout(!showAbout)}
		  >
			{showAbout ? "Hide About" : "Show About"}
		  </button>
		  {showAbout && (
			<div className="about-box">
			  <h3>ℹ️ About TxtTrim</h3>
			  <p>
				TxtTrim is a free AI-powered SMS shortener designed to optimise SMS messages
				whilst preserving clarity and meaning. It was developed to help businesses
				save costs on SMS communication.
			  </p>

			  <p>
				You can choose a Business Sector before shortening a message. This tells the AI to adjust the tone and phrasing based on the sector’s communication style. For example:
			  </p>
			  <ul>
				<li>🏥 <strong>Healthcare</strong>: Empathetic, professional, patient-friendly</li>
				<li>🛍️ <strong>Retail</strong>: Friendly, upbeat, promotional</li>
				<li>💼 <strong>Finance</strong>: Clear, trustworthy, regulation-aware</li>
				<li>🎓 <strong>Education</strong>: Supportive, informative, encouraging</li>
				<li>⚖️ <strong>Legal</strong>: Formal, precise, careful with language</li>
				<li>🌐 <strong>General</strong>: Neutral and universal tone for any audience</li>
			  </ul>
			  <p>
				TxtTrim is <strong>fully open-source</strong>. You can explore and contribute
				to the project:
			  </p>
			  <ul>
				<li>🔹 <a href="https://github.com/JLHITS/txttrim-FE" target="_blank" rel="noopener noreferrer">Frontend GitHub Repository</a></li>
				<li>🔹 <a href="https://github.com/JLHITS/txttrim" target="_blank" rel="noopener noreferrer">Backend GitHub Repository</a></li>
			  </ul>
			  <p>
				For feedback, questions, or contributions, email me at
				<strong> <a href="mailto:lhits@lhits.co.uk">lhits@lhits.co.uk</a></strong>.
			  </p>
			</div>
		  )}
		</div>


{/*
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
*/}


    </div>
  );
}

export default App;
