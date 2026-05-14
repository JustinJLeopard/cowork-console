import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  ActionIcon,
  AppShell,
  Avatar,
  Badge,
  Button,
  Checkbox,
  Collapse,
  Drawer,
  Group,
  MantineProvider,
  MultiSelect,
  Progress,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip
} from "@mantine/core";
import { Activity, AlertCircle, Archive, Bell, ChevronLeft, ChevronRight, Circle, CirclePause, Clipboard, Cloud, Database, HelpCircle, Image as ImageIcon, Inbox, Moon, PanelLeft, Plus, Radio, RadioTower, RefreshCw, Send, Settings, ShieldCheck, TerminalSquare, Trash2, Upload, UserCheck, Workflow } from "lucide-react";
import "@mantine/core/styles.css";
import "./styles.css";
import { HeartbeatTile } from "./src/lib/recipes";

type Mode = "lem" | "dayjob";

type ChatMessage = {
  id: number;
  role: string;
  text: string;
  sender: string | null;
  recipient: string | null;
  channel: string;
  created_at: string | null;
  created_at_ts: number | null;
  correlation_id: string | null;
  type?: string | null;
  is_autonomous?: boolean;
  relayed_to?: string | null;
  relayed_from?: string | null;
  sender_label?: string | null;
  original_message_id?: number | null;
  streaming?: boolean;
  session_id?: number | null;
  route?: string | null;
  model_used?: string | null;
  degraded?: boolean;
  context_pack_id?: number | null;
  context_summary?: { chunk_count?: number; source_count?: number; sources?: string[]; scope?: string } | null;
};

type DayjobRoute = "local" | "cloud";
type MainTab = "chat" | "dashboard" | "live" | "team";
type LiveInboxMessage = {
  id: number;
  ts?: string;
  from?: string;
  to?: string;
  channel?: string;
  severity?: string;
  summary?: string;
  body?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

type SettingsPayload = {
  db_path: string;
  local_server: string;
  chat_endpoint: string;
  vision_endpoint: string;
  mode: string;
  session_file: string;
  wake_drain: string;
};

type EngagementState = {
  active: boolean;
  is_active?: boolean;
  expires_at?: string | null;
  cadence_hint?: string;
  messages_this_hour?: number;
};

type ModeStatusPayload = {
  active: string;
  modes: Array<{
    id: Mode;
    label: string;
    enabled: boolean;
    status: string;
    root?: string;
    failure_reason?: string | null;
    audit?: DayjobHealthPayload;
  }>;
};

type DayjobHealthPayload = {
  workspace_ok?: boolean;
  schema_ok?: boolean;
  firewall_ok?: boolean;
  embedding_model_id?: string | null;
  vision_endpoint_health?: { ok?: boolean; status?: string; host?: string | null; port?: number | null; retired?: boolean; message?: string };
  storage_totals?: StorageTotals;
  leak_detected?: boolean;
  incidents?: Array<{ timestamp?: string; kind?: string; path?: string; original?: string }>;
  failure_reason?: string;
};

type DayjobSendPayload = {
  status?: string;
  correlation_id?: string | null;
  message?: ChatMessage | null;
  context_pack_id?: number;
  context_summary?: ChatMessage["context_summary"];
};

type StorageTotals = Record<string, number>;

type ActivityEvent = {
  id: number;
  event: string;
  focus?: string | null;
  summary: string;
  file?: string | null;
  correlation_id?: string | null;
  session_id?: number | null;
  created_at_ts?: number | null;
};

type DashboardPayload = {
  executor: { experiment_executed_24h: number; executor_skipped_24h: number; executor_no_match_24h: number; match_rate_24h: number; top_patterns: Array<{ pattern: string; count: number }>; executed_sparkline?: number[] };
  meta_cognition: { meta_correction_24h: number; meta_healthy_24h: number; last_strategy_recommended: string; strategy_distribution: Record<string, number> };
  reflection: { cycles_24h: number; avg_cycle_duration_seconds: number; top_chosen_focus: Array<{ focus: string; count: number }> };
  auto_research?: {
    today?: { session_id?: string; status?: string; started_at?: string; ended_at?: string | null } | null;
    last_3_sessions?: Array<{ session_id?: string; status?: string; cards?: Array<{ card_id?: string; title?: string; outcome?: { decision?: string | null } }> }>;
    pending_yellow_proposals?: Array<{ id?: number; card_id?: string; status?: string }>;
    current_hypothesis_card?: { card_id?: string; title?: string; outcome?: { decision?: string | null } } | null;
  };
  vivarium?: {
    home?: string;
    agent_count?: number;
    promotion_levels?: Record<string, number>;
    top_agent?: {
      agent_id?: string;
      promotion_level?: string;
      promotion_score?: number;
      solved_challenges?: number;
      model_calls?: number;
      tool_calls?: number;
      children?: number;
      next_gate?: string;
    } | null;
    agents?: Array<{
      agent_id?: string;
      promotion_level?: string;
      promotion_score?: number;
      solved_challenges?: number;
      model_calls?: number;
      tool_calls?: number;
      children?: number;
    }>;
  };
  vision: {
    endpoint: string;
    model: string;
    uptime_pct_1h: number;
    ingests_24h: number;
    vision_unreachable_warnings_24h: number;
    capture_loop_heartbeat?: string;
    last_frame_age_seconds?: number | null;
    vlm_route_status?: string;
    events_per_hour?: number;
    vlm_calls_per_hour?: number;
    parse_repaired_count?: number;
    active_predicates_count?: number;
    proposed_predicates_count?: number;
    open_episodes?: Array<{ episode_key?: string; episode_kind?: string; event_count?: number }>;
  };
  ctx_watchdog: { current_ctx: number; decisions_24h: Array<{ decision: string; timestamp: string }>; last_decision: string };
  engagement: { messages_initiated_24h: number; overrides_used_24h: number; current_window_active: boolean };
};

type ContextPackPayload = {
  id?: number;
  chunks?: Array<{ id: number; provenance?: string; text?: string; source_type?: string; repo_name?: string | null; file_path?: string | null }>;
};

type ChatSession = {
  id: number;
  label: string | null;
  started_at: string;
  ended_at: string | null;
  status: "active" | "archived" | "pruned";
  message_count: number;
  summary_excerpt?: string | null;
};

type DayjobPreviewPayload = {
  normalized_text: string;
  detected_source_type: string;
  chunks_preview: Array<{ index: number; label: string; source_type: string; byte_count: number }>;
  would_attach: boolean;
  attachment_sha_preview?: string;
};

type DayjobIngestion = {
  id: number;
  created_at: string;
  source_type: string;
  scope?: string | null;
  task_tag?: string | null;
  repo_name?: string | null;
  file_path?: string | null;
  attachment_sha?: string | null;
  title?: string | null;
  byte_count: number;
  chunk_count: number;
  metadata?: Record<string, unknown>;
};

type ImageIngestResult = {
  ingestion_id?: number;
  attachment_id?: string;
  chunk_count?: number;
  ocr_confidence?: number | null;
  vision_provider?: string;
  source_type?: string;
  warnings?: string[];
};

type CommandStatus = "pending" | "running" | "completed" | "failed";

type CommandRecord = {
  id: number;
  created_at: string;
  task_tag?: string | null;
  message_id?: number | null;
  session_id?: number | null;
  command_text: string;
  status: CommandStatus;
  pasted_output?: string | null;
  analysis_message_id?: number | null;
  analysis_text?: string | null;
};

type CommandRefreshOptions = {
  sessionId?: number | null;
  taskTag?: string;
  statuses?: string[];
  unscoped?: boolean;
};

import { Teammate, TeammateState } from "./src/lib/types";

type CloudRouteLogEntry = {
  timestamp?: string;
  correlation_id?: string;
  session_id?: number;
  task_tag?: string | null;
  model_requested?: string;
  model_used?: string;
  degraded?: boolean;
  message_id?: number;
  context_pack_id?: number;
  tokens_in?: number;
  tokens_out?: number;
  attachment_exclusion_verified?: boolean;
  duration_ms?: number;
};

type PasteForm = {
  text: string;
  source_type: string;
  task_tag: string;
  repo_name: string;
  file_path: string;
};

const SOURCE_OPTIONS = [
  { value: "auto", label: "Auto-detect" },
  { value: "filetree", label: "Filetree" },
  { value: "file_bundle", label: "File bundle" },
  { value: "code_block", label: "Code block" },
  { value: "readme", label: "README" },
  { value: "stacktrace", label: "Stacktrace" },
  { value: "command_output", label: "Command output" },
  { value: "other", label: "Other" }
];

function App() {
  const [mode, setMode] = useState<Mode>("lem");
  const [mainTab, setMainTab] = useState<MainTab>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [dayjobMessages, setDayjobMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [health, setHealth] = useState("checking");
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [modeStatus, setModeStatus] = useState<ModeStatusPayload | null>(null);
  const [dayjobHealth, setDayjobHealth] = useState<DayjobHealthPayload | null>(null);
  const [dayjobTotals, setDayjobTotals] = useState<StorageTotals>({});
  const [dayjobStatusOpen, setDayjobStatusOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ingestDrawerOpen, setIngestDrawerOpen] = useState(false);
  const [pasteForm, setPasteForm] = useState<PasteForm>({ text: "", source_type: "auto", task_tag: "", repo_name: "", file_path: "" });
  const [pastePreview, setPastePreview] = useState<DayjobPreviewPayload | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pasteBusy, setPasteBusy] = useState(false);
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageManualDescription, setImageManualDescription] = useState("");
  const [imageNeedsManual, setImageNeedsManual] = useState(false);
  const [imageResult, setImageResult] = useState<ImageIngestResult | null>(null);
  const [imageIngestStage, setImageIngestStage] = useState<string | null>(null);
  const [ingestions, setIngestions] = useState<DayjobIngestion[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [dayjobRoute, setDayjobRoute] = useState<DayjobRoute>("local");
  const [cloudConfirmOpen, setCloudConfirmOpen] = useState(false);
  const [cloudConfirmed, setCloudConfirmed] = useState(false);
  const [cloudConfirmRemember, setCloudConfirmRemember] = useState(false);
  const [isFocused, setIsFocused] = useState(!document.hidden);
  const [wsStatus, setWsStatus] = useState("connecting");
  const [streamingIds, setStreamingIds] = useState<Record<string, boolean>>({});
  const [engagement, setEngagement] = useState<EngagementState | null>(null);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [activityOpen, setActivityOpen] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [sessionsOpen, setSessionsOpen] = useState(true);
  const [sessionPanelTab, setSessionPanelTab] = useState<"sessions" | "commands">("sessions");
  const [sessionReady, setSessionReady] = useState(false);
  const [commandHistory, setCommandHistory] = useState<CommandRecord[]>([]);
  const [commandTaskFilter, setCommandTaskFilter] = useState("");
  const [commandStatusFilter, setCommandStatusFilter] = useState<string[]>([]);
  const [commandsUnscoped, setCommandsUnscoped] = useState(false);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [dashboardBusy, setDashboardBusy] = useState(false);
  const [liveInbox, setLiveInbox] = useState<LiveInboxMessage[]>([]);
  const [liveInboxPath, setLiveInboxPath] = useState("");
  const liveInboxLastIdRef = useRef(0);
  const viewport = useRef<HTMLDivElement>(null);
  const activityMaxIdRef = useRef(0);
  const maxIdRef = useRef(0);
  const retryRef = useRef(0);
  const hiddenRef = useRef(document.hidden);
  const notifyAtRef = useRef(0);
  const streamsRef = useRef<Map<string, EventSource>>(new Map());

  const maxId = useMemo(() => messages.reduce((id, message) => Math.max(id, message.id), 0), [messages]);
  maxIdRef.current = maxId;

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then((payload) => setHealth(payload.ok ? "ready" : "degraded"))
      .catch(() => setHealth("offline"))
      .finally(() => setSessionReady(true));
    fetch("/api/settings")
      .then((response) => response.json())
      .then(setSettings)
      .catch(() => setSettings(null));
    refreshModeStatus(setModeStatus, setDayjobHealth);
    refreshDayjobStatus(setDayjobHealth, setDayjobTotals);
    refreshIngestions(setIngestions, mode);
    refreshSessions().then((sid) => loadHistory(sid));
    refreshEngagement(setEngagement);
    fetch("/api/ui-session")
      .then((response) => response.json())
      .then((payload) => {
        const pref = payload.preferences?.activity_panel_open;
        if (typeof pref === "boolean") setActivityOpen(pref);
        if (payload.preferences?.dayjob_cloud_confirmed === true) setCloudConfirmed(true);
      })
      .catch(() => undefined);
    fetch("/api/activity?limit=25")
      .then((response) => response.json())
      .then((payload) => {
        const events = payload.events ?? [];
        setActivityEvents(events);
        activityMaxIdRef.current = maxActivityId(events);
      })
      .catch(() => setActivityEvents([]));

    fetch("/api/teammates")
      .then((response) => response.json())
      .then(setTeammates)
      .catch(() => setTeammates([]));
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    const source = new EventSource("/api/teammates/stream");
    source.addEventListener("heartbeat", (event) => {
      const payload = JSON.parse((event as MessageEvent).data);
      if (payload.teammates) {
        setTeammates(payload.teammates);
      }
    });
    source.onerror = () => source.close();
    return () => source.close();
  }, [sessionReady]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    if (!sessionReady) return;
    refreshSessions().then((sid) => loadHistory(sid));
    refreshIngestions(setIngestions, mode);
    refreshActivityForMode();
  }, [mode, sessionReady]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refreshModeStatus(setModeStatus, setDayjobHealth);
      refreshIngestions(setIngestions, mode);
      if (mode === "dayjob") {
        refreshDayjobStatus(setDayjobHealth, setDayjobTotals);
      }
      refreshCommands(setCommandHistory, mode, {
        sessionId: selectedSessionId,
        taskTag: commandTaskFilter,
        statuses: commandStatusFilter,
        unscoped: commandsUnscoped
      });
    }, 30000);
    return () => window.clearInterval(timer);
  }, [mode, selectedSessionId, commandTaskFilter, commandStatusFilter, commandsUnscoped]);

  useEffect(() => {
    if (mainTab !== "dashboard") return;
    refreshDashboard(mode, setDashboard, setDashboardBusy);
    const timer = window.setInterval(() => refreshDashboard(mode, setDashboard, setDashboardBusy), 30000);
    return () => window.clearInterval(timer);
  }, [mainTab, mode]);

  useEffect(() => {
    if (mainTab !== "live") return;
    refreshLiveInbox(setLiveInbox, (id) => {
      liveInboxLastIdRef.current = id;
    }, setLiveInboxPath, 0);
    const timer = window.setInterval(() => {
      refreshLiveInbox(setLiveInbox, (id) => {
        liveInboxLastIdRef.current = id;
      }, setLiveInboxPath, liveInboxLastIdRef.current);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [mainTab]);

  useEffect(() => {
    if (!sessionReady || (!commandsUnscoped && selectedSessionId === null)) return;
    refreshCommands(setCommandHistory, mode, {
      sessionId: selectedSessionId,
      taskTag: commandTaskFilter,
      statuses: commandStatusFilter,
      unscoped: commandsUnscoped
    });
  }, [mode, selectedSessionId, commandTaskFilter, commandStatusFilter, commandsUnscoped]);

  useEffect(() => {
    const timer = window.setInterval(() => refreshEngagement(setEngagement), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activityOpen !== null || engagement === null) return;
    setActivityOpen(Boolean(engagement.active || engagement.is_active));
  }, [activityOpen, engagement]);

  useEffect(() => {
    if (!sessionReady) return;
    if (mode === "dayjob") {
      const timer = window.setInterval(() => refreshActivityForMode(), 1000);
      return () => window.clearInterval(timer);
    }
    const source = new EventSource(`/api/activity/stream?since_id=${activityMaxIdRef.current}`);
    source.addEventListener("activity", (event) => {
      const payload = JSON.parse((event as MessageEvent).data);
      setActivityEvents((current) => {
        const merged = mergeActivity(current, [payload]).slice(-50);
        activityMaxIdRef.current = maxActivityId(merged);
        return merged;
      });
    });
    source.onerror = () => source.close();
    return () => source.close();
  }, [sessionReady, mode]);

  useEffect(() => {
    const onVisibility = () => {
      hiddenRef.current = document.hidden;
      const focused = document.hasFocus() && document.visibilityState === "visible";
      setIsFocused(focused);
      if (focused) {
        setDefaultFavicon();
        syncMissedMessages(maxIdRef.current, setMessages);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    window.addEventListener("blur", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
      window.removeEventListener("blur", onVisibility);
    };
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let heartbeat: number | undefined;
    let retryTimer: number | undefined;
    let closedByUnmount = false;

    const connect = () => {
      const scheme = window.location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${scheme}://${window.location.host}/ws/messages?last_seen_msg_id=${maxIdRef.current}`);
      setWsStatus("connecting");
      ws.onopen = () => {
        retryRef.current = 0;
        setWsStatus("open");
        heartbeat = window.setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) ws.send("ping");
        }, 30000);
      };
      ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type === "pong") return;
        const incoming: ChatMessage[] = payload.messages ?? [];
        if (!incoming.length) return;
        setMessages((current) => mergeMessages(current, incoming));
        const notable = incoming.find((message) => message.role !== "justin");
        if (notable) notifyReply(notable.text);
      };
      ws.onclose = () => {
        window.clearInterval(heartbeat);
        if (closedByUnmount) return;
        setWsStatus("reconnecting");
        if (retryRef.current >= 5) {
          setWsStatus("attention");
          return;
        }
        const delay = Math.min(30000, 1000 * 2 ** retryRef.current);
        retryRef.current += 1;
        retryTimer = window.setTimeout(connect, delay);
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      closedByUnmount = true;
      window.clearInterval(heartbeat);
      window.clearTimeout(retryTimer);
      ws?.close();
    };
  }, []);

  useEffect(() => {
    return () => {
      streamsRef.current.forEach((stream) => stream.close());
      streamsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, maxId]);

  async function sendDayjobText(text: string, forceCloud = false) {
    if (!text) return;
    if (dayjobRoute === "cloud" && !cloudConfirmed && !forceCloud) {
      setDraft(text);
      setCloudConfirmOpen(true);
      return;
    }
    setSendError(null);
    try {
      const response = await fetch("/api/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, mode: "dayjob", route: dayjobRoute })
      });
      if (!response.ok) {
        setSendError(await response.text());
        setDraft(text);
        return;
      }
      const payload = await response.json();
      setDayjobMessages((current) => mergeMessages(current, [payload.message].filter(Boolean)));
      startDayjobStreaming(payload.correlation_id);
      await refreshSessions(payload.message?.session_id ?? null);
      window.setTimeout(() => loadHistory(payload.message?.session_id ?? null), 1200);
      await refreshDayjobStatus(setDayjobHealth, setDayjobTotals);
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      setSendError(raw || "Unexpected send failure");
      setDraft(text);
    }
  }

  async function sendMessage(forceCloud = false) {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    if (mode === "dayjob") {
      await sendDayjobText(text, forceCloud);
      return;
    }
    setSendError(null);
    try {
      const response = await fetch("/api/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, mode, route: "local" })
      });
      if (!response.ok) {
        setSendError(await response.text());
        setDraft(text);
        return;
      }
      const payload = await response.json();
      await refreshSessions();
      setMessages((current) => mergeMessages(current, [payload.message]));
      startStreaming(payload.message.correlation_id);
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      const message = raw || "Unexpected send failure";
      setSendError(message);
      setDraft(text);
    }
  }

  async function confirmCloudAndSend() {
    setCloudConfirmed(true);
    setCloudConfirmOpen(false);
    if (cloudConfirmRemember) {
      await persistDayjobCloudConfirmed(true);
    }
    await sendMessage(true);
  }

  async function handleCommandAskNext(next: DayjobSendPayload | null | undefined) {
    if (!next) return;
    const correlationId = next.correlation_id ?? next.message?.correlation_id ?? null;
    if (mode === "dayjob") {
      setDayjobMessages((current) => mergeMessages(current, [next.message].filter(Boolean) as ChatMessage[]));
      startDayjobStreaming(correlationId);
      await refreshDayjobStatus(setDayjobHealth, setDayjobTotals);
    } else {
      setMessages((current) => mergeMessages(current, [next.message].filter(Boolean) as ChatMessage[]));
      startStreaming(correlationId);
    }
    await refreshSessions(next.message?.session_id ?? null);
    window.setTimeout(() => loadHistory(next.message?.session_id ?? null), 1200);
  }

  function startStreaming(correlationId: string | null) {
    if (!correlationId || streamsRef.current.has(correlationId)) return;
    const source = new EventSource(`/api/stream/${encodeURIComponent(correlationId)}`);
    streamsRef.current.set(correlationId, source);
    setStreamingIds((current) => ({ ...current, [correlationId]: true }));
    const tempId = -Date.now();
    source.addEventListener("token", (event) => {
      const payload = JSON.parse((event as MessageEvent).data);
      const token = String(payload.token ?? "");
      setMessages((current) => appendStreamingToken(current, tempId, correlationId, token));
    });
    source.addEventListener("done", (event) => {
      const payload = JSON.parse((event as MessageEvent).data);
      setMessages((current) => current.filter((message) => message.id !== tempId));
      streamsRef.current.get(correlationId)?.close();
      streamsRef.current.delete(correlationId);
      setStreamingIds((current) => ({ ...current, [correlationId]: false }));
      if (payload.reply_id) {
        syncMissedMessages(maxIdRef.current, setMessages);
        refreshCommands(setCommandHistory, mode, { sessionId: selectedSessionId, taskTag: commandTaskFilter, statuses: commandStatusFilter, unscoped: commandsUnscoped });
      }
    });
    source.addEventListener("error", (event) => {
      setMessages((current) => current.filter((message) => message.id !== tempId));
      source.close();
      streamsRef.current.delete(correlationId);
      setStreamingIds((current) => ({ ...current, [correlationId]: false }));
      setSendError(streamInterruptionMessage(event, "Lem stream interrupted - try again"));
      syncMissedMessages(maxIdRef.current, setMessages);
    });
    source.addEventListener("cancelled", (event) => {
      setMessages((current) => current.filter((message) => message.id !== tempId));
      source.close();
      streamsRef.current.delete(correlationId);
      setStreamingIds((current) => ({ ...current, [correlationId]: false }));
      setSendError(streamInterruptionMessage(event, "Lem stream cancelled - try again"));
      syncMissedMessages(maxIdRef.current, setMessages);
    });
  }

  function startDayjobStreaming(correlationId: string | null) {
    if (!correlationId || streamsRef.current.has(correlationId)) return;
    const source = new EventSource(`/api/dayjob/stream/${encodeURIComponent(correlationId)}`);
    streamsRef.current.set(correlationId, source);
    const tempId = -Date.now();
    let sawStreamEvent = false;
    window.setTimeout(() => {
      if (!streamsRef.current.has(correlationId) || sawStreamEvent) return;
      source.close();
      streamsRef.current.delete(correlationId);
      fetchDayjobStreamFallback(correlationId, tempId);
    }, 2500);
    source.addEventListener("token", (event) => {
      sawStreamEvent = true;
      const payload = JSON.parse((event as MessageEvent).data);
      const token = String(payload.token ?? "");
      setDayjobMessages((current) => appendDayjobStreamingToken(current, tempId, correlationId, token));
    });
    source.addEventListener("done", (event) => {
      sawStreamEvent = true;
      const payload = JSON.parse((event as MessageEvent).data);
      if (payload.status === "error") {
        setDayjobMessages((current) => current.map((message) => message.id === tempId ? { ...message, streaming: false } : message));
        setSendError(typeof payload.detail === "string" ? payload.detail : "Dayjob model reply failed");
      } else {
        setDayjobMessages((current) => mergeMessages(current.filter((message) => message.id !== tempId), [payload.reply_message].filter(Boolean)));
      }
      streamsRef.current.get(correlationId)?.close();
      streamsRef.current.delete(correlationId);
      refreshActivityForMode();
      refreshSessions(payload.reply_message?.session_id ?? payload.session_id ?? null);
      refreshCommands(setCommandHistory, mode, { sessionId: selectedSessionId, taskTag: commandTaskFilter, statuses: commandStatusFilter, unscoped: commandsUnscoped });
    });
    source.addEventListener("error", (event) => {
      setDayjobMessages((current) => current.filter((message) => message.id !== tempId));
      source.close();
      streamsRef.current.delete(correlationId);
      setSendError(streamInterruptionMessage(event, "Dayjob stream interrupted - try again"));
      refreshActivityForMode();
    });
    source.addEventListener("cancelled", (event) => {
      setDayjobMessages((current) => current.filter((message) => message.id !== tempId));
      source.close();
      streamsRef.current.delete(correlationId);
      setSendError(streamInterruptionMessage(event, "Dayjob stream cancelled - try again"));
      refreshActivityForMode();
    });
  }

  async function fetchDayjobStreamFallback(correlationId: string, tempId: number) {
    try {
      const response = await fetch(`/api/dayjob/stream/${encodeURIComponent(correlationId)}`);
      const raw = await response.text();
      let reply: ChatMessage | null = null;
      for (const block of raw.split("\n\n")) {
        const event = block.match(/^event: (.+)$/m)?.[1];
        const data = block.match(/^data: (.+)$/m)?.[1];
        if (event !== "done" || !data) continue;
        const payload = JSON.parse(data);
        reply = payload.reply_message ?? null;
      }
      if (reply) {
        setDayjobMessages((current) => mergeMessages(current.filter((message) => message.id !== tempId), [reply]));
        refreshSessions(reply.session_id ?? null);
      } else {
        await loadHistory(selectedSessionId);
      }
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : String(err));
    } finally {
      refreshActivityForMode();
    }
  }

  const dayjobMode = modeStatus?.modes.find((item) => item.id === "dayjob");
  const dayjobEnabled = Boolean(dayjobMode?.enabled);
  const disabled = mode === "dayjob" ? !dayjobEnabled : mode !== "lem";
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? null;
  const readOnly = Boolean(selectedSession && selectedSession.status !== "active");
  const standaloneTeammatesDemo = window.location.pathname === "/teammates-demo";

  if (standaloneTeammatesDemo) {
    return (
      <MantineProvider defaultColorScheme="dark">
        <main className="teammateDemoRoute">
          <TeammateGrid teammates={teammates} />
        </main>
      </MantineProvider>
    );
  }

  return (
    <MantineProvider defaultColorScheme="dark">
      <AppShell header={{ height: 58 }} padding="md">
        <AppShell.Header className={`header ${mode === "dayjob" ? "dayjobHeader" : ""}`}>
          <Group justify="space-between" h="100%" px="md" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <Text fw={700}>Lem Console</Text>
              <Badge leftSection={<Circle size={8} fill="currentColor" />} color={health === "ready" ? "green" : "yellow"}>{health}</Badge>
              <Badge leftSection={<Radio size={11} />} color={wsStatus === "open" ? "green" : wsStatus === "attention" ? "red" : "yellow"}>{wsStatus}</Badge>
            </Group>
            <Group gap="xs" wrap="nowrap">
              <SegmentedControl
                value={mode}
                onChange={(value) => setMode(value as Mode)}
                data={[
                  { value: "lem", label: "Lem" },
                  { value: "dayjob", label: "Dayjob", disabled: !dayjobEnabled }
                ]}
              />
              <SegmentedControl
                value={mainTab}
                onChange={(value) => setMainTab(value as MainTab)}
                data={[
                  { value: "chat", label: "Sessions" },
                  { value: "dashboard", label: "Dashboard" },
                  { value: "live", label: "Live" },
                  { value: "team", label: "Team" }
                ]}
              />
              <Button
                size="xs"
                leftSection={<Plus size={14} />}
                onClick={() => setIngestDrawerOpen(true)}
                disabled={mode === "dayjob" && !dayjobEnabled}
              >
                {mode === "dayjob" ? "Ingest" : "Add Context"}
              </Button>
              <EngagementBadge engagement={engagement} onStop={() => stopEngagement(setEngagement)} />
              <Tooltip label="Settings">
                <ActionIcon aria-label="Settings" variant="default" onClick={() => setDrawerOpen(true)}>
                  <Settings size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </AppShell.Header>
        <AppShell.Main className={`main ${activityOpen ? "withActivity" : ""} ${sessionsOpen ? "withSessions" : ""}`}>
          {mainTab === "dashboard" ? (
            <DashboardPanel
              dashboard={dashboard}
              busy={dashboardBusy}
              mode={mode}
              onRefresh={() => refreshDashboard(mode, setDashboard, setDashboardBusy)}
            />
          ) : mainTab === "live" ? (
            <LiveInboxPanel messages={liveInbox} path={liveInboxPath} />
          ) : mainTab === "team" ? (
            <TeammateGrid teammates={teammates} />
          ) : mode === "dayjob" ? (
            <section className="console dayjobConsole">
              <ScrollArea viewportRef={viewport} className="messages" type="always">
                <Stack gap="sm" p="md">
                  {dayjobMessages.length === 0 ? (
                    <DayjobEmptyState
                      onIngest={() => setIngestDrawerOpen(true)}
                      onCommands={() => {
                        setSessionPanelTab("commands");
                        setSessionsOpen(true);
                      }}
                      onDashboard={() => setMainTab("dashboard")}
                    />
                  ) : (
                    dayjobMessages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        mode="dayjob"
                        sessionId={selectedSessionId}
                        dayjobRoute={dayjobRoute}
                        onAskNext={handleCommandAskNext}
                        onCommandUpdated={async () => {
                          await loadHistory(selectedSessionId);
                          await refreshCommands(setCommandHistory, mode, {
                            sessionId: selectedSessionId,
                            taskTag: commandTaskFilter,
                            statuses: commandStatusFilter,
                            unscoped: commandsUnscoped
                          });
                        }}
                      />
                    ))
                  )}
                </Stack>
              </ScrollArea>
              <div className="composer dayjobComposer">
                <Group justify="space-between" mb={6}>
                  <Group gap="xs">
                    <Select
                      aria-label="Dayjob route"
                      size="xs"
                      w={140}
                      value={dayjobRoute}
                      onChange={(value) => setDayjobRoute((value as DayjobRoute) || "local")}
                      data={[
                        { value: "local", label: "LOCAL" },
                        { value: "cloud", label: "CLOUD" }
                      ]}
                      leftSection={dayjobRoute === "cloud" ? <Cloud size={14} /> : <ShieldCheck size={14} />}
                    />
                    <Text size="sm" c="dimmed">{dayjobRoute === "cloud" ? "Cloud route: Opus via LiteLLM" : "Dayjob route: local RAG"}</Text>
                  </Group>
                  <Button
                    size="xs"
                    variant="subtle"
                    leftSection={<HelpCircle size={14} />}
                    onClick={() => sendDayjobText("Show me how to use the Dayjob UI for this Workspaces task.")}
                    disabled={disabled || readOnly}
                  >
                    /help
                  </Button>
                  <Button
                    size="xs"
                    variant="subtle"
                    leftSection={<Database size={14} />}
                    onClick={() => setDayjobStatusOpen((open) => !open)}
                  >
                    Status
                  </Button>
                </Group>
                <Collapse in={dayjobStatusOpen}>
                  <DayjobStatusDrawer health={dayjobHealth} totals={dayjobTotals} modeStatus={dayjobMode} />
                </Collapse>
                <Collapse in={cloudConfirmOpen}>
                  <div className="cloudConfirm" data-testid="cloud-route-confirm">
                    <Text size="sm">This sends text + retrieved context to Claude Opus 4.6. No attachment binaries are transmitted. Continue?</Text>
                    <Group justify="space-between" mt="xs" gap="xs">
                      <Checkbox
                        size="xs"
                        label="Don't ask again this session"
                        checked={cloudConfirmRemember}
                        onChange={(event) => setCloudConfirmRemember(event.currentTarget.checked)}
                      />
                      <Group gap="xs">
                        <Button size="xs" variant="default" onClick={() => setCloudConfirmOpen(false)}>Cancel</Button>
                        <Button size="xs" leftSection={<Cloud size={14} />} onClick={confirmCloudAndSend}>Continue</Button>
                      </Group>
                    </Group>
                  </div>
                </Collapse>
                {pasteNotice ? <Text c="teal" size="sm">{pasteNotice}</Text> : null}
                <DayjobIngestionsList
                  ingestions={ingestions}
                  onDelete={async (id) => {
                    const response = await fetch(`/api/context/ingestions/${id}?mode=${mode}`, { method: "DELETE" });
                    if (!response.ok) return;
                    setIngestions((current) => current.filter((item) => item.id !== id));
                    setPasteNotice(`Deleted ingestion #${id}`);
                  }}
                />
                <Textarea
                  autosize
                  minRows={2}
                  maxRows={8}
                  value={draft}
                  disabled={disabled}
                  placeholder="Message Dayjob"
                  onChange={(event) => setDraft(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) sendMessage();
                  }}
                />
                {sendError ? <Text c="red" size="sm">{sendError}</Text> : null}
                <Group justify="space-between" mt="sm">
                  <Group gap="xs">
                    <ShieldCheck size={16} />
                    <Text size="sm" c="dimmed">No Dayjob message is written to the Lem teammate bus.</Text>
                  </Group>
                  <Button leftSection={<Send size={16} />} onClick={() => sendMessage()} disabled={!draft.trim() || disabled}>
                    Send
                  </Button>
                </Group>
              </div>
            </section>
          ) : (
            <section className="console">
              {readOnly && selectedSession ? (
                <div className="archiveSummary" data-testid="archive-summary">
                  <Group justify="space-between" wrap="nowrap">
                    <Badge color="gray" variant="light">archived</Badge>
                    <Text size="xs" c="dimmed">session #{selectedSession.id}</Text>
                  </Group>
                  <Text size="sm">{selectedSession.summary_excerpt || "No summary has been stored yet."}</Text>
                </div>
              ) : null}
              <ScrollArea viewportRef={viewport} className="messages" type="always">
                <Stack gap="sm" p="md">
                  {messages.length === 0 ? (
                    <Text c="dimmed">No recent Justin/Lem bus messages yet.</Text>
                  ) : (
                    messages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        mode="lem"
                        sessionId={selectedSessionId}
                        streaming={message.correlation_id ? streamingIds[message.correlation_id] : false}
                        onAskNext={handleCommandAskNext}
                        onCommandUpdated={async () => {
                          await loadHistory(selectedSessionId);
                          await refreshCommands(setCommandHistory, mode, {
                            sessionId: selectedSessionId,
                            taskTag: commandTaskFilter,
                            statuses: commandStatusFilter,
                            unscoped: commandsUnscoped
                          });
                        }}
                      />
                    ))
                  )}
                </Stack>
              </ScrollArea>
              <div className="composer">
                <Group justify="space-between" mb={6}>
                  <Group gap="xs">
                    <Badge color="blue">Lem</Badge>
                    <Text size="sm" c="dimmed">chat endpoint: teammate bus</Text>
                  </Group>
                </Group>
                {pasteNotice ? <Text c="teal" size="sm">{pasteNotice}</Text> : null}
                <DayjobIngestionsList
                  ingestions={ingestions}
                  onDelete={async (id) => {
                    const response = await fetch(`/api/context/ingestions/${id}?mode=${mode}`, { method: "DELETE" });
                    if (!response.ok) return;
                    setIngestions((current) => current.filter((item) => item.id !== id));
                    setPasteNotice(`Deleted ingestion #${id}`);
                  }}
                />
                <Textarea
                  autosize
                  minRows={2}
                  maxRows={8}
                  value={draft}
                  disabled={disabled || readOnly}
                  placeholder="Message Lem"
                  onChange={(event) => setDraft(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !readOnly) sendMessage();
                  }}
                />
                {sendError ? <Text c="red" size="sm">{sendError}</Text> : null}
                <Group justify="space-between" mt="sm">
                  <Group gap="xs">
                    <Bell size={16} />
                    <Text size="sm" c="dimmed">Replies can notify when this window is unfocused.</Text>
                  </Group>
                  <Button leftSection={<Send size={16} />} onClick={() => sendMessage()} disabled={!draft.trim() || disabled || readOnly}>
                    Send
                  </Button>
                </Group>
              </div>
            </section>
          )}
        </AppShell.Main>
      </AppShell>
      <SessionsPanel
        sessions={sessions}
        currentSessionId={currentSessionId}
        selectedSessionId={selectedSessionId}
        opened={sessionsOpen}
        onToggle={() => setSessionsOpen((open) => !open)}
        onSelect={(id) => {
          setSelectedSessionId(id);
          loadHistory(id);
        }}
        onNew={async () => {
          const response = await fetch(mode === "dayjob" ? "/api/dayjob/sessions" : "/api/sessions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({})
          });
          if (!response.ok) return;
          const payload = await response.json();
          await refreshSessions(payload.id);
          await loadHistory(payload.id);
        }}
        onCompact={async (id) => {
          if (!window.confirm("Compact and archive this chat?")) return;
          const response = await fetch(mode === "dayjob" ? `/api/dayjob/sessions/${id}/compact` : `/api/sessions/${id}/compact`, { method: "POST" });
          if (!response.ok) return;
          const payload = await response.json();
          await refreshSessions(payload.id);
          await loadHistory(payload.id);
        }}
        onPrune={async () => {
          const raw = window.prompt("Keep how many active sessions?", "10");
          if (raw === null) return;
          const keep = Number.parseInt(raw, 10);
          if (!Number.isFinite(keep) || keep < 0) return;
          if (!window.confirm(`Archive active sessions beyond the newest ${keep}?`)) return;
          await fetch(mode === "dayjob" ? "/api/dayjob/sessions/prune" : "/api/sessions/prune", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ keep_active: keep })
          });
          await refreshSessions();
        }}
        mode={mode}
        controlledTab={sessionPanelTab}
        onControlledTab={setSessionPanelTab}
        commands={commandHistory}
        commandTaskFilter={commandTaskFilter}
        commandStatusFilter={commandStatusFilter}
        commandsUnscoped={commandsUnscoped}
        onCommandTaskFilter={setCommandTaskFilter}
        onCommandStatusFilter={setCommandStatusFilter}
        onCommandsUnscoped={setCommandsUnscoped}
        onSelectCommand={async (command) => {
          if (command.session_id && command.session_id !== selectedSessionId) {
            setSelectedSessionId(command.session_id);
            await loadHistory(command.session_id);
          }
          window.setTimeout(() => {
            document.getElementById(`message-${command.message_id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 80);
        }}
      />
      <ActivityPanel
        events={activityEvents}
        opened={activityOpen ?? false}
        onToggle={() => {
          const next = !(activityOpen ?? false);
          setActivityOpen(next);
          persistActivityOpen(next);
        }}
      />
      <SettingsDrawer opened={drawerOpen} onClose={() => setDrawerOpen(false)} settings={settings} mode={mode} />
      <PasteIngestDrawer
        mode={mode}
        opened={ingestDrawerOpen}
        form={pasteForm}
        preview={pastePreview}
        imageFile={imageFile}
        imagePreviewUrl={imagePreviewUrl}
        imageResult={imageResult}
        imageManualDescription={imageManualDescription}
        imageNeedsManual={imageNeedsManual}
        imageIngestStage={imageIngestStage}
        visionHealth={dayjobHealth?.vision_endpoint_health ?? null}
        error={pasteError}
        busy={pasteBusy}
        onClose={() => setIngestDrawerOpen(false)}
        onChange={(updates) => {
          setPasteForm((current) => ({ ...current, ...updates }));
          setPastePreview(null);
          setPasteError(null);
        }}
        onImageSelected={(file) => {
          setImageFile(file);
          setImageResult(null);
          setImageNeedsManual(false);
          setImageManualDescription("");
          setPasteError(null);
        }}
        onImageManualDescription={setImageManualDescription}
        onPreview={previewPaste}
        onCommit={commitPaste}
        onCommitImage={commitImage}
      />
    </MantineProvider>
  );

  async function refreshSessions(preferredId?: number | null) {
    try {
      const response = await fetch(mode === "dayjob" ? "/api/dayjob/sessions" : "/api/sessions");
      if (!response.ok) return selectedSessionId;
      const payload = await response.json();
      const list: ChatSession[] = payload.sessions ?? [];
      const current = Number(payload.current_session_id ?? preferredId ?? null);
      setSessions(list);
      setCurrentSessionId(Number.isFinite(current) ? current : null);
      const next = preferredId ?? selectedSessionId ?? current;
      setSelectedSessionId(next);
      return next;
    } catch {
      setSessions([]);
      return selectedSessionId;
    }
  }

  async function loadHistory(sessionId?: number | null) {
    const suffix = sessionId ? `&session_id=${sessionId}` : "";
    const url = mode === "dayjob" ? `/api/dayjob/history?limit=50${suffix}` : `/api/history?limit=50${suffix}`;
    return fetch(url)
      .then((response) => response.json())
      .then((payload) => {
        if (mode === "dayjob") setDayjobMessages(payload.messages ?? []);
        else setMessages(payload.messages ?? []);
      })
      .catch(() => {
        if (mode === "dayjob") setDayjobMessages([]);
        else setMessages([]);
      });
  }

  async function refreshActivityForMode() {
    const url = mode === "dayjob" ? "/api/dayjob/activity?limit=25" : "/api/activity?limit=25";
    try {
      const response = await fetch(url);
      if (!response.ok) return;
      const payload = await response.json();
      const events = payload.events ?? [];
      setActivityEvents(events);
      activityMaxIdRef.current = maxActivityId(events);
    } catch {
      setActivityEvents([]);
    }
  }

  async function previewPaste() {
    if (!pasteForm.text.trim()) return;
    setPasteBusy(true);
    setPasteError(null);
    try {
      const response = await fetch("/api/context/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, text: pasteForm.text, source_type: pasteForm.source_type })
      });
      if (!response.ok) {
        setPasteError(await response.text());
        return;
      }
      setPastePreview(await response.json());
    } catch (err: unknown) {
      setPasteError(err instanceof Error ? err.message : String(err));
    } finally {
      setPasteBusy(false);
    }
  }

  async function commitPaste() {
    if (!pastePreview || !pasteForm.text.trim()) return;
    setPasteBusy(true);
    setPasteError(null);
    try {
      const response = await fetch("/api/context/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          text: pasteForm.text,
          source_type: pasteForm.source_type,
          task_tag: pasteForm.task_tag || null,
          repo_name: pasteForm.repo_name || null,
          file_path: pasteForm.file_path || null
        })
      });
      if (!response.ok) {
        setPasteError(await response.text());
        return;
      }
      const payload = await response.json();
      await refreshIngestions(setIngestions, mode);
      if (mode === "dayjob") await refreshDayjobStatus(setDayjobHealth, setDayjobTotals);
      setPasteNotice(`Committed ingestion #${payload.ingestion_id}`);
      setPasteForm({ text: "", source_type: "auto", task_tag: "", repo_name: "", file_path: "" });
      setPastePreview(null);
      setIngestDrawerOpen(false);
    } catch (err: unknown) {
      setPasteError(err instanceof Error ? err.message : String(err));
    } finally {
      setPasteBusy(false);
    }
  }

  async function commitImage() {
    if (!imageFile) return;
    setPasteBusy(true);
    setImageIngestStage("Preparing image...");
    setPasteError(null);
    let stageTimers: number[] = [];
    try {
      stageTimers = [
        window.setTimeout(() => setImageIngestStage("Reading text with OCR..."), 2000),
        window.setTimeout(() => setImageIngestStage("Asking vision model... can take about a minute on cold cache"), 8000)
      ];
      const body = new FormData();
      body.append("file", imageFile);
      body.append("mode", mode);
      if (pasteForm.task_tag.trim()) body.append("task_tag", pasteForm.task_tag.trim());
      if (imageManualDescription.trim()) body.append("manual_description", imageManualDescription.trim());
      const response = await fetch("/api/context/ingest/image", { method: "POST", body });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload?.detail?.needs_manual || payload?.needs_manual) setImageNeedsManual(true);
        setPasteError(typeof payload.detail === "string" ? payload.detail : JSON.stringify(payload.detail ?? payload));
        return;
      }
      setImageResult(payload);
      setImageIngestStage("Indexing for retrieval...");
      await refreshIngestions(setIngestions, mode);
      if (mode === "dayjob") await refreshDayjobStatus(setDayjobHealth, setDayjobTotals);
      const warning = payload.warnings?.length ? " with warning" : "";
      setPasteNotice(`Committed image ingestion #${payload.ingestion_id}${warning}`);
    } catch (err: unknown) {
      setPasteError(err instanceof Error ? err.message : String(err));
    } finally {
      stageTimers.forEach((timer) => window.clearTimeout(timer));
      setImageIngestStage(null);
      setPasteBusy(false);
    }
  }
}

function DashboardPanel({ dashboard, busy, mode, onRefresh }: { dashboard: DashboardPayload | null; busy: boolean; mode: Mode; onRefresh: () => void }) {
  const strategies = Object.entries(dashboard?.meta_cognition.strategy_distribution ?? {});
  const vivariumLevels = Object.entries(dashboard?.vivarium?.promotion_levels ?? {});
  return (
    <section className="dashboardPanel" data-testid="dashboard-panel">
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <Badge color={mode === "dayjob" ? "teal" : "blue"}>{mode === "dayjob" ? "Dayjob" : "Lem"}</Badge>
          <Text fw={700}>Dashboard</Text>
        </Group>
        <Button size="xs" variant="default" leftSection={<RefreshCw size={14} />} loading={busy} onClick={onRefresh}>Refresh</Button>
      </Group>
      {!dashboard ? <Text c="dimmed">Dashboard data unavailable.</Text> : (
        <div className="dashboardGrid">
          <DashboardCard title="Executor">
            <Text className="dashboardBig">{Math.round(dashboard.executor.match_rate_24h * 100)}%</Text>
            <Sparkline values={dashboard.executor.executed_sparkline ?? []} />
            <Text size="xs" c="dimmed">{dashboard.executor.experiment_executed_24h} executed · {dashboard.executor.executor_skipped_24h} skipped · {dashboard.executor.executor_no_match_24h} no match</Text>
          </DashboardCard>
          <DashboardCard title="Meta-cognition">
            <Text size="sm">Strategy: {dashboard.meta_cognition.last_strategy_recommended || "none"}</Text>
            <Text size="xs" c="dimmed">{dashboard.meta_cognition.meta_correction_24h} corrections · {dashboard.meta_cognition.meta_healthy_24h} healthy</Text>
            <div className="donut" style={{ ["--p" as string]: donutPercent(strategies) }} />
            <Text size="xs" c="dimmed">{strategies.map(([key, count]) => `${key} ${count}`).join(" · ") || "No strategies"}</Text>
          </DashboardCard>
          <DashboardCard title="Reflection">
            <Text className="dashboardBig">{dashboard.reflection.cycles_24h}</Text>
            <Text size="xs" c="dimmed">avg {dashboard.reflection.avg_cycle_duration_seconds}s</Text>
            {dashboard.reflection.top_chosen_focus.map((item) => <Text key={item.focus} size="xs">{item.focus} · {item.count}</Text>)}
          </DashboardCard>
          <DashboardCard title="Auto-Research">
            <Text size="sm" className="clipText">{dashboard.auto_research?.today?.status ?? "idle"}</Text>
            <Text size="xs" c="dimmed" className="clipText">{dashboard.auto_research?.current_hypothesis_card?.title ?? "no active card"}</Text>
            <Text size="xs" c="dimmed">{dashboard.auto_research?.last_3_sessions?.length ?? 0} sessions · {dashboard.auto_research?.pending_yellow_proposals?.length ?? 0} yellow pending</Text>
            {(dashboard.auto_research?.last_3_sessions ?? []).slice(0, 3).map((session) => (
              <Text key={session.session_id ?? "session"} size="xs" className="clipText">
                {session.session_id ?? "session"} · {session.cards?.[0]?.outcome?.decision ?? session.status ?? "pending"}
              </Text>
            ))}
          </DashboardCard>
          <DashboardCard title="Vivarium">
            <Text className="dashboardBig">{dashboard.vivarium?.agent_count ?? 0}</Text>
            <Text size="xs" c="dimmed" className="clipText">top: {dashboard.vivarium?.top_agent?.agent_id ?? "none"} · {dashboard.vivarium?.top_agent?.promotion_level ?? "seeded"}</Text>
            <Text size="xs" c="dimmed">{dashboard.vivarium?.top_agent?.solved_challenges ?? 0} solved · {dashboard.vivarium?.top_agent?.model_calls ?? 0} calls · {dashboard.vivarium?.top_agent?.tool_calls ?? 0} tools</Text>
            <Text size="xs" c="dimmed" className="clipText">next: {dashboard.vivarium?.top_agent?.next_gate ?? "seed first agent"}</Text>
            <Text size="xs" c="dimmed">{vivariumLevels.map(([key, count]) => `${key} ${count}`).join(" · ") || "No lineages"}</Text>
          </DashboardCard>
          <DashboardCard title="Vision">
            <Text size="sm" className="clipText">{dashboard.vision.model}</Text>
            <Text size="xs" c="dimmed" className="clipText">{dashboard.vision.capture_loop_heartbeat ?? dashboard.vision.endpoint}</Text>
            <Progress value={dashboard.vision.uptime_pct_1h} size="sm" mt="xs" />
            <Text size="xs" c="dimmed">{dashboard.vision.vlm_route_status ?? "pending"} · frame age {dashboard.vision.last_frame_age_seconds ?? "n/a"}s</Text>
            <Text size="xs" c="dimmed">{dashboard.vision.events_per_hour ?? 0} events/h · {dashboard.vision.vlm_calls_per_hour ?? 0} VLM/h · {dashboard.vision.parse_repaired_count ?? 0} repaired</Text>
            <Text size="xs" c="dimmed">{dashboard.vision.active_predicates_count ?? 0} active · {dashboard.vision.proposed_predicates_count ?? 0} proposed predicates</Text>
          </DashboardCard>
          <DashboardCard title="Engagement">
            <Text className="dashboardBig">{dashboard.engagement.messages_initiated_24h}</Text>
            <Text size="xs" c="dimmed">{dashboard.engagement.overrides_used_24h} overrides · window {dashboard.engagement.current_window_active ? "active" : "idle"}</Text>
          </DashboardCard>
          <DashboardCard title="CTX watchdog">
            <Text className="dashboardBig">{dashboard.ctx_watchdog.current_ctx || 0}</Text>
            <Text size="xs" c="dimmed">last: {dashboard.ctx_watchdog.last_decision || "none"}</Text>
            <Text size="xs" c="dimmed">{dashboard.ctx_watchdog.decisions_24h.length} decisions</Text>
          </DashboardCard>
        </div>
      )}
    </section>
  );
}

function DashboardCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="dashboardCard" data-testid="dashboard-card">
      <Text size="sm" fw={700}>{title}</Text>
      {children}
    </article>
  );
}

function TeammateGrid({ teammates }: { teammates: Teammate[] }) {
  return (
    <section className="teammateDemo" data-testid="teammate-demo">
      <Group justify="space-between" className="teammateDemoHeader" wrap="nowrap">
        <div>
          <Text size="xs" tt="uppercase" className="teammateKicker">Team Presence</Text>
          <Text fw={700} className="teammateTitle">Current Teammate State</Text>
        </div>
        <Badge variant="outline" color="gray">{teammates.length} cells</Badge>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="xs" className="teammateGrid">
        {teammates.map((teammate) => (
          <HeartbeatTile teammate={teammate} key={teammate.id} />
        ))}
      </SimpleGrid>
    </section>
  );
}

function LiveInboxPanel({ messages, path }: { messages: LiveInboxMessage[]; path: string }) {
  return (
    <section className="liveInboxPanel" data-testid="live-inbox-panel">
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <Inbox size={18} />
          <Text fw={700}>Live Inbox</Text>
          <Badge color="teal">{messages.length}</Badge>
        </Group>
        <Text size="xs" c="dimmed" className="clipText">{path || "~/.lem/live-inbox.jsonl"}</Text>
      </Group>
      <ScrollArea className="liveInboxList" type="always">
        <Stack gap="sm" p="xs">
          {messages.length === 0 ? (
            <Text c="dimmed">No live inbox messages yet.</Text>
          ) : (
            messages.map((message) => (
              <article className="liveInboxRow" key={message.id}>
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap">
                    <Badge color={message.severity === "error" ? "red" : message.severity === "warn" ? "yellow" : "blue"}>{message.severity || "info"}</Badge>
                    <Text size="sm" fw={700}>{message.from || "unknown"} -&gt; {message.to || "all"}</Text>
                  </Group>
                  <Text size="xs" c="dimmed">{message.ts || `#${message.id}`}</Text>
                </Group>
                <Text size="xs" c="dimmed">{message.channel || "live/status"}{message.source ? ` · ${message.source}` : ""}</Text>
                <Text className="liveInboxSummary" size="sm">{message.summary || message.body || ""}</Text>
                {message.body && message.body !== message.summary ? <pre className="liveInboxBody">{message.body}</pre> : null}
              </article>
            ))
          )}
        </Stack>
      </ScrollArea>
    </section>
  );
}

function DayjobEmptyState({
  onIngest,
  onCommands,
  onDashboard
}: {
  onIngest: () => void;
  onCommands: () => void;
  onDashboard: () => void;
}) {
  return (
    <div className="dayjobEmptyState" data-testid="dayjob-empty-state">
      <Text size="sm" fw={700}>Workspaces loop</Text>
      <Text size="sm" c="dimmed">Capture -&gt; Ingest -&gt; Ask -&gt; Run -&gt; Paste -&gt; Ask next.</Text>
      <Group gap="xs" mt="xs">
        <Button size="xs" variant="light" leftSection={<ImageIcon size={14} />} onClick={onIngest}>
          Ingest screenshot/paste
        </Button>
        <Button size="xs" variant="default" leftSection={<TerminalSquare size={14} />} onClick={onCommands}>
          Show commands
        </Button>
        <Button size="xs" variant="default" leftSection={<Database size={14} />} onClick={onDashboard}>
          Open dashboard
        </Button>
      </Group>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="sparkline" aria-hidden="true">
      {(values.length ? values : new Array(24).fill(0)).map((value, index) => (
        <span key={index} style={{ height: `${Math.max(12, (value / max) * 100)}%` }} />
      ))}
    </div>
  );
}

function donutPercent(entries: Array<[string, number]>) {
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return total ? `${Math.round((entries[0][1] / total) * 100)}%` : "0%";
}

function DayjobStatusDrawer({
  health,
  totals,
  modeStatus
}: {
  health: DayjobHealthPayload | null;
  totals: StorageTotals;
  modeStatus?: ModeStatusPayload["modes"][number];
}) {
  const warnings = [
    health?.workspace_ok === false ? "workspace check failed" : null,
    health?.schema_ok === false ? "schema check failed" : null,
    health?.firewall_ok === false ? "firewall check failed" : null,
    health?.vision_endpoint_health?.ok === false ? `vision endpoint ${health.vision_endpoint_health.status ?? "unreachable"}` : null,
    health?.failure_reason || modeStatus?.failure_reason || null
  ].filter(Boolean);
  const storage = Object.entries(totals).filter(([key]) => key !== "total");
  return (
    <div className="dayjobStatus" data-testid="dayjob-status">
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <Badge color={health?.firewall_ok ? "teal" : "red"} variant="light">firewall</Badge>
          <Badge color={health?.schema_ok ? "green" : "yellow"} variant="light">schema</Badge>
          <Badge color={health?.workspace_ok ? "green" : "yellow"} variant="light">workspace</Badge>
        </Group>
        <Text size="xs" c="dimmed">storage {formatBytes(totals.total ?? 0)}</Text>
      </Group>
      <div className="storageGrid">
        {storage.map(([kind, bytes]) => (
          <div key={kind} className="storageCell">
            <Text size="xs" c="dimmed">{kind}</Text>
            <Text size="sm">{formatBytes(bytes)}</Text>
          </div>
        ))}
      </div>
      {warnings.length ? (
        <Stack gap={2} mt={6}>
          {warnings.map((warning) => <Text key={warning} size="xs" c="yellow">{warning}</Text>)}
        </Stack>
      ) : null}
    </div>
  );
}

function SessionsPanel({
  sessions,
  currentSessionId,
  selectedSessionId,
  opened,
  onToggle,
  onSelect,
  onNew,
  onCompact,
  onPrune,
  mode,
  controlledTab,
  onControlledTab,
  commands,
  commandTaskFilter,
  commandStatusFilter,
  commandsUnscoped,
  onCommandTaskFilter,
  onCommandStatusFilter,
  onCommandsUnscoped,
  onSelectCommand
}: {
  sessions: ChatSession[];
  currentSessionId: number | null;
  selectedSessionId: number | null;
  opened: boolean;
  onToggle: () => void;
  onSelect: (id: number) => void;
  onNew: () => void;
  onCompact: (id: number) => void;
  onPrune: () => void;
  mode: Mode;
  controlledTab: "sessions" | "commands";
  onControlledTab: (value: "sessions" | "commands") => void;
  commands: CommandRecord[];
  commandTaskFilter: string;
  commandStatusFilter: string[];
  commandsUnscoped: boolean;
  onCommandTaskFilter: (value: string) => void;
  onCommandStatusFilter: (value: string[]) => void;
  onCommandsUnscoped: (value: boolean) => void;
  onSelectCommand: (command: CommandRecord) => void;
}) {
  const tab = controlledTab;
  const setTab = onControlledTab;
  return (
    <aside className={`sessionsPanel ${opened ? "open" : "closed"}`} data-testid="sessions-panel">
      <Tooltip label={opened ? "Collapse sessions" : "Expand sessions"}>
        <ActionIcon className="sessionsToggle" aria-label="Toggle sessions panel" variant="filled" onClick={onToggle}>
          <PanelLeft size={18} />
        </ActionIcon>
      </Tooltip>
      {opened ? (
        <div className="sessionsBody">
          <Group justify="space-between" className="sessionsHeader" wrap="nowrap">
            <Group gap="xs" wrap="nowrap">
              {mode === "dayjob" ? (
                <SegmentedControl
                  size="xs"
                  value={tab}
                  onChange={(value) => setTab(value as "sessions" | "commands")}
                  data={[
                    { value: "sessions", label: "Sessions" },
                    { value: "commands", label: "Commands" }
                  ]}
                />
              ) : (
                <>
                  <PanelLeft size={16} />
                  <Text fw={700} size="sm">Sessions</Text>
                </>
              )}
            </Group>
            {mode !== "dayjob" || tab === "sessions" ? <Group gap={4} wrap="nowrap">
              <Tooltip label="New chat">
                <ActionIcon aria-label="New chat" variant="default" onClick={onNew}>
                  <Plus size={16} />
                </ActionIcon>
              </Tooltip>
              {currentSessionId ? (
                <Tooltip label="Compact this chat">
                  <ActionIcon aria-label="Compact this chat" variant="default" onClick={() => onCompact(currentSessionId)}>
                    <Archive size={16} />
                  </ActionIcon>
                </Tooltip>
              ) : null}
              <Tooltip label="Prune older sessions">
                <ActionIcon aria-label="Prune older sessions" variant="default" onClick={onPrune}>
                  <Trash2 size={16} />
                </ActionIcon>
              </Tooltip>
            </Group> : null}
          </Group>
          {tab === "commands" ? (
            <CommandHistoryPanel
              commands={commands}
              taskFilter={commandTaskFilter}
              statusFilter={commandStatusFilter}
              unscoped={commandsUnscoped}
              onTaskFilter={onCommandTaskFilter}
              onStatusFilter={onCommandStatusFilter}
              onUnscoped={onCommandsUnscoped}
              onSelect={onSelectCommand}
            />
          ) : (
            <ScrollArea className="sessionsList" type="auto">
              <Stack gap="xs" p="xs">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    className={`sessionRow ${session.id === selectedSessionId ? "selected" : ""}`}
                    onClick={() => onSelect(session.id)}
                    data-testid="session-row"
                  >
                    <Group justify="space-between" gap="xs" wrap="nowrap">
                      <Text size="sm" fw={600} className="sessionLabel">{session.label || `Session ${session.id}`}</Text>
                      <Badge color={session.status === "active" ? "green" : "gray"} variant="light">{session.status}</Badge>
                    </Group>
                    <Text size="xs" c="dimmed">{session.message_count} messages</Text>
                  </button>
                ))}
              </Stack>
            </ScrollArea>
          )}
        </div>
      ) : null}
    </aside>
  );
}

function CommandHistoryPanel({
  commands,
  taskFilter,
  statusFilter,
  unscoped,
  onTaskFilter,
  onStatusFilter,
  onUnscoped,
  onSelect
}: {
  commands: CommandRecord[];
  taskFilter: string;
  statusFilter: string[];
  unscoped: boolean;
  onTaskFilter: (value: string) => void;
  onStatusFilter: (value: string[]) => void;
  onUnscoped: (value: boolean) => void;
  onSelect: (command: CommandRecord) => void;
}) {
  return (
    <div className="commandHistoryPanel" data-testid="command-history-panel">
      <Stack gap="xs" p="xs">
        <TextInput
          size="xs"
          label="Task tag"
          value={taskFilter}
          onChange={(event) => onTaskFilter(event.currentTarget.value)}
        />
        <MultiSelect
          size="xs"
          label="Status"
          value={statusFilter}
          onChange={onStatusFilter}
          data={[
            { value: "pending", label: "pending" },
            { value: "running", label: "running" },
            { value: "completed", label: "completed" },
            { value: "failed", label: "failed" }
          ]}
        />
        <Checkbox
          size="xs"
          label="Unscoped view"
          checked={unscoped}
          onChange={(event) => onUnscoped(event.currentTarget.checked)}
        />
      </Stack>
      <ScrollArea className="commandHistoryList" type="auto">
        <Stack gap="xs" p="xs" pt={0}>
          {commands.length === 0 ? <Text size="sm" c="dimmed">No commands yet.</Text> : null}
          {commands.map((command) => (
            <button
              key={command.id}
              className="commandHistoryRow"
              data-testid="command-history-row"
              onClick={() => onSelect(command)}
            >
              <Group justify="space-between" gap="xs" wrap="nowrap">
                <CommandStatusBadge status={command.status} />
                <Text size="xs" c="dimmed">#{command.id}</Text>
              </Group>
              {command.task_tag ? <Badge mt={6} color="blue" variant="light">{command.task_tag}</Badge> : null}
              <Text size="xs" className="commandHistoryText">{command.command_text}</Text>
            </button>
          ))}
        </Stack>
      </ScrollArea>
    </div>
  );
}

const ACTIVITY_FILTERS = [
  { value: "all", label: "All" },
  { value: "executor", label: "Executor" },
  { value: "meta", label: "Meta" },
  { value: "reflection", label: "Reflection" },
  { value: "vision", label: "Vision" }
];

function ActivityPanel({ events, opened, onToggle }: { events: ActivityEvent[]; opened: boolean; onToggle: () => void }) {
  const [filter, setFilter] = useState("all");
  const visibleEvents = events.filter((event) => activityFilterMatches(event.event, filter));
  return (
    <aside className={`activityPanel ${opened ? "open" : "closed"}`} data-testid="activity-panel">
      <Tooltip label={opened ? "Collapse activity" : "Expand activity"}>
        <ActionIcon className="activityToggle" aria-label="Toggle activity panel" variant="filled" onClick={onToggle}>
          {opened ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </ActionIcon>
      </Tooltip>
      {opened ? (
        <div className="activityBody">
          <Group gap="xs" className="activityHeader">
            <Activity size={16} />
            <Text fw={700} size="sm">Activity</Text>
          </Group>
          <SegmentedControl
            className="activityFilters"
            size="xs"
            value={filter}
            onChange={setFilter}
            data={ACTIVITY_FILTERS}
          />
          <ScrollArea className="activityList" type="auto">
            <Stack gap="xs" p="xs">
              {visibleEvents.length === 0 ? (
                <Text size="sm" c="dimmed">No activity yet.</Text>
              ) : (
                [...visibleEvents].reverse().map((event) => <ActivityRow key={event.id} event={event} />)
              )}
            </Stack>
          </ScrollArea>
        </div>
      ) : null}
    </aside>
  );
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const timeLabel = event.created_at_ts
    ? new Date(event.created_at_ts * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;
  return (
    <article className="activityRow" data-testid="activity-event">
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Badge color="teal" variant="light">{event.event}</Badge>
        <Group gap={4}>
          {timeLabel ? <Text size="xs" c="dimmed">{timeLabel}</Text> : null}
          <Text size="xs" c="dimmed">#{event.id}</Text>
        </Group>
      </Group>
      {event.focus ? <Text size="xs" c="dimmed" className="activityFocus">{event.focus}</Text> : null}
      <Text size="sm" className="activitySummary">{event.summary}</Text>
    </article>
  );
}

function DayjobIngestionsList({ ingestions, onDelete }: { ingestions: DayjobIngestion[]; onDelete: (id: number) => void }) {
  return (
    <div className="ingestionsPanel" data-testid="dayjob-ingestions">
      <Group justify="space-between" mb={6} wrap="nowrap">
        <Text size="sm" fw={700}>Ingestions</Text>
        <Badge color="gray" variant="light">{ingestions.length}</Badge>
      </Group>
      {ingestions.length === 0 ? (
        <Text size="sm" c="dimmed">No ingestions yet.</Text>
      ) : (
        <Stack gap="xs">
          {ingestions.map((item) => (
            <article key={item.id} className="ingestionRow" data-testid="ingestion-row">
              <Group justify="space-between" gap="xs" wrap="nowrap">
                <Group gap="xs" wrap="nowrap" className="ingestionTitle">
                  <Badge color="teal" variant="light">{item.source_type}</Badge>
                  {item.scope ? <Badge color="gray" variant="light">{item.scope}</Badge> : null}
                  {item.task_tag ? <Badge color="blue" variant="light">{item.task_tag}</Badge> : null}
                  {Array.isArray(item.metadata?.warnings) && item.metadata.warnings.includes("vision_local_pending") ? (
                    <Badge color="yellow" variant="light">manual vision</Badge>
                  ) : null}
                  <Text size="sm" fw={600} truncate>{item.title || `Ingestion ${item.id}`}</Text>
                </Group>
                <Group gap={6} wrap="nowrap">
                  <Text size="xs" c="dimmed">{formatBytes(item.byte_count)}</Text>
                  <Tooltip label="Delete ingestion">
                    <ActionIcon aria-label={`Delete ingestion ${item.id}`} size="sm" variant="subtle" color="red" onClick={() => onDelete(item.id)}>
                      <Trash2 size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
              <Text size="xs" c="dimmed">#{item.id} · {item.chunk_count} chunk{item.chunk_count === 1 ? "" : "s"}</Text>
            </article>
          ))}
        </Stack>
      )}
    </div>
  );
}

function PasteIngestDrawer({
  mode,
  opened,
  form,
  preview,
  imageFile,
  imagePreviewUrl,
  imageResult,
  imageManualDescription,
  imageNeedsManual,
  imageIngestStage,
  visionHealth,
  error,
  busy,
  onClose,
  onChange,
  onImageSelected,
  onImageManualDescription,
  onPreview,
  onCommit,
  onCommitImage
}: {
  mode: Mode;
  opened: boolean;
  form: PasteForm;
  preview: DayjobPreviewPayload | null;
  imageFile: File | null;
  imagePreviewUrl: string | null;
  imageResult: ImageIngestResult | null;
  imageManualDescription: string;
  imageNeedsManual: boolean;
  imageIngestStage: string | null;
  visionHealth: DayjobHealthPayload["vision_endpoint_health"] | null;
  error: string | null;
  busy: boolean;
  onClose: () => void;
  onChange: (updates: Partial<PasteForm>) => void;
  onImageSelected: (file: File | null) => void;
  onImageManualDescription: (value: string) => void;
  onPreview: () => void;
  onCommit: () => void;
  onCommitImage: () => void;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const acceptImage = (file?: File | null) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) return;
    onImageSelected(file);
  };
  const pasteClipboardImage = async () => {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((value) => ["image/png", "image/jpeg", "image/webp"].includes(value));
      if (type) {
        acceptImage(new File([await item.getType(type)], `clipboard.${type.split("/")[1]}`, { type }));
        return;
      }
    }
  };
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="lg"
      title={mode === "dayjob" ? "Ingest Workspaces Context" : "Add Local Context"}
    >
      <Stack gap="sm">
        <Textarea
          data-testid="paste-text"
          label="Paste"
          minRows={10}
          autosize
          value={form.text}
          onChange={(event) => onChange({ text: event.currentTarget.value })}
        />
        <Select
          label="Source type"
          data={SOURCE_OPTIONS}
          value={form.source_type}
          onChange={(value) => onChange({ source_type: value || "auto" })}
        />
        <Group grow>
          <TextInput label="Task tag" value={form.task_tag} onChange={(event) => onChange({ task_tag: event.currentTarget.value })} />
          <TextInput label="Repo" value={form.repo_name} onChange={(event) => onChange({ repo_name: event.currentTarget.value })} />
        </Group>
        <TextInput label="File path" value={form.file_path} onChange={(event) => onChange({ file_path: event.currentTarget.value })} />
        <div
          className="imageDropZone"
          data-testid="image-drop-zone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            acceptImage(event.dataTransfer.files.item(0));
          }}
          onPaste={(event) => acceptImage(Array.from(event.clipboardData.files).find((file) => file.type.startsWith("image/")))}
          tabIndex={0}
        >
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(event) => acceptImage(event.currentTarget.files?.item(0))}
          />
          <Group justify="space-between" gap="xs" wrap="nowrap">
            <Group gap="xs" wrap="nowrap">
              <ImageIcon size={18} />
              <Text size="sm" fw={600}>Image</Text>
              <Text size="xs" c="dimmed">PNG/JPEG/WebP · 10MB max</Text>
              <Badge size="xs" color={visionHealth?.ok === false ? "yellow" : "green"} variant="light">
                vision {visionHealth?.ok === false ? (visionHealth.status ?? "degraded") : "reachable"}
              </Badge>
              {visionHealth?.retired ? <Text size="xs" c="yellow">Vision capability pending re-establishment</Text> : null}
            </Group>
            <Group gap="xs" wrap="nowrap">
              <Tooltip label="Choose image">
                <ActionIcon aria-label="Choose image" variant="subtle" onClick={() => imageInputRef.current?.click()}>
                  <Upload size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Paste image from clipboard">
                <ActionIcon aria-label="Paste image from clipboard" variant="subtle" onClick={() => pasteClipboardImage().catch(() => undefined)}>
                  <Clipboard size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
          {imageFile ? (
            <Group className="imagePreviewRow" gap="sm" wrap="nowrap">
              {imagePreviewUrl ? <img src={imagePreviewUrl} alt="" className="imagePreviewThumb" /> : null}
              <Stack gap={2} className="imagePreviewMeta">
                <Text size="sm" fw={600} truncate>{imageFile.name}</Text>
                <Text size="xs" c="dimmed">{formatBytes(imageFile.size)}</Text>
                {imageResult ? <Text size="xs" c="dimmed">{imageResult.chunk_count ?? 0} chunk{imageResult.chunk_count === 1 ? "" : "s"}</Text> : null}
              </Stack>
              {imageResult?.warnings?.includes("vision_local_pending") ? <Badge color="yellow" variant="light">manual vision</Badge> : null}
            </Group>
          ) : null}
          {imageIngestStage ? (
            <div className="imageIngestProgress" data-testid="image-ingest-progress">
              <Progress value={imageIngestProgressValue(imageIngestStage)} size="xs" color="teal" />
              <Text size="xs" c="dimmed">{imageIngestStage}</Text>
            </div>
          ) : null}
        </div>
        {imageNeedsManual || visionHealth?.retired ? (
          <Textarea
            label="Manual description"
            minRows={3}
            value={imageManualDescription}
            onChange={(event) => onImageManualDescription(event.currentTarget.value)}
          />
        ) : null}
        {error ? <Text c="red" size="sm">{error}</Text> : null}
        <Group justify="flex-end">
          <Button variant="default" onClick={onCommitImage} loading={busy} disabled={!imageFile || (imageNeedsManual && !imageManualDescription.trim())}>
            Ingest Image
          </Button>
          <Button variant="default" onClick={onPreview} loading={busy} disabled={!form.text.trim()}>
            Preview
          </Button>
          <Button onClick={onCommit} loading={busy} disabled={!preview}>
            Commit
          </Button>
        </Group>
        {preview ? <PastePreview preview={preview} /> : null}
      </Stack>
    </Drawer>
  );
}

function PastePreview({ preview }: { preview: DayjobPreviewPayload }) {
  return (
    <div className="pastePreview" data-testid="paste-preview">
      <Group gap="xs" mb={6}>
        <Badge color="teal">{preview.detected_source_type}</Badge>
        <Badge color={preview.would_attach ? "yellow" : "gray"} variant="light">
          {preview.would_attach ? "attachment" : "inline"}
        </Badge>
      </Group>
      <Stack gap={4}>
        {preview.chunks_preview.map((chunk) => (
          <Group key={chunk.index} justify="space-between" gap="xs" wrap="nowrap">
            <Text size="sm" className="chunkLabel">{chunk.label}</Text>
            <Text size="xs" c="dimmed">{formatBytes(chunk.byte_count)}</Text>
          </Group>
        ))}
      </Stack>
      <pre className="previewText">{preview.normalized_text.slice(0, 2400)}</pre>
    </div>
  );
}

function EngagementBadge({ engagement, onStop }: { engagement: EngagementState | null; onStop: () => void }) {
  const active = engagement?.active || engagement?.is_active;
  if (!active) return null;
  const label = engagement?.expires_at ? `ACTIVE ${formatRemaining(engagement.expires_at)}` : "ENGAGED";
  return (
    <Tooltip label="Lem may proactively message you. Click to toggle off.">
      <Badge
        component="button"
        color="teal"
        variant="filled"
        className="engagementBadge"
        onClick={onStop}
        aria-label="Stop engagement window"
      >
        {label}
      </Badge>
    </Tooltip>
  );
}

function MessageBubble({
  message,
  streaming = false,
  mode = "lem",
  sessionId,
  dayjobRoute = "local",
  onAskNext,
  onCommandUpdated
}: {
  message: ChatMessage;
  streaming?: boolean;
  mode?: Mode;
  sessionId?: number | null;
  dayjobRoute?: DayjobRoute;
  onAskNext?: (next: DayjobSendPayload | null | undefined) => void | Promise<void>;
  onCommandUpdated?: () => void;
}) {
  const mine = message.role === "justin";
  const [commands, setCommands] = useState<CommandRecord[]>([]);
  const label = mode === "dayjob"
    ? (mine ? "Justin" : "Dayjob")
    : message.is_autonomous && message.sender === "lem"
    ? "🤖 [Lem]"
    : message.relayed_from
      ? `🤖 [${message.sender_label || message.sender || message.role}]`
      : mine ? "Justin" : "Lem";
  useEffect(() => {
    if (mine || message.id <= 0) {
      setCommands([]);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({ mode, message_id: String(message.id), limit: "20" });
    if (sessionId) params.set("session_id", String(sessionId));
    fetch(`/api/commands?${params.toString()}`)
      .then((response) => response.ok ? response.json() : { commands: [] })
      .then((payload) => {
        if (!cancelled) setCommands(payload.commands ?? []);
      })
      .catch(() => {
        if (!cancelled) setCommands([]);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, mine, message.id, sessionId]);

  return (
    <article className={`bubble ${mine ? "mine" : "theirs"}`} data-testid={`message-${message.role}`} id={`message-${message.id}`}>
      <Group justify="space-between" gap="xs">
        <Group gap="xs">
          <Badge variant="light" color={mine ? "blue" : "green"}>{label}</Badge>
          {message.is_autonomous ? (
            <Tooltip label="Lem initiated this without being asked">
              <Badge color="violet" variant="light">autonomous</Badge>
            </Tooltip>
          ) : null}
          {message.relayed_to ? <RelayBadge channel={message.relayed_to} /> : null}
          {message.relayed_from ? <Badge color="gray" variant="light">relayed from {message.relayed_from}</Badge> : null}
          {streaming ? <Badge color="teal" variant="light">streaming</Badge> : null}
          {mode === "dayjob" ? <DayjobRouteBadge message={message} /> : null}
          {mode === "dayjob" && !mine && message.context_pack_id ? <ContextPackBadge message={message} /> : null}
        </Group>
        <Text size="xs" c="dimmed">#{message.id}</Text>
      </Group>
      <Tooltip label={message.text} disabled={message.text.length < 240} multiline maw={520}>
        <Text className="messageText">{message.text}</Text>
      </Tooltip>
      {commands.length ? (
        <Stack gap="xs" mt="sm">
          {commands.map((command) => (
            <CommandBlock
              key={command.id}
              initialCommand={command}
              mode={mode}
              dayjobRoute={dayjobRoute}
              onAskNext={onAskNext}
              onUpdated={() => {
                const params = new URLSearchParams({ mode, message_id: String(message.id), limit: "20" });
                if (sessionId) params.set("session_id", String(sessionId));
                fetch(`/api/commands?${params.toString()}`)
                  .then((response) => response.ok ? response.json() : { commands: [] })
                  .then((payload) => setCommands(payload.commands ?? []))
                  .catch(() => undefined);
                onCommandUpdated?.();
              }}
            />
          ))}
        </Stack>
      ) : null}
      <Text size="xs" c="dimmed">{message.channel}</Text>
    </article>
  );
}

function CommandBlock({
  initialCommand,
  mode,
  dayjobRoute,
  onAskNext,
  onUpdated
}: {
  initialCommand: CommandRecord;
  mode: Mode;
  dayjobRoute: DayjobRoute;
  onAskNext?: (next: DayjobSendPayload | null | undefined) => void | Promise<void>;
  onUpdated: () => void;
}) {
  const [command, setCommand] = useState(initialCommand);
  const [output, setOutput] = useState(initialCommand.pasted_output || "");
  const [status, setStatus] = useState<CommandStatus>(initialCommand.status === "failed" ? "failed" : "completed");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCommand(initialCommand);
    setOutput(initialCommand.pasted_output || "");
  }, [initialCommand]);

  async function submit(askNext: boolean) {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/commands/${command.id}/output`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, pasted_output: output, status, ask_next: askNext, route: dayjobRoute })
      });
      if (!response.ok) return;
      const payload = await response.json();
      setCommand(payload.command);
      onUpdated();
      if (askNext) await onAskNext?.(payload.next);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="commandBlock" data-testid="command-block">
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <TerminalSquare size={16} />
          <CommandStatusBadge status={command.status} />
          {command.task_tag ? <Badge color="blue" variant="light">{command.task_tag}</Badge> : null}
        </Group>
        <Button
          size="xs"
          variant="default"
          leftSection={<Clipboard size={14} />}
          onClick={async () => {
            await navigator.clipboard.writeText(command.command_text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </Group>
      <pre className="commandCode">{command.command_text}</pre>
      {command.pasted_output ? (
        <div className="commandOutputPreview">
          <Text size="xs" c="dimmed">Pasted output</Text>
          <pre>{command.pasted_output.slice(0, 1600)}</pre>
          {command.analysis_message_id ? (
            <Text size="xs" c="dimmed">analysis follow-up #{command.analysis_message_id}</Text>
          ) : null}
        </div>
      ) : (
        <Stack gap="xs">
          <Textarea
            data-testid="command-output"
            label="Run in Workspaces, paste output here"
            minRows={3}
            autosize
            value={output}
            onChange={(event) => setOutput(event.currentTarget.value)}
          />
          <Group justify="space-between" gap="xs">
            <Select
              aria-label="Command status"
              size="xs"
              w={140}
              value={status}
              onChange={(value) => setStatus((value as CommandStatus) || "completed")}
              data={[
                { value: "completed", label: "completed" },
                { value: "failed", label: "failed" }
              ]}
            />
            <Group gap="xs" wrap="nowrap">
              <Button size="xs" variant="default" onClick={() => submit(false)} loading={submitting}>
                Save Output Only
              </Button>
              <Button size="xs" onClick={() => submit(true)} loading={submitting}>
                Submit + Ask Next
              </Button>
            </Group>
          </Group>
        </Stack>
      )}
    </div>
  );
}

function imageIngestProgressValue(stage: string): number {
  if (stage.startsWith("Reading")) return 36;
  if (stage.startsWith("Asking")) return 68;
  if (stage.startsWith("Indexing")) return 88;
  return 18;
}

function CommandStatusBadge({ status }: { status: CommandStatus }) {
  const color = status === "completed" ? "green" : status === "failed" ? "red" : status === "running" ? "blue" : "yellow";
  return <Badge color={color} variant="light">{status}</Badge>;
}

function ContextPackBadge({ message }: { message: ChatMessage }) {
  const [open, setOpen] = useState(false);
  const [pack, setPack] = useState<ContextPackPayload | null>(null);
  const summary = message.context_summary;
  const label = `Used ${summary?.chunk_count ?? 0} chunks from ${summary?.source_count ?? 0} sources`;
  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !pack && message.context_pack_id) {
      const response = await fetch(`/api/dayjob/context-packs/${message.context_pack_id}`);
      if (response.ok) setPack(await response.json());
    }
  }
  return (
    <span className="contextPack">
      <Badge component="button" color="grape" variant="light" onClick={toggle}>{label}</Badge>
      <Collapse in={open}>
        <Stack gap={4} mt={4}>
          {(pack?.chunks ?? []).map((chunk) => (
            <Text key={chunk.id} size="xs" c="dimmed" className="contextSource">
              {chunk.provenance || chunk.file_path || chunk.source_type} · {(chunk.text || "").slice(0, 140)}
            </Text>
          ))}
          {!pack?.chunks?.length ? (summary?.sources ?? []).map((source) => <Text key={source} size="xs" c="dimmed">{source}</Text>) : null}
        </Stack>
      </Collapse>
    </span>
  );
}

function DayjobRouteBadge({ message }: { message: ChatMessage }) {
  const route = (message.route || "local").toLowerCase();
  const model = simplifyModelName(message.model_used || (route === "cloud" ? "claude-opus-4-6" : "Qwen3-Coder-Next"));
  if (route === "cloud" && message.degraded) {
    return <Badge color="yellow" variant="light">CLOUD ⚠ degraded → {model}</Badge>;
  }
  if (route === "cloud") {
    return <Badge color="cyan" variant="light">CLOUD → {model}</Badge>;
  }
  return <Badge color="teal" variant="light">LOCAL → {model}</Badge>;
}

function RelayBadge({ channel }: { channel: string }) {
  return (
    <Badge
      color="cyan"
      variant="light"
      component="button"
      className="relayBadge"
      onClick={() => window.open(`/api/history?channel=${encodeURIComponent(channel)}`, "_blank")}
    >
      relayed to {channel}
    </Badge>
  );
}

function SettingsDrawer({ opened, onClose, settings, mode }: { opened: boolean; onClose: () => void; settings: SettingsPayload | null; mode: Mode }) {
  const [auditOpen, setAuditOpen] = useState(false);
  const [entries, setEntries] = useState<CloudRouteLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  async function loadAudit() {
    const next = !auditOpen;
    setAuditOpen(next);
    if (!next) return;
    setLoading(true);
    try {
      const response = await fetch("/api/dayjob/cloud-route-log?limit=50");
      if (response.ok) {
        const payload = await response.json();
        setEntries(payload.entries ?? []);
      }
    } finally {
      setLoading(false);
    }
  }
  return (
    <Drawer opened={opened} onClose={onClose} position="right" title="Settings">
      <Stack gap="sm">
        <Setting label="Mode" value={mode} />
        <Setting label="DB path" value={settings?.db_path ?? "unknown"} />
        <Setting label="Local server" value={settings?.local_server ?? "unknown"} />
        <Setting label="Chat endpoint" value={settings?.chat_endpoint ?? "unknown"} />
        <Setting label="Vision endpoint" value={settings?.vision_endpoint ?? "placeholder"} />
        <Setting label="Session token file" value={settings?.session_file ?? "unknown"} />
        <Setting label="Wake/drain" value={settings?.wake_drain ?? "available"} />
        {mode === "dayjob" ? (
          <div className="setting">
            <Button size="xs" variant="light" leftSection={<Cloud size={14} />} onClick={loadAudit}>
              Cloud Route Audit Log
            </Button>
            <Collapse in={auditOpen}>
              <Stack gap="xs" mt="sm" data-testid="cloud-route-log">
                {loading ? <Text size="sm" c="dimmed">Loading...</Text> : null}
                {!loading && entries.length === 0 ? <Text size="sm" c="dimmed">No cloud route entries.</Text> : null}
                {entries.map((entry, index) => (
                  <div key={`${entry.correlation_id ?? "entry"}-${index}`} className="cloudLogRow">
                    <Group justify="space-between" gap="xs" wrap="nowrap">
                      <Badge color={entry.degraded ? "yellow" : "cyan"} variant="light">
                        {entry.degraded ? "degraded" : "cloud"}
                      </Badge>
                      <Text size="xs" c="dimmed">#{entry.message_id ?? "n/a"}</Text>
                    </Group>
                    <Text size="xs">{simplifyModelName(entry.model_used || "unknown")}</Text>
                    <Text size="xs" c="dimmed">{entry.timestamp ?? ""}</Text>
                  </div>
                ))}
              </Stack>
            </Collapse>
          </div>
        ) : null}
      </Stack>
    </Drawer>
  );
}

function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className="setting">
      <Text size="xs" c="dimmed">{label}</Text>
      <Text size="sm">{value}</Text>
    </div>
  );
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map<number, ChatMessage>();
  [...current, ...incoming].forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

function mergeActivity(current: ActivityEvent[], incoming: ActivityEvent[]) {
  const byId = new Map<number, ActivityEvent>();
  [...current, ...incoming].forEach((event) => byId.set(event.id, event));
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

function maxActivityId(events: ActivityEvent[]) {
  return events.reduce((id, event) => Math.max(id, event.id), 0);
}

function activityFilterMatches(event: string, filter: string) {
  if (filter === "all") return true;
  if (filter === "executor") return ["experiment_executed", "executor_skipped", "executor_no_match"].includes(event);
  if (filter === "meta") return event.startsWith("meta_");
  if (filter === "reflection") return event.startsWith("reflection_");
  if (filter === "vision") return event === "image_ingested" || event.includes("vision");
  return true;
}

async function persistActivityOpen(open: boolean) {
  await fetch("/api/ui-session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ activity_panel_open: open })
  }).catch(() => undefined);
}

async function persistDayjobCloudConfirmed(value: boolean) {
  await fetch("/api/ui-session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ dayjob_cloud_confirmed: value })
  }).catch(() => undefined);
}

async function notifyReply(text: string) {
  if (document.hasFocus() || document.visibilityState === "visible") return;
  const now = Date.now();
  if (now - notifyAtRefGlobal.last < 30000) return;
  notifyAtRefGlobal.last = now;
  setAlertFavicon();
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission === "granted") {
    new Notification("Lem", { body: text.slice(0, 60) });
  }
}

const notifyAtRefGlobal = { last: 0 };

function appendStreamingToken(current: ChatMessage[], tempId: number, correlationId: string, token: string) {
  const existing = current.find((message) => message.id === tempId);
  if (existing) {
    return current.map((message) => message.id === tempId ? { ...message, text: message.text + token, streaming: true } : message);
  }
  return mergeMessages(current, [{
    id: tempId,
    role: "lem",
    text: token,
    sender: "lem",
    recipient: "justin",
    channel: "justin/replies",
    created_at: null,
    created_at_ts: null,
    correlation_id: correlationId,
    type: "reply",
    streaming: true
  }]);
}

function appendDayjobStreamingToken(current: ChatMessage[], tempId: number, correlationId: string, token: string) {
  const existing = current.find((message) => message.id === tempId);
  if (existing) {
    return current.map((message) => message.id === tempId ? { ...message, text: message.text + token, streaming: true } : message);
  }
  return mergeMessages(current, [{
    id: tempId,
    role: "dayjob",
    text: token,
    sender: "dayjob",
    recipient: "justin",
    channel: "dayjob/local",
    created_at: null,
    created_at_ts: null,
    correlation_id: correlationId,
    type: "reply",
    streaming: true,
    route: "LOCAL"
  }]);
}

function streamInterruptionMessage(event: Event, fallback: string) {
  if (!("data" in event) || typeof event.data !== "string") return fallback;
  try {
    const payload = JSON.parse(event.data);
    return typeof payload.detail === "string" && payload.detail.trim() ? payload.detail : fallback;
  } catch {
    return fallback;
  }
}

async function syncMissedMessages(lastSeenMsgId: number, setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>) {
  const response = await fetch(`/api/history?last_seen_msg_id=${lastSeenMsgId}&limit=200`);
  if (!response.ok) return;
  const payload = await response.json();
  const incoming: ChatMessage[] = payload.messages ?? [];
  if (incoming.length) setMessages((current) => mergeMessages(current, incoming));
}

async function refreshEngagement(setEngagement: React.Dispatch<React.SetStateAction<EngagementState | null>>) {
  try {
    const response = await fetch("/api/engagement/state");
    if (!response.ok) return;
    setEngagement(await response.json());
  } catch {
    setEngagement(null);
  }
}

async function refreshDashboard(
  mode: Mode,
  setDashboard: React.Dispatch<React.SetStateAction<DashboardPayload | null>>,
  setBusy: React.Dispatch<React.SetStateAction<boolean>>
) {
  setBusy(true);
  try {
    const response = await fetch(mode === "dayjob" ? "/api/dayjob/dashboard" : "/api/lem/dashboard");
    if (!response.ok) return;
    setDashboard(await response.json());
  } catch {
    setDashboard(null);
  } finally {
    setBusy(false);
  }
}

async function refreshLiveInbox(
  setLiveInbox: React.Dispatch<React.SetStateAction<LiveInboxMessage[]>>,
  setLatestId: (id: number) => void,
  setPath: React.Dispatch<React.SetStateAction<string>>,
  lastId: number
) {
  try {
    const response = await fetch(`/api/live-inbox?last_id=${lastId}&limit=100`);
    if (!response.ok) return;
    const payload = await response.json();
    setPath(payload.path || "");
    const incoming: LiveInboxMessage[] = payload.messages ?? [];
    if (incoming.length) {
      setLiveInbox((current) => mergeLiveInbox(current, incoming).slice(-200));
    } else if (lastId === 0) {
      setLiveInbox([]);
    }
    setLatestId(Number(payload.latest_id ?? lastId));
  } catch {
    if (lastId === 0) setLiveInbox([]);
  }
}

function mergeLiveInbox(current: LiveInboxMessage[], incoming: LiveInboxMessage[]) {
  const map = new Map<number, LiveInboxMessage>();
  for (const item of current) map.set(item.id, item);
  for (const item of incoming) map.set(item.id, item);
  return Array.from(map.values()).sort((a, b) => a.id - b.id);
}

async function refreshModeStatus(
  setModeStatus: React.Dispatch<React.SetStateAction<ModeStatusPayload | null>>,
  setDayjobHealth: React.Dispatch<React.SetStateAction<DayjobHealthPayload | null>>
) {
  try {
    const response = await fetch("/api/mode-status");
    if (!response.ok) return;
    const payload: ModeStatusPayload = await response.json();
    setModeStatus(payload);
    const dayjob = payload.modes.find((item) => item.id === "dayjob");
    if (dayjob?.audit) setDayjobHealth(dayjob.audit);
  } catch {
    setModeStatus(null);
  }
}

async function refreshDayjobStatus(
  setDayjobHealth: React.Dispatch<React.SetStateAction<DayjobHealthPayload | null>>,
  setDayjobTotals: React.Dispatch<React.SetStateAction<StorageTotals>>
) {
  try {
    const [healthResponse, totalsResponse, visionResponse] = await Promise.all([
      fetch("/api/dayjob/health"),
      fetch("/api/dayjob/storage-totals"),
      fetch("/api/dayjob/health/vision")
    ]);
    if (healthResponse.ok) {
      const healthPayload: DayjobHealthPayload = await healthResponse.json();
      if (visionResponse.ok) {
        const visionPayload = await visionResponse.json();
        healthPayload.vision_endpoint_health = {
          ok: !!visionPayload.reachable,
          status: visionPayload.retired ? "retired" : visionPayload.reachable ? "reachable" : "unreachable",
          host: visionPayload.host ?? null,
          port: visionPayload.port ?? null,
          retired: !!visionPayload.retired,
          message: visionPayload.message
        };
      }
      setDayjobHealth(healthPayload);
      if (healthPayload.storage_totals) setDayjobTotals(healthPayload.storage_totals);
    }
    if (totalsResponse.ok) {
      setDayjobTotals(await totalsResponse.json());
    }
  } catch {
    setDayjobHealth(null);
    setDayjobTotals({});
  }
}

async function refreshIngestions(setIngestions: React.Dispatch<React.SetStateAction<DayjobIngestion[]>>, mode: Mode = "dayjob") {
  try {
    const response = await fetch(`/api/context/ingestions?mode=${mode}&limit=50`);
    if (!response.ok) return;
    const payload = await response.json();
    setIngestions(payload.ingestions ?? []);
  } catch {
    setIngestions([]);
  }
}

async function refreshCommands(
  setCommands: React.Dispatch<React.SetStateAction<CommandRecord[]>>,
  modeOrOptions: Mode | CommandRefreshOptions = "lem",
  maybeOptions: CommandRefreshOptions = {}
) {
  try {
    const mode: Mode = typeof modeOrOptions === "string" ? modeOrOptions : "dayjob";
    const options = typeof modeOrOptions === "string" ? maybeOptions : modeOrOptions;
    const params = new URLSearchParams({ mode, limit: "50" });
    if (options.taskTag?.trim()) params.set("task_tag", options.taskTag.trim());
    if (options.statuses?.length) params.set("status", options.statuses.join(","));
    if (!options.unscoped && options.sessionId) params.set("session_id", String(options.sessionId));
    const response = await fetch(`/api/commands?${params.toString()}`);
    if (!response.ok) return;
    const payload = await response.json();
    setCommands(payload.commands ?? []);
  } catch {
    setCommands([]);
  }
}

async function stopEngagement(setEngagement: React.Dispatch<React.SetStateAction<EngagementState | null>>) {
  const response = await fetch("/api/engagement/stop", { method: "POST" });
  if (response.ok) setEngagement(await response.json());
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function formatRemaining(expiresAt: string) {
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return "0m";
  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function simplifyModelName(model: string) {
  const lower = model.toLowerCase();
  if (lower.includes("qwen3")) return "Qwen3-Coder-Next";
  if (lower.includes("claude-opus-4-6")) return "Opus 4.6";
  return model;
}

function setAlertFavicon() {
  setFavicon("/favicon-alert.svg");
}

function setDefaultFavicon() {
  setFavicon("/favicon.svg");
}

function setFavicon(href: string) {
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = href;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
