"""Tests for backend/bus_bridge.py — Followup E.

Covers:
- Fail-closed paths (missing DB, wrong schema, corrupt rows, symlinked
  ancestors).
- Successful enrichment from a synthetic bus DB with recent activity.
- State promotion logic (working / idle-available / no-op / errored
  passthrough).
- Window cutoff (activity older than the window doesn't promote state).
- Payload action parsing (current_action / summary / text / event
  field preference + 160-char truncation).
"""

from __future__ import annotations

import json
import os
import sqlite3
import stat
import tempfile
import time
import unittest
from pathlib import Path

from backend.bus_bridge import (
    BusBridgePathError,
    CURRENT_ACTION_MAX_LENGTH,
    TEAMMATE_RECENT_WINDOW_SECONDS,
    _parse_action,
    _promote_state,
    _refuse_ancestor_symlink,
    bus_activity_for_teammates,
    overlay_roster_with_bus,
    resolve_bus_db_path,
)


SCHEMA = """
CREATE TABLE bus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender TEXT,
  recipient TEXT,
  channel TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  created_at_ts INTEGER DEFAULT (cast(strftime('%s','now') as integer)),
  session_id INTEGER
);
"""


def _make_bus_db(tmp: Path, rows: list[dict]) -> Path:
    path = tmp / "teammate-bus.db"
    conn = sqlite3.connect(path)
    conn.executescript(SCHEMA)
    for row in rows:
        conn.execute(
            "INSERT INTO bus (sender, recipient, channel, payload, created_at_ts) "
            "VALUES (?, ?, ?, ?, ?)",
            (
                row.get("sender"),
                row.get("recipient"),
                row.get("channel", "a2a/test"),
                row.get("payload", "{}"),
                row.get("ts", int(time.time())),
            ),
        )
    conn.commit()
    conn.close()
    return path


class TestParseAction(unittest.TestCase):
    def test_prefers_current_action(self) -> None:
        payload = json.dumps({"current_action": "running probes", "text": "ignored"})
        self.assertEqual(_parse_action(payload), "running probes")

    def test_falls_back_to_summary_then_text_then_event(self) -> None:
        self.assertEqual(_parse_action(json.dumps({"summary": "s"})), "s")
        self.assertEqual(_parse_action(json.dumps({"text": "t"})), "t")
        self.assertEqual(_parse_action(json.dumps({"event": "e"})), "e")

    def test_truncates_at_max_length(self) -> None:
        long_text = "x" * (CURRENT_ACTION_MAX_LENGTH + 100)
        out = _parse_action(json.dumps({"text": long_text}))
        self.assertEqual(len(out), CURRENT_ACTION_MAX_LENGTH)

    def test_returns_empty_on_corrupt_payload(self) -> None:
        self.assertEqual(_parse_action("not json"), "")
        self.assertEqual(_parse_action(""), "")
        self.assertEqual(_parse_action(json.dumps([1, 2, 3])), "")

    def test_ignores_non_string_values(self) -> None:
        self.assertEqual(_parse_action(json.dumps({"text": 42})), "")


class TestPromoteState(unittest.TestCase):
    def test_within_window_promotes_to_working(self) -> None:
        self.assertEqual(_promote_state("lem", ts=100, cutoff=50), "working")

    def test_within_window_justin_to_idle_available(self) -> None:
        self.assertEqual(
            _promote_state("justin", ts=100, cutoff=50),
            "idle-available",
        )

    def test_outside_window_no_promotion(self) -> None:
        self.assertIsNone(_promote_state("lem", ts=10, cutoff=50))


class TestBusActivityForTeammates(unittest.TestCase):
    def test_returns_empty_on_missing_db(self) -> None:
        result = bus_activity_for_teammates(
            {"lem", "codex"},
            bus_db_path=Path("/nonexistent/bus.db"),
        )
        self.assertEqual(result, {})

    def test_picks_most_recent_per_teammate(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            now = int(time.time())
            bus = _make_bus_db(
                tmp_path,
                [
                    {"sender": "lem", "payload": json.dumps({"text": "old"}),
                     "ts": now - 300},
                    {"sender": "codex", "payload": json.dumps({"text": "codex msg"}),
                     "ts": now - 60},
                    {"sender": "lem", "payload": json.dumps({"current_action": "fresh"}),
                     "ts": now - 30},
                ],
            )
            result = bus_activity_for_teammates(
                {"lem", "codex", "iain"},
                bus_db_path=bus,
                now_ts=now,
            )
            self.assertIn("lem", result)
            self.assertEqual(result["lem"]["current_action"], "fresh")
            self.assertEqual(result["lem"]["last_activity_ts"], now - 30)
            self.assertEqual(result["lem"]["promoted_state"], "working")
            self.assertIn("codex", result)
            self.assertEqual(result["codex"]["current_action"], "codex msg")
            self.assertNotIn("iain", result)  # no activity

    def test_recipient_match_counts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            now = int(time.time())
            bus = _make_bus_db(
                tmp_path,
                [{"sender": "lem", "recipient": "codex",
                  "payload": json.dumps({"text": "dispatch"}),
                  "ts": now - 10}],
            )
            result = bus_activity_for_teammates(
                {"lem", "codex"},
                bus_db_path=bus,
                now_ts=now,
            )
            self.assertIn("lem", result)
            self.assertIn("codex", result)
            self.assertEqual(result["codex"]["last_activity_ts"], now - 10)

    def test_outside_window_no_state_promotion(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            now = int(time.time())
            bus = _make_bus_db(
                tmp_path,
                [{"sender": "lem",
                  "payload": json.dumps({"text": "old"}),
                  "ts": now - TEAMMATE_RECENT_WINDOW_SECONDS - 100}],
            )
            result = bus_activity_for_teammates(
                {"lem"},
                bus_db_path=bus,
                now_ts=now,
            )
            self.assertIn("lem", result)
            self.assertIsNone(result["lem"]["promoted_state"])

    def test_fail_closed_on_wrong_schema(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            wrong = tmp_path / "wrong.db"
            conn = sqlite3.connect(wrong)
            conn.executescript("CREATE TABLE wrong_table (x INTEGER);")
            conn.close()
            result = bus_activity_for_teammates(
                {"lem"},
                bus_db_path=wrong,
            )
            self.assertEqual(result, {})


class TestOverlayRosterWithBus(unittest.TestCase):
    def _baseline_roster(self) -> list[dict]:
        return [
            {"id": "lem", "name": "Lem", "role": "x",
             "signature_color": "#fff", "state": "asleep",
             "current_action": "baseline", "last_activity_ts": 0},
            {"id": "codex", "name": "Codex", "role": "y",
             "signature_color": "#fff", "state": "asleep",
             "current_action": "baseline", "last_activity_ts": 0},
            {"id": "justin", "name": "Justin", "role": "z",
             "signature_color": "#fff", "state": "asleep",
             "current_action": "baseline", "last_activity_ts": 0},
        ]

    def test_overlays_activity_and_promotes_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            now = int(time.time())
            bus = _make_bus_db(
                tmp_path,
                [
                    {"sender": "lem",
                     "payload": json.dumps({"current_action": "computing"}),
                     "ts": now - 30},
                    {"sender": "justin",
                     "payload": json.dumps({"text": "reviewing"}),
                     "ts": now - 60},
                ],
            )
            out = overlay_roster_with_bus(
                self._baseline_roster(),
                bus_db_path=bus,
                now_ts=now,
            )
            members = {m["id"]: m for m in out}
            self.assertEqual(members["lem"]["state"], "working")
            self.assertEqual(members["lem"]["current_action"], "computing")
            self.assertEqual(members["lem"]["last_activity_ts"], now - 30)
            self.assertEqual(members["justin"]["state"], "idle-available")
            self.assertEqual(members["justin"]["current_action"], "reviewing")
            # codex had no activity -> baseline preserved
            self.assertEqual(members["codex"]["state"], "asleep")
            self.assertEqual(members["codex"]["current_action"], "baseline")

    def test_errored_state_not_overridden(self) -> None:
        baseline = self._baseline_roster()
        baseline[0]["state"] = "errored"
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            now = int(time.time())
            bus = _make_bus_db(
                tmp_path,
                [{"sender": "lem",
                  "payload": json.dumps({"text": "still trying"}),
                  "ts": now - 10}],
            )
            out = overlay_roster_with_bus(baseline, bus_db_path=bus, now_ts=now)
            lem = next(m for m in out if m["id"] == "lem")
            self.assertEqual(lem["state"], "errored")  # not promoted
            # but ts + action ARE updated
            self.assertEqual(lem["current_action"], "still trying")
            self.assertEqual(lem["last_activity_ts"], now - 10)

    def test_fail_closed_returns_static_on_missing_bus(self) -> None:
        baseline = self._baseline_roster()
        out = overlay_roster_with_bus(
            baseline,
            bus_db_path=Path("/nonexistent/bus.db"),
        )
        # static roster preserved unchanged
        self.assertEqual(len(out), len(baseline))
        for orig, new in zip(baseline, out):
            self.assertEqual(orig["state"], new["state"])
            self.assertEqual(orig["current_action"], new["current_action"])


class TestBusPathAncestorSymlinkGuard(unittest.TestCase):
    """Standard 5-flavor symlink defense check on the bus DB path."""

    def test_rejects_symlinked_parent(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            outside = tmp_path / "outside"
            outside.mkdir(mode=0o755)
            link = tmp_path / "lem_link"
            link.symlink_to(outside, target_is_directory=True)
            bus_path = link / ".swarm" / "teammate-bus.db"
            with self.assertRaises(BusBridgePathError):
                _refuse_ancestor_symlink(bus_path, role="lem-bus.db")

    def test_resolve_uses_env_override_and_guard(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            outside = tmp_path / "outside"
            outside.mkdir(mode=0o755)
            link = tmp_path / "lem_link"
            link.symlink_to(outside, target_is_directory=True)
            nested = link / "teammate-bus.db"
            old = os.environ.get("LEM_BUS_DB")
            os.environ["LEM_BUS_DB"] = str(nested)
            try:
                with self.assertRaises(BusBridgePathError):
                    resolve_bus_db_path()
            finally:
                if old is None:
                    os.environ.pop("LEM_BUS_DB", None)
                else:
                    os.environ["LEM_BUS_DB"] = old

    def test_resolve_accepts_canonical_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            real = tmp_path / "real" / "teammate-bus.db"
            real.parent.mkdir(parents=True)
            old = os.environ.get("LEM_BUS_DB")
            os.environ["LEM_BUS_DB"] = str(real)
            try:
                resolved = resolve_bus_db_path()
                self.assertEqual(resolved, real)
            finally:
                if old is None:
                    os.environ.pop("LEM_BUS_DB", None)
                else:
                    os.environ["LEM_BUS_DB"] = old


if __name__ == "__main__":
    unittest.main()
