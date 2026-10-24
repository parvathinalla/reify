import { describe, it, expect } from "vitest";
import { fixture } from "../lib/fixtures";
import {
  create,
  advance,
  approve,
  digest,
  reply,
  verify,
  edit,
} from "../lib/engine";
import { validate, evaluate } from "../lib/model";
const date = "2099-10-25T16:00:00-04:00";
function setup() {
  const d = fixture("todo", "typed");
  d.questions = [];
  d.tasks.find((t) => t.id === "book")!.inputs.date = date;
  return create(d, "test", "fixture");
}
function approvals(w: ReturnType<typeof setup>) {
  for (const t of w.tasks.filter(
    (t) =>
      ["send_message", "browser_task"].includes(t.kind) &&
      ["pending", "blocked", "awaiting_approval"].includes(t.status),
  ))
    approve(w, t.id, w.version, digest(t));
}
function invitations(w: ReturnType<typeof setup>) {
  approvals(w);
  advance(w);
  advance(w);
}
describe("workflow trust engine", () => {
  it.each(["todo", "flowchart", "rough_notes"] as const)(
    "validates %s fixture",
    (f) => expect(validate(fixture(f, "typed")).tasks).toHaveLength(6),
  );
  it("rejects cycles, missing prerequisites and duplicate IDs", () => {
    const d = fixture("todo", "typed");
    d.tasks[0].dependsOn = ["book"];
    expect(() => validate(d)).toThrow("cycle");
    d.tasks[0].dependsOn = ["missing"];
    expect(() => validate(d)).toThrow("Dangling");
    d.tasks[0].dependsOn = [];
    d.tasks[1].id = "room";
    expect(() => validate(d)).toThrow("Duplicate");
  });
  it("limits execution to two ready tasks per advance", () => {
    const w = setup();
    approvals(w);
    advance(w);
    expect(
      w.audit.filter((a) => a.summary === "Demo adapter started"),
    ).toHaveLength(2);
    expect(w.tasks.find((t) => t.id === "priya")!.status).toBe("pending");
  });
  it("requires exact approval and rejects stale approvals", () => {
    const w = setup();
    advance(w);
    expect(w.tasks[1].status).toBe("awaiting_approval");
    expect(() => approve(w, "ravi", 0, digest(w.tasks[1]))).toThrow("Stale");
    approve(w, "ravi", w.version, digest(w.tasks[1]));
    w.tasks[1].inputs.message = "edited";
    advance(w);
    expect(w.tasks[1].status).toBe("awaiting_approval");
  });
  it("invalidates approvals after an edit", () => {
    const w = setup();
    approvals(w);
    edit(w, fixture("todo", "typed"));
    expect(w.approvals).toEqual({});
    expect(w.version).toBe(2);
  });
  it("blocks required unanswered clarification", () => {
    const w = create(fixture("todo", "typed"), "test", "fixture");
    advance(w);
    expect(w.tasks.find((t) => t.id === "book")!.status).toBe(
      "needs_clarification",
    );
  });
  it.each(["maybe", "silence"] as const)("%s cannot enable booking", (v) => {
    const w = setup();
    invitations(w);
    reply(w, "ravi", v);
    reply(w, "priya", "yes");
    advance(w);
    advance(w);
    expect(w.reservations).toEqual({});
    expect(w.facts["ravi.confirmed_yes"]).toBe("unknown");
  });
  it("Ravi declines: skip booking and downstream notification", () => {
    const w = setup();
    invitations(w);
    reply(w, "ravi", "no");
    reply(w, "priya", "yes");
    advance(w);
    advance(w);
    expect(w.tasks.find((t) => t.id === "book")!.status).toBe("skipped");
    expect(w.reservations).toEqual({});
  });
  it("no room: skip booking even after both yes", () => {
    const w = setup();
    w.demoScenario = "no_room";
    invitations(w);
    reply(w, "ravi", "yes");
    reply(w, "priya", "yes");
    advance(w);
    expect(w.reservations).toEqual({});
    expect(w.tasks.find((t) => t.id === "gate")!.status).toBe("skipped");
  });
  it("happy path: independently verify persisted reservation and deduplicate repeated advances", () => {
    const w = setup();
    invitations(w);
    reply(w, "ravi", "yes");
    reply(w, "priya", "yes");
    advance(w);
    expect(w.tasks.find((t) => t.id === "book")!.status).toBe("verifying");
    expect(w.evidence.some((e) => e.taskId === "book")).toBe(false);
    const restored = JSON.parse(JSON.stringify(w));
    verify(restored);
    advance(restored);
    approvals(restored);
    advance(restored);
    expect(
      restored.tasks.every((t: { status: string }) => t.status === "completed"),
    ).toBe(true);
    expect(Object.keys(restored.reservations)).toHaveLength(1);
    expect(restored.submitted.filter((x: string) => x === "book")).toHaveLength(
      1,
    );
  });
  it("pause and denial block progress", () => {
    const w = setup();
    w.paused = true;
    advance(w);
    expect(w.audit).toEqual([]);
    w.paused = false;
    w.tasks[1].status = "cancelled";
    advance(w);
    expect(w.tasks.find((t) => t.id === "gate")!.status).toBe("skipped");
  });
  it("unknown facts are three-valued, never eval", () =>
    expect(
      evaluate({ op: "all", facts: ["ravi.confirmed_yes"], branch: "yes" }, {}),
    ).toBe("unknown"));
  it("rejects arbitrary reservation targets", () => {
    const w = setup();
    invitations(w);
    reply(w, "ravi", "yes");
    reply(w, "priya", "yes");
    w.tasks.find((t) => t.id === "book")!.inputs.target =
      "https://evil.example";
    approvals(w);
    expect(() => advance(w)).toThrow("controlled");
  });
  it("rejects impossible dates without completing booking", () => {
    const w = setup();
    w.tasks.find((t) => t.id === "book")!.inputs.date = "2020-01-01";
    invitations(w);
    reply(w, "ravi", "yes");
    reply(w, "priya", "yes");
    advance(w);
    expect(w.tasks.find((t) => t.id === "book")!.status).toBe("failed");
    expect(w.reservations).toEqual({});
  });
  it("explicit unknown branch can handle observed silence without booking", () => {
    const w = setup();
    w.tasks[3].condition!.branch = "unknown";
    invitations(w);
    reply(w, "ravi", "silence");
    reply(w, "priya", "yes");
    advance(w);
    expect(w.tasks[3].status).toBe("completed");
  });
  it("a completed task cannot be resurrected by another approval", () => {
    const w = setup();
    invitations(w);
    reply(w, "ravi", "yes");
    expect(() => approve(w, "ravi", w.version, digest(w.tasks[1]))).toThrow(
      "actionable",
    );
  });
});
