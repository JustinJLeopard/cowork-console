import React from "react";
import { usePrefersReducedMotion, motion as motionTokens } from "./tokens";

export interface StatePulseRailProps {
  /** The signature color to pulse */
  signature_color: string;
  /** Whether the pulse animation should be active */
  active: boolean;
  /** Optional custom class name */
  className?: string;
  /** Duration override */
  duration?: string;
}

/**
 * @recipe StatePulseRail
 * 
 * @usage
 * ```tsx
 * <StatePulseRail 
 *   signature_color="#20c997" 
 *   active={state === 'working'} 
 * />
 * ```
 * 
 * @a11y
 * - Respects `prefers-reduced-motion` media query by disabling animations.
 * - Purely decorative rail, hidden from screen readers via `aria-hidden`.
 * 
 * @motion
 * - Subtle opacity and color-mix oscillation.
 * - Standard duration: 1800ms.
 * - Pulse amplitude: 1.0 to 0.6 opacity.
 */
export const StatePulseRail = ({
  signature_color,
  active,
  className,
  duration = motionTokens.durations.pulse,
}: StatePulseRailProps) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const isAnimated = active && !prefersReducedMotion;

  return (
    <span
      className={`teammateSignature ${isAnimated ? "pulse-rail-active" : ""} ${className || ""}`}
      aria-hidden="true"
      style={{
        ["--signature" as string]: signature_color,
        ["--duration" as string]: duration,
      }}
    />
  );
};

// Note: CSS for .pulse-rail-active should be moved to a shared recipes.css 
// or kept in styles.css for now as per phase 2 scope.

export const __demo = {
  title: "StatePulseRail",
  variants: [
    { signature_color: "#20c997", active: true },
    { signature_color: "#339af0", active: false },
  ],
};
