export async function onRequestPost({ request, env }) {
  try {
    const { platform, tone, length, language, topic } = await request.json();

    const platformLabel = platform || "TikTok";
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
You are a professional content creator writing a SPOKEN VIDEO SCRIPT.

IMPORTANT:
- Return ONLY valid JSON
- No markdown
- No explanations
- No text outside JSON

Language: ${langLabel}
Platform: ${platformLabel}
Tone: ${tone}
Target length: ${length} seconds
Topic: ${topic}
Persona: ${persona}

Return EXACTLY this JSON schema:
${schema}

Persona rules:
- If persona is "reviewer":
  Use first person.
  Speak as someone sharing a real experience or opinion.
  Focus on feelings, impressions, and honest reaction.
- If persona is "educator":
  Explain the idea conversationally.
  No teaching tone, no steps.
- If persona is "storyteller":
  Tell a short relatable situation or story.
- If persona is "general_creator":
  Share an insight or opinion naturally.

General rules:
- This must sound like REAL speech said to a camera.
- Do NOT use steps, lists, bullets, or numbered instructions.
- Do NOT say "Step 1", "First", "أول حاجة", etc.
- Use short sentences and pauses with "…".
- hooks must be exactly 5, punchy and spoken.
- script.intro/body/cta must be natural spoken language.
- caption must be ONE short sentence.
- hashtags must be 8–12, each starting with #.
- Use ONLY the selected language. No mixing.
- Never mention AI or prompts.
`.trim();

    const apiKey = (env.GEMINI_API_KEY || "").trim();
    if (!apiKey) {
      return jsonErr(500, "Missing GEMINI_API_KEY in environment variables");
    }

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    // Debug (Cloudflare logs)
    console.log("[Gemini] Request meta:", {
      platform: platformLabel,
      tone,
      length,
      language,
      persona
    });
    console.log("[Gemini] Prompt length:", prompt.length);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 900
        }
      })
    });

    // IMPORTANT: read as text first so we can debug non-JSON errors
    const resText = await res.text();
    let raw = null;
    try {
      raw = resText ? JSON.parse(resText) : null;
    } catch {
      raw = null;
    }

    console.log("[Gemini] HTTP:", res.status);
    if (!res.ok) {
      console.log("[Gemini] Non-OK body:", resText);
      return jsonErr(res.status, "Gemini API error", {
        status: res.status,
        body: raw || resText
      });
    }

    console.log("[Gemini] RAW RESPONSE (parsed?):", raw ? "JSON" : "TEXT");
    if (!raw) {
      console.log("[Gemini] RAW TEXT:", resText);
      return jsonErr(500, "Gemini returned non-JSON response", { body: resText });
    }

    // Extract ALL text parts, not just [0]
    let text = "";
    const c0 = raw?.candidates?.[0];

    const finishReason = c0?.finishReason;
    const safetyRatings = c0?.safetyRatings;
    if (finishReason) console.log("[Gemini] finishReason:", finishReason);
    if (safetyRatings) console.log("[Gemini] safetyRatings:", safetyRatings);

    const parts = c0?.content?.parts;
    if (Array.isArray(parts)) {
      text = parts.map(p => (p && typeof p.text === "string" ? p.text : "")).join("\n").trim();
    }

    // Sometimes models return nothing in parts but include other fields
    console.log("[Gemini] Extracted text length:", text.length);

    if (!text) {
      // return debug info so you can see why it was empty
      return jsonErr(500, "Gemini returned empty text", {
        finishReason: finishReason || null,
        safetyRatings: safetyRatings || null,
        rawPreview: safePreview(raw, 2000)
      });
    }

    // Clean code fences if any
    text = text.replace(/```json|```/gi, "").trim();

    // Parse JSON from model output
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.log("[Gemini] JSON parse failed. Raw text preview:", text.slice(0, 600));
      return jsonErr(500, "AI did not return valid JSON", {
        parseError: e.message,
        rawTextPreview: text.slice(0, 1500)
      });
    }

    const out = normalize(parsed);
    return ok(out);

  } catch (err) {
    console.log("[Server] Error:", err);
    return jsonErr(500, "Server error", { message: err.message });
  }
}

/* ---------------- Helpers ---------------- */

function ok(json) {
  return new Response(JSON.stringify(json), {
    headers: { "Content-Type": "application/json" }
  });
}

function jsonErr(status, error, extra = null) {
  return new Response(
    JSON.stringify({
      error,
      ...(extra ? { extra } : {})
    }),
    {
      status,
      headers: { "Content-Type": "application/json" }
    }
  );
}

function safePreview(obj, maxLen = 1500) {
  try {
    const s = JSON.stringify(obj);
    return s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
  } catch {
    return null;
  }
}

function normalize(obj) {
  if (
    !Array.isArray(obj.hooks) ||
    obj.hooks.length !== 5 ||
    !obj.script ||
    typeof obj.script !== "object" ||
    !obj.script.intro ||
    !obj.script.body ||
    !obj.script.cta ||
    !obj.caption ||
    !Array.isArray(obj.hashtags) ||
    obj.hashtags.length < 8
  ) {
    throw new Error("Invalid AI response structure");
  }

  return {
    hooks: obj.hooks.map(String),
    script: {
      intro: String(obj.script.intro).trim(),
      body: String(obj.script.body).trim(),
      cta: String(obj.script.cta).trim()
    },
    caption: String(obj.caption).trim(),
    hashtags: obj.hashtags
      .slice(0, 12)
      .map(h => {
        const s = String(h).trim();
        return s.startsWith("#") ? s : `#${s}`;
      })
  };
}

function detectPersona(topic = "") {
  const t = String(topic || "").toLowerCase();

  if (
    t.includes("مطعم") ||
    t.includes("اكل") ||
    t.includes("تجربة") ||
    t.includes("review") ||
    t.includes("تقييم") ||
    t.includes("game") ||
    t.includes("لعبة")
  ) {
    return "reviewer";
  }

  if (
    t.includes("شرح") ||
    t.includes("تعلم") ||
    t.includes("how") ||
    t.includes("tips") ||
    t.includes("نصائح")
  ) {
    return "educator";
  }

  if (
    t.includes("قصة") ||
    t.includes("حصل") ||
    t.includes("story")
  ) {
    return "storyteller";
  }

  return "general_creator";
}
