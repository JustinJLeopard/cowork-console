# Lem UI Recipe Library

Standardized components and visual patterns for the Lem Console.

## Convention (Per SOP §5)

Each recipe file (`*.recipe.tsx`) must include:
1.  **Component(s)**: Functional React components using Mantine primitives.
2.  **Variants**: Clear prop-driven state and style variations.
3.  **JSDoc Documentation**:
    -   `@usage`: Copy-pasteable usage example.
    -   `@a11y`: Detailed accessibility considerations (ARIA, keyboard, focus, contrast).
    -   `@motion`: Motion tokens, animation behavior, and `prefers-reduced-motion` support.
4.  **Demo**: A `__demo` export containing mock data for testing and manual preview.

## Directory Structure

- `tokens.ts`: Design tokens (colors, durations, typography).
- `index.ts`: Categorized exports (Atoms, Molecules, Organisms, Behaviors).
- `*.recipe.tsx`: Individual recipe implementations.

## Design Tokens

Refer to `tokens.ts` for the canonical source of truth on:
- **Signature Colors**: Mapped from the teammate bus schema.
- **Motion**: Standard durations and easing functions.
- **Media Queries**: Responsive breakpoints and accessibility hooks.
