export async function onRequestPost({ request, env }) {
  try {
    const { platform, tone, length, language, topic } = await request.json();

    const prompt = `
You are a professional social media script writer.

Generate content in ${language}.
Platform: ${platform}
Tone: ${tone}
Length: ${length} seconds
Topic: ${topic}

Return ONLY valid JSON in this exact format:
{
  "hooks": ["", "", "", "", ""],
  "script": {
    "intro": "",
    "body": "",
    "cta": ""
  },
  "caption": "",
  "hashtags": ["", "", "", "", "", "", "", ""]
}
Do not add any explanation or text outside JSON.
`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const geminiData = await geminiRes.json();

    const rawText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Gemini response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(parsed), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    );
  }
}
