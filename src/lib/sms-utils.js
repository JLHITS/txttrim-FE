// GSM 03.38 basic character set (1 septet each) and extension set (2 septets).
// Any character outside both forces the whole SMS into UCS-2 encoding, where
// segments are 70 chars (67 when multipart) instead of 160/153.
const GSM7_BASIC = new Set(
  ("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
    "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà").split(""),
);
const GSM7_EXTENDED = new Set("^{}\\[~]|€".split(""));

// Accepts the message text for accurate GSM/UCS-2 segment counting. A number
// (legacy length-only callers, e.g. old history entries) falls back to the
// GSM approximation.
export const getFragmentCount = (textOrLength) => {
  if (typeof textOrLength === "number") {
    return textOrLength <= 160 ? 1 : Math.ceil(textOrLength / 153) || 1;
  }

  const value = String(textOrLength || "");
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
  return value.length <= 70 ? 1 : Math.ceil(value.length / 67);
};

export const getFragmentColor = (count) =>
  count === 1
    ? "text-green-600 dark:text-green-400"
    : count === 2
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-red-600 dark:text-red-400";
