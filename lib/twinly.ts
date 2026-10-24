import { z } from "zod";
import {
  TwinlyFeature,
  twinlyMeSchema,
  twinlyJobSchema,
  featureReadiness,
  computerActionSchema,
  screenshotSchema,
} from "./twinly-contract";
export class TwinlyError extends Error {
  constructor(
    message: string,
    public status: number,
    public uncertain: boolean,
  ) {
    super(message);
    this.name = "TwinlyError";
  }
}
export class TwinlyAdapter {
  private async request(
    path: string,
    method = "GET",
    body?: unknown,
    timeout = 30000,
  ) {
    if (!process.env.TWINLY_API_KEY)
      throw new TwinlyError("Twinly not configured", 401, false);
    const base =
      process.env.TWINLY_BASE_URL ??
      "https://advktwnedlgnhswpxokg.supabase.co/functions/v1/twinly-api/v1";
    if (new URL(base).protocol !== "https:")
      throw new TwinlyError("Twinly requires HTTPS", 400, false);
    let response: Response;
    try {
      response = await fetch(base + path, {
        method,
        headers: {
          Authorization: `Bearer ${process.env.TWINLY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
        cache: "no-store",
      });
    } catch {
      throw new TwinlyError(
        method === "POST"
          ? "Submission uncertain. Reconcile the existing job before any retry."
          : "Twinly connection timed out",
        0,
        method === "POST",
      );
    }
    if (!response.ok) {
      const labels: Record<number, string> = {
        400: "Invalid Twinly request",
        401: "Twinly key rejected",
        402: "Twinly usage exhausted",
        403: "Twinly permission missing",
        404: "Twinly job or endpoint not found",
        409: "Twinly Mac offline or setup incomplete",
        413: "Twinly payload too large",
        422: "Twinly could not accept this content",
        429: "Twinly rate limited",
        503: "Twinly job unverified: reconcile before retry",
      };
      throw new TwinlyError(
        labels[response.status] ?? `Twinly request failed (${response.status})`,
        response.status,
        method === "POST" && response.status >= 500,
      );
    }
    try {
      return await response.json();
    } catch {
      throw new TwinlyError(
        "Twinly returned an unreadable response. Reconcile any submitted job.",
        502,
        method === "POST",
      );
    }
  }
  async health() {
    return twinlyMeSchema.parse(await this.request("/me"));
  }
  private async ready(feature: TwinlyFeature) {
    const state = featureReadiness(await this.health(), feature);
    if (!state.ready) throw new TwinlyError(state.reason, 409, false);
  }
  async message(to: string, text: string) {
    await this.ready("messages_send");
    return twinlyJobSchema.parse(
      await this.request("/messages?wait=0", "POST", {
        to: z.string().min(1).max(128).parse(to),
        text: z.string().min(1).max(4000).parse(text),
      }),
    );
  }
  async readMessages(withContact: string, limit = 20) {
    await this.ready("messages_read");
    return twinlyJobSchema.parse(
      await this.request(
        `/messages?with=${encodeURIComponent(z.string().min(1).max(128).parse(withContact))}&limit=${z.number().int().min(1).max(50).parse(limit)}&wait=0`,
      ),
    );
  }
  async task(prompt: string, output_schema: Record<string, unknown>) {
    await this.ready("tasks");
    return twinlyJobSchema.parse(
      await this.request("/tasks?wait=0", "POST", {
        prompt: z.string().min(1).max(4000).parse(prompt),
        output_schema,
      }),
    );
  }
  async call(to: string, goal: string, say?: string) {
    await this.ready("calls");
    return twinlyJobSchema.parse(
      await this.request("/calls?wait=0", "POST", {
        to: z.string().min(1).max(128).parse(to),
        goal: z.string().min(1).max(2000).parse(goal),
        ...(say ? { say: z.string().max(1000).parse(say) } : {}),
      }),
    );
  }
  async speak(text: string) {
    await this.ready("voice");
    return twinlyJobSchema.parse(
      await this.request("/voice/speak?wait=0", "POST", {
        text: z.string().min(1).max(600).parse(text),
      }),
    );
  }
  async image(prompt: string, shape: "square" | "wide" | "tall" = "square") {
    await this.ready("images");
    return z
      .object({
        data: z
          .array(
            z.object({
              b64_json: z.string().max(14000000),
              mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
            }),
          )
          .min(1)
          .max(4),
      })
      .parse(
        await this.request(
          "/images",
          "POST",
          {
            prompt: z.string().min(1).max(2000).parse(prompt),
            shape: z.enum(["square", "wide", "tall"]).parse(shape),
          },
          125000,
        ),
      );
  }
  async chat(prompt: string) {
    await this.ready("chat");
    return z
      .object({
        choices: z
          .array(
            z.object({ message: z.object({ content: z.string().min(1) }) }),
          )
          .min(1),
      })
      .parse(
        await this.request(
          "/chat/completions",
          "POST",
          {
            model: "twinly-core",
            messages: [
              {
                role: "user",
                content: z.string().min(1).max(20000).parse(prompt),
              },
            ],
            reasoning_effort: "minimal",
            stream: false,
            max_tokens: 4096,
          },
          125000,
        ),
      );
  }
  async nextAction(goal: string, screenshot: string) {
    await this.ready("computer");
    return z
      .object({ action: computerActionSchema, blocked: z.string().optional() })
      .parse(
        await this.request(
          "/computer/next-action",
          "POST",
          {
            goal: z.string().min(1).max(2000).parse(goal),
            screenshot: screenshotSchema.parse(screenshot),
          },
          125000,
        ),
      );
  }
  async poll(id: string) {
    return twinlyJobSchema.parse(
      await this.request(
        `/jobs/${encodeURIComponent(z.string().uuid().parse(id))}`,
      ),
    );
  }
  async cancel(id: string) {
    return twinlyJobSchema.parse(
      await this.request(
        `/jobs/${encodeURIComponent(z.string().uuid().parse(id))}/cancel`,
        "POST",
      ),
    );
  }
}
