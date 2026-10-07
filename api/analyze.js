// Vercel serverless function: sends the uploaded plan image to Claude and returns the layout JSON.
// Required env vars: ANTHROPIC_API_KEY, APP_PASSWORD. Optional: CLAUDE_MODEL.

const crypto = require("crypto");

function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function extractJson(text) {
  try { return JSON.parse(text); } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch {} }
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start >= 0 && end > start) { try { return JSON.parse(text.slice(start, end + 1)); } catch {} }
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });

  const { APP_PASSWORD, ANTHROPIC_API_KEY, CLAUDE_MODEL } = process.env;
  if (!APP_PASSWORD || !ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Server is missing ANTHROPIC_API_KEY or APP_PASSWORD. Add them in Vercel → Settings → Environment Variables, then redeploy." });
  }
  if (!safeEqual(req.headers["x-app-password"] || "", APP_PASSWORD)) {
    return res.status(401).json({ error: "Wrong password." });
  }

  const { images, prompt } = req.body || {};
  if (!Array.isArray(images) || !images.length || !prompt) return res.status(400).json({ error: "Missing drawings or prompt." });
  if (images.length > 4) return res.status(400).json({ error: "Upload at most 4 drawings." });
  const OK = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (images.some(i => !i || typeof i.data !== "string" || !OK.includes(i.mediaType))) {
    return res.status(400).json({ error: "One of the drawings has an unsupported format." });
  }
  if (String(prompt).length > 20000) return res.status(400).json({ error: "Request is too long." });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL || "claude-sonnet-5-5",
        max_tokens: 16000,
        messages: [{
          role: "user",
          content: [
            ...images.flatMap((img, i) => [
              { type: "text", text: `Image ${i + 1}:` },
              { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } },
            ]),
            { type: "text", text: String(prompt) },
          ],
        }],
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data?.error?.message || "Claude API request failed." });

    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    const plan = extractJson(text);
    if (!plan) return res.status(502).json({ error: "The plan came back in an unexpected format. Try again." });
    return res.status(200).json(plan);
  } catch (e) {
    return res.status(500).json({ error: "Could not reach the Claude API. Try again." });
  }
};
