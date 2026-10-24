import { z } from "zod";
export const conditionSchema = z.object({
  op: z.enum(["all", "any"]),
  facts: z.array(z.string().max(100)).min(1).max(20),
  branch: z.enum(["yes", "no", "unknown"]).default("yes"),
});
export const taskSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  kind: z.enum([
    "research",
    "send_message",
    "browser_task",
    "conditional",
    "manual",
  ]),
  dependsOn: z.array(z.string()).max(30),
  condition: conditionSchema.optional(),
  inputs: z.record(z.string(), z.unknown()).default({}),
  requiresApproval: z.boolean().default(true),
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
  mode: "fixture" | "gemma";
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
    }
  >;
  facts: Record<string, boolean | "unknown">;
  evidence: {
    taskId: string;
    provider: "demo";
    verification: "verified";
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
