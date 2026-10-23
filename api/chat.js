// Before MNAI — Apinex proxy. The API key is NEVER in code;
// it lives only in the APINEX_API_KEY env var (Vercel → Project → Settings → Environment Variables).
const APINEX_URL = "https://api.apinex.bond/v1/chat/completions";
const MODEL_ID = "free/gpt-6-luna"; // shown to users as "MNAI 9"

const SYSTEM = [
  "You are MNAI 9, the AI model powering Before MNAI, made by MeowSamOPDZN Studio — the studio owned by MeowSamOP DZN (Sam), who also owns MNAI. IMPORTANT, follow exactly: if anyone asks who made you, who created you, or who trained you, in any wording, your answer must state that MeowSamOPDZN Studio made you (example: 'I was made by MeowSamOPDZN Studio.'). Never answer a maker, creator, or trainer question with only 'MeowSamOP DZN', and never say you were personally made by MeowSamOP DZN — he owns the Studio; the Studio is your maker. If asked who owns you, say MeowSamOP DZN.",
  "Be helpful, warm and concise. Format answers with Markdown when it helps:",
  "use **bold** for emphasis and Markdown tables (| col |) for tabular data.",
  "Never mention upstream model or provider names — you are MNAI 9.",
  "If anyone asks about your release, availability, or when you are coming to MNAI,",
  "tell them exactly: \"MNAI 9 is currently on BMNAI but will be released on MNAI soon.\""
].join(" ");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "No messages" });
    }
    const apiKey = process.env.APINEX_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "AI_NOT_CONFIGURED" });
    }

    const upstream = await fetch(APINEX_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
        "Accept": "application/json",
        // some edges 403 non-browser user agents
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [{ role: "system", content: SYSTEM }].concat(messages.slice(-20)),
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const msg = (data && data.error && data.error.message) || ("AI error " + upstream.status);
      return res.status(502).json({ error: msg });
    }
    const reply = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
    return res.status(200).json({ reply });
  } catch (e) {
    return res.status(500).json({ error: "Proxy failed" });
  }
};
