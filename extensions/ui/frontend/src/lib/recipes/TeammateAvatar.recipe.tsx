import React from "react";
import { Avatar } from "@mantine/core";
import { TeammateState } from "../types";

export interface TeammateAvatarProps {
  /** Teammate unique ID */
  id: string;
  /** Teammate display name */
  name: string;
  /** Signature color for monogram fallback */
  signature_color: string;
  /** Current state to determine portrait variant */
  state: TeammateState;
  /** Avatar size */
  size?: number | string;
  /** Optional custom class name */
  className?: string;
}

/**
 * @recipe TeammateAvatar
 * 
 * @usage
 * ```tsx
 * <TeammateAvatar 
 *   id="lem" 
 *   name="Lem" 
 *   signature_color="#20c997" 
 *   state="working" 
 * />
 * ```
 * 
 * @a11y
 * - Uses semantic `<Avatar />` component.
 * - `alt` text is set to teammate name.
 * - ARIA label provides role and state context to screen readers.
 * - Maintains high contrast for monogram text (white on signature color).
 * 
 * @motion
 * - Static image/monogram, no intrinsic animation.
 */
export const TeammateAvatar = ({
  id,
  name,
  signature_color,
  state,
  size = 34,
  className,
}: TeammateAvatarProps) => {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  // Portrait logic: /portraits/<id>/<state>.png
  const portraitUrl = `/portraits/${id}/${state}.png`;

  return (
    <Avatar
      src={portraitUrl}
      alt={name}
      size={size}
      radius="xl"
      className={className}
      aria-label={`${name} (${state})`}
      styles={{
        placeholder: {
          backgroundColor: signature_color,
          color: "#fff",
          fontSize: "12px",
          fontWeight: 800,
        },
      }}
    >
      {initials}
    </Avatar>
  );
};

export const __demo = {
  title: "TeammateAvatar",
  variants: [
    { id: "lem", name: "Lem", signature_color: "#20c997", state: "working" as TeammateState },
    { id: "justin", name: "Justin", signature_color: "#fab005", state: "idle-available" as TeammateState },
    { id: "codex", name: "Codex", signature_color: "#f03e3e", state: "errored" as TeammateState },
  ],
};
