import { capabilities } from "@/lib/capabilities";
import { twinlyReadiness } from "@/lib/twinly-readiness";
export async function GET() {
  const twinly = await twinlyReadiness();
  return Response.json({
    gemmaConfigured: !!process.env.GEMINI_API_KEY,
    gemmaVerified: false,
    model: process.env.GEMMA_MODEL ?? "gemma-4-26b-a4b-it",
    twinlyConfigured: !!process.env.TWINLY_API_KEY,
    twinlyLive: twinly.features.some((f) => f.ready),
    persistence: process.env.VERCEL
      ? "read-only sandbox"
      : "local atomic files",
    execution: "capability-based",
    capabilities: capabilities(twinly.features),
  });
}
