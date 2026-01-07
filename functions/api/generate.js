export async function onRequestPost() {
  return new Response(
    JSON.stringify({
      ok: true,
      message: "POST works from Pages Functions"
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
