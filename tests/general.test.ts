import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const io = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  transact: vi.fn(),
  generate: vi.fn(),
}));
vi.mock("../lib/storage", () => ({
  load: io.load,
  save: io.save,
  transact: io.transact,
}));
vi.mock("../lib/content", () => ({ generateContent: io.generate }));
import { create, edit, advance } from "../lib/engine";
import {
  claimGeneral,
  finishGeneral,
  retryText,
  advanceGeneral,
} from "../lib/general-engine";
import { ensureClarifications } from "../lib/clarification";
import type { Draft, Task } from "../lib/model";
function task(
  id: string,
  kind: Task["kind"] = "generate_content",
  dependsOn: string[] = [],
): Task {
  return {
    id,
    title: `Write ${id}`,
    description: `Create the requested ${id} draft`,
    kind,
    dependsOn,
    inputs: { prompt: `Write ${id}` },
    requiresApproval: false,
    status: "pending",
  };
}
function draft(tasks: Task[]): Draft {
  return {
    title: "A general workflow",
    summary: "A custom request",
    source: { format: "todo", medium: "typed" },
    timezone: "America/New_York",
    tasks,
    questions: [],
    assumptions: [],
    warnings: [],
  };
}
function workflow(tasks = [task("draft")]) {
  return create(draft(tasks), "owner", "manual");
}
beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key-not-real");
  vi.clearAllMocks();
  io.transact.mockImplementation((fn) => fn());
});
afterEach(() => vi.unstubAllEnvs());
describe("general execution and capability boundaries", () => {
  it("recovers an abandoned text claim for explicit retry", () => {
    const w = workflow();
    claimGeneral(w, true);
    w.jobs!.draft.startedAt = new Date(Date.now() - 240000).toISOString();
    claimGeneral(w, true);
    expect(w.tasks[0].status).toBe("failed");
    expect(w.jobs!.draft.state).toBe("failed");
    retryText(w, "draft");
    expect(w.tasks[0].status).toBe("pending");
  });
  it("never resubmits an abandoned external claim", () => {
    const w = workflow();
    claimGeneral(w, true);
    w.jobs!.draft.provider = "twinly";
    w.jobs!.draft.startedAt = new Date(Date.now() - 240000).toISOString();
    const claims = claimGeneral(w, true);
    expect(claims).toEqual([]);
    expect(w.jobs!.draft.state).toBe("uncertain");
    expect(w.tasks[0].status).toBe("verifying");
    expect(w.submitted).toEqual(["draft"]);
  });
  it("generates an artifact rather than a reservation or fake room fact", () => {
    const w = workflow();
    claimGeneral(w, true);
    expect(w.tasks[0].status).toBe("running");
    finishGeneral(w, "draft", w.jobs!.draft.id, {
      text: "# Project proposal",
      model: "gemma-4-26b-a4b-it",
    });
    expect(w.outputs!.draft.text).toContain("Project proposal");
    expect(w.tasks[0].status).toBe("completed");
    expect(w.evidence[0].provider).toBe("gemma");
    expect(w.evidence[0].verification).toBe("generated");
    expect(w.reservations).toEqual({});
    expect(w.facts).toEqual({});
  });
  it("deduplicates repeated advances and limits total in-flight content jobs to two", () => {
    const w = workflow([task("one"), task("two"), task("three")]);
    expect(claimGeneral(w, true)).toHaveLength(2);
    expect(claimGeneral(w, true)).toHaveLength(0);
    expect(w.submitted).toHaveLength(2);
  });
  it("holds dependent tasks until the actual artifact is saved", () => {
    const w = workflow([task("one"), task("two", "generate_content", ["one"])]);
    expect(claimGeneral(w, true).map((t) => t.id)).toEqual(["one"]);
    finishGeneral(w, "one", w.jobs!.one.id, {
      text: "Outline",
      model: "gemma-4-26b-a4b-it",
    });
    expect(claimGeneral(w, true).map((t) => t.id)).toEqual(["two"]);
  });
  it("does not mark generic research, messages or browser jobs successful in the room mock", () => {
    const w = workflow([
      task("web", "research"),
      task("message", "send_message"),
      task("app", "twinly_task"),
    ]);
    expect(claimGeneral(w, true)).toEqual([]);
    expect(w.tasks.every((t) => t.status === "blocked" && t.blockReason)).toBe(
      true,
    );
    expect(w.evidence).toEqual([]);
    expect(w.submitted).toEqual([]);
    expect(() => advance(w)).toThrow("General workflows");
  });
  it("blocks model calls without a key and on required questions", () => {
    const w = workflow();
    expect(claimGeneral(w, false)).toEqual([]);
    expect(w.tasks[0].blockReason).toContain("GEMINI_API_KEY");
    w.questions = [
      {
        id: "goal",
        taskId: "draft",
        question: "What goal?",
        reason: "Need intent",
        required: true,
      },
    ];
    expect(claimGeneral(w, true)).toEqual([]);
    expect(w.tasks[0].status).toBe("needs_clarification");
  });
  it("persists a failed attempt and only permits an explicit text retry", () => {
    const w = workflow();
    claimGeneral(w, true);
    finishGeneral(w, "draft", w.jobs!.draft.id, {
      error: "Provider unavailable",
    });
    expect(w.tasks[0].status).toBe("failed");
    expect(claimGeneral(w, true)).toEqual([]);
    retryText(w, "draft");
    expect(claimGeneral(w, true)).toHaveLength(1);
    w.tasks.push(task("external", "send_message"));
    expect(() => retryText(w, "external")).toThrow("reconciliation");
  });
  it("ignores stale responses and preserves current-version integrity", () => {
    const w = workflow();
    claimGeneral(w, true);
    const attempt = w.jobs!.draft.id;
    finishGeneral(w, "draft", "wrong-attempt", {
      text: "wrong",
      model: "mock",
    });
    expect(w.outputs).toEqual({});
    w.tasks[0].inputs.prompt = "Changed";
    finishGeneral(w, "draft", attempt, { text: "old output", model: "mock" });
    expect(w.tasks[0].status).toBe("failed");
    expect(w.outputs).toEqual({});
  });
  it("allows editing a completed read-only draft but clears stale output", () => {
    const w = workflow();
    claimGeneral(w, true);
    expect(() => edit(w, draft([task("draft")]))).toThrow("finish");
    finishGeneral(w, "draft", w.jobs!.draft.id, {
      text: "Draft",
      model: "gemma-4-26b-a4b-it",
    });
    edit(w, draft([task("draft")]));
    expect(w.version).toBe(2);
    expect(w.outputs).toEqual({});
    expect(w.submitted).toEqual([]);
  });
  it("keeps the explicit room adapter separate", () => {
    const w = create(draft([task("draft")]), "owner", "fixture");
    expect(() => claimGeneral(w, true)).toThrow("fixtures");
  });
  it("executes actual provider boundary once and passes prerequisite output as context", async () => {
    const w = workflow([task("one"), task("two", "generate_content", ["one"])]);
    io.load.mockImplementation(async () => w);
    io.save.mockResolvedValue(undefined);
    io.generate.mockResolvedValue({
      text: "Saved outline",
      model: "gemma-4-26b-a4b-it",
    });
    await advanceGeneral(w.id, w.owner, w.version);
    expect(io.generate).toHaveBeenCalledTimes(1);
    await advanceGeneral(w.id, w.owner, w.version);
    expect(io.generate).toHaveBeenCalledTimes(2);
    expect(io.generate.mock.calls[1][1]).toContain("Saved outline");
    expect(w.tasks.every((t) => t.status === "completed")).toBe(true);
  });
});
describe("server-required completeness", () => {
  it("requires location, duration, people, exact time and destination for a room request", () => {
    const d = draft([
      {
        ...task("book", "browser_task"),
        title: "Reserve a study room",
        description: "Book a quiet library room",
        inputs: {},
      },
    ]);
    const result = ensureClarifications(d);
    expect(result.questions.map((q) => q.id)).toEqual(
      expect.arrayContaining([
        "book-location",
        "book-duration",
        "book-people",
        "book-date",
        "book-target",
      ]),
    );
  });
  it("does not force a room template onto a general writing request", () => {
    const d = ensureClarifications(draft([task("proposal")]));
    expect(d.questions).toEqual([]);
    expect(d.tasks[0].kind).toBe("generate_content");
  });
  it("requires exact messaging details even if the model asks nothing", () => {
    const d = ensureClarifications(
      draft([{ ...task("send", "send_message"), inputs: {} }]),
    );
    expect(d.questions).toHaveLength(2);
    expect(d.tasks[0].requiresApproval).toBe(true);
  });
});
