"""cowork-console.backend.security — shared safety primitives.

Currently exports the ancestor-symlink defense helpers — mirror of
``lem/security/paths.py`` (lem PR #11, cleanup-3). Each repo carries
its own copy since they're independently installable; if cowork-console
ever depends on lem as a package, this can collapse.
"""

from .paths import (
    refuse_symlink,
    refuse_ancestor_symlink,
)

__all__ = [
    "refuse_symlink",
    "refuse_ancestor_symlink",
]
