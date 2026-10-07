// Vercel serverless function: sends the uploaded plan images to an AI model and returns the JSON it designs.
//
// Pick ONE provider by setting its key in Vercel → Settings → Environment Variables:
//   GEMINI_API_KEY     – Google Gemini (key from aistudio.google.com). Optional GEMINI_MODEL (default gemini-3.8-flash).
//   ANTHROPIC_API_KEY  – Claude. Optional CLAUDE_MODEL (default claude-sonnet-5-5) and ANTHROPIC_WORKSPACE_ID.
// If both are set, Gemini is used unless AI_PROVIDER=claude.
// Always required: APP_PASSWORD.

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

async function callGemini(images, prompt, env) {
  const model = (env.GEMINI_MODEL || "gemini-3.8-flash").trim();
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY.trim() },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          ...images.flatMap((img, i) => [
            { text: `Image ${i + 1}:` },
            { inline_data: { mime_type: img.mediaType, data: img.data } },
          ]),
          { text: String(prompt) },
        ],
      }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 32768, temperature: 0.4 },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error?.message || `Gemini request failed (${r.status}).`;
    if (r.status === 429 || /quota|rate/i.test(msg)) throw new Error("Gemini's limit was reached (the free tier allows only a few requests per minute). Wait a minute and press Retry.");
    if (/API key not valid|API_KEY_INVALID|permission/i.test(msg)) throw new Error("Gemini rejected the key. Check GEMINI_API_KEY in Vercel, then redeploy.");
    if (r.status === 404) throw new Error(`Gemini model "${model}" wasn't found. Set GEMINI_MODEL in Vercel to a current model (for example gemini-3.5-flash), then redeploy.`);
    throw new Error(msg);
  }
  const cand = data?.candidates?.[0];
  const text = (cand?.content?.parts || []).filter(p => typeof p.text === "string" && !p.thought).map(p => p.text).join("\n");
  if (!text) throw new Error(cand?.finishReason === "SAFETY" ? "Gemini declined this page. Try a different drawing." : "Gemini returned an empty answer. Press Retry.");
  return text;
}

async function callClaude(images, prompt, env) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY.trim(),
      "anthropic-version": "2023-06-01",
      ...(env.ANTHROPIC_WORKSPACE_ID ? { "anthropic-workspace-id": env.ANTHROPIC_WORKSPACE_ID.trim() } : {}),
    },
    body: JSON.stringify({
      model: env.CLAUDE_MODEL || "claude-sonnet-5-5",
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
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error?.message || "Claude API request failed.";
    if (/workspace/i.test(msg)) throw new Error("This API key isn't tied to a workspace. In the Claude Console create a key inside a workspace (it starts with sk-ant-api03-) and put it in ANTHROPIC_API_KEY, or add ANTHROPIC_WORKSPACE_ID in Vercel. Then redeploy.");
    if (/credit|balance/i.test(msg)) throw new Error("Your Claude account has no credit. Add funds in the Claude Console, then press Retry.");
    if (/x-api-key|authentication/i.test(msg)) throw new Error("The API key was rejected. Check ANTHROPIC_API_KEY in Vercel (it should start with sk-ant-api03-), then redeploy.");
    throw new Error(msg);
  }
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });

  const env = process.env;
  if (!env.APP_PASSWORD || (!env.GEMINI_API_KEY && !env.ANTHROPIC_API_KEY)) {
    return res.status(500).json({ error: "Server setup is incomplete. In Vercel → Settings → Environment Variables add APP_PASSWORD and either GEMINI_API_KEY or ANTHROPIC_API_KEY, then redeploy." });
  }
  const useGemini = !!env.GEMINI_API_KEY && !((env.AI_PROVIDER || "").toLowerCase() === "claude" && env.ANTHROPIC_API_KEY);
  if (!safeEqual(req.headers["x-app-password"] || "", env.APP_PASSWORD)) {
    return res.status(401).json({ error: "Wrong password." });
  }

  const { images, prompt } = req.body || {};
  if (!Array.isArray(images) || !prompt) return res.status(400).json({ error: "Missing drawings or prompt." });
  if (images.length > 6) return res.status(400).json({ error: "Upload at most 6 drawings." });
  const OK = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (images.some(i => !i || typeof i.data !== "string" || !OK.includes(i.mediaType))) {
    return res.status(400).json({ error: "One of the drawings has an unsupported format." });
  }
  if (String(prompt).length > 60000) return res.status(400).json({ error: "Request is too long." });

  try {
    const text = useGemini ? await callGemini(images, prompt, env) : await callClaude(images, prompt, env);
    const plan = extractJson(text);
    if (!plan) return res.status(502).json({ error: "The design came back in an unexpected format. Press Retry." });
    return res.status(200).json(plan);
  } catch (e) {
    return res.status(502).json({ error: e?.message || "Could not reach the AI service. Try again." });
  }
};
