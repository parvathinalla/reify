import { TwinlyAdapter } from "@/lib/twinly";
export async function GET() {
  try {
    const h = await new TwinlyAdapter().health();
    return Response.json({
      online: h.mac.online,
      can: h.can,
      setup: h.mac.setup,
      liveVerified: false,
    });
  } catch (e) {
    return Response.json({
      online: false,
      error: e instanceof Error ? e.message : "Unavailable",
      liveVerified: false,
    });
  }
}
