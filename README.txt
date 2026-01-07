ScriptSpark (Vanilla) + Gemini via Cloudflare Pages Functions

1) Put index.html, style.css, main.js in your site root.
2) If you're using Cloudflare Pages:
   - Create this file path in your repo: functions/api/generate.js
   - In Cloudflare Pages -> Settings -> Environment variables:
       GEMINI_API_KEY = (your Google AI Studio key)
       GEMINI_MODEL   = gemini-2.5-flash   (optional)
       ALLOW_ORIGIN   = *                 (optional)
   - Deploy.
   - The frontend will call /api/generate automatically.

3) If you're NOT using Cloudflare Pages Functions:
   - Deploy a Cloudflare Worker with the same code and route /api/generate,
     OR put the full API URL in Settings inside the app.

Notes:
- Do not put your API key inside main.js or index.html for a public site.
