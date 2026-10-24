import { describe, it, expect } from "vitest";
import {
  applyTwinlyJob,
  observeReply,
  storeTwinlyOutput,
  confirmTwinlyResult,
} from "../lib/twinly-execution";
import { create, digest } from "../lib/engine";
import type { Task } from "../lib/model";
function setup(kind: Task["kind"] = "send_message") {
  const task: Task = {
    id: "send",
    title: "Approved action",
    description: "Test only",
    kind,
    dependsOn: [],
    inputs: { recipient: "+15555550102", message: "Test", awaitReply: true },
    requiresApproval: true,
    status: "pending",
  };
  const w = create(
    {
      title: "General",
      summary: "Test",
      source: { format: "todo", medium: "typed" },
      timezone: "UTC",
      tasks: [task],
      questions: [],
      assumptions: [],
      warnings: [],
    },
    "owner",
    "manual",
  );
  const t = w.tasks[0];
  w.jobs = {
    send: {
      id: "attempt",
      digest: digest(t),
      state: "running",
      startedAt: new Date().toISOString(),
      provider: "twinly",
      feature: "messages_send",
      externalId: "job",
    },
  };
  return { w, t };
}
describe("provider execution evidence and reply safety", () => {
  it("does not equate delivery with agreement", () => {
    const { w, t } = setup();
    applyTwinlyJob(w, t, {
      id: "job",
      kind: "messages.send",
      status: "done",
      result: {
        delivered: true,
        sent_at: "2026-10-24T12:00:00Z",
        to: "+15555550102",
      },
    });
    expect(t.status).toBe("awaiting_external_reply");
    expect(w.facts["send.confirmed_yes"]).not.toBe(true);
  });
  it.each([
    ["+15555550199", "2026-10-24T12:01:00Z", "yes"],
    ["+15555550102", "2026-10-24T11:59:00Z", "yes"],
    ["+15555550102", "2026-10-24T12:01:00", "yes"],
    ["+15555550102", "2026-10-24T12:01:00Z", "maybe"],
  ])(
    "keeps mismatched or ambiguous reply unknown: %s %s %s",
    (from, at, text) => {
      const { w, t } = setup();
      w.jobs!.send.sentAt = "2026-10-24T12:00:00Z";
      observeReply(w, t, { messages: [{ from, at, text }] });
      expect(w.facts["send.confirmed_yes"]).toBe("unknown");
      expect(t.status).toBe("awaiting_external_reply");
    },
  );
  it("accepts an explicit matched negative without inventing agreement", () => {
    const { w, t } = setup();
    w.jobs!.send.sentAt = "2026-10-24T12:00:00Z";
    observeReply(w, t, {
      messages: [
        { from: "+15555550102", at: "2026-10-24T12:01:00Z", text: "no" },
      ],
    });
    expect(w.facts["send.confirmed_yes"]).toBe(false);
    expect(t.status).toBe("completed");
  });
  it("rejects another provider job ID", () => {
    const { w, t } = setup();
    expect(() => applyTwinlyJob(w, t, { id: "other", status: "done" })).toThrow(
      "unexpected",
    );
  });
  it("keeps a wrong action kind unresolved", () => {
    const { w, t } = setup();
    applyTwinlyJob(w, t, {
      id: "job",
      status: "done",
      kind: "calls.place",
      result: {},
    });
    expect(w.jobs!.send.state).toBe("uncertain");
    expect(t.status).toBe("verifying");
  });
  it("does not claim held approval or cancellation is success", () => {
    const { w, t } = setup();
    applyTwinlyJob(w, t, { id: "job", status: "needs_approval" });
    expect(t.status).toBe("awaiting_approval");
    applyTwinlyJob(w, t, { id: "job", status: "canceled" });
    expect(t.status).toBe("cancelled");
  });
  it("rejects active content and unproven human confirmation", () => {
    const { w, t } = setup();
    expect(() =>
      storeTwinlyOutput(w, t, "media", "job", "YQ==", "text/html"),
    ).toThrow("media type");
    expect(() => confirmTwinlyResult(w, t.id, "I checked it")).toThrow(
      "completed provider",
    );
  });
});
