"""Shared ancestor-symlink defense helpers — cowork-console mirror of
``lem/security/paths.py`` (lem PR #11, cleanup-3, 2026-05-14).

This is a verbatim port of the lem-side helpers. Each repo carries
its own copy since they're independently installable; if cowork-console
ever depends on lem as a package, this module can collapse to a
re-export.

cowork-console doesn't currently need the ``refuse_ancestor_symlink_or_escape``
variant (no module uses an explicit ``owning_root`` concept here), so
it's omitted. Add it if a future module needs the bounded-walk +
contain variant.

See ``lem/security/paths.py`` for the full pattern lessons banked
across the WIP intake + Followup D audit.
"""

from __future__ import annotations

from pathlib import Path


def refuse_symlink(
    path: Path,
    *,
    exc_type: type[Exception],
    role: str,
) -> None:
    """Raise ``exc_type`` if ``path`` itself is a symlink (leaf only)."""
    if path.is_symlink():
        raise exc_type(f"refuses to follow symlink for {role}: {path}")


def refuse_ancestor_symlink(
    path: Path,
    *,
    exc_type: type[Exception],
    role: str,
) -> None:
    """Walk ``path.parent`` → filesystem root, raising ``exc_type`` if
    the leaf or any ancestor is a symlink.

    Canonical defense for user-controlled root paths (e.g. ``LEM_BUS_DB``
    in bus_bridge.py)."""
    if path.is_symlink():
        raise exc_type(f"refuses to follow symlink for {role}: {path}")
    walker = path.parent
    while True:
        if walker.is_symlink():
            raise exc_type(
                f"refuses to follow ancestor symlink for {role}: {walker}"
            )
        if walker.parent == walker:
            return
        walker = walker.parent
