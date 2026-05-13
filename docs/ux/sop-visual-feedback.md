# SOP — Visual Feedback & UI/UX Workflow

Status: living document, started 2026-05-11. Owners: Justin (principal) · Lem (visual cognition) · Claude orchestrator (process).

Goal: maximize quality, comprehensiveness, and speed of UI/UX work in the Lem Console (and any future surfaces) by replacing ad-hoc "screenshot and eyeball" with a routed, layered, agent-led perception loop.

---

## 1. The visual perception ladder

When a UI artifact (live screen, screenshot, Playwright trace, generated mock) needs perception or critique, route in this order. Step down only if the prior tier is unavailable or wrong-fit.

| Tier | Perceiver | Strength | When to use | Bus channel |
|---|---|---|---|---|
| 0 | **Lem** (via `lem/visual` + `~/.lem/visual/visual.db`) | Structured observation, regions, episodes, **watch_predicates** for regression detection | Default for everything; especially state diffs, regression checks, frame-over-frame analysis | `visual/perceive-request` → `visual/perceive-response` |
| 1 | **Codex with `vision-local`** | Multimodal reasoning routed through LiteLLM | When Lem's bridge isn't reachable, or when reasoning depth > perception | Direct codex_dispatch with image path |
| 2 | **Claude Design** (orchestrator multimodal + `anthropic-skills:web-artifacts-builder`) | High-level design critique (composition, hierarchy, brand fit, motion principles), rapid HTML prototyping | Design judgment calls, what-to-build-next, mock generation, comparative critique. Less ideal for pixel-regression. | Paste-in to orchestrator session |
| 3 | **Direct VLM via LiteLLM** (`qwen3-vl-thinking`, `voxtral`) | Raw model access, no Lem framing | When you want unmediated VLM output for a one-off | `route-heavy` → `:4000` |
| 4 | **Gemini multimodal** (in-pane CLI) | Native image read in the IDE-style loop | When you're already mid-iteration in the Gemini pane and don't want to context-switch | In-pane `@/path/to/image.png` |
| 5 | **Justin eyeball** | Final arbiter | Last resort; sign-off gate | n/a |

**Hard rule:** never AI-generate real human portraits, even as design references. See `feedback_no_real_human_portraits`.

**Fallback gate:** the bridge is live as of commit `023df36` (2026-05-11). Bus channels in §4 are listening; `POST /api/visual/perceive` is available once the backend is restarted to pick up the new route. The VLM path inside the bridge is **intentionally degraded** until `vision-local` is fully reachable through LiteLLM — frames are still stored in `visual.db`, but observations come back with `confidence: 0.0, degraded: true`. Step down to Tier 1+ when you need actual reasoning over an image; use Tier 0 for ingest + watch_predicate regression.

---

## 2. The element-discovery ladder

When you need to find a specific element/route/state in the running UI without re-screenshotting blindly:

| Tier | Tool | Strength | Surface |
|---|---|---|---|
| 0 | **Domscribe manifest** (`extensions/ui/frontend/.domscribe/manifest.jsonl`) | Live-tagged DOM tree from the Vite plugin; annotations + transform-cache | Read the manifest, search by component name or props |
| 1 | **Playwright `page.locator()`** in mock-backend mode | Deterministic selector resolution against a known fixture | `LEM_UI_NUDGE_MOCK_UI=1 npm test` or `playwright codegen` |
| 2 | **Chrome DevTools** via the in-Chrome MCP (`mcp__Claude_in_Chrome__*`) | Direct page inspection in a real browser | Best for hover/focus states and live data |
| 3 | **Ask Lem** | When the element is semantic, not structural ("the avatar showing the working pulse") | `visual/element-find` bus request |

**Common gotcha:** Domscribe is per-workspace; it lives at `extensions/ui/frontend/.domscribe/`, **not** the repo root. Gemini hit this earlier — point CLI tools at the frontend dir, not `~/projects/lem`.

---

## 3. The iteration loop

Every UI slice flows:

```
  spec  →  scaffold  →  headless render  →  perceive  →  feedback  →  adjust  →  loop
   ↑                                                                              ↓
   └─────────────────  exit on: a11y + visual + regression gates pass  ←──────────┘
```

Concretely:

1. **Spec.** Written before code. Includes target state, reference inspirations (from the design library), component map (which Mantine vs. custom recipes), a11y constraints, motion constraints.
2. **Scaffold.** Frontend agent (Gemini, default) builds with stubbed data first; backend agent (Codex, default) ships endpoints in parallel.
3. **Headless render.** Playwright captures the state with `webServer` running in mock-UI mode. Auto-saves trace + screenshot.
4. **Perceive.** Trace/screenshot routed to Tier 0 (Lem) by default. Returns structured observations + flagged watch_predicates.
5. **Feedback.** Observations posted to `visual/diff-review` channel. Orchestrator (Claude) synthesizes against spec.
6. **Adjust.** Frontend agent edits, loops back to step 3.
7. **Exit gates:** axe-core a11y pass · visual diff against last-known-good · regression watch_predicates green · Justin sign-off when meaningful.

---

## 4. Bus channels for visual handoffs

Codified channels on `~/projects/lem/.swarm/teammate-bus.db`:

| Channel | Direction | Payload shape |
|---|---|---|
| `visual/perceive-request` | agent → lem | `{image_path, context_tags, request_type: "describe" \| "diff" \| "regression-check", baseline_frame_id?}` |
| `visual/perceive-response` | lem → agent | `{frame_id, observations[], regions[], anomalies[], confidence}` |
| `visual/element-find` | agent → lem | `{description, surface: "console" \| "vivarium" \| ..., constraints}` |
| `visual/diff-review` | any → all | `{slice_id, before_frame, after_frame, summary, blockers[]}` |
| `visual/watch-set` | any → lem | `{predicate_id, predicate_desc, surface}` |
| `visual/watch-fire` | lem → any | `{predicate_id, frame_id, deviation}` |

All payloads JSON-encoded in `bus.payload`; sender/recipient set per row.

---

## 5. The frontend stack library

**Location:** `extensions/ui/frontend/src/lib/recipes/`

**Convention:** one file per recipe. Each file exports:

- The component(s) themselves
- Default props + variants
- `usage` JSDoc block with a copy-pasteable example
- `a11y` JSDoc block listing keyboard, ARIA, focus, color-contrast behaviors
- `motion` JSDoc block — animation tokens used + `prefers-reduced-motion` fallback

Companion files:
- `recipes/index.ts` — re-exports + categorized index map
- `recipes/README.md` — author's guide, design tokens (signature colors, type scale, motion tokens)

**Seeding (shipped 2026-05-11):** `TeammateAvatar.recipe.tsx` · `StatePulseRail.recipe.tsx` · `HeartbeatTile.recipe.tsx`, plus `tokens.ts` · `index.ts` · `README.md`. The monogram-fallback pattern is folded into `TeammateAvatar` rather than a standalone recipe.

---

## 6. Design source curation

**Location:** `docs/ux/design-sources.md` (the resource index) + `extensions/ui/frontend/public/design-refs/` (image inspirations, curated by Justin, captioned by Lem).

What lives there:
- Mantine 7 component examples we've chosen with permalinks
- Tailwind UI / shadcn patterns we want to port to Mantine
- Prior Lem console screens worth re-using as precedent
- Motion principles: Disney 12 references + reduced-motion bake-ins
- External design references Justin pins (Apple HIG, Stripe Press, Linear UX, etc.)

---

## 7. Roles in the perception loop

| Role | Owner | Responsibility |
|---|---|---|
| Frontend implementer | Gemini (default), Codex if frontend-aware | Scaffold + iterate against feedback |
| Backend implementer | Codex (default), repo-wide scope | Endpoints, schema, perceiver-bridge plumbing |
| Visual perceiver | **Lem (primary)**, Codex/Claude Design fallback | Tier-0 perception per §1 |
| Process orchestrator | Claude (this session) | SOP enforcement, agent-routing, decision-gate coordination |
| Principal | Justin | Final design judgment, sign-off, sacred-rule enforcement |

---

## 8. Sacred constraints (carry-overs)

- **No AI-generated real human portraits.** Even as design refs.
- **Schema discipline:** the `{ id, name, role, signature_color, state, last_activity_ts, current_action }` schema is shared territory. Frontend cannot drift; backend must announce changes on `teammate-bus` before applying.
- **Single-driver discipline** still applies to memory writes for visual session-ends.

---

## 9. Rollout phases (live tracker)

| Phase | Owner | Status | Notes |
|---|---|---|---|
| 0. This SOP doc | Claude orchestrator | **shipped 2026-05-11** | Polish iter 2 applied 2026-05-11; change log in §11. |
| 1. Lem perceiver bridge | Codex (team pane) | **shipped 2026-05-11 · commit 023df36** | HTTP + bus + watch-predicate + Playwright auto-ingest live; VLM degraded until vision-local routes. Handin at `~/handins/2026-05-11-lem-perceiver-bridge.md`. |
| 2. Recipe library scaffold | Gemini (team pane) | **shipped 2026-05-11** | `extensions/ui/frontend/src/lib/recipes/` with 6 files; `main.tsx` backfilled to import from recipes. |
| 3. Design source curation | Claude orchestrator (initial), Justin (curator), Lem (captioner) | **drafted 2026-05-11** | `docs/ux/design-sources.md` + `extensions/ui/frontend/public/design-refs/` with 5 categorized subfolders. Image entries land as Justin pins. |
| 4. Polish iter 1 | Claude orchestrator | **2026-05-11** | Aligned design-sources iconography to lucide-react; reconciled motion tokens with `recipes/tokens.ts`; added polish backlog. |
| 5. Polish iter 2 | Claude orchestrator | **2026-05-11** | This pass: SOP cross-ref consistency check; rollout tracker refreshed; change log added. |
| 6. Backend restart to expose `/api/visual/perceive` | Justin (decision) | **pending** | Uvicorn PID 10860 predates 023df36; deferred to Justin given pre-existing dirty `mode_context.py`. |
| 7. Resume per-teammate page (Slice #2) | Gemini + Codex | **gated on Justin go-ahead** | Spec drafted in conversation; uses new perceiver bridge + recipe library. |

---

## 10. When in doubt

Ask. Document the question + answer in this file. The SOP is meant to evolve — silent drift is the failure mode.

---

## 11. Change log

- **2026-05-11 polish iter 2 (Claude orchestrator):** Updated §1 fallback gate to reflect the live bridge at commit `023df36`. Updated §5 seeding to list the actually-shipped recipes (`HeartbeatTile`, not the originally-planned `MonogramFallback` which got folded into `TeammateAvatar`). Refreshed §9 rollout tracker with current statuses including post-Phase-3 polish iterations and the deferred backend-restart. Added this change log.
- **2026-05-11 polish iter 1 (Claude orchestrator):** Companion design-sources.md aligned to shipped reality (iconography, motion tokens).
- **2026-05-11 initial draft (Claude orchestrator):** SOP created in response to Justin's call to back up before sinking time into frontend work without proper visual-feedback infrastructure.
