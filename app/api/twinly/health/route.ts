import { twinlyReadiness } from "@/lib/twinly-readiness";
export async function GET() {
  try {
    return Response.json(await twinlyReadiness());
  } catch (e) {
    return Response.json({
      online: false,
      error: e instanceof Error ? e.message : "Unavailable",
      liveVerified: false,
    });
  }
}
