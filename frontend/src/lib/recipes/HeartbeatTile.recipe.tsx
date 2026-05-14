import React from "react";
import { Badge, Group, Text, Tooltip } from "@mantine/core";
import { RadioTower, UserCheck, Moon, CirclePause, Workflow, AlertCircle } from "lucide-react";
import { TeammateAvatar } from "./TeammateAvatar.recipe";
import { StatePulseRail } from "./StatePulseRail.recipe";
import { Teammate, TeammateState } from "../types";

export interface HeartbeatTileProps {
  /** Teammate data object */
  teammate: Teammate;
}

const STATE_META: Record<TeammateState, { label: string; Icon: any; treatment: string }> = {
  working: { label: "Working", Icon: RadioTower, treatment: "High contrast, solid rule, active signal mark" },
  "idle-available": { label: "Idle available", Icon: UserCheck, treatment: "Open surface, quiet check, low urgency" },
  asleep: { label: "Asleep", Icon: Moon, treatment: "Recessed contrast, muted metadata, dormant posture" },
  "blocked-on-human": { label: "Blocked on human", Icon: CirclePause, treatment: "Heavy rail, paused cadence, human handoff cue" },
  "blocked-on-agent": { label: "Blocked on agent", Icon: Workflow, treatment: "Dashed rule, dependency cue, still machine-owned" },
  errored: { label: "Errored", Icon: AlertCircle, treatment: "Inverted alarm cell, hard stop, inspect first" }
};

/**
 * @recipe HeartbeatTile
 * 
 * @usage
 * ```tsx
 * <HeartbeatTile teammate={teammateData} />
 * ```
 * 
 * @a11y
 * - Uses `<article>` for semantic grouping.
 * - Tooltip provides detailed state treatment info.
 * - Badge provides clear text-label for machine-state.
 * 
 * @motion
 * - Composes `StatePulseRail` for heartbeat animation.
 * - Respects reduced-motion via sub-components.
 */
export const HeartbeatTile = ({ teammate }: { teammate: Teammate }) => {
  const meta = STATE_META[teammate.state] || STATE_META.errored;
  const Icon = meta.Icon;

  return (
    <article
      className={`teammateCell state-${teammate.state} ${teammate.state === "working" ? "pulse-rail" : ""}`}
      data-testid="teammate-cell"
      style={{ ["--signature" as string]: teammate.signature_color }}
    >
      <Group justify="space-between" wrap="nowrap" className="teammateCellTop">
        <TeammateAvatar
          id={teammate.id}
          name={teammate.name}
          signature_color={teammate.signature_color}
          state={teammate.state}
        />
        <Tooltip label={meta.treatment}>
          <Badge className="teammateStateBadge" variant="outline" leftSection={<Icon size={12} />}>
            {meta.label}
          </Badge>
        </Tooltip>
      </Group>
      <div className="teammateCellBody">
        <Text fw={700} className="teammateName">{teammate.name}</Text>
        <Text size="xs" tt="uppercase" fw={700} c="dimmed" className="teammateRole">{teammate.role}</Text>
        <Text size="sm" className="teammateAction">{teammate.current_action}</Text>
      </div>
      <Group justify="space-between" wrap="nowrap" className="teammateMeta">
        <Text size="xs" c="dimmed">{formatActivity(teammate.last_activity_ts)}</Text>
        <StatePulseRail 
          signature_color={teammate.signature_color} 
          active={teammate.state === 'working'} 
        />
      </Group>
    </article>
  );
};

function formatActivity(value: number) {
  if (!value) return "activity unknown";
  const date = new Date(value * 1000);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric"
  }).format(date);
}

export const __demo = {
  title: "HeartbeatTile",
  data: {
    id: "lem",
    name: "Lem",
    role: "local teammate",
    signature_color: "#20c997",
    state: "working" as TeammateState,
    last_activity_ts: Math.floor(Date.now() / 1000),
    current_action: "Synthesizing teammate bus activity"
  }
};
