import { test, expect } from "@playwright/test";

test("focused workspace keeps questions first and details on demand", async ({
  page,
}) => {
  await page.goto("/");
  const response = await page.request.post("/api/workflows", {
    data: {
      title: "Plan a community event",
      summary: "Create a draft to review.",
      source: { format: "rough_notes", medium: "typed" },
      timezone: "UTC",
      tasks: [
        {
          id: "draft",
          title: "Write the event outline",
          description: "Write a draft",
          kind: "generate_content",
          inputs: { prompt: "Write an outline" },
          dependsOn: [],
          requiresApproval: false,
          status: "pending",
        },
      ],
      questions: [
        {
          id: "audience",
          taskId: "draft",
          question: "Who is this event for?",
          reason: "Tailor the outline.",
          required: true,
        },
      ],
      assumptions: [],
      warnings: [],
    },
  });
  expect(response.ok()).toBeTruthy();
  const w = await response.json();
  await page.evaluate((id) => localStorage.setItem("reify-id", id), w.id);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A few details first" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Run next steps" }),
  ).toBeDisabled();
  await expect(page.locator(".react-flow")).toHaveCount(0);
  await expect(page.getByText("generate_content", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Results", exact: true }).click();
  await expect(
    page.getByText("Your results will appear here as steps finish."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A few details first" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Plan", exact: true }).click();
  await page
    .getByRole("button", { name: "Write the event outline", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "Edit task" })).toBeVisible();
  await expect(page.getByLabel("Prompt", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Action data (JSON)")).not.toBeVisible();
  await page.getByText("Advanced settings", { exact: true }).click();
  await page.getByLabel("Action data (JSON)").fill("null");
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Connections" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Connections", exact: true }),
  ).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
