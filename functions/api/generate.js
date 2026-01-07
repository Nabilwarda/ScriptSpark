export async function onRequestPost({ request, env }) {
  try {
    const { platform, tone, length, language, topic } = await request.json();

    const platformLabel = platform || "TikTok";
    const langLabel = language === "Arabic"
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
  Speak in first person.
  Share a personal experience, reaction, and opinion.
  Focus on feelings, impressions, and whether it’s worth it.
- If persona is "educator":
  Explain the idea in a simple conversational way.
  No steps, no lists, no teaching tone.
- If persona is "storyteller":
  Tell a short relatable story or situation.
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
          temperature: 0.75,
          maxOutputTokens: 900
        }
      })
    });

    const raw = await res.json();
    let text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    text = text.replace(/```json|```/gi, "").trim();

    let parsed = null;
    try { parsed = JSON.parse(text); } catch {}

    const fallback = buildFallback({ platform: platformLabel, tone, length, language, topic, persona });
    const out = normalize(parsed || {}, fallback);

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

function normalize(obj, fallback) {
  const hooks = Array.isArray(obj.hooks) ? obj.hooks.filter(Boolean) : [];
  const hashtags = Array.isArray(obj.hashtags) ? obj.hashtags.filter(Boolean) : [];

  const script = typeof obj.script === "object" ? obj.script : {};
  const intro = (script.intro || "").trim();
  const body = (script.body || "").trim();
  const cta = (script.cta || "").trim();

  return {
    hooks: hooks.length === 5 ? hooks : fallback.hooks,
    script: {
      intro: intro || fallback.script.intro,
      body: body || fallback.script.body,
      cta: cta || fallback.script.cta
    },
    caption: (obj.caption || "").trim() || fallback.caption,
    hashtags: (hashtags.length >= 8 ? hashtags : fallback.hashtags)
      .slice(0, 12)
      .map(h => h.startsWith("#") ? h : `#${h}`)
  };
}

function detectPersona(topic = "") {
  const t = topic.toLowerCase();

  if (
    t.includes("مطعم") || t.includes("اكل") || t.includes("تجربة") ||
    t.includes("review") || t.includes("تقييم") ||
    t.includes("game") || t.includes("لعبة")
  ) {
    return "reviewer";
  }

  if (
    t.includes("شرح") || t.includes("تعلم") || t.includes("how") ||
    t.includes("tips") || t.includes("نصائح")
  ) {
    return "educator";
  }

  if (
    t.includes("قصة") || t.includes("حصل") || t.includes("story")
  ) {
    return "storyteller";
  }

  return "general_creator";
}

function buildFallback({ platform, length, language, topic, persona }) {
  const isAr = language === "Arabic";
  const L = Number(length) || 30;

  if (isAr) {
    return {
      hooks: [
        `خلّيك معايا ثانية…`,
        `اللي حصل معايا في ${topic} ده غريب.`,
        `مكنتش متوقع ده من ${topic}.`,
        `رأيي بصراحة في ${topic}.`,
        `آخر حتة دي فرقت معايا.`
      ],
      script: {
        intro: `خلّيني أحكيلك بسرعة عن ${topic}.`,
        body: `وأنا بتعامل مع الموضوع ده، لاحظت حاجة مهمة.
الموضوع مش في التفاصيل الكتير… الموضوع في إحساسك وانت بتجرب.
في حاجات بتبان بسيطة، بس تأثيرها كبير.
لو ركزت في النقطة دي، هتفهم الصورة كلها.`,
        cta: `لو حابب تسمع رأيي في موضوع تاني، اكتبلي في الكومنت.`
      },
      caption: `رأيي الحقيقي عن ${topic} 👀`,
      hashtags: [
        "#تيك_توك", "#ريلز", "#صناع_المحتوى",
        "#تجربة", "#رأي", "#محتوى", "#سوشيال_ميديا", "#كريتور"
      ]
    };
  }

  return {
    hooks: [
      `Wait a second…`,
      `Here’s what surprised me about ${topic}.`,
      `I didn’t expect this from ${topic}.`,
      `My honest take on ${topic}.`,
      `This part changed my opinion.`
    ],
    script: {
      intro: `Let me tell you about my experience with ${topic}.`,
      body: `While dealing with this, something stood out to me.
It’s not about too many details… it’s about how it feels.
Small things can change the whole picture.
Once you notice that, everything makes sense.`,
      cta: `If you want my take on another topic, drop it in the comments.`
    },
    caption: `My honest take on ${topic} 🎯`,
    hashtags: [
      "#creator", "#shorts", "#reels",
      "#experience", "#opinion", "#content", "#ai", "#socialmedia"
    ]
  };
}
