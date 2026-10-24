import { afterEach, describe, expect, it, vi } from "vitest";
import { twinlyReadiness } from "../lib/twinly-readiness";
import {
  featureDefinitions,
  featureReadiness,
  type TwinlyMe,
} from "../lib/twinly-contract";
afterEach(() => vi.unstubAllEnvs());
const me: TwinlyMe = {
  mac: {
    online: true,
    setup: {
      tasks_on_screen: true,
      messages: true,
      messages_read: true,
      calls: true,
      voice: true,
    },
  },
  can: {
    mac: [
      "POST /v1/tasks",
      "POST /v1/messages",
      "GET /v1/messages",
      "POST /v1/calls",
      "POST /v1/voice/speak",
    ],
    cloud: [
      "POST /v1/images",
      "POST /v1/chat/completions",
      "POST /v1/computer/next-action",
    ],
  },
};
describe("per-feature readiness gates", () => {
  it("requires explicit setup flags, not just a key and online Mac", () => {
    expect(
      featureReadiness({ ...me, mac: { online: true } }, "messages_send").ready,
    ).toBe(false);
    expect(featureReadiness(me, "messages_send").ready).toBe(true);
    expect(Object.keys(featureDefinitions)).toHaveLength(8);
  });
  it("does not require an online Mac for cloud proposals", () => {
    const offline = { ...me, mac: { ...me.mac, online: false } };
    expect(featureReadiness(offline, "tasks").ready).toBe(false);
    expect(featureReadiness(offline, "computer").ready).toBe(true);
  });
  it("keeps every feature disabled without connection proof even in live mode", async () => {
    vi.stubEnv("TWINLY_API_KEY", "test-not-real");
    vi.stubEnv("EXECUTION_MODE", "live");
    vi.stubEnv("TWINLY_VERIFICATION_JOB_ID", "");
    const status = await twinlyReadiness({
      health: vi.fn().mockResolvedValue(me),
      poll: vi.fn(),
    });
    expect(status.features.every((f) => !f.ready)).toBe(true);
  });
  it("requires consenting contacts after connection verification", async () => {
    vi.stubEnv("TWINLY_API_KEY", "test-not-real");
    vi.stubEnv("EXECUTION_MODE", "live");
    vi.stubEnv("TWINLY_VERIFICATION_JOB_ID", "test-proof");
    vi.stubEnv("TWINLY_ALLOWED_CONTACTS", "");
    const status = await twinlyReadiness({
      health: vi.fn().mockResolvedValue(me),
      poll: vi
        .fn()
        .mockResolvedValue({
          id: "test-proof",
          kind: "tasks.run",
          status: "done",
          result: { data: { reify_ready: true } },
        }),
    });
    expect(status.liveVerified).toBe(true);
    expect(status.features.find((f) => f.id === "calls")?.ready).toBe(false);
    expect(status.features.find((f) => f.id === "images")?.ready).toBe(true);
  });
});
