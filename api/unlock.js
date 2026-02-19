import crypto from "node:crypto";

function safeEqual(a, b) {
  const aBuf = Buffer.from(String(a), "utf8");
  const bBuf = Buffer.from(String(b), "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const providedPassword = req.body?.password;
  const masterPassword = process.env.MASTER_PW;

  if (!masterPassword) {
    console.error("MASTER_PW is not configured.");
    return res.status(500).json({ error: "Auth not configured" });
  }

  if (typeof providedPassword !== "string" || !safeEqual(providedPassword, masterPassword)) {
    return res.status(401).json({ ok: false });
  }

  return res.status(200).json({ ok: true });
}
