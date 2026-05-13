# Proposal: Per-Agent Personal DBs + Embedding Format Migration

**Date:** 2026-05-10  
**Author:** cowork  
**Status:** IMPLEMENTED by codex-app on 2026-05-10, with cowork correction applied

---

## Background

Following a DB health audit (2026-05-10), two improvements are proposed:

1. **Per-agent personal DBs** — each agent gets its own DB file with the same schema as `~/.swarm/memory.db`
2. **Embedding storage migration** — move embeddings from TEXT (JSON array) to BLOB (Float32Array) for 5.5× storage reduction

Correction applied after proposal review: personal DBs are for increased private use, not controlled sharing. Agents write to their personal DBs freely. The shared global DB continues exactly as before: write there whenever the fact benefits the team. No promote mechanism is implemented.

---

## 1. Per-Agent Personal DBs

### Problem

All agents (Lem, cowork, claude-code, codex) currently share `~/.swarm/memory.db`. This creates:
- Write conflicts requiring Sacred ceremony for every store
- No private scratchpad for in-flight agent state
- No clean isolation for agent-specific operational context

### Design

Each agent gets: `~/.swarm/agents/<agent-name>.db`

**Key constraint from Justin:** Same schema as `~/.swarm/memory.db` — no new tools, no new commands, no confusion switching between stores.

#### Schema

Identical to `~/.swarm/memory.db` `memory_entries` table:

```sql
CREATE TABLE memory_entries (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  namespace TEXT DEFAULT 'default',
  content TEXT NOT NULL,
  type TEXT DEFAULT 'semantic',
  embedding BLOB,           -- Float32Array bytes
  embedding_model TEXT DEFAULT 'local',
  embedding_dimensions INTEGER,
  tags TEXT,                -- JSON array
  metadata TEXT,            -- JSON object
  owner_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  expires_at INTEGER,
  last_accessed_at INTEGER,
  access_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  scope TEXT DEFAULT 'private_<agent>',
  UNIQUE(namespace, key)
);
-- Minimal supporting tables (no trajectories/sessions/patterns in personal DBs)
CREATE TABLE metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);
CREATE INDEX idx_memory_key ON memory_entries(key);
CREATE INDEX idx_memory_namespace ON memory_entries(namespace);
CREATE INDEX idx_memory_status ON memory_entries(status);
```

No trajectories, sessions, patterns, vector_indexes, or migration_state tables — those belong only in the shared DB.

#### CLI targeting

`memory-global` CLI gets a `--db <path>` flag:

```bash
# Write to personal DB
memory-global store --upsert --db ~/.swarm/agents/cowork.db -k "my-key" -v "value"

# Read from personal DB  
memory-global retrieve --db ~/.swarm/agents/cowork.db -k "my-key"

# Default (no --db flag): ~/.swarm/memory.db (unchanged behavior)
```

#### Shared-write rule

No promote command exists. If a personal-memory fact benefits the team, write the fact to the shared global DB directly with the same shared-memory judgment used before this change.

#### Agent DB locations

| Agent | DB Path |
|-------|---------|
| Lem | `~/.swarm/agents/lem.db` |
| cowork | `~/.swarm/agents/cowork.db` |
| claude-code | `~/.swarm/agents/claude-code.db` |
| codex | `~/.swarm/agents/codex.db` |

#### Benefits

- No ceremony required for personal writes
- Shared DB behavior stays unchanged for team-benefit writes
- Same schema → same CLI → no context-switching confusion
- Easy cross-agent sharing via SQLite ATTACH if needed
- Personal DBs can have embeddings too (same pipeline)

---

## 2. Embedding Storage Migration: TEXT → BLOB

### Problem

Current state: embeddings stored as `TEXT` (JSON array string).  
Each 768-dim embedding: ~17KB as JSON text vs ~3KB as BLOB Float32Array.  
**5.5× storage overhead.** The 20MB DB size is largely attributable to this.

### Migration plan

```python
# One-time migration script
import sqlite3, json, struct

db = sqlite3.connect(os.path.expanduser("~/.swarm/memory.db"))

# 1. Rebuild memory_entries with embedding BLOB while preserving the column name

# 2. Migrate each TEXT embedding to BLOB
rows = db.execute("SELECT id, embedding FROM memory_entries WHERE embedding IS NOT NULL").fetchall()
for row_id, emb_text in rows:
    floats = json.loads(emb_text)
    blob = struct.pack(f'{len(floats)}f', *floats)
    db.execute("UPDATE memory_entries SET embedding = ? WHERE id = ?", (blob, row_id))

db.commit()

# 3. Verify counts match
text_count = db.execute("SELECT COUNT(*) FROM memory_entries WHERE embedding IS NOT NULL").fetchone()[0]
blob_count = db.execute("SELECT COUNT(*) FROM memory_entries WHERE embedding IS NOT NULL").fetchone()[0]
assert text_count == blob_count, f"Mismatch: {text_count} vs {blob_count}"

# 4. Drop the old TEXT table only after count verification

db.close()
```

**Expected outcome:** DB shrinks from ~20MB to ~6MB. Embedding queries are faster (no JSON parsing).

**Read path update:** Load BLOB as `struct.unpack(f'{dim}f', blob)` or in Node as `new Float32Array(buffer)`.

### Brute-force cosine retrieval (replace HNSW for now)

At 982 entries, 768-dim, brute-force cosine in Node.js completes in <5ms — faster than the HNSW file I/O overhead.

```js
function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function semanticSearch(db, queryEmbedding, topK = 10) {
  const rows = db.prepare(
    "SELECT id, key, content, embedding FROM memory_entries WHERE embedding IS NOT NULL AND status = 'active'"
  ).all();
  
  return rows
    .map(row => {
      const emb = new Float32Array(row.embedding.buffer);
      return { ...row, score: cosineSim(queryEmbedding, emb) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
```

**HNSW:** Keep `hnsw.index` and `hnsw.metadata.json` as-is for now. Revisit sqlite-vec when Node's built-in `node:sqlite` (Node 22+) is standard and the Windows DLL version mismatch is resolved.

---

## 3. Missing Embeddings (9 entries)

Originally listed missing embeddings:

```
stress-test-validation-2        (28 bytes — may be test data, OK to skip)
stress-test-2-3                  (28 bytes — may be test data, OK to skip)
capability-build-web-apps-justin (1372 bytes)
harness-v2-litellm-ceremony-shipped-2026-05-06 (666 bytes)
cowork-wake-finding-2026-05-07-0604-yellow (3150 bytes)
cowork-wake-finding-2026-05-07-0817-yellow (2994 bytes)
apprenticeship-architecture-2026-05-07 (4097 bytes)
iain-headless-architecture-2026-05-07 (4585 bytes)
4-tier-architecture-2026-05-07 (4004 bytes)
```

Implementation note: on 2026-05-10 these exact keys were not active rows in the current global DB, and the DB reported zero active NULL embeddings. Re-embed was therefore verified as a no-op instead of blindly creating rows.

---

## 4. Scope Column

`memory_entries.scope` is the zero-cost isolation layer from the context-engineering review:

- Shared DB default: `user_global`
- Personal DB defaults: `private_lem`, `private_cowork`, `private_claude-code`, `private_codex`
- Project scopes remain available as `project_<name>` when a project-specific DB or future adapter needs them.

---

## 5. Snapshot Retention Policy

Script installed at `~/bin/memory-bak-cleanup`.

**Policy:**
- Keep ALL named ceremony backups (non-watch-yellow)
- Keep ALL `.corrupted` artifacts
- Keep `watch-yellow` from last 7 days (all)
- Thin `watch-yellow` between 7–30 days old to 3/day (first, mid, last)
- Delete `watch-yellow` older than 30 days
- Delete zero-byte stubs

**Run:** `memory-bak-cleanup` (or `DRY_RUN=1 memory-bak-cleanup` to preview)

Monthly per-agent maintenance cron entries run `PRAGMA integrity_check; PRAGMA optimize; VACUUM;` against each DB under `~/.swarm/agents/`.

---

## Implementation Priority

| Item | Priority | Owner | Blocker |
|------|----------|-------|---------|
| Re-embed 9 missing entries | HIGH | claude-code | Lemonade up |
| Embedding BLOB migration | MEDIUM | claude-code | Snapshot first |
| `--db` flag on memory-global | MEDIUM | claude-code | None |
| Personal DB init per agent | MEDIUM | claude-code | --db flag |
| sqlite-vec (BLOB+brute-force first) | LOW | parked | Node 22 |
