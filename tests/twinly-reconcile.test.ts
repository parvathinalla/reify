import { afterEach, describe, expect, it, vi } from "vitest";
const io = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  transact: vi.fn(),
}));
vi.mock("../lib/storage", () => io);
import { create, digest } from "../lib/engine";
import { keyFingerprint } from "../lib/twinly-readiness";
import { linkExistingTwinlyJob } from "../lib/twinly-execution";
import { TwinlyAdapter } from "../lib/twinly";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
function setup() {
  vi.stubEnv("TWINLY_API_KEY", "test-only-not-real");
  const w = create(
    {
      title: "Reconciliation",
      summary: "Test",
      source: { format: "todo", medium: "typed" },
      timezone: "UTC",
      tasks: [
        {
          id: "send",
          title: "Send approved text",
          description: "Test",
          kind: "send_message",
          inputs: { recipient: "+15555550102", message: "Test" },
          status: "pending",
          requiresApproval: true,
          dependsOn: [],
        },
      ],
      questions: [],
      assumptions: [],
      warnings: [],
    },
    "owner",
    "manual",
  );
  w.tasks[0].status = "verifying";
  const now = new Date().toISOString();
  w.jobs = {
    send: {
      id: "attempt",
      digest: digest(w.tasks[0]),
      state: "uncertain",
      startedAt: now,
      provider: "twinly",
      feature: "messages_send",
      providerKeyHash: keyFingerprint(),
    },
  };
  io.load.mockResolvedValue(w);
  io.save.mockResolvedValue(undefined);
  io.transact.mockImplementation((fn) => fn());
  const adapter = new TwinlyAdapter();
  return { w, now, adapter };
}
describe("human-assisted linking never resubmits", () => {
  it("links only the existing matched job through a read-only poll", async () => {
    const { w, now, adapter } = setup();
    const poll = vi
      .spyOn(adapter, "poll")
      .mockResolvedValue({
        id: "existing",
        kind: "messages.send",
        status: "done",
        created_at: now,
        result: { delivered: true, to: "+15555550102" },
      });
    const send = vi.spyOn(adapter, "message");
    await linkExistingTwinlyJob(
      w.id,
      w.owner,
      "send",
      w.version,
      "existing",
      adapter,
    );
    expect(poll).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
    expect(w.jobs!.send.externalId).toBe("existing");
    expect(w.tasks[0].status).toBe("completed");
  });
  it("rejects an older job even when its kind matches", async () => {
    const { w, adapter } = setup();
    vi.spyOn(adapter, "poll").mockResolvedValue({
      id: "old",
      kind: "messages.send",
      status: "done",
      created_at: "2020-01-01T00:00:00Z",
      result: {},
    });
    await expect(
      linkExistingTwinlyJob(w.id, w.owner, "send", w.version, "old", adapter),
    ).rejects.toThrow("creation time");
    expect(w.jobs!.send.externalId).toBeUndefined();
  });
});
