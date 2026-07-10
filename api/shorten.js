import OpenAI from "openai";

// --- CONFIG ---
// NOTE: reasoning/verbosity params below require a GPT-5 family model.
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-nano";
const ISGD_API = "https://is.gd/create.php?format=simple&url=";
const TINYURL_API = "https://tinyurl.com/api-create.php?url=";
const MAX_INPUT_LENGTH = 5000;
const MAX_REWRITE_ATTEMPTS = 1;
const REQUEST_TIME_BUDGET_MS = 12000;
const MIN_REMAINING_FOR_ATTEMPT_MS = 1500;
const MIN_CALL_TIMEOUT_MS = 600;
const URL_SHORTENER_TIMEOUT_MS = 1500;
const AI_CALL_TIMEOUT_MS = 8000;
const MAX_URLS_TO_SHORTEN = 3;
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"'`]+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<>"'`]*)?/gi;
// Bare domains (no protocol/www) are only treated as links when the TLD is
// recognisably web-like, so "report.pdf" or a "word.Word" typo never gets
// sent to is.gd.
const BARE_DOMAIN_TLDS = new Set([
  "com", "org", "net", "edu", "gov", "uk", "co", "io", "me", "info",
  "app", "dev", "ly", "gd", "health", "online", "site", "digital", "eu", "ie",
]);
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

function remainingMs(deadlineTs) {
  return Math.max(0, deadlineTs - Date.now());
}

function getCallTimeoutMs(deadlineTs, preferredMs) {
  const remaining = remainingMs(deadlineTs) - 250;
  if (remaining < MIN_CALL_TIMEOUT_MS) return 0;
  return Math.max(MIN_CALL_TIMEOUT_MS, Math.min(preferredMs, remaining));
}

function getUrlRegex() {
  return new RegExp(URL_PATTERN.source, "gi");
}

function splitTrailingPunctuation(value) {
  const match = String(value || "").match(/^(.*?)([.,;!?)\]]*)$/);
  if (!match) return { core: value, trailing: "" };
  return {
    core: match[1],
    trailing: match[2] || "",
  };
}

function normalizeUrlCandidate(candidate) {
  const value = String(candidate || "").trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) return value;
  if (/^www\./i.test(value)) return `https://${value}`;

  // Bare domains like "practice.com/link" — only for recognised TLDs
  const bareMatch = value.match(/^[a-z0-9.-]+\.([a-z]{2,})(?:\/.*)?$/i);
  if (bareMatch && BARE_DOMAIN_TLDS.has(bareMatch[1].toLowerCase())) {
    return `https://${value}`;
  }

  return null;
}

function extractUrlCandidates(text) {
  const regex = getUrlRegex();
  const raw = String(text || "");
  const items = [];

  for (const match of raw.matchAll(regex)) {
    const token = match[0];
    const index = match.index ?? -1;
    if (index > 0 && raw[index - 1] === "@") {
      continue;
    }

    const { core } = splitTrailingPunctuation(token);
    const normalized = normalizeUrlCandidate(core);
    if (!normalized) continue;
    items.push({ token: core, normalized });
  }

  return items;
}

async function fetchShortUrl(apiUrl, deadlineTs, label) {
  const timeoutMs = getCallTimeoutMs(deadlineTs, URL_SHORTENER_TIMEOUT_MS);
  if (!timeoutMs) return null;

  try {
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "TxtTrim/1.0" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = (await res.text()).trim();
    if (res.ok && /^https?:\/\//i.test(body) && !/\s/.test(body)) {
      return body;
    }
    // is.gd reports some failures as HTTP 200 with an error message body
    // (e.g. "Error, database insert failed"), so the body must be logged —
    // the status code alone looks like a success in the request logs.
    console.warn(`[${label}] could not shorten: HTTP ${res.status} "${body.slice(0, 100)}"`);
  } catch (e) {
    console.error(`[${label}] error:`, e.message);
  }
  return null;
}

// is.gd gives the shortest links, but it rejects some URLs (links to other
// redirect services such as youtu.be) and has intermittent outages that
// still return HTTP 200. TinyURL is queried in parallel as a backup so an
// is.gd failure costs no extra time.
async function shortenSingleUrl(url, deadlineTs) {
  const encoded = encodeURIComponent(url);
  const [isgd, tiny] = await Promise.all([
    fetchShortUrl(`${ISGD_API}${encoded}`, deadlineTs, "is.gd"),
    fetchShortUrl(`${TINYURL_API}${encoded}`, deadlineTs, "TinyURL"),
  ]);
  return isgd || tiny;
}

async function shortenUrlsInText(text, deadlineTs) {
  const urlCandidates = extractUrlCandidates(text);
  if (!urlCandidates.length) return text;
  if (remainingMs(deadlineTs) < MIN_REMAINING_FOR_ATTEMPT_MS) return text;

  const uniqueByNormalized = new Map();
  for (const item of urlCandidates) {
    const list = uniqueByNormalized.get(item.normalized) || [];
    list.push(item.token);
    uniqueByNormalized.set(item.normalized, list);
  }

  const normalizedLinks = Array.from(uniqueByNormalized.keys()).slice(0, MAX_URLS_TO_SHORTEN);
  if (!normalizedLinks.length) return text;

  const shortenedByToken = new Map();
  await Promise.all(
    normalizedLinks.map(async (normalizedUrl) => {
      const short = await shortenSingleUrl(normalizedUrl, deadlineTs);
      const tokens = uniqueByNormalized.get(normalizedUrl) || [];
      for (const token of tokens) {
        // Only substitute when the short link actually saves characters.
        shortenedByToken.set(token, short && short.length < token.length ? short : token);
      }
    }),
  );

  return text.replace(getUrlRegex(), (match, offset, source) => {
    if (typeof offset === "number" && offset > 0 && source[offset - 1] === "@") {
      return match;
    }

    const { core, trailing } = splitTrailingPunctuation(match);
    const short = shortenedByToken.get(core);
    if (!short) return match;
    return `${short}${trailing}`;
  });
}

// Masks required tokens (links, phone numbers, merge fields) with sentinels so
// the compression passes can never rewrite their contents.
function maskRequiredTokens(text, requiredTokens) {
  let masked = text;
  const map = [];
  requiredTokens.forEach((token, i) => {
    if (!masked.includes(token)) return;
    const sentinel = `\u0000${i}\u0000`;
    masked = masked.split(token).join(sentinel);
    map.push([sentinel, token]);
  });
  return { masked, map };
}

function unmaskRequiredTokens(text, map) {
  let out = text;
  for (const [sentinel, token] of map) {
    out = out.split(sentinel).join(token);
  }
  return out;
}

// Deterministic compression that preserves required tokens and never cuts
// content mid-sentence. If the text still exceeds maxChars after all passes,
// it is returned over-limit — the caller reports limit_met: false rather than
// silently deleting links or the final call to action.
function smartTrim(text, maxChars, requiredTokens = []) {
  if (text.length <= maxChars) return text;

  const { masked, map } = maskRequiredTokens(text, requiredTokens);
  let result = masked;
  const realLength = () => unmaskRequiredTokens(result, map).length;

  // Step 1: Remove trailing punctuation
  result = result.replace(/[.!]+$/, "").trim();
  if (realLength() <= maxChars) return unmaskRequiredTokens(result, map);

  // Step 2: Common abbreviations
  const abbrevs = [
    [/\bappointment\b/gi, "appt"],
    [/\bappointments\b/gi, "appts"],
    [/\bplease\b/gi, "pls"],
    [/\btelephone\b/gi, "tel"],
    [/\bregarding\b/gi, "re"],
    [/\binformation\b/gi, "info"],
    [/\bavailable\b/gi, "avail"],
    [/\bdepartment\b/gi, "dept"],
    [/\bmanagement\b/gi, "mgmt"],
    [/\breference\b/gi, "ref"],
    [/\bconfirmation\b/gi, "conf"],
    [/\bmonday\b/gi, "Mon"],
    [/\btuesday\b/gi, "Tue"],
    [/\bwednesday\b/gi, "Wed"],
    [/\bthursday\b/gi, "Thu"],
    [/\bfriday\b/gi, "Fri"],
    [/\bsaturday\b/gi, "Sat"],
    [/\bsunday\b/gi, "Sun"],
    [/\bjanuary\b/gi, "Jan"],
    [/\bfebruary\b/gi, "Feb"],
    [/\bmarch\b/gi, "Mar"],
    [/\bapril\b/gi, "Apr"],
    [/\bjune\b/gi, "Jun"],
    [/\bjuly\b/gi, "Jul"],
    [/\baugust\b/gi, "Aug"],
    [/\bseptember\b/gi, "Sep"],
    [/\boctober\b/gi, "Oct"],
    [/\bnovember\b/gi, "Nov"],
    [/\bdecember\b/gi, "Dec"],
    [/ and /gi, " & "],
  ];
  for (const [pattern, replacement] of abbrevs) {
    if (realLength() <= maxChars) break;
    result = result.replace(pattern, replacement);
  }
  result = normalizeWhitespace(result);
  if (realLength() <= maxChars) return unmaskRequiredTokens(result, map);

  // Step 3: Remove filler words
  const fillers = [/\bjust\b/gi, /\balso\b/gi, /\bkindly\b/gi, /\bsimply\b/gi];
  for (const filler of fillers) {
    if (realLength() <= maxChars) break;
    result = result.replace(filler, "");
    result = normalizeWhitespace(result);
  }
  if (realLength() <= maxChars) return unmaskRequiredTokens(result, map);

  // Step 4: Remove "the " where it's not critical
  result = result.replace(/\bthe\s+/gi, "");
  result = normalizeWhitespace(result);

  // No end-chopping: return best effort even if still over the limit.
  return unmaskRequiredTokens(result, map);
}

// GSM 03.38 basic character set (1 septet each) and extension set (2 septets).
// Any character outside both forces the whole SMS into UCS-2 encoding.
const GSM7_BASIC = new Set(
  ("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
    "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà").split(""),
);
const GSM7_EXTENDED = new Set("^{}\\[~]|€".split(""));

function smsFragments(text) {
  const value = String(text || "");
  if (!value) return 1;

  let septets = 0;
  let isGsm = true;
  for (const ch of value) {
    if (GSM7_BASIC.has(ch)) {
      septets += 1;
    } else if (GSM7_EXTENDED.has(ch)) {
      septets += 2;
    } else {
      isGsm = false;
      break;
    }
  }

  if (isGsm) {
    return septets <= 160 ? 1 : Math.ceil(septets / 153);
  }
  // UCS-2: 70 chars single-part, 67 per segment multipart
  const units = value.length;
  return units <= 70 ? 1 : Math.ceil(units / 67);
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
  const urls = uniqueTokens(extractUrlCandidates(text).map((item) => item.token));
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

// Typographic characters the model likes to emit (curly quotes, en/em dashes,
// ellipsis) are not in GSM-7 and silently force the SMS into UCS-2 encoding —
// 70-char segments instead of 160. Normalise them to GSM-safe equivalents.
function normalizeGsmPunctuation(text) {
  return String(text || "")
    .replace(/[\u2018\u2019\u02BC\u2032]/g, "'") // curly/prime apostrophes
    .replace(/[\u201C\u201D\u2033]/g, '"') // curly double quotes
    .replace(/[\u2010-\u2015\u2212]/g, "-") // hyphens, en/em dashes, minus
    .replace(/\u2026/g, "...") // ellipsis
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width chars
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " "); // exotic spaces
}

function sanitizeModelOutput(text) {
  let output = String(text || "").replace(/\r\n/g, "\n").trim();

  output = normalizeGsmPunctuation(output);
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
  if (!attempts.length) return null;

  // Keeping every required token (links, phone numbers, merge fields) beats
  // meeting the character limit: a slightly-long message can be compressed or
  // flagged, but a deleted link cannot be recovered.
  const withAllTokens = attempts.filter((attempt) => attempt.missingRequired.length === 0);
  const tokenPool = withAllTokens.length ? withAllTokens : attempts;

  const pool = tokenPool.some((attempt) => attempt.withinLimit)
    ? tokenPool.filter((attempt) => attempt.withinLimit)
    : tokenPool;

  return pool.reduce((best, current) => {
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

function extractTextFromResponse(response) {
  // Responses API: output is an array of items with type "message"
  if (Array.isArray(response?.output)) {
    for (const item of response.output) {
      if (item.type === "message" && Array.isArray(item.content)) {
        for (const part of item.content) {
          if (part.type === "output_text" && typeof part.text === "string") {
            return part.text.trim();
          }
        }
      }
    }
  }
  // Fallback: check output_text directly
  if (typeof response?.output_text === "string") {
    return response.output_text.trim();
  }
  return "";
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

async function generateModelText(systemPrompt, userPrompt, maxChars, deadlineTs) {
  const timeoutMs = getCallTimeoutMs(deadlineTs, AI_CALL_TIMEOUT_MS);
  if (!timeoutMs) {
    throw new Error("Not enough time left for AI call");
  }

  const estimatedVisibleTokens = Math.ceil(maxChars / 3) + 30;
  const maxOutputTokens = Math.max(400, Math.min(estimatedVisibleTokens + 600, 1200));

  const result = await client.responses.create({
    model: OPENAI_MODEL,
    instructions: systemPrompt,
    input: userPrompt,
    max_output_tokens: maxOutputTokens,
    reasoning: { effort: "minimal" },
    text: { verbosity: "low" },
  }, { timeout: timeoutMs, maxRetries: 0 });

  return {
    text: extractTextFromResponse(result),
    usage: result.usage,
  };
}

function buildStrictLimitPrompts({
  currentDraft,
  maxChars,
  targetLanguage,
  businessSector,
  requiredTokens,
}) {
  const requiredTokensBlock = formatRequiredTokens(requiredTokens);

  const overBy = currentDraft.length - maxChars;

  const systemPrompt = `You are a precise SMS compressor. Your ONLY job is to shorten the draft below.
Your output MUST be ${maxChars} characters or fewer. Count every character including spaces and punctuation.

Rules:
- The draft is ${overBy} characters too long. Remove or shorten ${overBy}+ characters worth of words.
- Use common abbreviations (e.g. "appointment" -> "appt", "please" -> "pls", "and" -> "&").
- Remove filler words ("just", "also", "the" where possible).
- Keep required tokens exactly as written.
- Keep language: ${targetLanguage}. Keep tone: ${businessSector}.
- Return ONLY the final SMS text, nothing else.`;

  const userPrompt = `Draft (${currentDraft.length} chars, MUST become <= ${maxChars}):
${currentDraft}

Required tokens (must appear exactly):
${requiredTokensBlock}

Remove at least ${overBy} characters. Output ONLY the shortened text.`;

  return { systemPrompt, userPrompt };
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
Rewrite now and keep the final text at or under ${maxChars} characters.`;

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
  deadlineTs,
  maxRewriteAttempts,
}) {
  const attempts = [];
  let totalTokens = 0;

  try {
    const firstResult = await generateModelText(initialSystemPrompt, initialUserPrompt, maxChars, deadlineTs);
    totalTokens += getTokenCount(firstResult.usage);

    const candidate = sanitizeModelOutput(firstResult.text);
    if (candidate) {
      const assessment = evaluateAttempt(candidate, maxChars, requiredTokens);
      attempts.push({ text: candidate, ...assessment });
    } else {
      console.warn("Initial shorten attempt produced empty visible text.");
    }
  } catch (e) {
    console.warn(`Initial shorten attempt failed: ${e.message}`);
  }

  for (let i = 0; i < maxRewriteAttempts; i += 1) {
    if (remainingMs(deadlineTs) < MIN_REMAINING_FOR_ATTEMPT_MS) {
      break;
    }

    const latest = attempts[attempts.length - 1];
    if (latest?.text && latest.withinLimit && latest.missingRequired.length === 0) {
      break;
    }

    const currentDraft = latest?.text || normalizeWhitespace(originalText);
    const missingRequired = findMissingRequiredTokens(currentDraft, requiredTokens);

    const revisionPrompts = buildRevisionPrompts({
      originalText,
      currentDraft,
      maxChars,
      targetLanguage,
      businessSector,
      requiredTokens,
      missingRequired,
    });

    try {
      const revisionResult = await generateModelText(
        revisionPrompts.systemPrompt,
        revisionPrompts.userPrompt,
        maxChars,
        deadlineTs,
      );

      totalTokens += getTokenCount(revisionResult.usage);
      const candidate = sanitizeModelOutput(revisionResult.text);
      if (candidate) {
        const assessment = evaluateAttempt(candidate, maxChars, requiredTokens);
        attempts.push({ text: candidate, ...assessment });
      } else {
        console.warn(`Revision attempt ${i + 1} produced empty visible text.`);
      }
    } catch (e) {
      console.warn(`Revision attempt ${i + 1} failed: ${e.message}`);
      break;
    }
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
  const deadlineTs = startTime + REQUEST_TIME_BUDGET_MS;
  const data = req.body || {};
  const originalText = data.text || "";

  let maxChars = parseInt(data.max_chars, 10);
  if (isNaN(maxChars)) maxChars = 160;
  maxChars = Math.min(Math.max(maxChars, 1), 1600);

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
    processedText = await shortenUrlsInText(processedText, deadlineTs);
  }

  const requiredTokens = extractRequiredTokens(processedText, protectVariables);

  // --- PROMPT ENGINEERING ---
  // Ask for ~10% headroom below the hard limit: the model cannot count
  // characters precisely, so aiming low means its typical overshoot still
  // lands within maxChars and the first attempt usually succeeds.
  const aimChars = Math.max(1, maxChars - Math.min(Math.ceil(maxChars * 0.1), 25));

  const role = "You are a precise SMS message shortener and translator.";
  const protection = protectVariables
    ? "CRITICAL: Do NOT change, delete, or translate any text inside [square brackets] (e.g. [Date]). Keep them exactly as is."
    : "";

  const task =
    targetLanguage && targetLanguage !== "English"
      ? `Task: Translate the message to ${targetLanguage} FIRST, and THEN shorten the translated text. Aim for ${aimChars} characters or fewer; never exceed ${maxChars} characters.`
      : `Task: Shorten the message in English. Aim for ${aimChars} characters or fewer; never exceed ${maxChars} characters.`;

  const systemPrompt = role;
  const initialUserPrompt = `${task}

Rules:
- Maintain the original meaning, key actions, dates/times, and contact details.
- Tone: ${businessSector}.
- ${protection}
- Keep every link. Do not drop, alter, or shorten links yourself.
- Provide ONLY the final SMS text. No intro/outro.

These tokens must appear in the output exactly as written:
${formatRequiredTokens(requiredTokens)}

Message to process: ${processedText}`;

  try {
    const optimization = await shortenWithRetries({
      initialSystemPrompt: systemPrompt,
      initialUserPrompt,
      originalText: processedText,
      maxChars,
      targetLanguage,
      businessSector,
      requiredTokens,
      deadlineTs,
      maxRewriteAttempts: MAX_REWRITE_ATTEMPTS,
    });

    let shortenedText = optimization.bestAttempt?.text || "";
    if (!shortenedText) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.warn(
        `No usable AI output | ${duration}s | Attempts:${optimization.attempts.length} | Returning timeout-style error instead of truncating.`,
      );
      return res.status(504).json({
        error: "AI did not return a usable shortened message in time. Please retry.",
        original_text: processedText,
        original_length: processedText.length,
        target_max_chars: maxChars,
        rewrite_attempts: optimization.attempts.length,
      });
    }

    let missingRequiredTokens = findMissingRequiredTokens(shortenedText, requiredTokens);
    let limitMet = shortenedText.length <= maxChars;

    if (!limitMet && remainingMs(deadlineTs) >= MIN_REMAINING_FOR_ATTEMPT_MS) {
      try {
        const strictPrompts = buildStrictLimitPrompts({
          currentDraft: shortenedText,
          maxChars,
          targetLanguage,
          businessSector,
          requiredTokens,
        });

        const strictResult = await generateModelText(
          strictPrompts.systemPrompt,
          strictPrompts.userPrompt,
          maxChars,
          deadlineTs,
        );

        const strictCandidate = sanitizeModelOutput(strictResult.text);
        // Only adopt the stricter draft if it doesn't lose required tokens
        // the current draft still has.
        if (
          strictCandidate &&
          findMissingRequiredTokens(strictCandidate, requiredTokens).length <=
            missingRequiredTokens.length
        ) {
          shortenedText = strictCandidate;
          missingRequiredTokens = findMissingRequiredTokens(shortenedText, requiredTokens);
          limitMet = shortenedText.length <= maxChars;
        }
      } catch (e) {
        console.warn(`Strict-limit retry failed: ${e.message}`);
      }
    }

    if (!limitMet) {
      console.warn(
        `AI over limit (${shortenedText.length}/${maxChars}), applying smart trim`,
      );
      shortenedText = smartTrim(shortenedText, maxChars, requiredTokens);
      missingRequiredTokens = findMissingRequiredTokens(shortenedText, requiredTokens);
      limitMet = shortenedText.length <= maxChars;
    }

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
      sms_fragments: smsFragments(shortenedText),
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

// Named exports for unit testing only — Vercel invokes the default export.
export {
  smartTrim,
  smsFragments,
  shortenUrlsInText,
  normalizeGsmPunctuation,
  sanitizeModelOutput,
  extractUrlCandidates,
  extractRequiredTokens,
  normalizeUrlCandidate,
  pickBestAttempt,
  findMissingRequiredTokens,
};
