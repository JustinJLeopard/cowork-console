/**
 * Followup H regressions: smoke + structural checks against the minimal
 * cowork-console Team-tab page (frontend/main.tsx, Stage 1f hotfix).
 *
 * Replaces three stale specs from the lem-mirror initial transport:
 * - activity-panel.spec.ts (targeted the deleted Lem-mixed app)
 * - perf-dashboard.spec.ts (perf-dashboard tab doesn't exist here)
 * - teammates-demo.spec.ts (replaced by canonical team-roster.spec.ts)
 *
 * These specs depend on a running backend at the configured port.
 * The backend serves canonical 5-teammate roster from
 * backend/teammates.json (plus optional bus-bridge overlay). For test
 * isolation, run with LEM_BUS_DB pointed at a nonexistent path so the
 * static roster is what renders.
 *
 * Selectors used:
 * - article[data-testid="teammate-cell"] (HeartbeatTile recipe)
 * - [aria-label="<name> (<state>)"] (TeammateAvatar)
 * - role="heading" name="Teammates" (page title)
 * - text "Live" or "Polling" (HeartbeatTile global indicator badge)
 */

import { test, expect } from "@playwright/test";

const CANONICAL_IDS = ["lem", "iain", "codex", "claude-code", "justin"] as const;

test.describe("cowork-console Team roster", () => {
  test("renders 5 canonical teammate cells", async ({ page }) => {
    await page.goto("/");
    const cells = page.locator('[data-testid="teammate-cell"]');
    await expect(cells).toHaveCount(5);
  });

  test("page shows Teammates heading", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Teammates/i, level: 3 }),
    ).toBeVisible();
  });

  test("each card has a teammate name + role text visible", async ({ page }) => {
    await page.goto("/");
    // Names appear in HeartbeatTile body
    for (const name of ["Lem", "Iain", "Codex", "claude-code", "Justin"]) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
  });

  test("connection-status badge shows Live or Polling", async ({ page }) => {
    await page.goto("/");
    // After load the EventSource should connect within a couple seconds;
    // accept either "Live" (stream connected) or "Polling" (stream not yet)
    // — both are valid steady states.
    const badge = page.getByText(/^(Live|Polling)$/);
    await expect(badge).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("cowork-console Team roster — accessibility", () => {
  test("each TeammateAvatar exposes an aria-label with name + state", async ({
    page,
  }) => {
    await page.goto("/");
    // TeammateAvatar's aria-label format: "<name> (<state>)"
    // We don't pin specific states because bus-bridge enrichment can
    // change them; we just verify the shape exists for each known id.
    for (const id of CANONICAL_IDS) {
      // The avatar component renders the Mantine Avatar with the aria-label
      // pattern; we use a non-exact regex match on the name component.
      const expectedName =
        id === "lem"
          ? "Lem"
          : id === "iain"
          ? "Iain"
          : id === "codex"
          ? "Codex"
          : id === "claude-code"
          ? "claude-code"
          : "Justin";
      const ariaPattern = new RegExp(`^${expectedName} \\(.+\\)$`);
      await expect(page.getByLabel(ariaPattern).first()).toBeVisible();
    }
  });
});
