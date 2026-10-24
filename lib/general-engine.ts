import { createHash, randomUUID } from "node:crypto";
import type { Workflow, Task } from "./model";
import { evaluate, validate } from "./model";
import { capabilityFor } from "./capabilities";
import { digest, log } from "./engine";
import { load, save, transact } from "./storage";
import { generateContent } from "./content";
import type { FeatureStatus } from "./twinly-readiness";
import { keyFingerprint, twinlyReadiness } from "./twinly-readiness";
import {
  compileTwinlyAction,
  featureForTask,
  resolveOutputReferences,
} from "./twinly-actions";
import { submitTwinly, pollTwinlyJobs } from "./twinly-execution";
import { z } from "zod";

export function claimGeneral(
  w: Workflow,
  hasGemmaKey: boolean,
  features?: FeatureStatus[],
) {
  if (w.mode === "fixture")
    throw Error("Explicit fixtures use the demo adapter.");
  validate(w);
  w.jobs ??= {};
  w.outputs ??= {};
  // All provider requests have shorter timeouts. Recover abandoned claims after a
  // process interruption without ever resubmitting an external action.
  for (const [taskId, job] of Object.entries(w.jobs)) {
    if (
      job.state !== "running" ||
      Date.now() - Date.parse(job.startedAt) < 180000
    )
      continue;
    const task = w.tasks.find((t) => t.id === taskId);
    if (!task || job.replySubmitting) continue;
    job.state = job.provider === "twinly" ? "uncertain" : "failed";
    task.status = job.provider === "twinly" ? "verifying" : "failed";
    task.blockReason =
      job.provider === "twinly"
        ? "An interrupted submission needs reconciliation on the Mac. Do not resubmit; link its existing job."
        : "Text generation was interrupted. You can explicitly retry this text task.";
    log(
      w,
      "Recovered an abandoned execution claim without resubmission",
      taskId,
    );
  }
  if (w.paused) return [];
  const claimed: Task[] = [];
  const slots = Math.max(
    0,
    2 -
      Object.values(w.jobs).filter((j) =>
        ["running", "awaiting_provider", "uncertain"].includes(j.state),
      ).length,
  );
  for (const t of w.tasks) {
    if (
      w.jobs[t.id]?.provider === "twinly" &&
      ["awaiting_provider", "uncertain"].includes(w.jobs[t.id].state)
    )
      continue;
    if (
      [
        "completed",
        "failed",
        "skipped",
        "cancelled",
        "running",
        "awaiting_external_reply",
        "verifying",
      ].includes(t.status)
    )
      continue;
    delete t.blockReason;
    if (
      w.questions.some(
        (q) => q.required && !q.answer && (!q.taskId || q.taskId === t.id),
      )
    ) {
      t.status = "needs_clarification";
      t.blockReason = "Answer the required questions for this step.";
      continue;
    }
    const deps = t.dependsOn.map((id) => w.tasks.find((x) => x.id === id)!);
    if (
      deps.some((d) => ["failed", "cancelled", "skipped"].includes(d.status))
    ) {
      t.status = "skipped";
      t.blockReason = "A prerequisite did not complete.";
      continue;
    }
    if (deps.some((d) => d.status !== "completed")) {
      t.status = "blocked";
      t.blockReason = "Waiting for prerequisites.";
      continue;
    }
    if (t.condition) {
      const result = evaluate(t.condition, w.facts);
      if (result === "unknown" && t.condition.branch !== "unknown") {
        t.status = "blocked";
        t.blockReason =
          "Waiting for verified observations; unknown is not yes.";
        continue;
      }
      if (result !== t.condition.branch) {
        t.status = "skipped";
        continue;
      }
    }
    if (t.kind === "conditional") {
      t.status = "completed";
      log(w, "Condition evaluated from server observations", t.id);
      continue;
    }
    const capability = capabilityFor(t, hasGemmaKey, features);
    if (!capability.ready) {
      t.status = "blocked";
      t.blockReason = capability.reason;
      continue;
    }
    const feature = featureForTask(t);
    if (feature) {
      try {
        compileTwinlyAction(t);
      } catch (e) {
        t.status = "needs_clarification";
        t.blockReason =
          e instanceof z.ZodError
            ? "Missing or invalid action fields: " +
              e.issues.map((i) => i.path.join(".")).join(", ")
            : e instanceof Error
              ? e.message
              : "Action configuration is incomplete.";
        continue;
      }
      const approval = w.approvals[t.id];
      if (
        !approval ||
        approval.version !== w.version ||
        approval.digest !== digest(t) ||
        approval.consumedAt ||
        approval.providerKeyHash !== keyFingerprint()
      ) {
        t.status = "awaiting_approval";
        t.blockReason =
          "Review and approve this exact action before it is submitted.";
        continue;
      }
    }
    if (claimed.length >= slots) {
      t.status = "pending";
      continue;
    }
    if (w.submitted.includes(t.id)) {
      t.status = "failed";
      t.blockReason =
        "An earlier attempt exists. Reconcile or explicitly retry the text task.";
      continue;
    }
    const id = randomUUID();
    w.jobs[t.id] = {
      id,
      digest: digest(t),
      state: "running",
      startedAt: new Date().toISOString(),
      provider: feature ? "twinly" : "gemma",
      ...(feature ? { feature, providerKeyHash: keyFingerprint() } : {}),
    };
    w.submitted.push(t.id);
    t.status = "running";
    claimed.push(structuredClone(t));
    log(
      w,
      feature
        ? "Approved Twinly action claimed; submission has not yet been confirmed"
        : "Gemma text generation started",
      t.id,
    );
  }
  return claimed;
}

export function finishGeneral(
  w: Workflow,
  taskId: string,
  attemptId: string,
  result: { text: string; model: string } | { error: string },
) {
  const job = w.jobs?.[taskId];
  const task = w.tasks.find((t) => t.id === taskId);
  if (!job || !task || job.id !== attemptId || job.state !== "running") return;
  if (job.digest !== digest(task)) {
    job.state = "failed";
    task.status = "failed";
    task.blockReason = "Task changed during execution; result was not applied.";
    return;
  }
  if ("error" in result) {
    job.state = "failed";
    job.error = result.error;
    task.status = "failed";
    task.blockReason = result.error;
    log(
      w,
      "Text generation failed; no external side effect was submitted",
      taskId,
    );
    return;
  }
  if (!result.text.trim()) {
    job.state = "failed";
    task.status = "failed";
    task.blockReason = "Provider returned no content.";
    return;
  }
  const sha256 = createHash("sha256").update(result.text).digest("hex");
  const at = new Date().toISOString();
  w.outputs ??= {};
  w.outputs[taskId] = {
    text: result.text,
    model: result.model,
    sha256,
    createdAt: at,
  };
  job.state = "completed";
  task.status = "completed";
  delete task.blockReason;
  w.evidence.push({
    taskId,
    provider: "gemma",
    verification: "generated",
    summary: "Requested text artifact generated and saved",
    externalId: `artifact:${sha256.slice(0, 16)}`,
    checkedAt: at,
  });
  log(w, "Generated artifact saved with content hash", taskId);
}

export function retryText(w: Workflow, id: string) {
  const task = w.tasks.find((t) => t.id === id);
  const job = w.jobs?.[id];
  if (!task || task.kind !== "generate_content")
    throw Error(
      "Only text generation has a safe retry here. External actions require reconciliation.",
    );
  const interrupted =
    task.status === "running" &&
    job &&
    Date.now() - Date.parse(job.startedAt) > 120000;
  if (task.status !== "failed" && !interrupted)
    throw Error("This text task has not failed and is not interrupted.");
  task.status = "pending";
  delete task.blockReason;
  if (w.jobs) delete w.jobs[id];
  w.submitted = w.submitted.filter((t) => t !== id);
  log(w, "User requested text-only retry", id);
}

export async function advanceGeneral(
  id: string,
  owner: string,
  version: number,
) {
  await pollTwinlyJobs(id, owner);
  const initial = await load(id, owner);
  const readiness = initial.tasks.some((t) => featureForTask(t))
    ? await twinlyReadiness()
    : undefined;
  const work = await transact(async () => {
    const w = await load(id, owner);
    if (w.version !== version)
      throw Error("Stale workflow version. Refresh and review.");
    resolveOutputReferences(w);
    const tasks = claimGeneral(
      w,
      !!process.env.GEMINI_API_KEY,
      readiness?.features,
    );
    await save(w);
    return {
      tasks,
      attempts: Object.fromEntries(tasks.map((t) => [t.id, w.jobs![t.id].id])),
      context: [
        w.sourceText ?? "",
        ...w.questions
          .filter((q) => q.answer)
          .map((q) => `${q.question}: ${q.answer}`),
      ],
      outputs: w.outputs ?? {},
    };
  });
  await Promise.all(
    work.tasks.map(async (task) => {
      if (featureForTask(task)) {
        await submitTwinly(id, owner, task.id, work.attempts[task.id]);
        return;
      }
      let result: { text: string; model: string } | { error: string };
      try {
        const inputs = task.dependsOn
          .map((id) => work.outputs[id]?.text ?? "")
          .join("\n\n");
        result = await generateContent(
          task,
          [...work.context, inputs].join("\n\n"),
        );
      } catch (e) {
        result = {
          error: e instanceof Error ? e.message : "Content generation failed.",
        };
      }
      await transact(async () => {
        const current = await load(id, owner);
        finishGeneral(current, task.id, work.attempts[task.id], result);
        await save(current);
      });
    }),
  );
  return load(id, owner);
}
