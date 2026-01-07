export async function onRequestPost({ request, env }) {
  try {
    const { platform, tone, length, language, topic } = await request.json();

    const prompt = `
You are a professional social media content generator.

Write content in ${language}.
Platform: ${platform}
Tone: ${tone}
Length: ${length} seconds
Topic: ${topic}

Prefer returning JSON, but if not possible, return clear structured text.
`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
        })
      }
    );

    const data = await res.json();

    let text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    text = text.replace(/```json|```/gi, "").trim();

    try {
      const parsed = JSON.parse(text);
      return ok(parsed);
    } catch {}

    const lines = text.split("\n").filter(Boolean);

    const fallback = {
      hooks: lines.slice(0, 5),
      script: {
        intro: lines[5] || `Let's talk about ${topic}.`,
        body: lines.slice(6, 10).join(" "),
        cta: `Follow for more ${platform} content`
      },
      caption: `${topic} – ${tone} ${platform} video`,
      hashtags: [
        platform.toLowerCase(),
        "content",
        "creator",
        "viral",
        "ai"
      ]
    };

    return ok(fallback);

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

function ok(json) {
  return new Response(JSON.stringify(json), {
    headers: { "Content-Type": "application/json" }
  });
}
