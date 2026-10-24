import { createHash, randomUUID } from "node:crypto";
import { Draft, Workflow, Task, evaluate, validate } from "./model";
import { requiresActionApproval } from "./capabilities";
export const digest = (t: Task) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        title: t.title,
        kind: t.kind,
        inputs: t.inputs,
        dependsOn: t.dependsOn,
        condition: t.condition,
      }),
    )
    .digest("hex");
export function create(
  d: Draft,
  owner: string,
  mode: Workflow["mode"],
): Workflow {
  return {
    ...validate(d),
    tasks: d.tasks.map((t) => ({
      ...t,
      status: "pending",
      requiresApproval: requiresActionApproval(t, mode === "fixture"),
    })),
    id: randomUUID(),
    version: 1,
    owner,
    mode,
    paused: false,
    demoScenario: "happy",
    approvals: {},
    facts: {},
    evidence: [],
    audit: [],
    reservations: {},
    submitted: [],
    outputs: {},
    jobs: {},
  };
}
export function log(w: Workflow, summary: string, taskId?: string) {
  w.audit.push({ at: new Date().toISOString(), summary, taskId });
}
export function approve(
  w: Workflow,
  id: string,
  version: number,
  hash: string,
) {
  const t = w.tasks.find((t) => t.id === id);
  if (!t || version !== w.version || hash !== digest(t))
    throw Error("Stale approval; review the current action");
  if (
    !requiresActionApproval(t, w.mode === "fixture") ||
    !["pending", "blocked", "awaiting_approval"].includes(t.status)
  )
    throw Error("This task is not awaiting an actionable approval");
  if (w.submitted.includes(id))
    throw Error(
      "This action is already submitted. Handle any provider approval in Twinly; do not resubmit.",
    );
  w.approvals[id] = {
    digest: hash,
    version,
    at: new Date().toISOString(),
    exactTarget: String(t.inputs.recipient ?? t.inputs.target ?? ""),
    exactPayload: JSON.stringify(t.inputs),
    approvedBy: w.owner,
    ...(w.mode !== "fixture"
      ? {
          providerKeyHash: createHash("sha256")
            .update(process.env.TWINLY_API_KEY ?? "")
            .digest("hex"),
        }
      : {}),
  };
  t.status = "pending";
  log(w, "Exact action approved", id);
}
export function assertEditable(w: Workflow) {
  if (w.tasks.some((t) => t.status === "running"))
    throw Error(
      "Wait for the current text generation to finish before editing.",
    );
  if (
    w.submitted.some(
      (id) => w.tasks.find((t) => t.id === id)?.kind !== "generate_content",
    )
  )
    throw Error("Reset or create a new workflow to edit after execution");
}
export function edit(w: Workflow, d: Draft) {
  assertEditable(w);
  validate(d);
  Object.assign(w, d);
  w.version++;
  w.approvals = {};
  w.facts = {};
  w.evidence = [];
  w.reservations = {};
  w.outputs = {};
  w.jobs = {};
  w.submitted = [];
  for (const t of w.tasks) t.status = "pending";
  log(w, "Plan edited; all approvals invalidated");
}
export function advance(w: Workflow) {
  if (w.mode !== "fixture")
    throw Error("General workflows must use the capability execution engine.");
  if (w.paused) return;
  let count = 0;
  for (const t of w.tasks) {
    if (count >= 2) break;
    if (
      [
        "completed",
        "skipped",
        "cancelled",
        "failed",
        "verifying",
        "awaiting_external_reply",
      ].includes(t.status)
    )
      continue;
    if (
      w.questions.some(
        (q) =>
          (q.required || ["send_message", "browser_task"].includes(t.kind)) &&
          !q.answer &&
          (!q.taskId ||
            q.taskId === t.id ||
            (q.id === "when" && !!t.inputs.awaitReply)),
      )
    ) {
      t.status = "needs_clarification";
      continue;
    }
    const deps = t.dependsOn.map((id) => w.tasks.find((x) => x.id === id)!);
    if (
      deps.some((x) => ["failed", "skipped", "cancelled"].includes(x.status))
    ) {
      t.status = "skipped";
      log(w, "Prerequisite cannot complete", t.id);
      continue;
    }
    if (
      deps.some(
        (x) =>
          x.status !== "completed" &&
          !(
            t.condition?.branch === "unknown" &&
            x.status === "awaiting_external_reply" &&
            Object.hasOwn(w.facts, `${x.id}.confirmed_yes`)
          ),
      )
    ) {
      t.status = "blocked";
      continue;
    }
    if (t.condition) {
      const result = evaluate(t.condition, w.facts);
      if (result === "unknown" && t.condition.branch !== "unknown") {
        t.status = "blocked";
        continue;
      }
      if (result !== t.condition.branch) {
        t.status = "skipped";
        continue;
      }
    }
    if (t.id === "notify" && w.reservations.book) {
      const r = w.reservations.book;
      t.inputs.message = `Study room ${r.room} reserved for ${r.date}. Confirmation: ${r.reference}.`;
    }
    if (
      t.kind === "browser_task" &&
      (w.demoScenario === "no_room" ||
        w.tasks
          .filter((x) => x.kind === "send_message" && x.inputs.awaitReply)
          .some((x) => w.facts[`${x.id}.confirmed_yes`] !== true))
    ) {
      t.status = "blocked";
      continue;
    }
    if (t.kind === "manual") {
      t.status = "blocked";
      continue;
    }
    if (["generate_content", "twinly_task", "read_messages"].includes(t.kind)) {
      t.status = "blocked";
      t.blockReason =
        "This capability is not part of the explicit room fixture.";
      continue;
    }
    if (t.kind === "send_message" || t.kind === "browser_task") {
      const a = w.approvals[t.id];
      if (!a || a.version !== w.version || a.digest !== digest(t)) {
        t.status = "awaiting_approval";
        continue;
      }
      if (w.submitted.includes(t.id)) {
        t.status = "failed";
        log(w, "Already submitted; reconcile before retry", t.id);
        continue;
      }
      if (
        t.kind === "send_message" &&
        (!t.inputs.recipient || !t.inputs.message)
      )
        throw Error("Recipient and exact message required");
      if (t.kind === "browser_task" && t.inputs.target !== "/demo/rooms")
        throw Error("Only the controlled room portal is allowed");
      a.consumedAt = new Date().toISOString();
      w.submitted.push(t.id);
    }
    count++;
    t.status = "running";
    log(w, "Demo adapter started", t.id);
    if (t.kind === "research") {
      w.facts[`${t.id}.available`] = w.demoScenario !== "no_room";
    }
    if (t.kind === "send_message" && t.inputs.awaitReply) {
      t.status = "awaiting_external_reply";
      log(w, "Simulated message sent; awaiting simulated reply", t.id);
      continue;
    }
    if (t.kind === "browser_task") {
      const date = String(t.inputs.date ?? "");
      if (
        !date ||
        !Number.isFinite(Date.parse(date)) ||
        !/(Z|[+-]\d\d:\d\d)$/.test(date) ||
        Date.parse(date) < Date.now()
      ) {
        t.status = "failed";
        log(w, "Reservation requires a future ISO date/time", t.id);
        continue;
      }
      const existing = Object.values(w.reservations).find(
        (r) => r.date === date,
      );
      if (existing) {
        t.status = "failed";
        log(w, "Room slot already booked", t.id);
        continue;
      }
      w.reservations[t.id] = {
        reference: `RF-${randomUUID().slice(0, 8)}`,
        room: "Indigo 204",
        date,
      };
      t.status = "verifying";
      continue;
    }
    complete(w, t, "Demo result verified", `DEMO-${randomUUID().slice(0, 8)}`);
  }
  // Read persisted reservation state in a separate request before completing.
}
export function verify(w: Workflow) {
  for (const t of w.tasks.filter((t) => t.status === "verifying")) {
    const r = w.reservations[t.id];
    if (r)
      complete(
        w,
        t,
        `Controlled portal reservation ${r.reference}`,
        r.reference,
      );
    else {
      t.status = "failed";
      log(w, "Reservation verification failed", t.id);
    }
  }
}
export function complete(
  w: Workflow,
  t: Task,
  summary: string,
  externalId: string,
) {
  t.status = "completed";
  w.evidence.push({
    taskId: t.id,
    provider: "demo",
    verification: "verified",
    summary,
    externalId,
    checkedAt: new Date().toISOString(),
  });
  log(w, summary, t.id);
}
export function reply(
  w: Workflow,
  id: string,
  value: "yes" | "no" | "maybe" | "silence",
) {
  const t = w.tasks.find((t) => t.id === id);
  if (!t || t.status !== "awaiting_external_reply")
    throw Error("No pending reply");
  w.facts[`${id}.confirmed_yes`] =
    value === "yes" ? true : value === "no" ? false : "unknown";
  log(w, `Simulated reply: ${value}`, id);
  if (value === "yes" || value === "no")
    complete(
      w,
      t,
      `Simulated participant replied ${value}`,
      `REPLY-${randomUUID().slice(0, 8)}`,
    );
}
