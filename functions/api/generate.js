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
    const topic = (body.topic || "").trim();

    if (!topic) return jsonErr(400, "Missing topic");

    const langLabel =
      language === "Arabic"
        ? "Arabic (Egyptian colloquial, spoken)"
        : "English (spoken)";

    const persona = detectPersona(topic);

    const schema = `{
  "hooks": ["", "", "", "", ""],
  "script": { "intro": "", "body": "", "cta": "" },
  "caption": "",
  "hashtags": ["#tag"]
}`;

    const prompt = `
Return ONLY valid JSON. No markdown. No explanations. No text outside JSON.

You are a professional content creator writing a SPOKEN VIDEO SCRIPT to be read out loud to camera.

Language: ${langLabel}
Platform: ${platform}
Tone: ${tone}
Target length: ${length} seconds
Topic: ${topic}
Persona: ${persona}

Return EXACTLY this JSON schema:
${schema}

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

    // ✅ موديل واحد فقط (Flash)
    const MODEL = "gemini-2.5-flash";

    const attempt = await callGemini({
      apiKey,
      model: MODEL,
      prompt,
      temperature: 0.8,
      maxOutputTokens: 900
    });

    // لو فشل: رجّع تفاصيل واضحة
    if (!attempt.ok) {
      return jsonErr(500, "Gemini call failed", {
        model: MODEL,
        status: attempt.status,
        error: attempt.error || null,
        rawPreview: attempt.rawPreview || null
      });
    }

    // extract+parse JSON
    const extracted = extractJsonObject(attempt.text || "");
    if (!extracted) {
      return jsonErr(500, "No JSON object found in model response", {
        model: MODEL,
        textPreview: preview(attempt.text, 1200)
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(extracted);
    } catch (e) {
      return jsonErr(500, "AI did not return valid JSON", {
        model: MODEL,
        parseError: e.message,
        rawTextPreview: preview(extracted, 1500)
      });
    }

    // validate shape strictly (no fallback)
    let out;
    try {
      out = normalizeStrict(parsed);
    } catch (e) {
      return jsonErr(500, "Invalid AI response shape", {
        model: MODEL,
        error: e.message,
        parsedPreview: preview(JSON.stringify(parsed), 1500)
      });
    }

    return jsonOk(out);

  } catch (err) {
    return jsonErr(500, "Server error", { message: err?.message || String(err) });
  }
}

/* ---------------- Gemini Call ---------------- */

async function callGemini({ apiKey, model, prompt, temperature, maxOutputTokens }) {
  // ملاحظة: بنستخدم v1beta هنا زي ما كنت عامل
  // لو ظهرلك errors غريبة، جرّب تغيّرها لـ /v1
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens
        }
      })
    });

    const resText = await res.text();

    let raw = null;
    try { raw = resText ? JSON.parse(resText) : null; } catch { raw = null; }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: raw?.error?.message || "Gemini API error",
        rawPreview: preview(resText)
      };
    }

    if (!raw?.candidates?.length) {
      return {
        ok: false,
        status: res.status,
        error: "No candidates returned",
        rawPreview: preview(resText)
      };
    }

    const c0 = raw.candidates[0];
    const parts = c0?.content?.parts;

    const text = Array.isArray(parts)
      ? parts.map(p => (typeof p?.text === "string" ? p.text : "")).join("\n").trim()
      : "";

    if (!text) {
      return {
        ok: false,
        status: res.status,
        error: "Empty text returned from candidates[0].content.parts",
        rawPreview: preview(resText)
      };
    }

    return { ok: true, status: res.status, text };

  } catch (e) {
    return { ok: false, status: 0, error: e.message || "Network error" };
  }
}

/* ---------------- Validation & JSON extraction ---------------- */

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

  const hooks = obj.hooks.map(x => String(x || "").trim()).filter(Boolean);
  if (hooks.length !== 5) throw new Error("hooks items must be non-empty (5)");

  return {
    hooks,
    script: { intro, body, cta },
    caption,
    hashtags
  };
}

function extractJsonObject(text) {
  const clean = String(text || "").replace(/```json|```/gi, "").trim();

  let depth = 0;
  let start = -1;
  let end = -1;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === '{') {
      if (start === -1) start = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        end = i;
        break;
      }
    }
  }

  if (start !== -1 && end !== -1 && end > start) {
    return clean.slice(start, end + 1);
  }

  // fallback لو مفيش توازن كامل
  const first = clean.indexOf("{");
  const last = clean.lastIndexOf("}");
  if (first !== -1 && last > first) return clean.slice(first, last + 1);
  return null;
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
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function jsonOk(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders() }
  });
}

function jsonErr(status, error, extra = null) {
  return new Response(JSON.stringify({ error, ...(extra ? { extra } : {}) }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() }
  });
}

function preview(s, n = 1500) {
  const str = String(s || "");
  return str.length > n ? str.slice(0, n) + "…" : str;
}
