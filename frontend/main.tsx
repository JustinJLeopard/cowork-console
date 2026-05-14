/**
 * cowork-console — team-coordination panel
 *
 * Minimal Team-tab page consuming /api/teammates + /api/teammates/stream
 * from the cowork-console backend (backend/main.py). Renders the
 * canonical 5-teammate roster using the TeammateAvatar, HeartbeatTile,
 * and StatePulseRail recipes transported from lem in Stage 1b.
 *
 * Historical note: this file replaces a 2,713-line lem-mixed-concept
 * `main.tsx` carried over in the initial transport commit. Per the
 * Justin-approved 3-concept ADR (lem@docs/spec/extensions-ui-audit-
 * 2026-05-13.md), cowork-console renders ONLY Concept-3 surfaces;
 * Lem-observability rendering (Lem/Dayjob/Sessions/Live/Dashboard
 * tabs) stays in the lem repo.
 *
 * State for now: STATIC roster (backend reads teammates.json). Bus-
 * bridge enrichment that promotes teammates to "working" based on
 * recent lem-bus activity is Followup E.
 */

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  AppShell,
  Badge,
  Container,
  Group,
  MantineProvider,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import "@mantine/core/styles.css";
import "./styles.css";

import { HeartbeatTile } from "./src/lib/recipes";
import type { Teammate } from "./src/lib/types";

const ROSTER_ENDPOINT = "/api/teammates";
const STREAM_ENDPOINT = "/api/teammates/stream";

interface HeartbeatPayload {
  teammates: Teammate[];
  ts: number;
}

function useTeammates() {
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [lastTick, setLastTick] = useState<number | null>(null);
  const [streamOk, setStreamOk] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    fetch(ROSTER_ENDPOINT)
      .then((r) => {
        if (!r.ok) throw new Error(`roster fetch ${r.status}`);
        return r.json();
      })
      .then((roster: Teammate[]) => {
        if (cancelled) return;
        setTeammates(roster);
        setLastTick(Math.floor(Date.now() / 1000));
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // SSE stream subscription
  useEffect(() => {
    const source = new EventSource(STREAM_ENDPOINT);
    source.addEventListener("heartbeat", (ev: MessageEvent) => {
      try {
        const payload = JSON.parse(ev.data) as HeartbeatPayload;
        setTeammates(payload.teammates);
        setLastTick(payload.ts);
        setStreamOk(true);
        setError(null);
      } catch (e) {
        setError(`heartbeat parse: ${e}`);
      }
    });
    source.addEventListener("error", () => {
      setStreamOk(false);
    });
    return () => {
      source.close();
    };
  }, []);

  return { teammates, lastTick, streamOk, error };
}

function formatTickAge(ts: number | null): string {
  if (ts == null) return "no ticks yet";
  const ageSec = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (ageSec < 5) return "just now";
  if (ageSec < 60) return `${ageSec}s ago`;
  if (ageSec < 3600) return `${Math.floor(ageSec / 60)}m ago`;
  return new Date(ts * 1000).toLocaleString();
}

function TeamRoster() {
  const { teammates, lastTick, streamOk, error } = useTeammates();

  if (error && teammates.length === 0) {
    return (
      <Stack gap="xs">
        <Title order={4}>Teammates</Title>
        <Text c="red" size="sm">
          {error}
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Title order={3}>Teammates</Title>
        <Group gap="xs">
          <Badge color={streamOk ? "teal" : "gray"} variant="light">
            {streamOk ? "Live" : "Polling"}
          </Badge>
          <Text size="xs" c="dimmed">
            {formatTickAge(lastTick)}
          </Text>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 3 }} spacing="lg">
        {teammates.map((m) => (
          <HeartbeatTile key={m.id} teammate={m} />
        ))}
      </SimpleGrid>

      {teammates.length === 0 && (
        <Text size="sm" c="dimmed">
          Loading roster…
        </Text>
      )}
    </Stack>
  );
}

function App() {
  return (
    <MantineProvider defaultColorScheme="dark">
      <AppShell padding="md" header={{ height: 56 }}>
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Title order={4}>cowork-console</Title>
            <Text size="xs" c="dimmed">
              team-coordination panel
            </Text>
          </Group>
        </AppShell.Header>
        <AppShell.Main>
          <Container size="xl">
            <TeamRoster />
          </Container>
        </AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
}

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);
root.render(<App />);
