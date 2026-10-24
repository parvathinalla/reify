import { z } from "zod";
const jobSchema = z.object({
  id: z.string(),
  status: z.enum([
    "queued",
    "running",
    "needs_approval",
    "done",
    "failed",
    "canceled",
    "expired",
  ]),
  result: z.record(z.string(), z.unknown()).nullable().optional(),
  error: z
    .object({ code: z.string().optional(), message: z.string().optional() })
    .nullable()
    .optional(),
});
export class TwinlyAdapter {
  private async request(path: string, method = "GET", body?: unknown) {
    if (!process.env.TWINLY_API_KEY) throw Error("Twinly not configured");
    const base =
      process.env.TWINLY_BASE_URL ??
      "https://advktwnedlgnhswpxokg.supabase.co/functions/v1/twinly-api/v1";
    if (new URL(base).protocol !== "https:")
      throw Error("Twinly requires HTTPS");
    let r: Response;
    try {
      r = await fetch(`${base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${process.env.TWINLY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30000),
        cache: "no-store",
      });
    } catch {
      throw Error(
        method === "POST"
          ? "Submission uncertain. Reconcile jobs before any retry."
          : "Twinly connection timed out",
      );
    }
    if (!r.ok)
      throw Error(
        (
          {
            402: "Usage exhausted",
            403: "Permission missing",
            409: "Mac offline or setup incomplete",
            429: "Rate limited",
            503: "Job unverified: reconcile before retry",
          } as Record<number, string>
        )[r.status] ?? `Twinly request failed (${r.status})`,
      );
    return r.json();
  }
  async health() {
    const data = await this.request("/me");
    return z
      .object({
        mac: z.object({
          online: z.boolean(),
          setup: z
            .record(z.string(), z.union([z.boolean(), z.string()]))
            .nullable()
            .optional(),
        }),
        can: z.object({ cloud: z.array(z.string()), mac: z.array(z.string()) }),
      })
      .parse(data);
  }
  async message(to: string, text: string) {
    await this.ready();
    return jobSchema.parse(
      await this.request("/messages?wait=0", "POST", { to, text }),
    );
  }
  async task(prompt: string, output_schema: Record<string, unknown>) {
    await this.ready();
    return jobSchema.parse(
      await this.request("/tasks?wait=0", "POST", { prompt, output_schema }),
    );
  }
  async poll(id: string) {
    return jobSchema.parse(
      await this.request(`/jobs/${encodeURIComponent(id)}`),
    );
  }
  async cancel(id: string) {
    return jobSchema.parse(
      await this.request(`/jobs/${encodeURIComponent(id)}/cancel`, "POST"),
    );
  }
  private async ready() {
    const me = await this.health();
    if (!me.mac.online) throw Error("Twinly Mac offline");
  }
}
// Adapter is intentionally not wired to public mutation routes until Mac verification.
