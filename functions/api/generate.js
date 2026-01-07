// /functions/api/generate.js

export async function onRequest({ request, env }) {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (request.method !== "POST") {
    return jsonErr(405, "Method Not Allowed");
  }

  try {
    const apiKey = (env.GEMINI_API_KEY || env.GOOGLE_API_KEY || "").trim();
    if (!apiKey) {
      return jsonErr(500, "Missing GEMINI_API_KEY (or GOOGLE_API_KEY) in environment variables");
    }

    const body = await request.json();
    const platform = body.platform || "TikTok";
    const tone = body.tone || "Friendly";
    const length = Number(body.length || 30);
    const language = body.language || "Arabic";
    const topic = String(body.topic || "").trim();

    if (!topic) return jsonErr(400, "Missing topic");

    const langLabel =
      language === "Arabic"
        ? "Arabic (Egyptian colloquial, spoken)"
        : "English (spoken)";

    const persona = detectPersona(topic);

    // Prompt: spoken + JSON only (بس كمان إحنا هنجبره JSON من generationConfig)
    const prompt = `
Return ONLY valid JSON. No markdown. No explanations. No text outside JSON.

You are a professional content creator writing a SPOKEN VIDEO SCRIPT to be read out loud to camera.

Language: ${langLabel}
Platform: ${platform}
Tone: ${tone}
Target length: ${length} seconds
Topic: ${topic}
Persona: ${persona}

Rules:
- This must sound like REAL speech (natural, conversational).
- Do NOT use steps, lists, bullets, or numbered instructions.
- Do NOT say "Step 1", "First", "أول حاجة", "تاني حاجة", etc.
- Use short sentences and pauses with "…" when appropriate.
- hooks must be exactly 5, punchy, SPOKEN hooks.
- script.intro/body/cta must be non-empty and spoken.
- caption must be ONE short sentence.
- hashtags must be 8–12, each starting with #.
- Use ONLY the selected language. No mixing languages.
- Never mention AI, prompts, policies, or instructions.
`.trim();

    // Flash ONLY (زي ما طلبت)
    const model = "gemini-2.5-flash";

    const attempt = await callGemini({
      apiKey,
      model,
      prompt,
      temperature: 0.8,
      maxOutputTokens: 1800, // زودناها عشان يمنع القطع
    });

    if (!attempt.ok) {
      return jsonErr(500, "Gemini API error", {
        model,
        status: attempt.status,
        error: attempt.error,
        rawPreview: attempt.rawPreview,
      });
    }

    const text = String(attempt.text || "").trim();
    if (!text) {
      return jsonErr(500, "Gemini returned empty text", { model });
    }

    // في JSON mode المفروض ده يبقى JSON صافي
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return jsonErr(500, "AI did not return valid JSON", {
        model,
        parseError: e.message,
        textPreview: preview(text, 2000),
      });
    }

    const out = normalizeStrict(parsed);
    return jsonOk(out);

  } catch (err) {
    return jsonErr(500, "Server error", { message: err?.message || String(err) });
  }
}

/* ---------------- Gemini Call ---------------- */

async function callGemini({ apiKey, model, prompt, temperature, maxOutputTokens }) {
  // NOTE: Using v1beta generateContent + JSON Mode + schema
  // Fields response_mime_type and response_schema are supported in REST generationConfig. :contentReference[oaicite:1]{index=1}
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  // JSON schema (REST requires upper-case-ish enum values like "OBJECT"/"ARRAY"/"STRING" in examples)
  const responseSchema = {
    type: "OBJECT",
    properties: {
      hooks: {
        type: "ARRAY",
        items: { type: "STRING" },
      },
      script: {
        type: "OBJECT",
        properties: {
          intro: { type: "STRING" },
          body: { type: "STRING" },
          cta: { type: "STRING" },
        },
        required: ["intro", "body", "cta"],
      },
      caption: { type: "STRING" },
      hashtags: {
        type: "ARRAY",
        items: { type: "STRING" },
      },
    },
    required: ["hooks", "script", "caption", "hashtags"],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens,
          // ✅ إجبار JSON output
          response_mime_type: "application/json",
          response_schema: responseSchema,
        },
      }),
    });

    const resText = await res.text();

    let raw = null;
    try { raw = resText ? JSON.parse(resText) : null; } catch { raw = null; }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: raw?.error?.message || "Gemini API error",
        rawPreview: preview(resText),
      };
    }

    if (!raw?.candidates?.length) {
      return {
        ok: false,
        status: res.status,
        error: "No candidates returned",
        rawPreview: preview(resText),
      };
    }

    const c0 = raw.candidates[0];
    const parts = c0?.content?.parts;

    // With JSON mode, text should be JSON
    const text = Array.isArray(parts)
      ? parts.map(p => (typeof p?.text === "string" ? p.text : "")).join("\n").trim()
      : "";

    return { ok: true, status: res.status, text };

  } catch (e) {
    return { ok: false, status: 0, error: e?.message || "Network error" };
  }
}

/* ---------------- Validation ---------------- */

function normalizeStrict(obj) {
  if (!obj || typeof obj !== "object") throw new Error("Not an object");

  if (!Array.isArray(obj.hooks) || obj.hooks.length !== 5) {
    throw new Error("hooks must be exactly 5");
  }

  if (!obj.script || typeof obj.script !== "object") throw new Error("script missing");

  const intro = String(obj.script.intro || "").trim();
  const body = String(obj.script.body || "").trim();
  const cta = String(obj.script.cta || "").trim();
  if (!intro || !body || !cta) throw new Error("script fields must be non-empty");

  const caption = String(obj.caption || "").trim();
  if (!caption) throw new Error("caption must be non-empty");

  if (!Array.isArray(obj.hashtags) || obj.hashtags.length < 8) {
    throw new Error("hashtags must be 8+");
  }

  const hashtags = obj.hashtags
    .slice(0, 12)
    .map(x => String(x || "").trim())
    .filter(Boolean)
    .map(h => (h.startsWith("#") ? h : `#${h}`));

  const hooks = obj.hooks
    .map(x => String(x || "").trim())
    .filter(Boolean);

  if (hooks.length !== 5) throw new Error("hooks must be 5 non-empty strings");

  return {
    hooks,
    script: { intro, body, cta },
    caption,
    hashtags,
  };
}

/* ---------------- Persona ---------------- */

function detectPersona(topic = "") {
  const t = String(topic || "").toLowerCase();

  if (t.includes("مطعم") || t.includes("اكل") || t.includes("تجربة") || t.includes("review") || t.includes("تقييم")) {
    return "reviewer";
  }
  if (t.includes("شرح") || t.includes("تعلم") || t.includes("how") || t.includes("tips") || t.includes("نصائح")) {
    return "educator";
  }
  if (t.includes("قصة") || t.includes("حصل") || t.includes("story")) {
    return "storyteller";
  }
  return "general_creator";
}

/* ---------------- Response helpers ---------------- */

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonOk(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function jsonErr(status, error, extra = null) {
  return new Response(JSON.stringify({ error, ...(extra ? { extra } : {}) }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function preview(s, n = 1500) {
  const str = String(s || "");
  return str.length > n ? str.slice(0, n) + "…" : str;
}
