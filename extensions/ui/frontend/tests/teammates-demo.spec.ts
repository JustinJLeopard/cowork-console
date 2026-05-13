import { test, expect } from "@playwright/test";

test("teammate demo route renders live teammate cells", async ({ page }) => {
  await page.goto("/teammates-demo");
  await expect(page.getByTestId("teammate-demo")).toBeVisible();
  
  // Renders teammates from extensions/ui/backend/teammates.json via the mock backend
  await expect(page.getByTestId("teammate-demo")).toContainText("Lem");
  await expect(page.getByTestId("teammate-demo")).toContainText("Iain");
  await expect(page.getByTestId("teammate-demo")).toContainText("Codex");
});

test("team tab slots the teammate cells into the console shell", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Team", { exact: true }).click();
  await expect(page.getByTestId("teammate-demo")).toBeVisible();
});
