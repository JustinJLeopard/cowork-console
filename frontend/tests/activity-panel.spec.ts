import { test, expect } from "@playwright/test";

test("activity panel toggle persists", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("activity-panel")).toBeVisible();
  await page.getByTestId("activity-toggle").click();
  await expect(page.getByTestId("activity-panel")).not.toBeVisible();
  await page.reload();
  await expect(page.getByTestId("activity-panel")).not.toBeVisible();
});
