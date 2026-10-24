import { test, expect } from "@playwright/test";
test("graph renders six visible nodes and allows task editing", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Try todo example", exact: true })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(6);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.locator(".react-flow__node").first().click();
  await page
    .getByLabel("Task title", { exact: true })
    .fill("Find a quiet library room");
  await page
    .getByRole("button", { name: "Save task & invalidate approvals" })
    .click();
  await expect(page.locator(".react-flow__node").first()).toContainText(
    "Find a quiet library room",
  );
});
