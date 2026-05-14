"""cowork-console minimal team-coord backend.

Serves the canonical 5-teammate roster + heartbeat stream that the
React `TeammateAvatar` / `StatePulseRail` / `HeartbeatTile` recipes
consume.

History: this surface used to live in `lem@extensions/ui/backend/main.py`
(2 routes + roster JSON + helpers) — extracted to `cowork-console` in
Stage 1a of the C3 audit migration (PR #9 on lem repo, merged
2026-05-13T22:59Z). See `docs/spec/extensions-ui-audit-2026-05-13.md`
in the lem repo for the classification ADR.

Current state — STATIC ROSTER:
- `GET /api/teammates` returns the JSON file contents with
  `last_activity_ts` stamped at request time.
- `GET /api/teammates/stream` emits SSE `heartbeat` events every 5s
  with the same enriched roster + a `ts` field.

The original lem-side implementation enriched the roster from the
teammate bus (per-message `_teammate_action_for_message`,
`_teammate_id_for_message`, recent-window state promotion).
**That dynamic enrichment is a follow-up dispatch** — the
cross-process bus-reader from cowork-console to lem's
`~/.swarm/teammate-bus.db` needs a design pass (file-watch vs
HTTP-poll-from-lem-observatory vs shared-volume mount). Until then
this surface is functional but static.

No-follow / ancestor-symlink guards: the roster path is resolved
under the package directory at import time; `_refuse_ancestor_symlink`
walks `roster_path.parent` to the filesystem root rejecting any
symlinked component. Same pattern as `lem/visual/paths.py` (lem PR #7
CR-1 fix).
"""

from __future__ import annotations

import asyncio
import json
import os
import stat
import time
from pathlib import Path
from typing import Any, AsyncIterator

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse


ROSTER_FILENAME = "teammates.json"
HEARTBEAT_INTERVAL_SECONDS = 5

TEAMMATE_REQUIRED_FIELDS = {
    "id",
    "name",
    "role",
    "signature_color",
    "state",
    "current_action",
}
TEAMMATE_STATES = {
    "working",
    "idle-available",
    "asleep",
    "blocked-on-human",
    "blocked-on-agent",
    "errored",
}


class RosterPathError(RuntimeError):
    """Raised when the roster file path resolves outside the package or
    traverses a symlinked ancestor."""


def _refuse_ancestor_symlink(path: Path, owning_root: Path) -> None:
    """Walk path.parent up to owning_root rejecting any symlinked component.

    Mirrors `lem/visual/paths.py::_refuse_ancestor_symlink` (lem PR #7
    CR-1 fix). Defense against `LEM_*_HOME=symlink_to_outside_dir` style
    privilege-leak by ensuring every link in the chain is a real
    directory before the path is opened.
    """
    owning_root_resolved = owning_root.resolve()
    current = path.parent
    while True:
        try:
            current_lstat = current.lstat()
        except OSError as exc:
            raise RosterPathError(f"roster ancestor unreachable: {current}") from exc
        if stat.S_ISLNK(current_lstat.st_mode):
            raise RosterPathError(f"roster ancestor is a symlink: {current}")
        if current == current.parent:
            raise RosterPathError(
                f"roster path {path} is not contained under owning root {owning_root}"
            )
        if current.resolve() == owning_root_resolved:
            return
        current = current.parent


def _roster_path() -> Path:
    """Resolve the canonical roster file path under this package."""
    package_dir = Path(__file__).parent.resolve()
    roster = package_dir / ROSTER_FILENAME
    _refuse_ancestor_symlink(roster, package_dir)
    leaf_lstat = roster.lstat() if roster.exists() else None
    if leaf_lstat is not None and stat.S_ISLNK(leaf_lstat.st_mode):
        raise RosterPathError(f"roster file is a symlink: {roster}")
    return roster


def _load_roster() -> list[dict[str, Any]]:
    """Load the static roster; fail-closed to empty list on corruption."""
    try:
        path = _roster_path()
    except RosterPathError:
        return []
    try:
        raw = path.read_text(encoding="utf-8")
        parsed = json.loads(raw)
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        return []
    if not isinstance(parsed, list):
        return []
    return parsed


def _enriched_roster(*, now_ts: int | None = None) -> list[dict[str, Any]]:
    """Return the roster with `last_activity_ts` stamped + state/field validation.

    Members missing required fields or with an unknown state are dropped
    fail-closed.

    Followup E (2026-05-14): when the lem teammate-bus DB is reachable
    (``LEM_BUS_DB`` env override or default ``~/projects/lem/.swarm/
    teammate-bus.db``), per-teammate ``last_activity_ts`` /
    ``current_action`` / promoted-``state`` are overlaid from recent
    bus activity. Falls back to the static-stamped roster on any bus
    failure. See ``backend/bus_bridge.py``.
    """
    if now_ts is None:
        now_ts = int(time.time())
    raw = _load_roster()
    out: list[dict[str, Any]] = []
    for member in raw:
        if not isinstance(member, dict):
            continue
        missing = TEAMMATE_REQUIRED_FIELDS - set(member.keys())
        if missing:
            continue
        if member.get("state") not in TEAMMATE_STATES:
            continue
        member_out = dict(member)
        member_out["last_activity_ts"] = now_ts
        out.append(member_out)

    # Followup E: overlay bus activity on top of the validated baseline.
    # Imported lazily to avoid hard-failing if bus_bridge has an issue
    # at module load time.
    try:
        from backend.bus_bridge import overlay_roster_with_bus
        out = overlay_roster_with_bus(out, now_ts=now_ts)
    except Exception:
        # Fail-closed: any unexpected bus_bridge error -> static roster.
        pass
    return out


def _sse(event: str, payload: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


def create_app() -> FastAPI:
    app = FastAPI(title="cowork-console team-coord backend", version="0.1.0")

    @app.get("/api/teammates")
    async def teammates() -> list[dict[str, Any]]:
        return _enriched_roster()

    @app.get("/api/teammates/stream")
    async def teammates_stream(request: Request) -> StreamingResponse:
        async def events() -> AsyncIterator[str]:
            while True:
                if await request.is_disconnected():
                    return
                now = int(time.time())
                yield _sse(
                    "heartbeat",
                    {"teammates": _enriched_roster(now_ts=now), "ts": now},
                )
                await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS)

        return StreamingResponse(
            events(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    @app.get("/api/health")
    async def health() -> dict[str, Any]:
        return {
            "ok": True,
            "service": "cowork-console-team-coord",
            "roster_count": len(_enriched_roster()),
        }

    return app


app = create_app()
