import { z } from "zod";
export const conditionSchema = z.object({
  op: z.enum(["all", "any"]),
  facts: z.array(z.string().max(100)).min(1).max(20),
  branch: z.enum(["yes", "no", "unknown"]).default("yes"),
});
export const taskSchema = z.object({
  id: z
    .string()
    .regex(/^(?!(?:constructor|prototype)$)[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  kind: z.enum([
    "research",
    "send_message",
    "browser_task",
    "conditional",
    "manual",
    "generate_content",
    "twinly_task",
    "read_messages",
    "call",
    "speak",
    "generate_image",
    "twinly_chat",
    "computer_action",
  ]),
  dependsOn: z.array(z.string()).max(30),
  condition: conditionSchema.optional(),
  inputs: z.record(z.string(), z.unknown()).default({}),
  requiresApproval: z.boolean().default(true),
  blockReason: z.string().max(500).optional(),
  status: z
    .enum([
      "pending",
      "needs_clarification",
      "blocked",
      "awaiting_approval",
      "running",
      "awaiting_external_reply",
      "verifying",
      "completed",
      "failed",
      "skipped",
      "cancelled",
    ])
    .default("pending"),
});
export const draftSchema = z.object({
  title: z.string().max(200),
  source: z.object({
    format: z.enum(["todo", "flowchart", "rough_notes"]),
    medium: z.enum(["typed", "image", "canvas"]),
  }),
  timezone: z.string().default("America/New_York"),
  summary: z.string().max(3000),
  tasks: z.array(taskSchema).min(1).max(30),
  questions: z
    .array(
      z.object({
        id: z.string(),
        taskId: z.string().optional(),
        question: z.string(),
        reason: z.string(),
        required: z.boolean(),
        answer: z.string().optional(),
      }),
    )
    .max(30),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
});
export type Draft = z.infer<typeof draftSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Workflow = Draft & {
  id: string;
  version: number;
  owner: string;
  sourceText?: string;
  mode: "fixture" | "gemma" | "manual";
  paused: boolean;
  demoScenario: "happy" | "no_room";
  approvals: Record<
    string,
    {
      digest: string;
      version: number;
      at: string;
      exactTarget: string;
      exactPayload: string;
      approvedBy: string;
      consumedAt?: string;
      providerKeyHash?: string;
    }
  >;
  facts: Record<string, boolean | "unknown">;
  evidence: {
    taskId: string;
    provider: "demo" | "gemma" | "twinly";
    verification:
      "verified" | "generated" | "reported" | "inconclusive" | "user_confirmed";
    summary: string;
    externalId: string;
    checkedAt: string;
  }[];
  audit: { at: string; taskId?: string; summary: string }[];
  reservations: Record<
    string,
    { reference: string; room: string; date: string }
  >;
  submitted: string[];
  outputs?: Record<
    string,
    {
      text: string;
      model: string;
      sha256: string;
      createdAt: string;
      mime?: string;
      data?: string;
    }
  >;
  jobs?: Record<
    string,
    {
      id: string;
      digest: string;
      state:
        "running" | "completed" | "failed" | "awaiting_provider" | "uncertain";
      startedAt: string;
      error?: string;
      provider?: "gemma" | "twinly";
      feature?: import("./twinly-contract").TwinlyFeature;
      externalId?: string;
      providerStatus?: string;
      providerKeyHash?: string;
      sentAt?: string;
      resolvedRecipient?: string;
      replyJobId?: string;
      replySubmitting?: boolean;
    }
  >;
};
export function validate(d: Draft) {
  const ids = new Set(d.tasks.map((t) => t.id));
  if (ids.size !== d.tasks.length) throw Error("Duplicate task IDs");
  const done = new Set<string>();
  const visiting = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw Error("Dependency cycle");
    if (done.has(id)) return;
    if (!ids.has(id)) throw Error("Dangling dependency");
    visiting.add(id);
    d.tasks.find((t) => t.id === id)!.dependsOn.forEach(visit);
    visiting.delete(id);
    done.add(id);
  }
  d.tasks.forEach((t) => visit(t.id));
  d.questions.forEach((q) => {
    if (q.taskId && !ids.has(q.taskId)) throw Error("Unknown question task");
  });
  for (const t of d.tasks) {
    if (t.kind === "conditional" && !t.condition)
      throw Error("A conditional step requires a structured predicate.");
    if (t.condition)
      for (const f of t.condition.facts)
        if (!/^[\w-]+\.(available|confirmed_yes)$/.test(f))
          throw Error("Unsafe condition fact");
        else if (!ids.has(f.split(".")[0]))
          throw Error("Condition references an unknown task");
  }
  return d;
}
export function evaluate(
  c: NonNullable<Task["condition"]>,
  facts: Workflow["facts"],
) {
  const v = c.facts.map((f) => facts[f] ?? "unknown");
  const r =
    c.op === "all"
      ? v.includes(false)
        ? "no"
        : v.includes("unknown")
          ? "unknown"
          : "yes"
      : v.includes(true)
        ? "yes"
        : v.includes("unknown")
          ? "unknown"
          : "no";
  return r;
}
