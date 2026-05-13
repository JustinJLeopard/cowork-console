# Live Messaging Channel

Lem-first live messaging uses one shared inbox file:

```text
/home/justinleopard/.lem/live-inbox.jsonl
```

Each line is one JSON object:

```json
{"ts":"2026-05-09T21:20:00+00:00","from":"lem","to":"cowork","channel":"live/lem-status","severity":"info","summary":"short status","body":"optional detail","source":"lem-agent"}
```

Contract:

- Writers append one complete JSON line. Do not rewrite history.
- Readers keep their own cursor under `~/.lem/live-inbox-readers/<reader>.last_id`.
- Wake hook command: `$HOME/bin/lem-live-inbox wake --reader <agent-name>`.
- `read_for_wake` delivers only messages whose `to:` matches the reader name,
  `all`, or `broadcast`. Other messages are skipped for delivery but the
  cursor still advances past them (so they are not re-delivered).
- Lem reads messages addressed to `lem`, `all`, or `broadcast` on its heartbeat cycle.
- Lem writes live status messages from its decision loop when a novel event is handled.
- This is an in-context inbox. It is not pub/sub, routing, or orchestration.

Claim / ack convention (documented, not enforced):

- When a reader picks up a task-like message (an instruction or
  authorization addressed to it), it should post an ack message before
  acting. The ack establishes a soft claim so a peer reading the same
  inbox state does not start the same work in parallel.
- Ack format: a new message back to the original sender (or `cowork`)
  with `channel: live/coordination`, summary starting with `ACK:` or
  `CLAIM:`, naming the task being claimed. Completion is similarly
  reported as `DONE:` or `COMPLETE:`.
- This is a convention, not a lock. Two readers can still race if both
  ack inside the same scheduler tick; the convention narrows the window
  rather than eliminating it. If stronger guarantees are needed in
  future, add a real claim file under `~/.lem/live-inbox-claims/`.

Cursor observability:

- `read_for_wake` with `persist=True` emits one INFO log line per actual
  cursor advance, captured to stderr by default (the CLI configures
  `logging.basicConfig` for this). The Claude Code SessionStart helper
  redirects stderr to `~/.lem/live-inbox-cursor.log` so the line is not
  lost. Format: `live_inbox cursor advance: reader=X prev=N new=M
  pid=P ppid=PP`.

Console:

- `http://127.0.0.1:8787` has a `Live` tab.
- The tab polls `/api/live-inbox` once per second and renders new lines without a user prompt.
