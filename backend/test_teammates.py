"""Tests for the cowork-console team-coord backend.

Adapted from `lem@extensions/ui/backend/test_teammates.py` (the original
roster tests removed in lem PR #9). This version drops the
`UiConfig` / `TeammateBus` dependencies since cowork-console's roster
is static (bus enrichment is a follow-up dispatch).
"""

from __future__ import annotations

import json
import os
import stat
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.main import (
    RosterPathError,
    TEAMMATE_REQUIRED_FIELDS,
    TEAMMATE_STATES,
    _enriched_roster,
    _refuse_ancestor_symlink,
    create_app,
)


class TestTeammatesApi(unittest.TestCase):
    def setUp(self) -> None:
        # Followup E (2026-05-14): isolate the static-roster unit tests
        # from any real lem teammate-bus.db that the bus_bridge would
        # otherwise overlay. Point LEM_BUS_DB at a nonexistent path so
        # bus_bridge fails closed and the static roster passes through.
        self._old_lem_bus_db = os.environ.get("LEM_BUS_DB")
        os.environ["LEM_BUS_DB"] = "/nonexistent/teammate-bus.db"
        self.app = create_app()
        self.client = TestClient(self.app)

    def tearDown(self) -> None:
        if self._old_lem_bus_db is None:
            os.environ.pop("LEM_BUS_DB", None)
        else:
            os.environ["LEM_BUS_DB"] = self._old_lem_bus_db

    def test_get_teammates_returns_canonical_roster(self) -> None:
        response = self.client.get("/api/teammates")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 5)

        ids = [m["id"] for m in data]
        self.assertEqual(set(ids), {"lem", "iain", "codex", "claude-code", "justin"})

        for member in data:
            for required in TEAMMATE_REQUIRED_FIELDS:
                self.assertIn(required, member, f"missing {required} from {member['id']}")
            self.assertIn(member["state"], TEAMMATE_STATES)
            self.assertIn("last_activity_ts", member)
            self.assertIsInstance(member["last_activity_ts"], int)

    def test_get_teammates_stamps_recent_last_activity_ts(self) -> None:
        before = int(time.time())
        response = self.client.get("/api/teammates")
        after = int(time.time())
        for member in response.json():
            self.assertGreaterEqual(member["last_activity_ts"], before)
            self.assertLessEqual(member["last_activity_ts"], after)

    def test_teammates_stream_route_registered(self) -> None:
        # We verify the route exists by inspecting app.routes rather than
        # actually streaming. TestClient.stream + an indefinite SSE
        # generator hangs on close in the unit-test harness; iteration
        # is covered by integration smokes outside the unit suite. The
        # single-event shape is exercised synchronously via
        # _enriched_roster() in TestEnrichedRosterValidation below.
        stream_routes = [
            r for r in self.app.routes
            if getattr(r, "path", None) == "/api/teammates/stream"
        ]
        self.assertEqual(len(stream_routes), 1, "stream route not registered")

    def test_health_endpoint(self) -> None:
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["ok"])
        self.assertEqual(body["service"], "cowork-console-team-coord")
        self.assertEqual(body["roster_count"], 5)


class TestEnrichedRosterValidation(unittest.TestCase):
    def test_drops_member_missing_required_field(self) -> None:
        bad_roster = [
            {"id": "lem", "name": "Lem", "role": "x", "signature_color": "#fff",
             "state": "working", "current_action": "ok"},
            # missing 'role':
            {"id": "broken", "name": "B", "signature_color": "#fff",
             "state": "working", "current_action": "ok"},
        ]
        with patch("backend.main._load_roster", return_value=bad_roster):
            out = _enriched_roster()
        self.assertEqual([m["id"] for m in out], ["lem"])

    def test_drops_member_with_unknown_state(self) -> None:
        bad_roster = [
            {"id": "lem", "name": "Lem", "role": "x", "signature_color": "#fff",
             "state": "working", "current_action": "ok"},
            {"id": "weird", "name": "W", "role": "x", "signature_color": "#fff",
             "state": "telepathic", "current_action": "ok"},
        ]
        with patch("backend.main._load_roster", return_value=bad_roster):
            out = _enriched_roster()
        self.assertEqual([m["id"] for m in out], ["lem"])


class TestAncestorSymlinkGuard(unittest.TestCase):
    """Mirrors lem/visual/paths.py guard; per the 5-flavor symlink defense
    captured in lem CHECKPOINTS.md."""

    def test_refuse_ancestor_symlink_rejects_symlinked_parent(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            outside = tmp_path / "outside"
            outside.mkdir(mode=0o755)
            link = tmp_path / "link_to_outside"
            link.symlink_to(outside, target_is_directory=True)
            roster = link / "teammates.json"
            with self.assertRaises(RosterPathError):
                _refuse_ancestor_symlink(roster, owning_root=tmp_path)

    def test_refuse_ancestor_symlink_accepts_canonical_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            real_dir = tmp_path / "real"
            real_dir.mkdir(mode=0o755)
            roster = real_dir / "teammates.json"
            # Should not raise
            _refuse_ancestor_symlink(roster, owning_root=tmp_path)


if __name__ == "__main__":
    unittest.main()
