export async function onRequestPost({ request, env }) {
  try {
    const { platform, tone, length, language, topic } = await request.json();

    const langLabel = language === "Arabic" ? "Arabic (Egyptian friendly)" : "English";
    const platformLabel = platform || "TikTok";

    const schema = `{
  "hooks": ["", "", "", "", ""],
  "script": { "intro": "", "body": "", "cta": "" },
  "caption": "",
  "hashtags": ["#tag1"]
}`;

    const prompt = `
You are a strict JSON API.
Return ONLY valid JSON. No markdown. No explanations. No extra text.

Language: ${langLabel}
Platform: ${platformLabel}
Tone: ${tone}
Length: ${length} seconds
Topic: ${topic}

Return EXACTLY this JSON schema:
${schema}

Rules:
- hooks must be exactly 5 (short, punchy)
- script.intro/body/cta must be non-empty
- caption must be 1 line
- hashtags must be 8 to 12 items, each starts with #
- Do not mention that you are an AI.
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

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

    // Try strict JSON
    let parsed = null;
    try { parsed = JSON.parse(text); } catch {}

    // Validate + normalize
    const fallback = buildFallback({ platform: platformLabel, tone, length, language, topic });

    const out = normalize(parsed || {}, fallback);
    return ok(out);

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

function ok(json) {
  return new Response(JSON.stringify(json), {
    headers: { "Content-Type": "application/json" }
  });
}

function normalize(obj, fallback) {
  const hooks = Array.isArray(obj.hooks) ? obj.hooks.filter(Boolean) : [];
  const hashtags = Array.isArray(obj.hashtags) ? obj.hashtags.filter(Boolean) : [];

  const script = obj.script && typeof obj.script === "object" ? obj.script : {};
  const intro = (script.intro || "").trim();
  const body = (script.body || "").trim();
  const cta = (script.cta || "").trim();

  return {
    hooks: hooks.length >= 5 ? hooks.slice(0, 5) : fallback.hooks,
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

function buildFallback({ platform, tone, length, language, topic }) {
  const isAr = language === "Arabic";
  const p = platform;
  const L = Number(length) || 30;

  if (isAr) {
    return {
      hooks: [
        `قبل ما تعمل/ي ${topic}… خد/ي بالك من النقطة دي!`,
        `ليه أغلب الناس بتغلط في ${topic}؟`,
        `لو عندك 30 ثانية… ده أهم شيء عن ${topic}.`,
        `3 خطوات هتخليك/ي تعمل/ي ${topic} صح.`,
        `آخر نصيحة هتفرق معاك جدًا في ${topic}.`
      ],
      script: {
        intro: `النهارده هقولك بسرعة إزاي تبدأ في: ${topic}.`,
        body: `أول حاجة: حدّد/ي الهدف في جملة واحدة.\nتاني حاجة: ابدأ/ي بالمعلومة الأقوى الأول.\nتالت حاجة: مثال سريع + نتيجة واضحة.\nخلي الكلام بسيط ومباشر وبنَفَس ${tone.toLowerCase()}.\nوخلّي الفيديو حوالي ${L} ثانية على ${p}.`,
        cta: `لو الفيديو فادك، اعمل/ي متابعة واكتب/ي "تم" عشان أبعتلك أفكار زيادة.`
      },
      caption: `سكريبت سريع عن: ${topic} ✅`,
      hashtags: [
        "#تيك_توك", "#ريلز", "#صناع_المحتوى", "#افكار_محتوى",
        "#تسويق", "#سوشيال_ميديا", "#ذكاء_اصطناعي", "#نصائح"
      ]
    };
  }

  return {
    hooks: [
      `Before you try "${topic}", do this first.`,
      `Most people mess this up about "${topic}"…`,
      `In 30 seconds, here’s the easiest way to "${topic}".`,
      `3 quick steps to improve "${topic}" today.`,
      `The last tip will save you time on "${topic}".`
    ],
    script: {
      intro: `Quick breakdown on: ${topic}.`,
      body: `Step 1: Define the goal in one sentence.\nStep 2: Lead with the strongest insight first.\nStep 3: Show a mini example + clear result.\nKeep it ${tone.toLowerCase()} and simple.\nAim for ~${L}s on ${p}.`,
      cta: `If this helped, follow for more and comment "DONE" for extra ideas.`
    },
    caption: `A quick script about: ${topic} ✅`,
    hashtags: ["#contentcreator","#shorts","#tiktok","#reels","#socialmedia","#marketing","#ai","#creatorTips"]
  };
}
