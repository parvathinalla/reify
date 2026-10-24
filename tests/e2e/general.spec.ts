import { test, expect } from "@playwright/test";
test("general plans have no room controls and unavailable tools stay blocked", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.request.post("/api/workflows", {
    data: {
      title: "Launch a community project",
      summary: "General app workflow",
      source: { format: "todo", medium: "typed" },
      timezone: "America/New_York",
      tasks: [
        {
          id: "research",
          title: "Research community events",
          description: "Find current information",
          kind: "research",
          dependsOn: [],
          inputs: { prompt: "Research community events" },
          requiresApproval: true,
          status: "completed",
        },
      ],
      questions: [],
      assumptions: [],
      warnings: [],
    },
  });
  expect(result.ok()).toBeTruthy();
  const w = await result.json();
  expect(w.tasks[0].status).toBe("pending");
  await page.evaluate((id) => localStorage.setItem("reify-id", id), w.id);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Launch a community project" }),
  ).toBeVisible();
  await expect(page.getByLabel("Controlled demo inventory")).toHaveCount(0);
  await expect(page.getByText("Open room portal")).toHaveCount(0);
  await page.getByRole("button", { name: "Run next steps" }).click();
  await expect(
    page
      .locator(".task.blocked")
      .filter({ hasText: "Research community events" }),
  ).toBeVisible();
  await expect(page.getByText("0 completed", { exact: true })).toBeVisible();
  const bad = await page.request.post(`/api/workflows/${w.id}/reply`, {
    data: { version: 1, taskId: "research", value: "yes" },
  });
  expect(bad.ok()).toBe(false);
});
