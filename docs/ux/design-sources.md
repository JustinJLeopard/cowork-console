# Design Sources & Reference Library

Status: living curation, started 2026-05-11. Owner: Justin (curator) · Lem (perceiver, via bridge) · Claude orchestrator (editor). Companion to `docs/ux/sop-visual-feedback.md`.

Purpose: a single curated home for the design vocabulary the Lem Console (and future surfaces) draws from. Replaces ad-hoc "I saw this somewhere" with sourced, permalinked, captioned references. Every entry here should be either directly portable into Mantine 7.x, or a clearly-labelled aspiration with a notes line.

---

## How to use this doc

1. **Need to ship a UI surface?** Skim §3–§6 for the relevant category. Pick a reference, port to Mantine, file the new component as a recipe in `extensions/ui/frontend/src/lib/recipes/`.
2. **Found a great pattern?** Add it under the right §-section with: short name, source link, why-it-matters in one sentence, Mantine-porting notes if non-obvious.
3. **Have an image inspiration?** Drop the file into `extensions/ui/frontend/public/design-refs/<category>/` and add a row in §8. Lem will ingest via the perceiver bridge and produce a caption.
4. **Disagree with a reference?** Don't delete; mark `[deprecated YYYY-MM-DD: <reason>]` so the history is preserved.

---

## §1. The stack (what we're porting *to*)

- **Mantine 7.16.1** — primary component library. [Docs](https://mantine.dev/). Strict opt-out from defaults only with reason.
- **@mantine/hooks** — first-choice for state primitives (`useDisclosure`, `useHotkeys`, `useDebouncedValue`, `useMediaQuery`, `useReducedMotion`).
- **CSS layers strategy:** Mantine generates layered styles. Custom CSS goes in `extensions/ui/frontend/styles.css` under a named layer, never inline overrides.
- **Iconography:** `lucide-react` 0.468.0 (already adopted by `main.tsx`). Don't mix icon families. Note: this diverges from Mantine's recommended `@tabler/icons-react` — the project decision is to stay on lucide for consistency with prior screens.
- **Typography scale:** Mantine default (sm/md/lg/xl) until we have a documented reason to deviate.

When porting an external pattern, prefer this priority: **Mantine component out-of-box → Mantine component with `styles` prop overrides → Mantine `Box`/`Flex`/`Stack` + minimal custom CSS → fully custom component.** Step down only when the prior step can't express the design.

---

## §2. The non-negotiables

Borrowed from `docs/ux/sop-visual-feedback.md` and `feedback_no_real_human_portraits`. Listed here so every contributor sees them in the design-context.

- **No AI-generated real human portraits.** Even as inspiration. Use illustration, abstract avatars, or initials monograms.
- **`prefers-reduced-motion`** is a hard gate on every motion pattern. Document the fallback in the recipe.
- **WCAG AA contrast minimum.** AAA where text > 18px and we can.
- **Keyboard-first.** Every interactive element must be reachable + operable via keyboard with visible focus rings.
- **No new dependencies** for a design pattern unless `docs/ux/design-sources.md` shows we've considered Mantine-native first.

---

## §3. Atomic patterns (Mantine 7 examples we've adopted)

Format per entry: **Name** — short caption · Mantine surface · permalink · notes.

| Pattern | Mantine surface | Permalink | Notes |
|---|---|---|---|
| **Avatar with initials fallback** | `<Avatar color={signature_color}>` with child `<Text>` for initials | [Mantine Avatar docs](https://mantine.dev/core/avatar/) | Shipped 2026-05-11 at `extensions/ui/frontend/src/lib/recipes/TeammateAvatar.recipe.tsx`. Uses Mantine `<Avatar>` with `styles.placeholder` for the colored monogram. |
| **Status pill with color** | `<Badge variant="light" color={...}>` | [Mantine Badge docs](https://mantine.dev/core/badge/) | Use `signature_color` for teammate-scoped pills; reserve semantic colors (green/red/yellow) for system state |
| **Loading skeleton** | `<Skeleton>` with explicit `height`/`width` | [Mantine Skeleton docs](https://mantine.dev/core/skeleton/) | Always include skeletons for any async data — empty state ≠ loading state |
| **Tooltip on truncated text** | `<Tooltip label={fullText}><Text truncate>` | [Mantine Tooltip docs](https://mantine.dev/core/tooltip/) | Required when truncation hides meaningful content (e.g., bus-tail rows) |
| **Sticky section header** | `<AppShell.Section grow component={ScrollArea}>` with sticky child | [Mantine AppShell docs](https://mantine.dev/core/app-shell/) | Use for the per-teammate page left-rail |
| **Modal compose** | `<Modal opened={opened} onClose={close} title="..." centered>` | [Mantine Modal docs](https://mantine.dev/core/modal/) | Pair with `useDisclosure` |
| **Toast notification** | `notifications.show({ ... })` from `@mantine/notifications` | [Mantine Notifications](https://mantine.dev/x/notifications/) | NOT YET INSTALLED — add only when first needed |

---

## §4. Composite patterns (sourced, partly adopted)

Patterns we like that need adaptation work before they're production-ready in Mantine.

| Pattern | Source | Why we want it | Mantine porting notes |
|---|---|---|---|
| **Command palette** | [shadcn-ui Command](https://ui.shadcn.com/docs/components/command) · [Linear's ⌘K](https://linear.app/) | Universal navigation/action surface for power-users; very on-brand for an "always-on" console | Mantine has `Spotlight` — start there. Skip shadcn dep. |
| **Activity timeline** | [GitHub PR conversation timeline](https://github.blog/), [Linear issue activity](https://linear.app/) | Per-teammate page right-column needs this | Compose `Timeline` + `Card` + `Text dimmed`. Channel colors as left rail. |
| **Edge connections on a grid** | [tldraw](https://www.tldraw.com/), [Excalidraw](https://excalidraw.com/) | Slice #3 future: blocked-on-agent edges between teammate tiles | Pure SVG overlay layer above the grid; no library needed. |
| **Live cursor / presence** | [Liveblocks examples](https://liveblocks.io/examples) · [Figma multiplayer](https://www.figma.com/) | Aspirational; if multiple humans use the console | Out of scope until we have multiple human users. Flagged only. |
| **Inline rich text in compose** | [Lexical](https://lexical.dev/) · [Tiptap](https://tiptap.dev/) | Bus compose surface eventually wants markdown shortcuts | Mantine doesn't ship one; Tiptap if/when needed. Defer. |

---

## §5. Motion principles

We are following a **subtle, semantic** motion philosophy. Motion communicates state change or system activity, never decoration.

### Core principles (Disney 12, applicable subset)

- **Anticipation:** before a button reveals a dropdown, a 50ms scale-up to signal "I'm about to do something."
- **Slow-in / slow-out:** all transitions ≥ 200ms use `cubic-bezier(0.4, 0, 0.2, 1)` (Material standard easing). Linear is forbidden except for pulsing.
- **Secondary action:** when one element changes, related elements move proportionally (e.g., chips reflowing).
- **Staging:** never animate everything at once; rotate attention with 50–100ms stagger.

### Tokens (canonical: `extensions/ui/frontend/src/lib/recipes/tokens.ts`)

This table describes **intent**; the shipped values live in `tokens.ts` and that file is the source of truth. If you need to change a token, change `tokens.ts` first; update this table second. Drift = bug.

| Token (as in `tokens.ts`) | Shipped value | Use |
|---|---|---|
| `motion.durations.fast` | `150ms` | hover, focus, micro-interaction |
| `motion.durations.standard` | `300ms` | reveal, dismiss, route transition |
| `motion.durations.pulse` | `1800ms` | heartbeat, live indicators |
| `motion.easing.standard` | `ease-in-out` | default (consider upgrading to `cubic-bezier(0.4, 0, 0.2, 1)` — see polish backlog) |
| `motion.easing.bounce` | `cubic-bezier(0.175, 0.885, 0.32, 1.275)` | playful micro-affordances (use sparingly) |

**Polish backlog (open items):**
- Upgrade `motion.easing.standard` from `ease-in-out` to the Material-standard `cubic-bezier(0.4, 0, 0.2, 1)` for a tighter feel. Coordinate via the recipe library, not here.
- Add a `motion.durations.slow` (~400–500ms) for large content swaps if/when we need it. Not shipping speculative tokens.
- Make `usePrefersReducedMotion` in `tokens.ts` reactive — currently it only checks at call time, so users toggling the OS setting mid-session won't see UI react. Replace with a `useSyncExternalStore` or Mantine's `useMediaQuery`.

### Reduced-motion baseline

Every motion token has an explicit `prefers-reduced-motion: reduce` fallback. The pattern:

```css
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.01ms !important; animation: none !important; }
}
```

…but we override on a per-recipe basis. Pulses become static border highlights. Slide transitions become opacity-only. Never disable the feedback entirely — replace it with a non-motion equivalent.

### References

- [WCAG 2.3.3 Animation from Interactions (AAA)](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html)
- [Material Design motion](https://m3.material.io/styles/motion/overview)
- [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion)

---

## §6. Accessibility references

Curated short-list. The full standard lives at [W3C WAI](https://www.w3.org/WAI/).

| Topic | Reference | Action item |
|---|---|---|
| Focus management | [WAI-ARIA APG: Focus](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | Every recipe documents tab order in `@a11y` |
| Live regions | [ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions) | Bus feed uses `aria-live="polite"` |
| Color contrast checking | [axe DevTools](https://www.deque.com/axe/devtools/) | Run on every slice before merge |
| Reduced motion | [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) | See §5 |
| Keyboard testing | [Keyboard-only navigation guide](https://webaim.org/techniques/keyboard/) | Manual pass each slice |
| Skip links | [WebAIM: Skip Navigation](https://webaim.org/techniques/skipnav/) | Add at AppShell level when we exceed 2 tabbable headers |

---

## §7. Prior Lem console patterns worth re-using

Internal precedents. Update permalinks as files move.

| Surface | Where it lives | Why re-use |
|---|---|---|
| Heartbeat tile pulse rail | `extensions/ui/frontend/src/lib/recipes/StatePulseRail.recipe.tsx` (post-Phase-2) | Canonical "this teammate is working" indicator |
| Initials monogram fallback | `extensions/ui/frontend/src/lib/recipes/TeammateAvatar.recipe.tsx` | When portrait missing; sacred-rule compliant |
| Bus message format (terse) | `/tmp/bus-tail.sh` output style | Single-line, channel-colored, sender→recipient, type tag, payload truncated. Port to web for the bus-tail web component eventually. |
| Bus message format (conversational) | `/tmp/teammate-chat.sh` output style | Multi-line wrapped, separator bars, sender color. Port to web for the per-teammate activity feed. |
| Domscribe inline tagging | `extensions/ui/frontend/.domscribe/` | Already wired in dev mode; use for element discovery (see SOP §2) |

---

## §8. Image inspirations (curated by Justin, captioned by Lem)

This section gets populated as Justin drops images into `extensions/ui/frontend/public/design-refs/<category>/`. Lem ingests each image via the perceiver bridge (`POST /api/visual/perceive`) and produces a structured caption that gets pasted here.

Convention per entry:

```
### <filename> (<category>)
- **Source:** <where it came from — site / app / screenshot context>
- **Why pinned:** <one-line reason Justin pinned it>
- **Lem caption:** <observations from visual.db>
- **Portability:** <how feasible to port to Mantine>
```

When the file lands in `design-refs/<category>/<filename>`, fire:

```bash
curl -s -X POST http://127.0.0.1:8787/api/visual/perceive \
  -H "Content-Type: application/json" \
  -d "{\"image_path\":\"$HOME/projects/lem/extensions/ui/frontend/public/design-refs/<category>/<filename>\",\"context_tags\":[\"design-ref\",\"<category>\"],\"request_type\":\"describe\"}"
```

…then paste the response's `observations` into the entry above.

### Categories

- `layouts/` — full-page compositions
- `components/` — single-component inspirations
- `motion/` — short videos / animated GIFs / Lottie files
- `data-viz/` — graphs, timelines, heatmaps
- `dark-mode/` — dark theme references specifically

**No entries yet.** First entries will be Justin's pins post-2026-05-11.

---

## §9. Anti-patterns (what NOT to copy)

Documented to prevent repeated drift.

- **Glassmorphism for production UIs.** Looks great on dribbble, terrible on real backgrounds + a11y disaster.
- **Auto-playing video backgrounds.** Motion-sickness trigger; bandwidth waste.
- **Hover-only affordances.** Touch + keyboard users miss them.
- **Carousels for primary navigation.** Hide content; track-record of low engagement.
- **Skeuomorphic shadows everywhere.** One subtle shadow per elevation level, max.
- **Decorative AI faces in empty states.** Conflicts with the sacred-rule. Use abstract illustration or text-forward states instead.

---

## §10. Open questions / parking lot

Things we should decide as we accrue evidence:

- **Dark mode strategy:** Mantine has `useColorScheme()` and `MantineProvider colorScheme`. Should we default to dark, system-following, or per-user-stored? Currently undecided.
- **Iconography depth:** are tabler icons sufficient, or do we need a custom set for Lem-specific entities (teammate, channel, bus, vivarium)?
- **Real-time motion thresholds:** at what bus-message-rate does the pulse animation become noise instead of signal? Need a heuristic.
- **Brand color drift:** signature colors are per-teammate; do we also need a global brand color, or is "no brand color, only teammate colors" the actual position?
- **Per-teammate page route:** `/teammates/:id` (REST-ish) or `/t/:id` (terser)? Decide before Slice #2 ships.

---

## §11. Maintenance

This doc is appended-to, rarely rewritten. When a pattern is superseded:
- Mark old entry `[deprecated YYYY-MM-DD: <reason>]` in-place.
- Add new entry below in same section.
- Never delete history.

Owner of last commit signals the doc's freshness. If you ship a slice that changes how a pattern works, update the relevant section in the same PR.

### Change log

- **2026-05-11 (polish iter 1, Claude orchestrator):** Aligned §1 iconography with shipped reality (`lucide-react`, not `@tabler/icons-react`). Reconciled §5 motion tokens with `recipes/tokens.ts` and added a polish backlog there. Added shipped recipe file paths to §3 and §7. The doc started as aspirational; now it tracks reality.
