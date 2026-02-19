import { useState, useEffect } from "react";

export function usePreferences() {
  const [maxChars, setMaxChars] = useState(160);
  const [businessSector, setBusinessSector] = useState("General");
  const [targetLanguage, setTargetLanguage] = useState("English");
  const [signature, setSignature] = useState("");
  const [shortenUrls, setShortenUrls] = useState(true);
  const [protectVariables, setProtectVariables] = useState(true);

  useEffect(() => {
    const storedSector = localStorage.getItem("preferredSector");
    const storedMaxChars = localStorage.getItem("preferredMaxChars");
    const storedSig = localStorage.getItem("txttrim_signature");

    if (storedSector) setBusinessSector(storedSector);
    if (storedMaxChars) setMaxChars(Number(storedMaxChars));
    if (storedSig) setSignature(storedSig);
  }, []);

  const updateMaxChars = (val) => {
    setMaxChars(val);
    localStorage.setItem("preferredMaxChars", String(val));
  };

  const updateBusinessSector = (val) => {
    setBusinessSector(val);
    localStorage.setItem("preferredSector", val);
  };

  const updateSignature = (val) => {
    setSignature(val);
    localStorage.setItem("txttrim_signature", val);
  };

  return {
    maxChars,
    setMaxChars: updateMaxChars,
    businessSector,
    setBusinessSector: updateBusinessSector,
    targetLanguage,
    setTargetLanguage,
    signature,
    setSignature: updateSignature,
    shortenUrls,
    setShortenUrls,
    protectVariables,
    setProtectVariables,
  };
}
