import { test, expect } from "@playwright/test";
test("study-room happy path through actual browser and API", async ({
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
  await expect(
    page.getByText("A place to think, together", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Required answer").fill("2099-10-25T16:00:00-04:00");
  await page.getByRole("button", { name: "Save answers" }).click();
  await expect(page.getByText("/ Version 2")).toBeVisible();
  const tick = async () => {
    await page.getByRole("button", { name: "Run next steps" }).click();
    await expect(
      page.getByRole("button", { name: "Run next steps" }),
    ).toBeEnabled();
  };
  const approveAll = async () => {
    while (
      await page.getByRole("button", { name: "Review exact action" }).count()
    ) {
      await page
        .getByRole("button", { name: "Review exact action" })
        .first()
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page
        .getByRole("button", { name: "Approve exact action", exact: true })
        .click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
    }
  };
  await tick();
  await approveAll();
  await tick();
  await tick();
  await page.getByRole("button", { name: "yes", exact: true }).first().click();
  await expect(
    page.getByRole("button", { name: "yes", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "yes", exact: true }).click();
  await tick();
  await approveAll();
  await tick();
  await tick();
  await approveAll();
  await tick();
  await expect(page.getByText("6 completed", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Dependency map", exact: true })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(6);
  await expect(page.locator(".react-flow__edge-path")).toHaveCount(5);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.screenshot({ path: "docs/evidence-desktop.png", fullPage: true });
  await page.reload();
  await expect(page.getByText("6 completed", { exact: true })).toBeVisible();
  await page.goto("/demo/rooms");
  await expect(page.getByText(/RF-/)).toBeVisible();
});
test("mobile input controls and upload rejection", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Input medium").selectOption("image");
  await page.getByLabel(/Drop your notes/).setInputFiles({
    name: "bad.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("bad"),
  });
  await expect(page.locator(".error[role=alert]")).toContainText("PNG");
  await page.screenshot({ path: "docs/evidence-mobile.png", fullPage: true });
});
