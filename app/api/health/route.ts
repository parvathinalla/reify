export async function GET() {
  return Response.json({
    gemmaConfigured: !!process.env.GEMINI_API_KEY,
    gemmaVerified: false,
    model: process.env.GEMMA_MODEL ?? "gemma-4-26b-a4b-it",
    twinlyConfigured: !!process.env.TWINLY_API_KEY,
    twinlyLive: false,
    persistence: process.env.VERCEL
      ? "read-only sandbox"
      : "local atomic files",
    execution: "demo",
  });
}
