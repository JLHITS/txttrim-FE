import OpenAI from "openai";

// --- CONFIG ---
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const ISGD_API = "https://is.gd/create.php?format=simple&url=";
const MAX_INPUT_LENGTH = 5000;
const OUTPUT_TOKEN_BUFFER = 180;
const MAX_REWRITE_ATTEMPTS = 2;
const REQUEST_TIME_BUDGET_MS = 12000;
const MIN_REMAINING_FOR_ATTEMPT_MS = 1500;
const MIN_CALL_TIMEOUT_MS = 600;
const URL_SHORTENER_TIMEOUT_MS = 800;
const AI_CALL_TIMEOUT_MS = 8000;
const MAX_URLS_TO_SHORTEN = 3;
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"'`]+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<>"'`]*)?/gi;
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

  // Bare domains like "practice.com/link"
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(value)) return `https://${value}`;

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

async function shortenWithIsgd(url, deadlineTs) {
  const timeoutMs = getCallTimeoutMs(deadlineTs, URL_SHORTENER_TIMEOUT_MS);
  if (!timeoutMs) return null;

  try {
    const encoded = encodeURIComponent(url);
    const res = await fetch(`${ISGD_API}${encoded}`, {
      headers: { "User-Agent": "TxtTrim/1.0" },
      signal: AbortSignal.timeout(timeoutMs),
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
      const short = await shortenWithIsgd(normalizedUrl, deadlineTs);
      const tokens = uniqueByNormalized.get(normalizedUrl) || [];
      for (const token of tokens) {
        shortenedByToken.set(token, short || token);
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

function smartTrim(text, maxChars) {
  if (text.length <= maxChars) return text;

  let result = text;

  // Step 1: Remove trailing punctuation (except those inside required tokens)
  result = result.replace(/[.!]+$/, "").trim();
  if (result.length <= maxChars) return result;

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
    [/\bcancellation\b/gi, "cancellation"],
    [/\bnumber\b/gi, "no"],
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
    if (result.length <= maxChars) break;
    result = result.replace(pattern, replacement);
  }
  result = normalizeWhitespace(result);
  if (result.length <= maxChars) return result;

  // Step 3: Remove filler words
  const fillers = [/\bjust\b/gi, /\balso\b/gi, /\bkindly\b/gi, /\bsimply\b/gi];
  for (const filler of fillers) {
    if (result.length <= maxChars) break;
    result = result.replace(filler, "");
    result = normalizeWhitespace(result);
  }
  if (result.length <= maxChars) return result;

  // Step 4: Remove "the " where it's not critical
  result = result.replace(/\bthe\s+/gi, "");
  result = normalizeWhitespace(result);
  if (result.length <= maxChars) return result;

  // Step 5: Trim from end at word boundary as last resort
  while (result.length > maxChars) {
    const lastSpace = result.lastIndexOf(" ");
    if (lastSpace <= 0) break;
    result = result.slice(0, lastSpace).replace(/[,;:\s]+$/, "");
  }

  return result;
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
  const pool = attempts.some((attempt) => attempt.withinLimit)
    ? attempts.filter((attempt) => attempt.withinLimit)
    : attempts;

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

  // --- PROMPT ENGINEERING (Legacy Python-style) ---
  const role = "You are a precise SMS message shortener and translator.";
  const protection = protectVariables
    ? "CRITICAL: Do NOT change, delete, or translate any text inside [square brackets] (e.g. [Date]). Keep them exactly as is."
    : "";

  const task =
    targetLanguage && targetLanguage !== "English"
      ? `Task: Translate the message to ${targetLanguage} FIRST, and THEN shorten the translated text to under ${maxChars} characters.`
      : `Task: Shorten the message to under ${maxChars} characters in English.`;

  const systemPrompt = role;
  const initialUserPrompt = `${task}

Rules:
- Maintain the original meaning.
- Tone: ${businessSector}.
- ${protection}
- If multiple links exist, keep them all.
- Provide ONLY the final SMS text. No intro/outro.

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
        if (strictCandidate) {
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
      shortenedText = smartTrim(shortenedText, maxChars);
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
