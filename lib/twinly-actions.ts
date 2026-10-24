import { z } from "zod";
import { isIP } from "node:net";
import type { Task, Workflow } from "./model";
import { TwinlyAdapter } from "./twinly";
import type { TwinlyFeature } from "./twinly-contract";
export type CompiledTwinlyAction = {
  feature: TwinlyFeature;
  target: string;
  payload: Record<string, unknown>;
};
export function featureForTask(task: Task): TwinlyFeature | undefined {
  return (
    {
      research: "tasks",
      twinly_task: "tasks",
      browser_task: "tasks",
      send_message: "messages_send",
      read_messages: "messages_read",
      call: "calls",
      speak: "voice",
      generate_image: "images",
      twinly_chat: "chat",
      computer_action: "computer",
    } as Partial<Record<Task["kind"], TwinlyFeature>>
  )[task.kind];
}
export const canonicalContact = (value: string) =>
  value.includes("@")
    ? value.trim().toLowerCase()
    : /^\+?[\d ()-]+$/.test(value)
      ? value.replace(/[^\d+]/g, "")
      : value.trim().toLowerCase();
export function requireAllowedContact(value: string) {
  const target = z.string().min(1).max(128).parse(value);
  const allowed = (process.env.TWINLY_ALLOWED_CONTACTS ?? "")
    .split(",")
    .map(canonicalContact);
  if (!allowed.includes(canonicalContact(target)))
    throw Error(
      "This recipient is not in the server consenting-contact allowlist. Configure TWINLY_ALLOWED_CONTACTS before contacting them.",
    );
  return target;
}
function allowedTarget(value: unknown) {
  const target = z.url().max(2000).parse(value);
  const url = new URL(target);
  const allowed = (process.env.TWINLY_ALLOWED_DOMAINS ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    isIP(url.hostname) ||
    url.hostname === "localhost" ||
    url.hostname.endsWith(".local") ||
    !allowed.includes(url.hostname.toLowerCase())
  )
    throw Error(
      "Configure this exact HTTPS website host in TWINLY_ALLOWED_DOMAINS before browser actions.",
    );
  return target;
}
export function resolveOutputReferences(w: Workflow) {
  let changed = false;
  for (const task of w.tasks) {
    if (
      !featureForTask(task) ||
      task.dependsOn.some(
        (id) => w.tasks.find((t) => t.id === id)?.status !== "completed",
      )
    )
      continue;
    for (const field of ["prompt", "message", "text", "goal"]) {
      const value = task.inputs[field];
      if (typeof value !== "string") continue;
      const next = value.replace(
        /\{\{([A-Za-z0-9_-]+)\.output\}\}/g,
        (_, id: string) => {
          if (!task.dependsOn.includes(id) || !w.outputs?.[id])
            throw Error(
              "An output reference must name a completed prerequisite.",
            );
          return w.outputs[id].text;
        },
      );
      if (next !== value) {
        task.inputs[field] = next;
        changed = true;
      }
    }
  }
  if (changed) {
    w.version++;
    w.approvals = {};
  }
  return changed;
}
export function compileTwinlyAction(task: Task): CompiledTwinlyAction {
  const input = task.inputs;
  const feature = featureForTask(task);
  if (!feature) throw Error("Not a Twinly action.");
  if (task.kind === "send_message") {
    const p = z
      .object({
        recipient: z.string().min(1).max(128),
        message: z.string().min(1).max(4000),
      })
      .parse(input);
    return {
      feature,
      target: requireAllowedContact(p.recipient),
      payload: { to: p.recipient, text: p.message },
    };
  }
  if (task.kind === "read_messages") {
    const p = z
      .object({
        recipient: z.string().min(1).max(128),
        limit: z.number().int().min(1).max(50).default(20),
      })
      .parse(input);
    return {
      feature,
      target: requireAllowedContact(p.recipient),
      payload: { with: p.recipient, limit: p.limit },
    };
  }
  if (task.kind === "call") {
    const p = z
      .object({
        recipient: z.string().min(1).max(128),
        goal: z.string().min(1).max(2000),
        say: z.string().max(1000).optional(),
      })
      .parse(input);
    return {
      feature,
      target: requireAllowedContact(p.recipient),
      payload: {
        to: p.recipient,
        goal: p.goal,
        ...(p.say ? { say: p.say } : {}),
      },
    };
  }
  if (task.kind === "speak") {
    const p = z.object({ text: z.string().min(1).max(600) }).parse(input);
    return {
      feature,
      target: "Key owner voice profile",
      payload: { text: p.text },
    };
  }
  if (task.kind === "generate_image") {
    const p = z
      .object({
        prompt: z.string().min(1).max(2000),
        shape: z.enum(["square", "wide", "tall"]).default("square"),
      })
      .parse(input);
    return { feature, target: "Private generated image", payload: p };
  }
  if (task.kind === "twinly_chat") {
    const p = z.object({ prompt: z.string().min(1).max(20000) }).parse(input);
    return { feature, target: "Twinly AI chat", payload: p };
  }
  if (task.kind === "computer_action") {
    const p = z
      .object({
        goal: z.string().min(1).max(2000),
        screenshot: z.string().max(5700000),
        ownedScreen: z.literal(true),
      })
      .parse(input);
    const b64 = p.screenshot.replace(
      /^data:image\/(png|jpeg|webp);base64,/,
      "",
    );
    const bytes = Buffer.from(b64, "base64");
    const png = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp =
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP";
    if (
      !bytes.length ||
      bytes.length > 4 * 1024 * 1024 ||
      (!png && !jpeg && !webp)
    )
      throw Error("Choose an owned PNG, JPEG or WebP screenshot under 4 MB.");
    return {
      feature,
      target: "Proposed action only; no screen executor",
      payload: { goal: p.goal, screenshot: p.screenshot },
    };
  }
  const goal = z
    .string()
    .min(1)
    .max(3000)
    .parse(input.prompt ?? task.description ?? task.title);
  let target = "Read-only public research";
  let scope =
    "Read-only public research. Do not access private accounts or files.";
  if (task.kind === "browser_task") {
    target = allowedTarget(input.target);
    const operation = z
      .enum(["browser_read", "browser_submit"])
      .parse(input.operation ?? "browser_read");
    scope = `Approved website: ${target}. ${operation === "browser_read" ? "Read only; do not submit forms or change data." : "Only the exact user-approved submission described below is permitted."} Do not navigate to other hosts.`;
  }
  if (task.kind === "twinly_task") {
    const operation = z
      .enum(["research", "read_app", "create_draft"])
      .parse(input.operation ?? "create_draft");
    const app = z.string().min(1).max(200).parse(input.app);
    target = app;
    scope = `Approved app: ${app}. Operation: ${operation}. Read or create a private draft only; do not send or publish.`;
  }
  const prompt = `Reify user-approved task. ${scope}\nGoal: ${goal}\nNever make calls or send messages/email inside this task. Never pay, purchase, delete data, enter passwords/card/SSN details, or bypass CAPTCHA. Stop and report if a new permission or unapproved action is needed. Report what actually happened, evidence references and limitations; do not invent success.`;
  return {
    feature,
    target,
    payload: {
      prompt,
      output_schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          evidence: { type: "array", items: { type: "string" } },
          completed: { type: "boolean" },
        },
        required: ["summary", "completed"],
      },
    },
  };
}
export async function executeTwinlyAction(
  adapter: TwinlyAdapter,
  action: CompiledTwinlyAction,
) {
  const p = action.payload;
  switch (action.feature) {
    case "messages_send":
      return {
        kind: "job" as const,
        job: await adapter.message(String(p.to), String(p.text)),
      };
    case "messages_read":
      return {
        kind: "job" as const,
        job: await adapter.readMessages(String(p.with), Number(p.limit)),
      };
    case "calls":
      return {
        kind: "job" as const,
        job: await adapter.call(
          String(p.to),
          String(p.goal),
          p.say ? String(p.say) : undefined,
        ),
      };
    case "voice":
      return { kind: "job" as const, job: await adapter.speak(String(p.text)) };
    case "tasks":
      return {
        kind: "job" as const,
        job: await adapter.task(
          String(p.prompt),
          p.output_schema as Record<string, unknown>,
        ),
      };
    case "images": {
      const r = await adapter.image(
        String(p.prompt),
        p.shape as "square" | "wide" | "tall",
      );
      return {
        kind: "output" as const,
        text: "Generated image",
        data: r.data[0].b64_json,
        mime: r.data[0].mime,
      };
    }
    case "chat": {
      const r = await adapter.chat(String(p.prompt));
      return { kind: "output" as const, text: r.choices[0].message.content };
    }
    case "computer": {
      const r = await adapter.nextAction(String(p.goal), String(p.screenshot));
      return { kind: "output" as const, text: JSON.stringify(r, null, 2) };
    }
  }
}
