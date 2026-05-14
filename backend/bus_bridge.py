"""cowork-console bus-bridge: read recent teammate activity from lem's bus.

Followup E (2026-05-14): the cowork-console teammates roster was static
until this module landed. The lem teammate bus at
``~/projects/lem/.swarm/teammate-bus.db`` carries every message between
agents (Lem, Iain, Codex, claude-code, Justin) on its ``bus`` table.
This bridge reads it cross-process and computes per-teammate enrichment
that's overlaid onto the static roster (``backend/teammates.json``):

- ``last_activity_ts`` — most recent bus message where the teammate
  was sender or recipient
- ``current_action`` — short text from the most recent message's
  payload (``current_action`` / ``summary`` / ``text`` / ``event``
  field, in that order, truncated to 160 chars; mirrors the helper
  in the deleted lem ``_teammate_action_for_message``)
- state promotion — if the teammate had any activity in the last
  ``TEAMMATE_RECENT_WINDOW_SECONDS`` (default 15 min), state is
  promoted to ``working`` (or ``idle-available`` for ``justin``)
  unless already ``errored``

Design choice: **direct SQLite read** rather than HTTP-polling
lem-observatory. Both processes are on the same machine, same user;
SQLite handles concurrent readers fine via WAL mode (or even legacy
rollback-journal). The HTTP-poll alternative would require lem-
observatory to expose ``/api/teammates-activity`` — feasible but more
work and an extra hop. If/when cowork-console moves to a different
host than lem, switch to HTTP at that time (re-evaluate alongside
Stage 2 ``lem/observatory/`` rename).

Failure mode: **fail-closed**. If the bus DB doesn't exist, can't be
opened, has the wrong schema, or contains corrupt rows, the bridge
returns an empty dict and the static roster passes through unchanged.
The roster is never broken by a broken bridge.

Symlink guard: same pattern as the 5-flavor symlink defense in lem
(``lem/visual/paths.py::_refuse_ancestor_symlink`` etc.) — walks the
full ancestor chain of the bus path before opening. ``LEM_BUS_DB``
env var override flows through the same guard.
"""

from __future__ import annotations

import json
import os
import sqlite3
import stat
import time
from pathlib import Path
from typing import Any


DEFAULT_LEM_BUS_DB = Path.home() / "projects" / "lem" / ".swarm" / "teammate-bus.db"
TEAMMATE_RECENT_WINDOW_SECONDS = 15 * 60
MAX_ROWS_SCANNED = 1000

CURRENT_ACTION_MAX_LENGTH = 160


class BusBridgePathError(RuntimeError):
    """Raised when the bus DB path resolves to or through a symlinked
    ancestor. Mirrors the 5-flavor symlink defense pattern from lem."""


def _refuse_ancestor_symlink(path: Path, *, role: str) -> None:
    """Walk path.parent → filesystem root, refusing any symlinked link.

    Same shape as ``lem/visual/paths.py::_refuse_ancestor_symlink`` and
    ``cowork-console/backend/main.py::_refuse_ancestor_symlink``."""

    if path.is_symlink():
        raise BusBridgePathError(
            f"bus_bridge refuses to follow symlink for {role}: {path}"
        )
    walker = path.parent
    while True:
        try:
            walker_lstat = walker.lstat()
        except OSError as exc:
            raise BusBridgePathError(
                f"bus_bridge ancestor unreachable for {role}: {walker}"
            ) from exc
        if stat.S_ISLNK(walker_lstat.st_mode):
            raise BusBridgePathError(
                f"bus_bridge refuses to follow ancestor symlink for "
                f"{role}: {walker}"
            )
        if walker.parent == walker:
            return
        walker = walker.parent


def resolve_bus_db_path() -> Path:
    """Resolve the lem teammate-bus.db path with env override + guard."""
    raw = os.environ.get("LEM_BUS_DB")
    path = Path(raw).expanduser() if raw else DEFAULT_LEM_BUS_DB
    _refuse_ancestor_symlink(path, role="lem-bus.db")
    return path


def _parse_action(payload_text: str) -> str:
    """Extract a short action description from a bus payload.

    Mirrors the deleted ``_teammate_action_for_message`` from lem.
    Returns "" on any parse failure (fail-closed)."""
    try:
        payload = json.loads(payload_text)
    except (json.JSONDecodeError, TypeError):
        return ""
    if not isinstance(payload, dict):
        return ""
    for key in ("current_action", "summary", "text", "event"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()[:CURRENT_ACTION_MAX_LENGTH]
    return ""


def bus_activity_for_teammates(
    teammate_ids: set[str],
    *,
    bus_db_path: Path | None = None,
    window_seconds: int = TEAMMATE_RECENT_WINDOW_SECONDS,
    now_ts: int | None = None,
    max_rows: int = MAX_ROWS_SCANNED,
) -> dict[str, dict[str, Any]]:
    """Return enrichment overlay per teammate id.

    Reads the lem bus DB in read-only mode and walks the most recent
    ``max_rows`` messages, picking out the freshest per teammate where
    they appear as sender or recipient.

    Returns a dict ``{teammate_id: {last_activity_ts, current_action,
    promoted_state}}``. If the bus DB doesn't exist or any error occurs,
    returns ``{}`` (fail-closed)."""

    if bus_db_path is None:
        try:
            bus_db_path = resolve_bus_db_path()
        except BusBridgePathError:
            return {}

    if not bus_db_path.exists():
        return {}

    if now_ts is None:
        now_ts = int(time.time())
    cutoff = now_ts - max(0, int(window_seconds))

    # Open read-only via URI to avoid creating the file if missing and
    # to prevent any accidental writes from the cowork-console process.
    uri = f"file:{bus_db_path}?mode=ro"
    try:
        conn = sqlite3.connect(uri, uri=True, timeout=1.0)
    except sqlite3.Error:
        return {}

    out: dict[str, dict[str, Any]] = {}
    try:
        # Scan the most-recent N messages in descending order; first
        # row per teammate (as sender or recipient) wins.
        cursor = conn.execute(
            """
            SELECT sender, recipient, payload, created_at_ts
            FROM bus
            ORDER BY id DESC
            LIMIT ?
            """,
            (int(max_rows),),
        )
        for sender, recipient, payload_text, ts in cursor:
            ts_int = int(ts) if ts is not None else 0
            action = _parse_action(payload_text or "")
            for who in (sender, recipient):
                if who is None or who not in teammate_ids:
                    continue
                if who in out:
                    continue
                out[who] = {
                    "last_activity_ts": ts_int,
                    "current_action": action,
                    "promoted_state": _promote_state(who, ts_int, cutoff),
                }
            if len(out) >= len(teammate_ids):
                break
    except sqlite3.Error:
        return {}
    finally:
        conn.close()

    return out


def _promote_state(teammate_id: str, ts: int, cutoff: int) -> str | None:
    """If activity is within the recent window, promote state.

    Returns the promoted state or None (no promotion / use static
    state from roster). Mirrors the deleted lem helper's logic."""
    if ts < cutoff:
        return None
    # Justin gets 'idle-available' even when actively in the bus —
    # mirrors the lem-side convention.
    if teammate_id == "justin":
        return "idle-available"
    return "working"


def overlay_roster_with_bus(
    static_roster: list[dict[str, Any]],
    *,
    bus_db_path: Path | None = None,
    now_ts: int | None = None,
) -> list[dict[str, Any]]:
    """Apply bus enrichment to a static roster list.

    Each roster member is overlaid in-place style (returned as a new
    list with new dicts). Fields overridden when bus has data:
    ``last_activity_ts``, ``current_action``, and ``state`` (only
    when the bus has fresh activity AND the member isn't ``errored``).

    On any bus failure: returns the static roster unchanged (fail-
    closed)."""

    ids = {m["id"] for m in static_roster if isinstance(m, dict) and "id" in m}
    if not ids:
        return list(static_roster)

    activity = bus_activity_for_teammates(
        ids,
        bus_db_path=bus_db_path,
        now_ts=now_ts,
    )

    if not activity:
        return list(static_roster)

    out: list[dict[str, Any]] = []
    for member in static_roster:
        if not isinstance(member, dict):
            continue
        new = dict(member)
        enrichment = activity.get(new.get("id"))
        if enrichment is not None:
            new["last_activity_ts"] = enrichment["last_activity_ts"]
            if enrichment["current_action"]:
                new["current_action"] = enrichment["current_action"]
            promoted = enrichment["promoted_state"]
            if promoted is not None and new.get("state") != "errored":
                new["state"] = promoted
        out.append(new)
    return out
