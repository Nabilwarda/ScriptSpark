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
`;

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

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

    const raw = await res.json();

    let text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    text = text.replace(/```json|```/gi, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return errorResponse("AI did not return valid JSON", text);
    }

    const out = normalize(parsed);
    return ok(out);

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/* ---------------- Helpers ---------------- */

function ok(json) {
  return new Response(JSON.stringify(json), {
    headers: { "Content-Type": "application/json" }
  });
}

function errorResponse(message, rawText) {
  return new Response(
    JSON.stringify({
      error: message,
      rawText
    }),
    {
      status: 500,
      headers: { "Content-Type": "application/json" }
    }
  );
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
    hooks: obj.hooks,
    script: {
      intro: obj.script.intro.trim(),
      body: obj.script.body.trim(),
      cta: obj.script.cta.trim()
    },
    caption: obj.caption.trim(),
    hashtags: obj.hashtags
      .slice(0, 12)
      .map(h => (h.startsWith("#") ? h : `#${h}`))
  };
}

function detectPersona(topic = "") {
  const t = topic.toLowerCase();

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
