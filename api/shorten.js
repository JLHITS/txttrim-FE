import OpenAI from "openai";

// --- CONFIG ---
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const ISGD_API = "https://is.gd/create.php?format=simple&url=";
const MAX_INPUT_LENGTH = 5000;
const OUTPUT_TOKEN_BUFFER = 180;
const MAX_REWRITE_ATTEMPTS = 3;
const URL_PATTERN = /https?:\/\/[^\s\]\)>,;]+/g;
const PLACEHOLDER_PATTERN = /\[[^\]\r\n]+\]/g;
const PHONE_OR_LONG_NUMBER_PATTERN = /\b(?:\+?\d[\d\s().-]{6,}\d)\b/g;
const DATE_TIME_PATTERN = /\b(?:\d{1,2}[:.]\d{2}(?:\s?[AaPp][Mm])?|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/g;

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
  const urls = text.match(URL_PATTERN);
  if (!urls) return text;

  const cache = {};
  for (const u of urls) {
    const cleanUrl = u.replace(/[.,;!?]+$/, "");
    if (!(cleanUrl in cache)) {
      const short = await shortenWithIsgd(cleanUrl);
      cache[u] = short || u;
    }
  }
  return text.replace(URL_PATTERN, (match) => cache[match] || match);
}

function smsFragments(length) {
  return Math.ceil(length / 160) || 1;
}

function normalizeWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function uniqueTokens(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const token = normalizeWhitespace(item);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

function extractRequiredTokens(text, protectVariables) {
  const urls = text.match(URL_PATTERN) || [];
  const placeholders = protectVariables ? text.match(PLACEHOLDER_PATTERN) || [] : [];
  const phoneOrLongNumbers = text.match(PHONE_OR_LONG_NUMBER_PATTERN) || [];
  const dateOrTime = text.match(DATE_TIME_PATTERN) || [];

  const numberTokens = [...phoneOrLongNumbers, ...dateOrTime].filter(
    (token) => token.replace(/\D/g, "").length >= 3,
  );

  return uniqueTokens([...urls, ...placeholders, ...numberTokens]);
}

function findMissingRequiredTokens(text, requiredTokens) {
  if (!requiredTokens.length) return [];
  return requiredTokens.filter((token) => !text.includes(token));
}

function sanitizeModelOutput(text) {
  let output = String(text || "").replace(/\r\n/g, "\n").trim();

  output = output.replace(/^```(?:\w+)?\s*/i, "").replace(/\s*```$/, "").trim();
  output = output.replace(/^\s*(?:shortened(?:\s+message)?|sms|translation|output)\s*:\s*/i, "").trim();

  if (
    (output.startsWith("\"") && output.endsWith("\"")) ||
    (output.startsWith("'") && output.endsWith("'")) ||
    (output.startsWith("`") && output.endsWith("`"))
  ) {
    output = output.slice(1, -1).trim();
  }

  return normalizeWhitespace(output);
}

function scoreCandidate(text, maxChars, missingRequiredCount) {
  if (!text) return -100000;

  let score = 1000;
  score -= missingRequiredCount * 500;

  if (text.length <= maxChars) {
    score += 300 + (maxChars - text.length) * 0.5;
  } else {
    score -= (text.length - maxChars) * 5;
  }

  if (text.length < 12 && maxChars >= 80) {
    score -= 150;
  }

  return score;
}

function evaluateAttempt(text, maxChars, requiredTokens) {
  const missingRequired = findMissingRequiredTokens(text, requiredTokens);
  return {
    withinLimit: text.length <= maxChars,
    missingRequired,
    score: scoreCandidate(text, maxChars, missingRequired.length),
  };
}

function pickBestAttempt(attempts) {
  return attempts.reduce((best, current) => {
    if (!best) return current;
    if (current.score > best.score) return current;
    if (current.score === best.score && current.text.length < best.text.length) return current;
    return best;
  }, null);
}

function formatRequiredTokens(requiredTokens) {
  if (!requiredTokens.length) return "- None";
  return requiredTokens.map((token) => `- ${token}`).join("\n");
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

function getTokenCount(usage) {
  if (!usage) return 0;
  if (typeof usage.total_tokens === "number") return usage.total_tokens;

  const promptTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0;
  const completionTokens = usage.output_tokens ?? usage.completion_tokens ?? 0;
  const total = Number(promptTokens) + Number(completionTokens);

  return Number.isFinite(total) && total > 0 ? total : 0;
}

function formatTokenCount(totalTokens) {
  return totalTokens > 0 ? totalTokens : "n/a";
}

async function generateModelText(systemPrompt, userPrompt, maxChars) {
  const maxOutputTokens = Math.max(64, Math.min(maxChars + OUTPUT_TOKEN_BUFFER, 2200));

  try {
    const responsesApiResult = await client.responses.create({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
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
      { role: "user", content: userPrompt },
    ],
    max_completion_tokens: maxOutputTokens,
  });

  return {
    text: extractTextFromChatCompletion(chatResult),
    usage: chatResult.usage,
  };
}

function buildRevisionPrompts({
  originalText,
  currentDraft,
  maxChars,
  targetLanguage,
  businessSector,
  requiredTokens,
  missingRequired,
}) {
  const requiredTokensBlock = formatRequiredTokens(requiredTokens);
  const missingBlock = missingRequired.length
    ? `\nRequired tokens currently missing and must be restored exactly:\n${missingRequired.map((token) => `- ${token}`).join("\n")}\n`
    : "";

  const systemPrompt = `You are an expert SMS editor.
Rewrite the draft to be concise without losing meaning.

Rules:
- Maximum length: ${maxChars} characters.
- Language: ${targetLanguage}.
- Tone: ${businessSector}.
- Keep all required tokens exactly as written.
- Keep key intent, action, dates/times, and contact details.
- Do NOT cut words or end abruptly.
- Return ONLY the final SMS text.`;

  const userPrompt = `Original message:
${originalText}

Current draft (${currentDraft.length} chars):
${currentDraft || "[empty draft]"}

Required tokens (must appear exactly):
${requiredTokensBlock}${missingBlock}
Rewrite now and keep the final text at or under ${maxChars} characters if possible.`;

  return { systemPrompt, userPrompt };
}

async function shortenWithRetries({
  initialSystemPrompt,
  initialUserPrompt,
  originalText,
  maxChars,
  targetLanguage,
  businessSector,
  requiredTokens,
}) {
  const attempts = [];
  let totalTokens = 0;

  const firstResult = await generateModelText(initialSystemPrompt, initialUserPrompt, maxChars);
  totalTokens += getTokenCount(firstResult.usage);

  let candidate = sanitizeModelOutput(firstResult.text);
  let assessment = evaluateAttempt(candidate, maxChars, requiredTokens);
  attempts.push({ text: candidate, ...assessment });

  for (let i = 0; i < MAX_REWRITE_ATTEMPTS; i += 1) {
    const latest = attempts[attempts.length - 1];
    if (latest.text && latest.withinLimit && latest.missingRequired.length === 0) {
      break;
    }

    const revisionPrompts = buildRevisionPrompts({
      originalText,
      currentDraft: latest.text,
      maxChars,
      targetLanguage,
      businessSector,
      requiredTokens,
      missingRequired: latest.missingRequired,
    });

    const revisionResult = await generateModelText(
      revisionPrompts.systemPrompt,
      revisionPrompts.userPrompt,
      maxChars,
    );

    totalTokens += getTokenCount(revisionResult.usage);
    candidate = sanitizeModelOutput(revisionResult.text);
    assessment = evaluateAttempt(candidate, maxChars, requiredTokens);
    attempts.push({ text: candidate, ...assessment });
  }

  const bestAttempt = pickBestAttempt(attempts);
  return { bestAttempt, attempts, totalTokens };
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

  const requiredTokens = extractRequiredTokens(processedText, protectVariables);
  const requiredTokensRule = requiredTokens.length
    ? `Required tokens (must appear exactly): ${requiredTokens.join(" | ")}`
    : "Keep key facts: who, what, when, where, action needed, and contact details.";

  // --- PROMPT ENGINEERING ---
  const protection = protectVariables
    ? "CRITICAL: Do NOT change, delete, or translate any text inside [square brackets] (e.g. [Date]). Keep them exactly as is."
    : "You may rewrite freely, but preserve the message intent and critical facts.";

  const task =
    targetLanguage && targetLanguage !== "English"
      ? `Task: Translate the message to ${targetLanguage} FIRST, then shorten to ${maxChars} characters or fewer.`
      : `Task: Shorten the message in English to ${maxChars} characters or fewer.`;

  const systemPrompt = `You are a precise SMS message shortener and translator.
${task}

Rules:
- Maintain the original meaning and intent.
- Tone: ${businessSector}.
- ${protection}
- If multiple links exist, keep them all.
- ${requiredTokensRule}
- Do NOT output chopped, cut-off, or half-finished text.
- Provide ONLY the final SMS text. No intro/outro.`;

  const initialUserPrompt = `Original message:
${processedText}

Target maximum length: ${maxChars} characters.`;

  try {
    const optimization = await shortenWithRetries({
      initialSystemPrompt: systemPrompt,
      initialUserPrompt,
      originalText: processedText,
      maxChars,
      targetLanguage,
      businessSector,
      requiredTokens,
    });

    let shortenedText = optimization.bestAttempt?.text || "";
    if (!shortenedText) {
      shortenedText = normalizeWhitespace(processedText);
      console.warn("Model returned empty text after retries. Using full processed input fallback.");
    }

    const missingRequiredTokens = findMissingRequiredTokens(shortenedText, requiredTokens);
    const limitMet = shortenedText.length <= maxChars;
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const totalTokens = formatTokenCount(optimization.totalTokens);
    console.log(
      `Success: ${duration}s | Old:${originalText.length} -> New:${shortenedText.length} | Target:${maxChars} | LimitMet:${limitMet} | Attempts:${optimization.attempts.length} | MissingTokens:${missingRequiredTokens.length} | Tokens: ${totalTokens}`,
    );

    return res.status(200).json({
      original_text: processedText,
      shortened_text: shortenedText,
      original_length: processedText.length,
      shortened_length: shortenedText.length,
      sms_fragments: smsFragments(shortenedText.length),
      target_max_chars: maxChars,
      limit_met: limitMet,
      rewrite_attempts: optimization.attempts.length,
      missing_required_tokens: missingRequiredTokens,
    });
  } catch (e) {
    console.error("AI Error:", e.message);
    return res.status(500).json({ error: "Failed to process message. Please try again." });
  }
}
