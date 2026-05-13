/**
 * Lem UI Design Tokens
 * 
 * Canonical source for colors, motion, and layout constraints.
 */

/**
 * Signature colors from teammate-bus schema.
 * @see extensions/ui/backend/teammates.json
 */
export const signatureColors = {
  lem: "#20c997",
  iain: "#339af0",
  codex: "#f03e3e",
  claudeCode: "#ae3ec9",
  justin: "#fab005",
};

/**
 * Motion tokens
 */
export const motion = {
  durations: {
    pulse: "1800ms",
    fast: "150ms",
    standard: "300ms",
  },
  easing: {
    standard: "ease-in-out",
    bounce: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
  },
};

/**
 * Accessibility Helpers
 */
export const usePrefersReducedMotion = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};
