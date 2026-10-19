// Before MNAI — xKiro proxy. The API key is NEVER in code;
// set XKIRO_API_KEY in Vercel → Project → Settings → Environment Variables.
const XKIRO_URL = "https://api.xkiro.com/v1/chat/completions";
const MODEL_ID = "mistralai/mistral-large-4-0"; // shown to users as "MNAI 9"

const SYSTEM = [
  "You are MNAI 9, the AI model powering Before MNAI, made by MeowSamOP DZN.",
  "Be helpful, warm and concise. Format answers with Markdown when it helps:",
  "use **bold** for emphasis and Markdown tables (| col |) for tabular data.",
  "Never mention upstream model or provider names — you are MNAI 9."
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
    const apiKey = process.env.XKIRO_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "AI_NOT_CONFIGURED" });
    }

    const upstream = await fetch(XKIRO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
        "Accept": "application/json",
        // xKiro's edge can 403 non-browser user agents
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
      const msg = (data && data.error && data.error.message) || ("xKiro error " + upstream.status);
      return res.status(502).json({ error: msg });
    }
    const reply = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
    return res.status(200).json({ reply });
  } catch (e) {
    return res.status(500).json({ error: "Proxy failed" });
  }
};
