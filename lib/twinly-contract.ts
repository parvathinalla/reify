import { z } from "zod";
export const twinlyFeatureSchema = z.enum([
  "tasks",
  "messages_send",
  "messages_read",
  "calls",
  "voice",
  "images",
  "chat",
  "computer",
]);
export type TwinlyFeature = z.infer<typeof twinlyFeatureSchema>;
export const twinlyJobSchema = z.object({
  id: z.string(),
  kind: z.string().optional(),
  status: z.enum([
    "queued",
    "running",
    "needs_approval",
    "done",
    "failed",
    "canceled",
    "expired",
  ]),
  cancel_requested: z.boolean().optional(),
  result: z.record(z.string(), z.unknown()).nullable().optional(),
  created_at: z.string().optional(),
  error: z
    .object({ code: z.string().optional(), message: z.string().optional() })
    .nullable()
    .optional(),
});
export type TwinlyJob = z.infer<typeof twinlyJobSchema>;
export const twinlyMeSchema = z.object({
  mac: z.object({
    online: z.boolean(),
    app_version: z.string().nullable().optional(),
    setup: z
      .record(z.string(), z.union([z.boolean(), z.string()]))
      .nullable()
      .optional(),
  }),
  can: z.object({ cloud: z.array(z.string()), mac: z.array(z.string()) }),
});
export type TwinlyMe = z.infer<typeof twinlyMeSchema>;
export const featureDefinitions: Record<
  TwinlyFeature,
  { title: string; method: string; family: "cloud" | "mac"; setup?: string }
> = {
  tasks: {
    title: "Web research and Mac app tasks",
    method: "POST /v1/tasks",
    family: "mac",
    setup: "tasks_on_screen",
  },
  messages_send: {
    title: "Send iMessages",
    method: "POST /v1/messages",
    family: "mac",
    setup: "messages",
  },
  messages_read: {
    title: "Read an approved chat",
    method: "GET /v1/messages",
    family: "mac",
    setup: "messages_read",
  },
  calls: {
    title: "AI voice calls",
    method: "POST /v1/calls",
    family: "mac",
    setup: "calls",
  },
  voice: {
    title: "Generate owner-voice audio",
    method: "POST /v1/voice/speak",
    family: "mac",
    setup: "voice",
  },
  images: {
    title: "Generate images",
    method: "POST /v1/images",
    family: "cloud",
  },
  chat: {
    title: "Twinly AI chat",
    method: "POST /v1/chat/completions",
    family: "cloud",
  },
  computer: {
    title: "Propose an owned-screen action",
    method: "POST /v1/computer/next-action",
    family: "cloud",
  },
};
export function featureReadiness(me: TwinlyMe, feature: TwinlyFeature) {
  const definition = featureDefinitions[feature];
  if (!me.can[definition.family].includes(definition.method))
    return {
      ready: false,
      reason: "This key does not currently allow " + definition.method,
    };
  if (definition.family === "mac" && !me.mac.online)
    return {
      ready: false,
      reason: "The Twinly Mac is offline. Keep the app open and the Mac awake.",
    };
  if (definition.setup && me.mac.setup?.[definition.setup] !== true)
    return {
      ready: false,
      reason:
        typeof me.mac.setup?.[definition.setup] === "string"
          ? String(me.mac.setup[definition.setup])
          : "Setup has not been verified for " + definition.setup,
    };
  return {
    ready: true,
    reason:
      definition.family === "cloud"
        ? "Cloud capability available."
        : "Mac capability permissions are ready.",
  };
}
export const screenshotSchema = z.string().min(1).max(5700000);
export const computerActionSchema = z.object({
  type: z.enum([
    "click",
    "double_click",
    "type",
    "key",
    "scroll",
    "wait",
    "done",
    "fail",
  ]),
  reason: z.string(),
  commits: z.boolean(),
  x: z.number().int().min(0).max(1000).optional(),
  y: z.number().int().min(0).max(1000).optional(),
  text: z.string().optional(),
  keys: z.string().optional(),
  direction: z.enum(["up", "down", "left", "right"]).optional(),
  amount: z.number().int().min(1).max(20).optional(),
  seconds: z.number().min(0.2).max(10).optional(),
});
