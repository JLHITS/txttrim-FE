import { useState } from "react";
import { API_BASE_URL } from "../lib/constants";
import { track } from "../lib/analytics";

export function useShorten({ addToHistory }) {
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleShorten = async ({
    text,
    maxChars,
    businessSector,
    targetLanguage,
    signature,
    shortenUrls,
    protectVariables,
  }) => {
    if (!text.trim()) {
      setErrorMessage("Please enter a message first.");
      return;
    }

    setErrorMessage("");
    setLoading(true);
    setCopied(false);

    track("clicked_shorten", {
      sector: businessSector,
      language: targetLanguage,
      limit: maxChars,
      has_signature: !!signature,
    });

    const sigLength = signature ? signature.length + 1 : 0;
    const aiMaxChars = maxChars - sigLength;

    if (aiMaxChars < 1) {
      setLoading(false);
      setErrorMessage(
        "Signature is too long for the selected SMS limit. Shorten signature or increase target limit.",
      );
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/shorten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          max_chars: aiMaxChars,
          shorten_urls: shortenUrls,
          business_sector: businessSector,
          protect_variables: protectVariables,
          target_language: targetLanguage,
        }),
      });

      const rawBody = await res.text();
      let data = {};
      try {
        data = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        if (!res.ok) {
          throw new Error(`Server error (${res.status}). Please try again.`);
        }
        throw new Error("Server returned an invalid response.");
      }

      if (!res.ok) {
        const serverError = data?.error || `Server error (${res.status}).`;
        throw new Error(serverError);
      }

      if (signature && typeof data.shortened_text === "string") {
        data.shortened_text = `${data.shortened_text} ${signature}`;
        data.shortened_length = data.shortened_text.length;
      }

      setResponse(data);

      addToHistory({
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        original: text,
        response: data,
      });
    } catch (error) {
      console.error("Error:", error);
      if ((error.message || "").includes("504")) {
        setErrorMessage(
          "The server timed out. Please retry once or reduce message length.",
        );
      } else {
        setErrorMessage(error.message || "Connection error. Please try again.");
      }
      track("error_shorten", { message: error.message });
    }
    setLoading(false);
  };

  const handleCopy = () => {
    if (response?.shortened_text) {
      navigator.clipboard.writeText(response.shortened_text);
      setCopied(true);
      track("copied_text");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const setResponseDirectly = (data) => setResponse(data);

  return {
    response,
    loading,
    copied,
    errorMessage,
    setErrorMessage,
    handleShorten,
    handleCopy,
    setResponse: setResponseDirectly,
  };
}
