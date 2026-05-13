import { test, expect } from "@playwright/test";

const dashboard = {
  executor: {
    experiment_executed_24h: 6,
    executor_skipped_24h: 2,
    executor_no_match_24h: 1,
    match_rate_24h: 0.667,
    top_patterns: [{ pattern: "FILE_WRITE", count: 4 }],
    executed_sparkline: [0, 1, 0, 2, 3]
  },
  meta_cognition: {
    meta_correction_24h: 2,
    meta_healthy_24h: 5,
    last_strategy_recommended: "pivot",
    strategy_distribution: { pivot: 2, deep_dive: 1 }
  },
  reflection: {
    cycles_24h: 9,
    avg_cycle_duration_seconds: 12.5,
    top_chosen_focus: [{ focus: "system_health", count: 3 }]
  },
  vivarium: {
    agent_count: 3,
    promotion_levels: { awake: 1, clone_ready: 2 },
    top_agent: {
      agent_id: "lemlet-prime",
      promotion_level: "clone_ready",
      promotion_score: 42,
      solved_challenges: 2,
      model_calls: 4,
      tool_calls: 1,
      children: 1,
      next_gate: "clone and compare against parent"
    },
    agents: []
  },
  vision: {
    endpoint: "http://vision.local/v1",
    model: "vision-local",
    uptime_pct_1h: 95,
    ingests_24h: 4,
    vision_unreachable_warnings_24h: 1
  },
  ctx_watchdog: {
    current_ctx: 256000,
    decisions_24h: [{ decision: "hold", timestamp: "2026-05-06T12:00:00Z" }],
    last_decision: "hold"
  },
  engagement: {
    messages_initiated_24h: 3,
    overrides_used_24h: 1,
    current_window_active: true
  }
};

test("dashboard tab visible in Lem mode", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Dashboard", { exact: true })).toBeVisible();
});

test("dashboard cards render mocked Lem values", async ({ page }) => {
  await page.route("**/api/lem/dashboard", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(dashboard) });
  });
  await page.goto("/");
  await page.getByText("Dashboard", { exact: true }).click();

  await expect(page.getByTestId("dashboard-panel")).toContainText("67%");
  await expect(page.getByTestId("dashboard-panel")).toContainText("pivot");
  await expect(page.getByTestId("dashboard-panel")).toContainText("lemlet-prime");
  await expect(page.getByTestId("dashboard-panel")).toContainText("clone_ready");
  await expect(page.getByTestId("dashboard-panel")).toContainText("vision-local");
  await expect(page.getByTestId("dashboard-panel")).toContainText("256000");
});
