import { createHash } from "node:crypto";
import type { Workflow, Task } from "./model";
import type { TwinlyJob, TwinlyFeature } from "./twinly-contract";
import { TwinlyAdapter, TwinlyError } from "./twinly";
import { keyFingerprint, twinlyReadiness } from "./twinly-readiness";
import {
  compileTwinlyAction,
  executeTwinlyAction,
  canonicalContact,
} from "./twinly-actions";
import { load, save, transact } from "./storage";
import { digest, log } from "./engine";
const jobKinds: Partial<Record<TwinlyFeature, string>> = {
  tasks: "tasks.run",
  messages_send: "messages.send",
  messages_read: "messages.read",
  calls: "calls.place",
  voice: "voice.speak",
};
function evidence(
  w: Workflow,
  t: Task,
  verification: Workflow["evidence"][number]["verification"],
  summary: string,
  reference: string,
) {
  w.evidence.push({
    taskId: t.id,
    provider: "twinly",
    verification,
    summary,
    externalId: reference,
    checkedAt: new Date().toISOString(),
  });
  log(w, summary, t.id);
}
export function storeTwinlyOutput(
  w: Workflow,
  t: Task,
  text: string,
  reference: string,
  data?: string,
  mime?: string,
) {
  if (data) {
    if (
      !mime ||
      ![
        "image/png",
        "image/jpeg",
        "image/webp",
        "audio/mp4",
        "audio/m4a",
        "audio/x-m4a",
      ].includes(mime)
    )
      throw Error("Unsupported provider media type");
    if (Buffer.from(data, "base64").length > 10 * 1024 * 1024)
      throw Error("Provider media exceeded 10 MB");
  }
  const bytes = data ? Buffer.from(data, "base64") : Buffer.from(text);
  if (!bytes.length) throw Error("Provider returned an empty artifact");
  w.outputs ??= {};
  w.outputs[t.id] = {
    text: text.slice(0, 40000),
    model: t.kind === "twinly_chat" ? "twinly-core" : "Twinly",
    sha256: createHash("sha256").update(bytes).digest("hex"),
    createdAt: new Date().toISOString(),
    ...(data && mime ? { data, mime } : {}),
  };
  evidence(
    w,
    t,
    data || t.kind === "twinly_chat" || t.kind === "computer_action"
      ? "generated"
      : "reported",
    t.kind === "computer_action"
      ? "Screen action proposed; no action was executed"
      : "Twinly result saved",
    reference,
  );
}
export function applyTwinlyJob(w: Workflow, t: Task, providerJob: TwinlyJob) {
  const job = w.jobs?.[t.id];
  if (!job || job.provider !== "twinly") return;
  if (job.externalId && job.externalId !== providerJob.id)
    throw Error("Provider returned an unexpected job ID");
  if (job.providerStatus === "done" && job.state === "completed") return;
  job.externalId = providerJob.id;
  job.providerStatus = providerJob.status;
  if (
    providerJob.status === "queued" ||
    providerJob.status === "running" ||
    providerJob.status === "needs_approval"
  ) {
    job.state = "awaiting_provider";
    t.status =
      providerJob.status === "needs_approval" ? "awaiting_approval" : "running";
    t.blockReason =
      providerJob.status === "needs_approval"
        ? "This submitted job is held for approval inside Twinly on the Mac. Approve it there, then check progress."
        : "Twinly is processing this job. Check progress to reconcile the same job ID.";
    return;
  }
  if (["failed", "canceled", "expired"].includes(providerJob.status)) {
    job.state = "failed";
    t.status = providerJob.status === "canceled" ? "cancelled" : "failed";
    t.blockReason = `Twinly job ${providerJob.status}. Check the existing job; it will not be resubmitted automatically.`;
    evidence(
      w,
      t,
      "reported",
      `Twinly reported job ${providerJob.status}`,
      providerJob.id,
    );
    return;
  }
  const expected = job.feature ? jobKinds[job.feature] : undefined;
  if (!providerJob.result || providerJob.kind !== expected) {
    job.state = "uncertain";
    t.status = "verifying";
    t.blockReason =
      "The job result could not be matched to its expected action. Reconcile it on the Mac; do not resubmit.";
    return;
  }
  const result = providerJob.result;
  if (
    job.feature === "messages_send" &&
    typeof result.to === "string" &&
    !sameSender(result.to, String(t.inputs.recipient ?? ""))
  ) {
    job.state = "uncertain";
    t.status = "verifying";
    t.blockReason =
      "Provider recipient does not match the approved recipient. Inspect the existing job on the Mac.";
    return;
  }
  job.state = "completed";
  delete t.blockReason;
  if (job.feature === "messages_send") {
    const sent =
      typeof result.sent_at === "string" &&
      /(Z|[+-]\d\d:\d\d)$/.test(result.sent_at) &&
      Number.isFinite(Date.parse(result.sent_at));
    if (sent) job.sentAt = String(result.sent_at);
    if (typeof result.to === "string") job.resolvedRecipient = result.to;
    if (result.delivered === false) {
      t.status = "failed";
      t.blockReason =
        "Provider reports the message was not delivered. No automatic resend.";
      evidence(w, t, "reported", "Message delivery failed", providerJob.id);
      return;
    }
    if (t.inputs.awaitReply && sent) {
      t.status = "awaiting_external_reply";
      t.blockReason =
        "Message submitted; awaiting an identity- and timestamp-matched reply. Sent is not agreement.";
      evidence(
        w,
        t,
        result.delivered === true ? "verified" : "reported",
        result.delivered === true
          ? "Provider confirmed delivery; reply pending"
          : "Provider reports sent; reply pending",
        providerJob.id,
      );
      return;
    }
    t.status = result.delivered === true ? "completed" : "verifying";
    evidence(
      w,
      t,
      result.delivered === true ? "verified" : "inconclusive",
      result.delivered === true
        ? "Provider confirmed message delivery"
        : "Provider reports sent; delivery is not confirmed",
      providerJob.id,
    );
    return;
  }
  if (job.feature === "voice") {
    if (
      typeof result.audio_b64 !== "string" ||
      typeof result.mime !== "string"
    ) {
      job.state = "uncertain";
      t.status = "verifying";
      t.blockReason = "Voice output was missing audio or MIME metadata.";
      return;
    }
    storeTwinlyOutput(
      w,
      t,
      "Generated voice audio",
      providerJob.id,
      result.audio_b64,
      result.mime,
    );
    t.status = "completed";
    return;
  }
  const data =
    result.data && typeof result.data === "object"
      ? (result.data as Record<string, unknown>)
      : undefined;
  const summary =
    job.feature === "messages_read"
      ? JSON.stringify(result.messages ?? [], null, 2)
      : job.feature === "calls"
        ? String(
            result.outcome ?? "Call finished; inspect the outcome on the Mac.",
          )
        : String(
            data?.summary ??
              result.answer ??
              "Provider job finished without a summary.",
          );
  storeTwinlyOutput(w, t, summary, providerJob.id);
  if (data?.completed === false) {
    t.status = "failed";
    t.blockReason = "Twinly reported that the requested task did not complete.";
    return;
  }
  const externalOutcome =
    job.feature === "calls" ||
    (t.kind === "browser_task" && t.inputs.operation === "browser_submit");
  t.status = externalOutcome ? "verifying" : "completed";
  if (externalOutcome)
    t.blockReason =
      "Provider reports done. Independently check the real outcome, then record your confirmation.";
}
function sameSender(from: string, to: string) {
  const a = canonicalContact(from).replace(/^\+/, ""),
    b = canonicalContact(to).replace(/^\+/, "");
  return (
    a === b ||
    (b.length === 11 && b.startsWith("1") && a.length === 10 && "1" + a === b)
  );
}
export function observeReply(
  w: Workflow,
  t: Task,
  result: Record<string, unknown>,
) {
  const job = w.jobs?.[t.id];
  if (!job?.sentAt) return;
  const source = job.resolvedRecipient ?? String(t.inputs.recipient ?? "");
  const sent = Date.parse(job.sentAt);
  const messages = Array.isArray(result.messages) ? result.messages : [];
  const matches = messages
    .filter(
      (m: unknown): m is { from: string; text: string; at: string } =>
        !!m &&
        typeof m === "object" &&
        "from" in m &&
        typeof m.from === "string" &&
        "text" in m &&
        typeof m.text === "string" &&
        "at" in m &&
        typeof m.at === "string" &&
        /(Z|[+-]\d\d:\d\d)$/.test(m.at) &&
        sameSender(m.from, source) &&
        Date.parse(m.at) > sent,
    )
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const text = matches[0]?.text.trim().toLowerCase();
  const yes =
    !!text &&
    /^(yes|yep|yeah|sure|confirmed|i can|i'm in|im in|count me in)[.! ]*$/.test(
      text,
    );
  const no =
    !!text && /^(no|nope|i can't|i cannot|can't make it)[.! ]*$/.test(text);
  w.facts[`${t.id}.confirmed_yes`] = yes ? true : no ? false : "unknown";
  if (yes || no) {
    t.status = "completed";
    delete t.blockReason;
    evidence(
      w,
      t,
      "verified",
      `Matched ${yes ? "affirmative" : "negative"} reply from approved recipient after send time`,
      job.replyJobId ?? job.externalId!,
    );
  } else {
    t.status = "awaiting_external_reply";
    t.blockReason =
      "No unambiguous matched yes/no reply yet. Maybe and silence remain unknown.";
  }
  job.replyJobId = undefined;
  job.replySubmitting = false;
  job.state = "completed";
}
export async function submitTwinly(
  id: string,
  owner: string,
  taskId: string,
  attempt: string,
  adapter = new TwinlyAdapter(),
) {
  let sent = false;
  let returnedJobId: string | undefined;
  try {
    const fresh = await twinlyReadiness();
    const action = await transact(async () => {
      const w = await load(id, owner);
      const t = w.tasks.find((t) => t.id === taskId)!;
      const job = w.jobs?.[taskId];
      if (
        !job ||
        job.id !== attempt ||
        job.state !== "running" ||
        job.provider !== "twinly"
      )
        return;
      if (w.paused) {
        t.status = "pending";
        delete w.jobs![taskId];
        w.submitted = w.submitted.filter((x) => x !== taskId);
        await save(w);
        return;
      }
      const approval = w.approvals[taskId];
      if (
        !fresh.features.find((f) => f.id === job.feature)?.ready ||
        !approval ||
        approval.version !== w.version ||
        approval.digest !== digest(t) ||
        approval.providerKeyHash !== keyFingerprint() ||
        job.providerKeyHash !== keyFingerprint() ||
        approval.consumedAt
      )
        throw Error(
          "Provider readiness or the exact approval changed. Review again.",
        );
      const prepared = compileTwinlyAction(t);
      approval.consumedAt = new Date().toISOString();
      await save(w);
      return prepared;
    });
    if (!action) return;
    sent = true;
    const response = await executeTwinlyAction(adapter, action);
    if (response.kind === "job") returnedJobId = response.job.id;
    await transact(async () => {
      const w = await load(id, owner);
      const t = w.tasks.find((t) => t.id === taskId)!;
      const job = w.jobs?.[taskId];
      if (!job || job.id !== attempt) return;
      if (response.kind === "job") applyTwinlyJob(w, t, response.job);
      else {
        storeTwinlyOutput(
          w,
          t,
          response.text,
          `artifact:${job.id}`,
          "data" in response ? response.data : undefined,
          "mime" in response ? response.mime : undefined,
        );
        job.state = "completed";
        t.status = "completed";
      }
      await save(w);
    });
  } catch (error) {
    await transact(async () => {
      const w = await load(id, owner);
      const t = w.tasks.find((t) => t.id === taskId);
      const job = w.jobs?.[taskId];
      if (!t || !job || job.id !== attempt) return;
      const uncertain =
        sent && (!(error instanceof TwinlyError) || error.uncertain);
      job.state = uncertain ? "uncertain" : "failed";
      if (returnedJobId) job.externalId = returnedJobId;
      job.error =
        error instanceof TwinlyError
          ? error.message
          : sent
            ? "Provider response or persistence was uncertain. Reconcile before retry."
            : "Provider readiness or approval changed; no submission was made.";
      t.status = uncertain ? "verifying" : "failed";
      t.blockReason = job.error;
      evidence(
        w,
        t,
        "inconclusive",
        uncertain
          ? "Submission outcome uncertain; automatic resubmission is blocked"
          : "Twinly submission was refused",
        job.externalId ?? `attempt:${job.id}`,
      );
      await save(w);
    });
  }
}
export async function pollTwinlyJobs(
  id: string,
  owner: string,
  adapter = new TwinlyAdapter(),
) {
  const snapshot = await load(id, owner);
  const active = snapshot.tasks
    .filter(
      (t) =>
        snapshot.jobs?.[t.id]?.provider === "twinly" &&
        (snapshot.jobs[t.id].state === "awaiting_provider" ||
          (snapshot.jobs[t.id].state === "uncertain" &&
            !!snapshot.jobs[t.id].externalId) ||
          t.status === "awaiting_external_reply"),
    )
    .slice(0, 2);
  for (const task of active) {
    const job = snapshot.jobs![task.id];
    if (job.providerKeyHash !== keyFingerprint()) continue;
    try {
      if (task.status === "awaiting_external_reply") {
        if (job.replyJobId) {
          const result = await adapter.poll(job.replyJobId);
          await transact(async () => {
            const w = await load(id, owner);
            const t = w.tasks.find((t) => t.id === task.id)!;
            const j = w.jobs![task.id];
            if (j.replyJobId !== result.id) return;
            if (
              result.status === "done" &&
              result.kind === "messages.read" &&
              result.result
            )
              observeReply(w, t, result.result);
            else if (
              ["failed", "canceled", "expired"].includes(result.status)
            ) {
              j.replyJobId = undefined;
              j.replySubmitting = false;
              j.state = "completed";
              t.blockReason =
                "Reply read failed; the original message will not be resent.";
            }
            await save(w);
          });
        } else if (!snapshot.paused && !job.replySubmitting) {
          const readiness = await twinlyReadiness();
          if (!readiness.features.find((f) => f.id === "messages_read")?.ready)
            continue;
          const canRead = await transact(async () => {
            const w = await load(id, owner);
            const j = w.jobs![task.id];
            if (
              w.paused ||
              j.replySubmitting ||
              j.replyJobId ||
              w.tasks.find((t) => t.id === task.id)?.status !==
                "awaiting_external_reply"
            )
              return false;
            j.replySubmitting = true;
            j.state = "running";
            await save(w);
            return true;
          });
          if (!canRead) continue;
          const result = await adapter.readMessages(
            String(task.inputs.recipient),
            20,
          );
          await transact(async () => {
            const w = await load(id, owner);
            const t = w.tasks.find((t) => t.id === task.id)!;
            const j = w.jobs![task.id];
            j.replyJobId = result.id;
            j.state = "awaiting_provider";
            if (
              result.status === "done" &&
              result.kind === "messages.read" &&
              result.result
            )
              observeReply(w, t, result.result);
            await save(w);
          });
        }
        continue;
      }
      if (!job.externalId) continue;
      const result = await adapter.poll(job.externalId);
      await transact(async () => {
        const w = await load(id, owner);
        const t = w.tasks.find((t) => t.id === task.id)!;
        applyTwinlyJob(w, t, result);
        await save(w);
      });
    } catch {
      await transact(async () => {
        const w = await load(id, owner);
        const t = w.tasks.find((t) => t.id === task.id)!;
        t.blockReason =
          "Could not reconcile this provider job. Check progress later; no action was resent.";
        await save(w);
      });
    }
  }
}
export async function cancelTwinlyJob(
  id: string,
  owner: string,
  taskId: string,
  version: number,
  adapter = new TwinlyAdapter(),
) {
  const w = await load(id, owner);
  if (w.version !== version) throw Error("Stale workflow version");
  const job = w.jobs?.[taskId];
  if (
    !job?.externalId ||
    job.provider !== "twinly" ||
    job.providerKeyHash !== keyFingerprint()
  )
    throw Error("No matching provider job to cancel");
  const result = await adapter.cancel(job.externalId);
  return transact(async () => {
    const current = await load(id, owner);
    const t = current.tasks.find((t) => t.id === taskId)!;
    applyTwinlyJob(current, t, result);
    if (result.cancel_requested)
      t.blockReason =
        "Cancellation requested. The action may already have completed; check the existing job outcome.";
    await save(current);
    return current;
  });
}
export function confirmTwinlyResult(w: Workflow, id: string, note: string) {
  const t = w.tasks.find((t) => t.id === id);
  const job = w.jobs?.[id];
  if (
    !t ||
    !job ||
    t.status !== "verifying" ||
    job.providerStatus !== "done" ||
    job.state !== "completed" ||
    note.trim().length < 5
  )
    throw Error(
      "A completed provider result and your explicit verification note are required",
    );
  t.status = "completed";
  delete t.blockReason;
  evidence(
    w,
    t,
    "user_confirmed",
    "User independently checked the provider-reported outcome",
    job.externalId!,
  );
  log(
    w,
    "User verification note acknowledged (sha256: " +
      createHash("sha256").update(note.trim()).digest("hex") +
      ")",
    id,
  );
}
export async function linkExistingTwinlyJob(
  id: string,
  owner: string,
  taskId: string,
  version: number,
  externalId: string,
  adapter = new TwinlyAdapter(),
) {
  const snapshot = await load(id, owner);
  const initial = snapshot.jobs?.[taskId];
  if (
    snapshot.version !== version ||
    initial?.state !== "uncertain" ||
    initial.provider !== "twinly" ||
    initial.externalId ||
    initial.providerKeyHash !== keyFingerprint()
  )
    throw Error(
      "Only an uncertain submission without a job reference can be reconciled this way",
    );
  const result = await adapter.poll(externalId);
  const created = Date.parse(result.created_at ?? "");
  if (
    result.id !== externalId ||
    !initial.feature ||
    result.kind !== jobKinds[initial.feature] ||
    !Number.isFinite(created) ||
    created < Date.parse(initial.startedAt) - 60000 ||
    created > Date.parse(initial.startedAt) + 300000
  )
    throw Error(
      "Existing job kind or creation time does not match this submission",
    );
  return transact(async () => {
    const w = await load(id, owner);
    const job = w.jobs?.[taskId];
    const t = w.tasks.find((t) => t.id === taskId);
    if (
      !t ||
      w.version !== version ||
      job?.id !== initial.id ||
      job.state !== "uncertain" ||
      job.externalId ||
      job.providerKeyHash !== keyFingerprint() ||
      job.digest !== digest(t)
    )
      throw Error("Submission changed while reconciling");
    log(
      w,
      "User matched an existing provider job on the Mac; no action was resubmitted",
      taskId,
    );
    applyTwinlyJob(w, t, result);
    await save(w);
    return w;
  });
}
