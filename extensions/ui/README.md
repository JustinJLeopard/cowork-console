# Lem UI Extension

Phase A1 adds a local, loopback-only browser console for Justin <-> Lem text chat.

## Run

```bash
cd /home/justinleopard/projects/lem
bash extensions/ui/start.sh
```

Open:

```text
http://127.0.0.1:8787
```

The backend writes a local session token file at:

```text
~/.lem/ui-session.json
```

The file is created with mode `600`. The token is delivered to the browser in an httpOnly cookie.

## Scope

- `Lem` mode writes to the teammate bus through `extensions/comms`.
- `Dayjob` mode is visible but guarded until Phase A2.
- Wake/drain is an explicit header button.
- Vision endpoint is a placeholder readout in Settings.
- Live mode polls `~/.lem/live-inbox.jsonl` through `/api/live-inbox`.

## Security

- Backend refuses non-loopback host in Phase A1.
- CORS allows only the local UI origins.
- No external runtime assets or telemetry libraries are used.
- The UI extension does not modify `~/projects/lem/lem/` core files.

## Development

Backend:

```bash
python3 -m uvicorn extensions.ui.backend.main:app --host 127.0.0.1 --port 8787
```

Frontend:

```bash
cd extensions/ui/frontend
npm install
npm run dev
```

Tests:

```bash
pytest tests/test_ui_backend.py tests/test_ui_send_receive_integration.py
cd extensions/ui/frontend && npm run build && npm test
```

Playwright uses a temp teammate bus and temp session directory; it does not write the real `~/.lem/ui-session.json`.
