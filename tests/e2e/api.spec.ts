import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
for (const scenario of ["decline", "no-room", "maybe"] as const)
  test(`API scenario: ${scenario}`, async ({ request }) => {
    const created = await request.post("/api/parse", {
      data: {
        format: "todo",
        medium: "typed",
        fixture: true,
        text: "explicit test fixture",
      },
    });
    expect(created.ok()).toBeTruthy();
    let w = await created.json();
    const act = async (action: string, data: Record<string, unknown> = {}) => {
      const r = await request.post(`/api/workflows/${w.id}/${action}`, {
        data: { version: w.version, ...data },
      });
      expect(r.ok(), await r.text()).toBeTruthy();
      w = await r.json();
    };
    if (scenario === "no-room") await act("scenario", { scenario: "no_room" });
    await act("clarify", { answers: { when: "2099-10-25T16:00:00-04:00" } });
    for (let tick = 0; tick < 4; tick++) {
      await act("advance");
      const r = await request.get(`/api/workflows/${w.id}/status`);
      w = await r.json();
      for (const t of w.tasks.filter(
        (t: { status: string }) => t.status === "awaiting_approval",
      ))
        await act("approve", {
          taskId: t.id,
          digest:
            w.digests?.[t.id] ??
            (await (await request.get(`/api/workflows/${w.id}/status`)).json())
              .digests[t.id],
        });
    }
    await act("reply", {
      taskId: "ravi",
      value:
        scenario === "decline" ? "no" : scenario === "maybe" ? "maybe" : "yes",
    });
    await act("reply", { taskId: "priya", value: "yes" });
    await act("advance");
    await act("advance");
    expect(Object.keys(w.reservations)).toHaveLength(0);
    expect(w.tasks.find((t: { id: string }) => t.id === "book").status).toBe(
      scenario === "maybe" ? "blocked" : "skipped",
    );
  });
test("cross-session access, stale version, cross-origin and image MIME checks", async ({
  request,
  playwright,
}) => {
  const r = await request.post("/api/parse", {
    data: { format: "todo", medium: "typed", fixture: true },
  });
  const w = await r.json();
  const stranger = await playwright.request.newContext();
  expect(
    (
      await stranger.get(`http://127.0.0.1:3000/api/workflows/${w.id}/status`)
    ).ok(),
  ).toBe(false);
  await stranger.dispose();
  expect(
    (
      await request.post(`/api/workflows/${w.id}/advance`, {
        data: { version: 999 },
      })
    ).ok(),
  ).toBe(false);
  expect(
    (
      await request.post("/api/parse", {
        headers: { origin: "https://evil.example" },
        data: { format: "todo", medium: "typed", fixture: true },
      })
    ).ok(),
  ).toBe(false);
  expect(
    (
      await request.post("/api/parse", {
        data: {
          format: "todo",
          medium: "image",
          fixture: true,
          image: {
            mime: "image/png",
            data: Buffer.from("bad").toString("base64"),
          },
        },
      })
    ).ok(),
  ).toBe(false);
});
for (const format of ["todo", "flowchart", "rough_notes"])
  test(`image upload boundary: ${format} explicit fixture`, async ({
    request,
  }) => {
    const r = await request.post("/api/parse", {
      data: {
        format,
        medium: "image",
        fixture: true,
        image: {
          mime: "image/png",
          data: readFileSync(`public/demo/${format}.png`).toString("base64"),
        },
      },
    });
    expect(r.ok()).toBeTruthy();
    const w = await r.json();
    expect(w.source).toEqual({ format, medium: "image" });
    expect(w.mode).toBe("fixture");
  });
