import OpenAI from "openai";

// --- CONFIG ---
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const ISGD_API = "https://is.gd/create.php?format=simple&url=";
const MAX_INPUT_LENGTH = 5000;
const OUTPUT_TOKEN_BUFFER = 100;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- HELPERS ---
function toBool(value, defaultVal = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return !["false", "0", "no"].includes(value.toLowerCase());
  return value != null ? Boolean(value) : defaultVal;
}

async function shortenWithIsgd(url) {
  try {
    const encoded = encodeURIComponent(url);
    const res = await fetch(`${ISGD_API}${encoded}`, {
      headers: { "User-Agent": "TxtTrim/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const text = await res.text();
      if (text.startsWith("http")) return text.trim();
    }
  } catch (e) {
    console.error("[is.gd Error]", e.message);
  }
  return null;
}

async function shortenUrlsInText(text) {
  const urlPattern = /https?:\/\/[^\s\]\)>,;]+/g;
  const urls = text.match(urlPattern);
  if (!urls) return text;

  const cache = {};
  for (const u of urls) {
    const cleanUrl = u.replace(/[.,;!?]+$/, "");
    if (!(cleanUrl in cache)) {
      const short = await shortenWithIsgd(cleanUrl);
      cache[u] = short || u;
    }
  }
  return text.replace(urlPattern, (match) => cache[match] || match);
}

function smsFragments(length) {
  return Math.ceil(length / 160) || 1;
}

function extractTextFromContentParts(parts) {
  if (!Array.isArray(parts)) return "";

  return parts
    .map((part) => {
      if (typeof part === "string") return part;
      if (typeof part?.text === "string") return part.text;
      if (typeof part?.output_text === "string") return part.output_text;
      if (part?.text && typeof part.text?.value === "string") return part.text.value;
      return "";
    })
    .join("")
    .trim();
}

function extractTextFromChatCompletion(response) {
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  return extractTextFromContentParts(content);
}

function extractTextFromResponses(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  if (!Array.isArray(response?.output)) return "";

  const combined = response.output
    .filter((item) => item?.type === "message")
    .map((item) => extractTextFromContentParts(item?.content))
    .join("")
    .trim();

  return combined;
}

function getTotalTokens(usage) {
  if (!usage) return "n/a";
  if (typeof usage.total_tokens === "number") return usage.total_tokens;

  const promptTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0;
  const completionTokens = usage.output_tokens ?? usage.completion_tokens ?? 0;
  const total = Number(promptTokens) + Number(completionTokens);

  return total > 0 ? total : "n/a";
}

async function generateShortenedText(systemPrompt, processedText, maxChars) {
  const maxOutputTokens = maxChars + OUTPUT_TOKEN_BUFFER;

  try {
    const responsesApiResult = await client.responses.create({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: processedText },
      ],
      max_output_tokens: maxOutputTokens,
    });

    const text = extractTextFromResponses(responsesApiResult);
    if (text) {
      return { text, usage: responsesApiResult.usage };
    }

    console.warn("Responses API returned empty text. Falling back to chat.completions.");
  } catch (e) {
    console.warn(`Responses API failed (${e.message}). Falling back to chat.completions.`);
  }

  const chatResult = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: processedText },
    ],
    max_completion_tokens: maxOutputTokens,
  });

  return {
    text: extractTextFromChatCompletion(chatResult),
    usage: chatResult.usage,
  };
}

// --- HANDLER ---
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const startTime = Date.now();
  const data = req.body || {};
  const originalText = data.text || "";

  let maxChars = parseInt(data.max_chars, 10);
  if (isNaN(maxChars)) maxChars = 160;
  maxChars = Math.min(Math.max(maxChars, 50), 1600);

  const doShortenUrls = toBool(data.shorten_urls, true);
  const businessSector = data.business_sector || "General";
  const protectVariables = toBool(data.protect_variables, true);
  const targetLanguage = data.target_language || "English";

  // --- VALIDATION ---
  if (!originalText) {
    return res.status(400).json({ error: "No text provided" });
  }
  if (originalText.length > MAX_INPUT_LENGTH) {
    return res.status(400).json({ error: `Text exceeds maximum length of ${MAX_INPUT_LENGTH} characters` });
  }

  console.log(`Processing: Lang=${targetLanguage} | Sector=${businessSector} | Length=${originalText.length}`);

  // --- URL SHORTENING ---
  let processedText = originalText;
  if (doShortenUrls) {
    processedText = await shortenUrlsInText(processedText);
  }

  // --- PROMPT ENGINEERING ---
  const protection = protectVariables
    ? "CRITICAL: Do NOT change, delete, or translate any text inside [square brackets] (e.g. [Date]). Keep them exactly as is."
    : "";

  const task =
    targetLanguage && targetLanguage !== "English"
      ? `Task: Translate the message to ${targetLanguage} FIRST, and THEN shorten the translated text to under ${maxChars} characters.`
      : `Task: Shorten the message to under ${maxChars} characters in English.`;

  const systemPrompt = `You are a precise SMS message shortener and translator.
${task}

Rules:
- Maintain the original meaning.
- Tone: ${businessSector}.
- ${protection}
- If multiple links exist, keep them all.
- Provide ONLY the final SMS text. No intro/outro.`;

  try {
    const modelResult = await generateShortenedText(systemPrompt, processedText, maxChars);
    let shortenedText = (modelResult.text || "").trim();

    // Final guard: avoid returning a zero-length message if the model response is unexpectedly empty.
    if (!shortenedText) {
      shortenedText = processedText.slice(0, maxChars).trim();
      console.warn("Model returned empty text. Using trimmed input fallback.");
    }

    if (targetLanguage === "English" && shortenedText.length > maxChars) {
      shortenedText = shortenedText.slice(0, maxChars).replace(/[. ,]+$/, "");
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const totalTokens = getTotalTokens(modelResult.usage);
    console.log(`Success: ${duration}s | Old:${originalText.length} -> New:${shortenedText.length} | Tokens: ${totalTokens}`);

    return res.status(200).json({
      original_text: processedText,
      shortened_text: shortenedText,
      original_length: processedText.length,
      shortened_length: shortenedText.length,
      sms_fragments: smsFragments(shortenedText.length),
    });
  } catch (e) {
    console.error("AI Error:", e.message);
    return res.status(500).json({ error: "Failed to process message. Please try again." });
  }
}
