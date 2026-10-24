import { afterEach, describe, it, expect, vi } from "vitest";
import { TwinlyAdapter } from "../lib/twinly";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("official Twinly adapter contract (mock HTTP, not live)", () => {
  it.each([402, 403, 409, 429, 503])(
    "surfaces %s without retries",
    async (status) => {
      vi.stubEnv("TWINLY_API_KEY", "test-only");
      const fn = vi.fn().mockResolvedValue(new Response("{}", { status }));
      vi.stubGlobal("fetch", fn);
      await expect(new TwinlyAdapter().health()).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(1);
    },
  );
  it("requires online Mac before mutation", async () => {
    vi.stubEnv("TWINLY_API_KEY", "test-only");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          mac: { online: false },
          can: { cloud: [], mac: ["POST /v1/messages"] },
        }),
      ),
    );
    await expect(new TwinlyAdapter().message("demo", "hello")).rejects.toThrow(
      "offline",
    );
  });
  it("sends documented payload and preserves needs_approval", async () => {
    vi.stubEnv("TWINLY_API_KEY", "test-only");
    const fn = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          mac: { online: true, setup: { messages: true } },
          can: { cloud: [], mac: ["POST /v1/messages"] },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ id: "job-1", status: "needs_approval" }),
      );
    vi.stubGlobal("fetch", fn);
    const result = await new TwinlyAdapter().message(
      "consenting-test-contact",
      "approved text",
    );
    expect(result.status).toBe("needs_approval");
    expect(fn.mock.calls[1][0]).toContain("/v1/messages?wait=0");
    expect(JSON.parse(fn.mock.calls[1][1].body)).toEqual({
      to: "consenting-test-contact",
      text: "approved text",
    });
  });
});
