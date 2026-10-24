import { test, expect } from "@playwright/test";
test("graph renders six visible nodes and allows task editing", async ({
  page,
}) => {
  await page.goto("/");
  const seeded = await page.request.post("/api/parse", {
    data: { format: "todo", medium: "typed", fixture: true },
  });
  const workflow = await seeded.json();
  await page.evaluate(
    (id) => localStorage.setItem("reify-id", id),
    workflow.id,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Dependency map", exact: true })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(6);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.locator(".react-flow__node").first().click();
  await page
    .getByLabel("Task title", { exact: true })
    .fill("Find a quiet library room");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".react-flow__node").first()).toContainText(
    "Find a quiet library room",
  );
});
