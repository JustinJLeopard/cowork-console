from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from .bus_sqlite import DEFAULT_DB_PATH, DEFAULT_NOTIFY_PATH, BusMessage, TeammateBus
from .correlation import CorrelationClient
from .cowork_wake_drain import CoworkWakeDrain
from lem.live_inbox import read_for_wake


def build_bus(args: argparse.Namespace) -> TeammateBus:
    return TeammateBus(
        db_path=Path(args.db).expanduser(),
        notify_path=Path(args.notify).expanduser(),
    )


def message_to_line(message: BusMessage, *, json_payload: bool = False) -> str:
    if json_payload:
        payload = message.payload
    else:
        try:
            decoded = json.loads(message.payload)
            payload = decoded.get("text") or decoded.get("summary") or json.dumps(decoded, sort_keys=True)
        except json.JSONDecodeError:
            payload = message.payload
    return (
        f"#{message.id} {message.created_at or ''} "
        f"{message.sender or '?'} -> {message.recipient or '?'} "
        f"[{message.channel}] {payload}"
    ).strip()


def chat_main(argv: list[str] | None = None) -> int:
    parser = common_parser("lem-chat", "Send a direct message to Lem.")
    parser.add_argument("message", nargs="*", help="message text; stdin is used when omitted")
    parser.add_argument("--channel", default="justin/inbox")
    parser.add_argument("--sender", default="justin")
    parser.add_argument("--recipient", default="lem")
    args = parser.parse_args(argv)
    text = " ".join(args.message).strip() if args.message else sys.stdin.read().strip()
    if not text:
        parser.error("message is required")
    bus = build_bus(args)
    message_id = bus.insert(
        args.channel,
        {"type": "message", "text": text, "created_at_ts": int(time.time())},
        sender=args.sender,
        recipient=args.recipient,
    )
    print(f"sent #{message_id} to {args.recipient} on {args.channel}")
    return 0


def listen_main(argv: list[str] | None = None) -> int:
    parser = common_parser("lem-listen", "Read or tail messages from Lem.")
    parser.add_argument("--channel")
    parser.add_argument("--recipient", default="justin")
    parser.add_argument("--sender", default="lem")
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--since-id", type=int, default=None)
    parser.add_argument("--tail", action="store_true")
    parser.add_argument("--poll-interval", type=float, default=1.0)
    parser.add_argument("--json-payload", action="store_true")
    args = parser.parse_args(argv)
    bus = build_bus(args)
    if args.tail:
        last_seen = args.since_id if args.since_id is not None else bus.latest_id()
        while True:
            rows = bus.read_new(
                last_seen,
                limit=args.limit,
                channel=args.channel,
                recipient=args.recipient,
                sender=args.sender,
            )
            for row in rows:
                last_seen = max(last_seen, row.id)
                print(message_to_line(row, json_payload=args.json_payload), flush=True)
            time.sleep(args.poll_interval)
    rows = (
        bus.read_new(
            args.since_id,
            limit=args.limit,
            channel=args.channel,
            recipient=args.recipient,
            sender=args.sender,
        )
        if args.since_id is not None
        else bus.get_recent(
            limit=args.limit,
            channel=args.channel,
            recipient=args.recipient,
            sender=args.sender,
        )
    )
    for row in rows:
        print(message_to_line(row, json_payload=args.json_payload))
    return 0


def ask_main(argv: list[str] | None = None) -> int:
    parser = common_parser("lem-ask", "Ask Lem and wait for a correlated reply.")
    parser.add_argument("question", nargs="*", help="question text; stdin is used when omitted")
    parser.add_argument("--request-channel", default="justin/inbox")
    parser.add_argument("--reply-channel", default="justin/replies")
    parser.add_argument("--timeout", type=float, default=120.0)
    parser.add_argument("--poll-interval", type=float, default=0.5)
    args = parser.parse_args(argv)
    text = " ".join(args.question).strip() if args.question else sys.stdin.read().strip()
    if not text:
        parser.error("question is required")
    bus = build_bus(args)
    correlation = CorrelationClient(bus)
    request = correlation.send_request(
        text,
        request_channel=args.request_channel,
        reply_channel=args.reply_channel,
    )
    print(f"sent #{request.message_id}; waiting for reply {request.correlation_id}", flush=True)
    reply = correlation.wait_for_reply(
        request.correlation_id,
        since_id=request.message_id,
        timeout=args.timeout,
        poll_interval=args.poll_interval,
    )
    if reply is None:
        print(f"timed out waiting for {request.correlation_id}", file=sys.stderr)
        return 124
    print(message_to_line(reply))
    return 0


def cowork_wake_drain_main(argv: list[str] | None = None) -> int:
    parser = common_parser("cowork-wake-drain", "Drain Cowork-addressed bus messages.")
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--memory-key", default="cowork-bus-last-seen-id")
    parser.add_argument("--state-file")
    parser.add_argument("--no-persist", action="store_true")
    args = parser.parse_args(argv)
    bus = build_bus(args)
    drain = CoworkWakeDrain(
        bus,
        memory_key=args.memory_key,
        state_file=args.state_file,
    )
    result = drain.drain(limit=args.limit, persist=not args.no_persist)
    live = read_for_wake("cowork", limit=args.limit, persist=not args.no_persist)
    print(
        json.dumps(
            {
                "previous_last_seen_id": result.previous_last_seen_id,
                "new_last_seen_id": result.new_last_seen_id,
                "messages": [message.__dict__ for message in result.messages],
                "live_inbox": live,
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0


def common_parser(prog: str, description: str) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog=prog, description=description)
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH))
    parser.add_argument("--notify", default=str(DEFAULT_NOTIFY_PATH))
    return parser
