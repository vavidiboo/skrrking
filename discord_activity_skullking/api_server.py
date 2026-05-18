from __future__ import annotations

import random
import threading
import time
import uuid
import asyncio
import contextlib
import os
import mimetypes
import json
import copy
import hashlib
import hmac
import base64
import logging
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode, urlparse
from urllib.error import HTTPError
from urllib.request import Request as UrlRequest, urlopen

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect, Request as FastAPIRequest, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.datastructures import QueryParams
from pydantic import BaseModel, Field
from .activity_service import GameService
from .core.card_rules import Card, is_escape, is_numbered
from .core import game_engine as engine
from .core.skull_king_rules import resolve_trick


SUIT_LABELS = {
    "yellow": "Treasure",
    "green": "Parrot",
    "purple": "Map",
    "black": "Jolly Roger",
}

MAX_PLAYERS = 8
MAX_ROUNDS = 10
TURN_LIMIT_SECONDS = max(5, int(os.getenv("ACTIVITY_TURN_LIMIT_SECONDS", "15")))
TIMEOUT_WATCH_INTERVAL_SECONDS = max(0.25, float(os.getenv("ACTIVITY_TIMEOUT_WATCH_INTERVAL_SECONDS", "0.5")))
STATE_WAIT_POLL_INTERVAL_SECONDS = min(
    1.0,
    max(0.05, float(os.getenv("ACTIVITY_STATE_WAIT_POLL_INTERVAL_SECONDS", "0.10"))),
)
ALLOW_ACTIVITY_SPECTATORS = os.getenv("ACTIVITY_ALLOW_SPECTATORS", "0").strip().lower() in {"1", "true", "yes", "on"}
DISCONNECT_GRACE_SECONDS = max(15, int(os.getenv("ACTIVITY_DISCONNECT_GRACE_SECONDS", "90")))
SPECTATOR_POLICY = "allow_read_only" if ALLOW_ACTIVITY_SPECTATORS else "disabled"
RECONNECT_GRACE_SECONDS = min(90, max(30, int(os.getenv("ACTIVITY_RECONNECT_GRACE_SECONDS", "60"))))
AFK_TIMEOUT_STREAK_LIMIT = max(2, int(os.getenv("ACTIVITY_AFK_TIMEOUT_STREAK_LIMIT", "3")))
TRICK_REVEAL_HOLD_SECONDS = max(0, int(os.getenv("ACTIVITY_TRICK_REVEAL_HOLD_SECONDS", "5")))
SOLO_LOBBY_EXPIRY_SECONDS = max(60, int(os.getenv("ACTIVITY_SOLO_LOBBY_EXPIRY_SECONDS", "300")))
EMPTY_SESSION_GRACE_SECONDS = max(5, int(os.getenv("ACTIVITY_EMPTY_SESSION_GRACE_SECONDS", "30")))
IDENTITY_TOKEN_TTL_SECONDS = max(300, int(os.getenv("ACTIVITY_IDENTITY_TOKEN_TTL_SECONDS", "43200")))
IDENTITY_TOKEN_SKEW_SECONDS = max(30, int(os.getenv("ACTIVITY_IDENTITY_TOKEN_SKEW_SECONDS", "120")))
IDENTITY_COOKIE_SAMESITE = os.getenv("ACTIVITY_IDENTITY_COOKIE_SAMESITE", "auto").strip().lower()
if IDENTITY_COOKIE_SAMESITE not in {"auto", "lax", "strict", "none"}:
    IDENTITY_COOKIE_SAMESITE = "auto"
IDENTITY_COOKIE_SECURE = os.getenv("ACTIVITY_IDENTITY_COOKIE_SECURE", "0").strip().lower() in {"1", "true", "yes", "on"}
if IDENTITY_COOKIE_SAMESITE == "none":
    # Browsers require Secure when SameSite=None.
    IDENTITY_COOKIE_SECURE = True

APP_STARTED_AT = time.time()
DEPLOYMENT_MODE = os.getenv("ACTIVITY_DEPLOYMENT_MODE", "single_instance").strip().lower()
if DEPLOYMENT_MODE not in {"single_instance", "multi_instance"}:
    DEPLOYMENT_MODE = "single_instance"

ENABLE_RATE_LIMIT = os.getenv("ACTIVITY_ENABLE_RATE_LIMIT", "1").strip().lower() in {"1", "true", "yes", "on"}
RATE_LIMIT_WINDOW_SECONDS = max(10, int(os.getenv("ACTIVITY_RATE_LIMIT_WINDOW_SECONDS", "60")))
RATE_LIMIT_DEFAULT_MAX_REQUESTS = max(60, int(os.getenv("ACTIVITY_RATE_LIMIT_DEFAULT_MAX_REQUESTS", "600")))
RATE_LIMIT_STATE_MAX_REQUESTS = max(60, int(os.getenv("ACTIVITY_RATE_LIMIT_STATE_MAX_REQUESTS", "900")))
RATE_LIMIT_MUTATION_MAX_REQUESTS = max(10, int(os.getenv("ACTIVITY_RATE_LIMIT_MUTATION_MAX_REQUESTS", "240")))
TRANSPORT_PROTOCOL_VERSION = "turn-based-snapshot.v2"


def configure_logging() -> None:
    level_name = os.getenv("ACTIVITY_LOG_LEVEL", "INFO").strip().upper() or "INFO"
    level = getattr(logging, level_name, logging.INFO)
    root_logger = logging.getLogger()
    if not root_logger.handlers:
        logging.basicConfig(
            level=level,
            format="%(asctime)s %(levelname)s %(name)s %(message)s",
        )
    root_logger.setLevel(level)


configure_logging()
logger = logging.getLogger("skullking.activity")


def card_label_from_engine(card: Card) -> str:
    if is_numbered(card):
        return f"{SUIT_LABELS.get(str(card.suit), str(card.suit))} {card.number}"
    if card.kind == "skull_king":
        return "Skull King"
    if card.kind == "mermaid":
        return "Mermaid"
    if card.kind == "pirate":
        return "Pirate"
    if card.kind == "escape":
        return "Escape"
    if card.kind == "tigress":
        return "Tigress"
    if card.kind == "kraken":
        return "Kraken"
    if card.kind == "white_whale":
        return "White Whale"
    return str(card.kind or "Card")


def build_session(session_id: str) -> Dict[str, Any]:
    return {
        "id": session_id,
        "session_id": session_id,
        "_doc_type": "activity_session",
        "status": "lobby",
        "room_status": "waiting",
        "phase": "idle",
        "host_id": None,
        "players": [],
        "round_number": 0,
        "cards_dealt": 0,
        "leader_index": 0,
        "turn_index": 0,
        "tricks_completed": 0,
        "current_trick": [],
        "last_trick": [],
        "flow_events": [],
        "last_winner_id": None,
        "logs": [],
        "turn_started_at": 0,
        "turn_deadline_at": 0,
        "trick_hold_until": 0,
        "turn_limit_seconds": TURN_LIMIT_SECONDS,
        "created_at": int(time.time()),
        "updated_at": int(time.time_ns() // 1_000_000),
    }


def current_updated_at_ms() -> int:
    return int(time.time_ns() // 1_000_000)


def next_updated_at(previous: Any = 0) -> int:
    prior = int(previous or 0)
    return max(current_updated_at_ms(), prior + 1 if prior > 0 else 0)


def bump_session_updated_at(session: Dict[str, Any]) -> int:
    next_value = next_updated_at(session.get("updated_at", 0))
    session["updated_at"] = next_value
    return next_value


def add_log(session: Dict[str, Any], message: str) -> None:
    session["logs"].insert(0, f"[R{session['round_number']}] {message}")
    session["logs"] = session["logs"][:20]
    bump_session_updated_at(session)


_IDEMPOTENCY_TTL_SECONDS = 60
_IDEMPOTENCY_MAX_ENTRIES = 20


def check_idempotency(session: Dict[str, Any], request_id: Optional[str]) -> Optional[Dict[str, Any]]:
    if not request_id:
        return None
    cache: Dict[str, Any] = session.get("_idempotency") or {}
    entry = cache.get(request_id)
    if entry and entry.get("expires_at", 0) > time.time():
        return entry["response"]
    return None


def store_idempotency(session: Dict[str, Any], request_id: Optional[str], response: Dict[str, Any]) -> None:
    if not request_id:
        return
    cache: Dict[str, Any] = session.setdefault("_idempotency", {})
    now = time.time()
    # Purge expired entries
    expired = [k for k, v in cache.items() if v.get("expires_at", 0) <= now]
    for k in expired:
        del cache[k]
    # Evict oldest if over limit
    if len(cache) >= _IDEMPOTENCY_MAX_ENTRIES:
        oldest = sorted(cache.items(), key=lambda x: x[1].get("expires_at", 0))
        for k, _ in oldest[: len(cache) - _IDEMPOTENCY_MAX_ENTRIES + 1]:
            del cache[k]
    cache[request_id] = {"response": response, "expires_at": now + _IDEMPOTENCY_TTL_SECONDS}


def set_flow_events(session: Dict[str, Any], *events: Dict[str, Any]) -> List[Dict[str, Any]]:
    payload = [event for event in events if isinstance(event, dict)]
    session["flow_events"] = payload
    return payload


def build_flow_event(kind: str, *, room: engine.RoomState, **extra: Any) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "kind": str(kind),
        "round_number": int(room.round_number),
        "status": str(room.status),
        "phase": str(room.phase),
        "tricks_completed": int(room.tricks_completed),
        "at": current_updated_at_ms(),
    }
    payload.update(extra)
    return payload

def session_card_to_engine_card(card: Dict[str, Any]) -> Card:
    ctype = card.get("type")
    if ctype == "suit":
        return Card(suit=card.get("suit"), number=card.get("value"))
    if ctype == "tigress":
        return Card(kind="tigress", tigress_as=card.get("mode"))
    return Card(kind=ctype)


def engine_card_to_session_card(card: Card) -> Dict[str, Any]:
    if card.kind is None:
        out = {"type": "suit", "suit": card.suit, "value": card.number}
    else:
        out = {"type": card.kind, "suit": None, "value": None}
    if card.kind == "tigress" and card.tigress_as in {"pirate", "escape"}:
        out["mode"] = card.tigress_as
    out["id"] = uuid.uuid4().hex
    return out


def status_phase_from_session_status(status: str) -> tuple[str, str]:
    mapping = {
        "lobby": ("waiting", "idle"),
        "bidding": ("playing", "bidding"),
        "playing": ("playing", "playing"),
        "waiting_round": ("playing", "waiting_next_round"),
        "finished": ("finished", "idle"),
    }
    return mapping.get(status, ("waiting", "idle"))


def normalize_player_state(state: str) -> str:
    safe = str(state or "").strip().lower()
    if safe in {"not_ready", "ready", "bid", "playing", "finished"}:
        return safe
    return "not_ready"


def default_player_state_for_room(room: engine.RoomState, player: engine.PlayerState) -> str:
    if room.phase == "bidding":
        return "bid" if player.bid is None else "ready"
    if room.phase in {"playing", "scoring"}:
        return "playing"
    return "not_ready"


def resolved_player_state_for_room(
    room: engine.RoomState,
    player: engine.PlayerState,
    previous_state: str = "",
) -> str:
    # During active game phases, runtime phase takes priority over previous lobby toggles.
    if room.phase in {"bidding", "playing", "scoring"}:
        return default_player_state_for_room(room, player)

    prior = normalize_player_state(previous_state)
    if prior in {"ready", "not_ready"}:
        return prior
    return "not_ready"


def session_doc_to_room(session: Dict[str, Any]) -> engine.RoomState:
    normalize_session_status_fields(session)
    players: List[engine.PlayerState] = []
    for idx, p in enumerate(session.get("players") or []):
        if not isinstance(p, dict):
            continue
        hand = [session_card_to_engine_card(c) for c in (p.get("hand") or []) if isinstance(c, dict)]
        players.append(
            engine.PlayerState(
                id=str(p.get("id", "")),
                name=str(p.get("name", "")),
                order=int(p.get("order", idx + 1)),
                score=int(p.get("score", 0)),
                bid=p.get("bid"),
                tricks_won=int(p.get("tricks_won", 0)),
                round_bonus=int(p.get("round_bonus", 0)),
                hand=hand,
            )
        )

    current_trick: List[engine.TrickPlay] = []
    for tp in session.get("current_trick") or []:
        if not isinstance(tp, dict) or not isinstance(tp.get("card"), dict):
            continue
        current_trick.append(
            engine.TrickPlay(
                player_id=str(tp.get("player_id", "")),
                card=session_card_to_engine_card(tp["card"]),
            )
        )

    status = str(session.get("status", "lobby"))
    room_status, phase = status_phase_from_session_status(status)
    if session.get("phase"):
        phase = str(session["phase"])
    if session.get("room_status"):
        room_status = str(session["room_status"])

    settings_data = session.get("settings") or {}
    settings = engine.Settings(
        bonus_enabled=bool(settings_data.get("bonus_enabled", False)),
        advanced_rules_enabled=bool(settings_data.get("advanced_rules_enabled", False)),
        max_players=int(settings_data.get("max_players", MAX_PLAYERS)),
        max_rounds=int(settings_data.get("max_rounds", MAX_ROUNDS)),
    )

    room = engine.RoomState(
        id=str(session.get("session_id") or session.get("id")),
        name=str(session.get("room_name") or session.get("name") or session.get("session_id")),
        host_player=str(session.get("host_id") or (players[0].id if players else "")),
        created_at=int(session.get("created_at", int(time.time()))),
        status=room_status,  # type: ignore[arg-type]
        round_number=int(session.get("round_number", 0)),
        leader_index=int(session.get("leader_index", 0)),
        current_turn_index=int(session.get("turn_index", 0)),
        tricks_completed=int(session.get("tricks_completed", 0)),
        phase=phase,  # type: ignore[arg-type]
        settings=settings,
        players=players,
        current_trick=current_trick,
    )
    return room


def session_status_from_room(room: engine.RoomState) -> str:
    if room.status == "finished":
        return "finished"
    if room.round_number == 0 and room.phase == "idle":
        return "lobby"
    if room.phase == "bidding":
        return "bidding"
    if room.phase == "playing":
        return "playing"
    if room.phase in {"scoring", "waiting_next_round"}:
        return "waiting_round"
    return "lobby"


def canonical_status_from_fields(room_status: str, phase: str, round_number: int) -> str:
    room_status = str(room_status or "waiting").strip().lower()
    phase = str(phase or "idle").strip().lower()
    if room_status == "finished":
        return "finished"
    if phase == "bidding":
        return "bidding"
    if phase == "playing":
        return "playing"
    if phase in {"scoring", "waiting_next_round"}:
        return "waiting_round"
    if phase == "idle" and int(round_number or 0) > 0:
        return "waiting_round"
    return "lobby"


def normalize_session_status_fields(session: Dict[str, Any]) -> None:
    valid_room_status = {"waiting", "playing", "finished"}
    valid_phase = {"idle", "bidding", "playing", "scoring", "waiting_next_round"}

    status = str(session.get("status", "lobby")).strip().lower()
    room_status = str(session.get("room_status", "")).strip().lower()
    phase = str(session.get("phase", "")).strip().lower()

    fallback_room_status, fallback_phase = status_phase_from_session_status(status)
    if room_status not in valid_room_status:
        room_status = fallback_room_status
    if phase not in valid_phase:
        phase = fallback_phase

    session["room_status"] = room_status
    session["phase"] = phase
    session["status"] = canonical_status_from_fields(
        room_status=room_status,
        phase=phase,
        round_number=int(session.get("round_number", 0) or 0),
    )


def reset_session_to_lobby(session: Dict[str, Any]) -> None:
    normalize_session_status_fields(session)
    session["status"] = "lobby"
    session["room_status"] = "waiting"
    session["phase"] = "idle"
    session["round_number"] = 0
    session["cards_dealt"] = 0
    session["leader_index"] = 0
    session["turn_index"] = 0
    session["tricks_completed"] = 0
    session["current_trick"] = []
    session["last_trick"] = []
    session["flow_events"] = []
    session["last_winner_id"] = None
    session["turn_started_at"] = 0
    session["turn_deadline_at"] = 0
    session["trick_hold_until"] = 0

    players = session.get("players") if isinstance(session.get("players"), list) else []
    for player in players:
        if not isinstance(player, dict):
            continue
        player["state"] = "not_ready"
        player["score"] = 0
        player["bid"] = None
        player["tricks_won"] = 0
        player["round_bonus"] = 0
        player["hand"] = []
        player["afk"] = False
        player["afk_since"] = 0
        player["consecutive_timeout_count"] = 0

    bump_session_updated_at(session)


def room_to_session_doc(room: engine.RoomState, prev: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    prev = prev or {}
    prev_settings = prev.get("settings") if isinstance(prev.get("settings"), dict) else {}
    prev_players = prev.get("players") if isinstance(prev.get("players"), list) else []
    prev_by_id: Dict[str, Dict[str, Any]] = {
        str(pp.get("id", "")): pp
        for pp in prev_players
        if isinstance(pp, dict) and pp.get("id")
    }
    now_ts = int(time.time())
    players = []
    for p in room.players:
        prev_meta = prev_by_id.get(str(p.id), {})
        players.append(
            {
                "id": p.id,
                "name": p.name,
                "order": p.order,
                "score": p.score,
                "bid": p.bid,
                "tricks_won": p.tricks_won,
                "round_bonus": p.round_bonus,
                "hand": [engine_card_to_session_card(c) for c in p.hand],
                "joined_at": int(prev_meta.get("joined_at", now_ts)),
                "discord_user_id": prev_meta.get("discord_user_id"),
                "avatar_url": prev_meta.get("avatar_url"),
                "connection_state": str(prev_meta.get("connection_state") or "connected"),
                "last_seen_at": int(prev_meta.get("last_seen_at", now_ts) or now_ts),
                "disconnected_at": prev_meta.get("disconnected_at"),
                "consecutive_timeout_count": int(prev_meta.get("consecutive_timeout_count", 0) or 0),
                "afk": bool(prev_meta.get("afk", False)),
                "afk_since": int(prev_meta.get("afk_since", 0) or 0),
                "leave_requested_at": int(prev_meta.get("leave_requested_at", 0) or 0),
                "reconnect_failed_at": int(prev_meta.get("reconnect_failed_at", 0) or 0),
                "state": resolved_player_state_for_room(room, p, str(prev_meta.get("state") or "")),
            }
        )

    current_trick = [
        {
            "player_id": tp.player_id,
            "player_name": next((pp.name for pp in room.players if pp.id == tp.player_id), tp.player_id),
            "card": engine_card_to_session_card(tp.card),
        }
        for tp in room.current_trick
    ]

    return {
        "id": room.id,
        "session_id": room.id,
        "_doc_type": "activity_session",
        "room_name": room.name,
        "status": session_status_from_room(room),
        "room_status": room.status,
        "phase": room.phase,
        "host_id": room.host_player,
        "players": players,
        "round_number": room.round_number,
        "cards_dealt": room.round_number,
        "leader_index": room.leader_index,
        "turn_index": room.current_turn_index,
        "tricks_completed": room.tricks_completed,
        "current_trick": current_trick,
        "last_trick": prev.get("last_trick", []),
        "flow_events": prev.get("flow_events", []),
        "last_winner_id": prev.get("last_winner_id"),
        "logs": prev.get("logs", []),
        "turn_started_at": int(prev.get("turn_started_at", 0) or 0),
        "turn_deadline_at": int(prev.get("turn_deadline_at", 0) or 0),
        "trick_hold_until": int(prev.get("trick_hold_until", 0) or 0),
        "turn_limit_seconds": int(
            prev_settings.get("turn_limit_seconds", prev.get("turn_limit_seconds", TURN_LIMIT_SECONDS)) or TURN_LIMIT_SECONDS
        ),
        "created_at": int(prev.get("created_at", room.created_at)),
        "updated_at": next_updated_at(prev.get("updated_at", 0)),
        "settings": {
            "bonus_enabled": room.settings.bonus_enabled,
            "advanced_rules_enabled": room.settings.advanced_rules_enabled,
            "max_players": room.settings.max_players,
            "max_rounds": room.settings.max_rounds,
            "turn_limit_seconds": int(prev_settings.get("turn_limit_seconds", prev.get("turn_limit_seconds", TURN_LIMIT_SECONDS)) or TURN_LIMIT_SECONDS),
            "allow_spectators": bool(prev_settings.get("allow_spectators", False)),
        },
        "room_password": prev.get("room_password"),
        "activity_instance_id": prev.get("activity_instance_id"),
    }


def engine_card_dict_to_card(data: Dict[str, Any]) -> Card:
    return Card(
        suit=data.get("suit"),
        number=data.get("number"),
        kind=data.get("kind"),
        tigress_as=data.get("tigress_as"),
    )


def client_card_payload_from_engine_card(card: Card) -> Dict[str, Any]:
    payload = engine_card_to_session_card(card)
    payload["label"] = card_label_from_engine(card)
    payload["needs_mode"] = card.kind == "tigress"
    return payload


def determine_lead_suit_room(room: engine.RoomState) -> Optional[str]:
    if not room.current_trick:
        return None
    first = room.current_trick[0].card
    if is_numbered(first):
        return str(first.suit)
    if is_escape(first):
        for tp in room.current_trick[1:]:
            if is_numbered(tp.card):
                return str(tp.card.suit)
    return None


def legal_card_indexes_room(room: engine.RoomState, player: engine.PlayerState) -> List[int]:
    return engine.legal_card_indexes(room, player)


def current_turn_player_id_from_room(room: engine.RoomState) -> str:
    if not room.players:
        return ""
    try:
        return str(room.players[room.current_turn_index % len(room.players)].id)
    except Exception:
        return ""


def trick_payload_from_room(room: engine.RoomState) -> List[Dict[str, Any]]:
    return [
        {
            "player_id": tp.player_id,
            "player_name": next((p.name for p in room.players if p.id == tp.player_id), tp.player_id),
            "card": client_card_payload_from_engine_card(tp.card),
        }
        for tp in room.current_trick
    ]


def resolve_closed_trick(room: engine.RoomState, full_trick: List[engine.TrickPlay]):
    plays_for_eval = [{"player_index": room.player_index(tp.player_id), "card": tp.card} for tp in full_trick]
    return resolve_trick(
        plays_for_eval,
        num_players=len(room.players),
        advanced_rules_enabled=room.settings.advanced_rules_enabled,
    )


def evaluate_closed_trick(room: engine.RoomState, full_trick: List[engine.TrickPlay]) -> tuple[Optional[int], Optional[int]]:
    resolution = resolve_closed_trick(room, full_trick)
    return resolution.winner_index, resolution.next_leader_index


def effective_turn_limit(session_doc: Dict[str, Any]) -> int:
    per_room = int((session_doc.get("settings") or {}).get("turn_limit_seconds", 0) or 0)
    return max(5, per_room if per_room > 0 else TURN_LIMIT_SECONDS)


def sync_turn_timer_for_room_doc(
    session_doc: Dict[str, Any],
    room: engine.RoomState,
    *,
    reset: bool = False,
    start_delay_seconds: int = 0,
) -> None:
    status = session_status_from_room(room)
    limit = effective_turn_limit(session_doc)
    session_doc["turn_limit_seconds"] = limit
    if status in {"bidding", "playing"}:
        deadline = int(session_doc.get("turn_deadline_at", 0) or 0)
        if reset or deadline <= 0:
            started_at = int(time.time()) + max(0, int(start_delay_seconds or 0))
            session_doc["turn_started_at"] = started_at
            session_doc["turn_deadline_at"] = started_at + limit
        return
    session_doc["turn_started_at"] = 0
    session_doc["turn_deadline_at"] = 0
    session_doc["trick_hold_until"] = 0


def effective_connection_state(player_meta: Dict[str, Any], now_ts: Optional[int] = None) -> str:
    now_ts = int(now_ts or time.time())
    base = str(player_meta.get("connection_state", "connected") or "connected").strip().lower()
    leave_requested_at = int(player_meta.get("leave_requested_at", 0) or 0)
    if leave_requested_at > 0:
        return "disconnected"
    if base == "connected":
        return "connected"
    disconnected_at = int(player_meta.get("disconnected_at", 0) or 0)
    if base == "disconnected" and disconnected_at > 0 and (now_ts - disconnected_at) < RECONNECT_GRACE_SECONDS:
        return "reconnecting"
    return "disconnected"


def reconnect_deadline_at(player_meta: Dict[str, Any]) -> int:
    disconnected_at = int(player_meta.get("disconnected_at", 0) or 0)
    if disconnected_at <= 0:
        return 0
    return disconnected_at + RECONNECT_GRACE_SECONDS


def match_session_phase_scope(status: str) -> str:
    normalized = str(status or "").strip().lower()
    if normalized == "lobby":
        return "lobby"
    if normalized == "finished":
        return "post_match"
    return "match_runtime"


def mark_player_timeout_penalty(
    session_doc: Dict[str, Any],
    *,
    player_id: str,
) -> None:
    players = session_doc.get("players") if isinstance(session_doc.get("players"), list) else []
    now_ts = int(time.time())
    for p in players:
        if not isinstance(p, dict) or str(p.get("id", "")) != str(player_id):
            continue
        current = int(p.get("consecutive_timeout_count", 0) or 0) + 1
        p["consecutive_timeout_count"] = current
        if current >= AFK_TIMEOUT_STREAK_LIMIT:
            if not bool(p.get("afk", False)):
                p["afk_since"] = now_ts
            p["afk"] = True
        return


def reset_player_timeout_penalty(
    session_doc: Dict[str, Any],
    *,
    player_id: str,
) -> None:
    players = session_doc.get("players") if isinstance(session_doc.get("players"), list) else []
    for p in players:
        if not isinstance(p, dict) or str(p.get("id", "")) != str(player_id):
            continue
        p["consecutive_timeout_count"] = 0
        p["afk"] = False
        p["afk_since"] = 0
        return


def count_participating_players(session: Dict[str, Any]) -> int:
    players = session.get("players") if isinstance(session.get("players"), list) else []
    count = 0
    for p in players:
        if not isinstance(p, dict):
            continue
        if int(p.get("leave_requested_at", 0) or 0) > 0:
            continue
        count += 1
    return count


def transfer_host_if_needed(session: Dict[str, Any]) -> None:
    players = session.get("players") if isinstance(session.get("players"), list) else []
    if not players:
        session["host_id"] = None
        return

    current_host = str(session.get("host_id") or "")
    valid_ids = {
        str(p.get("id", ""))
        for p in players
        if isinstance(p, dict) and int(p.get("leave_requested_at", 0) or 0) <= 0
    }
    if current_host and current_host in valid_ids:
        return

    candidates = [
        p
        for p in players
        if isinstance(p, dict) and int(p.get("leave_requested_at", 0) or 0) <= 0
    ]
    if not candidates:
        session["host_id"] = None
        return
    candidates.sort(key=lambda p: int(p.get("joined_at", 0) or 0))
    session["host_id"] = str(candidates[0].get("id", ""))


def finalize_session_due_to_player_shortage(session: Dict[str, Any], *, reason: str) -> bool:
    normalize_session_status_fields(session)
    prior = str(session.get("status", "")).lower()
    if prior == "finished":
        return False
    session["room_status"] = "finished"
    session["phase"] = "idle"
    session["status"] = "finished"
    session["turn_started_at"] = 0
    session["turn_deadline_at"] = 0
    bump_session_updated_at(session)
    add_log(session, reason)
    return True


def apply_reconnect_failure_policy_locked(session: Dict[str, Any]) -> bool:
    normalize_session_status_fields(session)
    status = str(session.get("status", "lobby")).lower()
    if status not in {"bidding", "playing"}:
        return False
    players = session.get("players") if isinstance(session.get("players"), list) else []
    if not players:
        return False

    now_ts = int(time.time())
    changed = False
    marked_names: List[str] = []
    for p in players:
        if not isinstance(p, dict):
            continue
        if int(p.get("leave_requested_at", 0) or 0) > 0:
            continue
        disconnected_at = int(p.get("disconnected_at", 0) or 0)
        if str(p.get("connection_state", "connected")) != "disconnected" or disconnected_at <= 0:
            continue
        if (now_ts - disconnected_at) < RECONNECT_GRACE_SECONDS:
            continue
        if int(p.get("reconnect_failed_at", 0) or 0) > 0:
            continue
        p["reconnect_failed_at"] = now_ts
        p["afk"] = True
        if int(p.get("afk_since", 0) or 0) <= 0:
            p["afk_since"] = now_ts
        p["consecutive_timeout_count"] = max(
            int(p.get("consecutive_timeout_count", 0) or 0),
            AFK_TIMEOUT_STREAK_LIMIT,
        )
        marked_names.append(str(p.get("name") or p.get("id") or "unknown"))
        changed = True
    if changed:
        add_log(session, f"Reconnect grace expired. AFK: {', '.join(marked_names[:3])}")
    if count_participating_players(session) < 2:
        changed = finalize_session_due_to_player_shortage(
            session,
            reason="Game ended: not enough active players after reconnect grace expiration.",
        ) or changed
    return changed


def penalty_auto_play_card_index(room: engine.RoomState, actor: engine.PlayerState, legal_indexes: List[int]) -> int:
    """
    Timeout default action policy (penalty-oriented, not best-play).
    The goal is predictable legal progress that is slightly disadvantageous
    to absent players without being randomly destructive.
    """
    if not actor.hand:
        return 0
    if not legal_indexes:
        return 0

    lead_suit = engine.determine_lead_suit(room)
    legal = [idx for idx in legal_indexes if 0 <= idx < len(actor.hand)]
    if not legal:
        return 0

    def numbered_indexes(indexes: List[int], *, suit: Optional[str] = None) -> List[int]:
        out: List[int] = []
        for idx in indexes:
            card = actor.hand[idx]
            if not is_numbered(card):
                continue
            if suit is not None and str(card.suit) != str(suit):
                continue
            out.append(idx)
        return out

    def pick_lowest_number(indexes: List[int]) -> Optional[int]:
        if not indexes:
            return None
        return min(indexes, key=lambda i: int(actor.hand[i].number or 0))

    # 1) Must-follow normal suit -> lowest number in that suit.
    if lead_suit:
        follow_numbered = numbered_indexes(legal, suit=str(lead_suit))
        chosen = pick_lowest_number(follow_numbered)
        if chosen is not None:
            return chosen

    # 2) Lowest normal numbered card (excluding trump/black for now).
    plain_numbered = [
        idx
        for idx in numbered_indexes(legal)
        if str(actor.hand[idx].suit) != "black"
    ]
    chosen = pick_lowest_number(plain_numbered)
    if chosen is not None:
        return chosen

    # 3) Escape (lowest-impact special).
    escape_indexes = [idx for idx in legal if is_escape(actor.hand[idx])]
    if escape_indexes:
        return escape_indexes[0]

    # 4) Low trump (black suit) numbered card.
    low_trump = pick_lowest_number(numbered_indexes(legal, suit="black"))
    if low_trump is not None:
        return low_trump

    core_high_impact = {"skull_king", "pirate", "mermaid", "tigress", "kraken", "white_whale"}

    # 5) Other special cards first.
    other_specials = [
        idx
        for idx in legal
        if actor.hand[idx].kind is not None and str(actor.hand[idx].kind) not in core_high_impact
    ]
    if other_specials:
        return other_specials[0]

    # 6) Core/high-impact specials as absolute last resort.
    core_priority = {"tigress": 0, "mermaid": 1, "pirate": 2, "white_whale": 3, "kraken": 4, "skull_king": 5}
    core_indexes = [idx for idx in legal if str(actor.hand[idx].kind or "") in core_priority]
    if core_indexes:
        return min(core_indexes, key=lambda i: core_priority.get(str(actor.hand[i].kind or ""), 99))

    return legal[0]


def timeout_penalty_card_index(room: engine.RoomState, actor: engine.PlayerState, legal_indexes: List[int]) -> int:
    # Backward-compatible alias.
    return penalty_auto_play_card_index(room, actor, legal_indexes)


def session_store_fingerprint(session: Dict[str, Any]) -> str:
    copied = copy.deepcopy(session)
    # Volatile timer metadata should not force persistent DB writes.
    copied.pop("updated_at", None)
    copied.pop("turn_started_at", None)
    copied.pop("turn_deadline_at", None)
    return json.dumps(copied, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def cache_and_save_if_significant_change(session: Dict[str, Any], *, prev: Optional[Dict[str, Any]] = None) -> bool:
    cache_set_session(session)
    sid = str(session.get("session_id") or "")
    if prev is None:
        save_session_to_store(session)
        if sid:
            schedule_session_broadcast(sid)
        return True
    if session_store_fingerprint(prev) != session_store_fingerprint(session):
        save_session_to_store(session)
        if sid:
            schedule_session_broadcast(sid)
        return True
    return False


def find_viewer_player_meta(
    session: Dict[str, Any],
    *,
    player_id: str = "",
    discord_user_id: str = "",
) -> Optional[Dict[str, Any]]:
    players = session.get("players") if isinstance(session.get("players"), list) else []
    safe_player_id = str(player_id or "")
    safe_discord_user_id = str(discord_user_id or "")

    if safe_player_id:
        direct = next(
            (p for p in players if isinstance(p, dict) and str(p.get("id", "")) == safe_player_id),
            None,
        )
        if isinstance(direct, dict):
            return direct

    if safe_discord_user_id:
        by_discord = next(
            (
                p
                for p in players
                if isinstance(p, dict)
                and (
                    str(p.get("discord_user_id", "") or "") == safe_discord_user_id
                    or str(p.get("id", "")) == safe_discord_user_id
                    or str(p.get("id", "")) == f"discord-{safe_discord_user_id}"
                )
            ),
            None,
        )
        if isinstance(by_discord, dict):
            return by_discord

    return None


def canonical_viewer_player_id(
    session: Dict[str, Any],
    *,
    player_id: str = "",
    discord_user_id: str = "",
) -> str:
    matched = find_viewer_player_meta(session, player_id=player_id, discord_user_id=discord_user_id)
    if isinstance(matched, dict):
        return str(matched.get("id", "") or "")
    return str(player_id or "")


def viewer_role_in_session(session: Dict[str, Any], viewer_id: str, discord_user_id: str = "") -> str:
    matched = find_viewer_player_meta(session, player_id=viewer_id, discord_user_id=discord_user_id)
    if matched is not None:
        return "player"
    return "spectator" if ALLOW_ACTIVITY_SPECTATORS else "forbidden"


def build_next_session_doc_after_play(
    room: engine.RoomState,
    prev_doc: Dict[str, Any],
    *,
    actor_id: str,
    actor_name: str,
    chosen_card: Card,
    before_trick: List[engine.TrickPlay],
    timeout_auto: bool = False,
    afk_auto: bool = False,
) -> Dict[str, Any]:
    next_doc = room_to_session_doc(room, prev=prev_doc)
    next_doc["trick_hold_until"] = 0
    flow_events: List[Dict[str, Any]] = []

    if afk_auto:
        add_log(next_doc, f"AFK auto-play. {actor_name} auto-played {card_label_from_engine(chosen_card)}")
    elif timeout_auto:
        add_log(next_doc, f"Turn timeout. {actor_name} auto-played {card_label_from_engine(chosen_card)}")
    else:
        add_log(next_doc, f"{actor_name} played {card_label_from_engine(chosen_card)}")

    flow_events.append(
        build_flow_event(
            "card_played",
            room=room,
            actor_id=actor_id,
            actor_name=actor_name,
            card_label=card_label_from_engine(chosen_card),
            timeout_auto=bool(timeout_auto),
            afk_auto=bool(afk_auto),
            trick_size=int(len(before_trick) + 1 if len(room.current_trick) == 0 else len(room.current_trick)),
        )
    )

    trick_just_closed = len(before_trick) + 1 == len(room.players) and len(room.current_trick) == 0
    if trick_just_closed:
        full_trick = before_trick + [engine.TrickPlay(player_id=actor_id, card=chosen_card)]
        trick_resolution = resolve_closed_trick(room, full_trick)
        winner_idx = trick_resolution.winner_index
        hold_until = int(time.time()) + TRICK_REVEAL_HOLD_SECONDS if room.phase == "playing" else 0
        next_doc["trick_hold_until"] = hold_until
        next_doc["last_trick"] = [
            {
                "player_id": tp.player_id,
                "player_name": next((p.name for p in room.players if p.id == tp.player_id), tp.player_id),
                "card": engine_card_to_session_card(tp.card),
            }
            for tp in full_trick
        ]
        if winner_idx is None:
            next_doc["last_winner_id"] = None
            add_log(next_doc, "Trick resolved with no winner.")
        else:
            winner_id = room.players[winner_idx].id
            next_doc["last_winner_id"] = winner_id
            add_log(next_doc, f"Trick winner: {room.players[winner_idx].name}")
        flow_events.append(
            build_flow_event(
                "trick_resolved",
                room=room,
                winner_id=(room.players[winner_idx].id if winner_idx is not None else None),
                next_turn_player_id=current_turn_player_id_from_room(room),
                discarded=bool(trick_resolution.discarded),
                applied_rule=str(trick_resolution.applied_rule),
            )
        )
        if room.phase == "playing":
            flow_events.append(
                build_flow_event(
                    "turn_changed",
                    room=room,
                    current_turn_player_id=current_turn_player_id_from_room(room),
                )
            )
    elif room.phase == "playing":
        flow_events.append(
            build_flow_event(
                "turn_changed",
                room=room,
                current_turn_player_id=current_turn_player_id_from_room(room),
            )
        )

    if room.phase == "scoring":
        try:
            engine.score_round(room)
        except ValueError:
            pass
        next_doc = room_to_session_doc(room, prev=next_doc)
        if room.status == "finished":
            if room.players:
                winner = max(room.players, key=lambda p: p.score)
                add_log(next_doc, f"Game over. Winner: {winner.name} ({winner.score} pts)")
            else:
                add_log(next_doc, "Game over.")
        else:
            add_log(next_doc, f"Round {room.round_number} scored. Ready for next round.")
        flow_events.append(
            build_flow_event(
                "round_scored",
                room=room,
                current_turn_player_id=current_turn_player_id_from_room(room),
            )
        )
        if room.status == "finished":
            winner = max(room.players, key=lambda p: p.score) if room.players else None
            flow_events.append(
                build_flow_event(
                    "game_finished",
                    room=room,
                    winner_id=(winner.id if winner is not None else None),
                )
            )

    set_flow_events(next_doc, *flow_events)
    sync_turn_timer_for_room_doc(
        next_doc,
        room,
        reset=True,
        start_delay_seconds=(TRICK_REVEAL_HOLD_SECONDS if trick_just_closed and room.phase == "playing" else 0),
    )
    return next_doc


def maybe_apply_server_timeouts_locked(session: Dict[str, Any]) -> bool:
    now_ts = int(time.time())
    deadline = int(session.get("turn_deadline_at", 0) or 0)
    trick_hold_until = int(session.get("trick_hold_until", 0) or 0)
    turn_started_at = int(session.get("turn_started_at", 0) or 0)
    status = str(session.get("status", "") or "").lower()
    session_players = session.get("players") if isinstance(session.get("players"), list) else []
    has_active_afk_player = any(
        isinstance(player, dict)
        and bool(player.get("afk", False))
        and int(player.get("leave_requested_at", 0) or 0) <= 0
        for player in session_players
    )

    if status not in {"bidding", "playing"} and not deadline and not turn_started_at and not trick_hold_until:
        return False
    if trick_hold_until > now_ts:
        return False
    if status in {"bidding", "playing"} and trick_hold_until <= 0 and deadline > now_ts and not has_active_afk_player:
        return False

    before = copy.deepcopy(session)
    room = session_doc_to_room(session)
    status = session_status_from_room(room)
    session_player_by_id = {
        str(player.get("id", "")): player
        for player in session_players
        if isinstance(player, dict)
    }

    if status not in {"bidding", "playing"}:
        if deadline or int(session.get("turn_started_at", 0) or 0):
            sync_turn_timer_for_room_doc(session, room, reset=True)
            bump_session_updated_at(session)
            cache_and_save_if_significant_change(session, prev=before)
            return True
        return False

    if trick_hold_until > 0 and trick_hold_until <= now_ts:
        session["trick_hold_until"] = 0
        bump_session_updated_at(session)
        cache_and_save_if_significant_change(session, prev=before)
        return True

    if status == "bidding":
        pending_afk = [
            player
            for player in room.players
            if player.bid is None
            and bool(session_player_by_id.get(str(player.id), {}).get("afk", False))
            and int(session_player_by_id.get(str(player.id), {}).get("leave_requested_at", 0) or 0) <= 0
        ]
        if pending_afk:
            for player in pending_afk:
                player.bid = 0
            if all(player.bid is not None for player in room.players):
                room.phase = "playing"
            next_doc = room_to_session_doc(room, prev=session)
            if len(pending_afk) == 1:
                add_log(next_doc, f"AFK auto-bid. {pending_afk[0].name} auto-bid 0.")
            else:
                add_log(next_doc, f"AFK auto-bid. {len(pending_afk)} players auto-bid 0.")
            if room.phase == "playing":
                add_log(next_doc, "All bids locked. Play begins.")
            sync_turn_timer_for_room_doc(next_doc, room, reset=True)
            session.clear()
            session.update(next_doc)
            cache_and_save_if_significant_change(session, prev=before)
            return True

    if status == "playing" and room.players:
        actor = room.players[room.current_turn_index % len(room.players)]
        actor_meta = session_player_by_id.get(str(actor.id), {})
        actor_is_afk = bool(actor_meta.get("afk", False))
        actor_left = int(actor_meta.get("leave_requested_at", 0) or 0) > 0
        if actor_is_afk and not actor_left:
            if not actor.hand:
                sync_turn_timer_for_room_doc(session, room, reset=True)
                bump_session_updated_at(session)
                cache_and_save_if_significant_change(session, prev=before)
                return True

            legal_indexes = engine.legal_card_indexes(room, actor)
            card_index = penalty_auto_play_card_index(room, actor, legal_indexes)
            card_index = max(0, min(card_index, len(actor.hand) - 1))
            chosen = actor.hand[card_index]
            if chosen.kind == "tigress" and chosen.tigress_as not in {"pirate", "escape"}:
                chosen.tigress_as = "escape"
            before_trick = list(room.current_trick)
            try:
                engine.play_card(room, actor.id, card_index)
            except ValueError:
                sync_turn_timer_for_room_doc(session, room, reset=True)
                bump_session_updated_at(session)
                cache_and_save_if_significant_change(session, prev=before)
                return True

            next_doc = build_next_session_doc_after_play(
                room,
                session,
                actor_id=actor.id,
                actor_name=actor.name or actor.id,
                chosen_card=chosen,
                before_trick=before_trick,
                timeout_auto=False,
                afk_auto=True,
            )
            session.clear()
            session.update(next_doc)
            cache_and_save_if_significant_change(session, prev=before)
            return True

    if deadline <= 0:
        sync_turn_timer_for_room_doc(session, room, reset=True)
        bump_session_updated_at(session)
        cache_and_save_if_significant_change(session, prev=before)
        return True

    if now_ts < deadline:
        return False

    if status == "bidding":
        pending = [p for p in room.players if p.bid is None]
        if pending:
            for p in pending:
                p.bid = 0
            if all(p.bid is not None for p in room.players):
                room.phase = "playing"
            next_doc = room_to_session_doc(room, prev=session)
            if len(pending) == 1:
                add_log(next_doc, f"Bidding timeout. {pending[0].name} auto-bid 0.")
            else:
                add_log(next_doc, f"Bidding timeout. {len(pending)} players auto-bid 0.")
            for p in pending:
                mark_player_timeout_penalty(next_doc, player_id=p.id)
            if room.phase == "playing":
                add_log(next_doc, "All bids locked. Play begins.")
            sync_turn_timer_for_room_doc(next_doc, room, reset=True)
            session.clear()
            session.update(next_doc)
            cache_and_save_if_significant_change(session, prev=before)
            return True

        sync_turn_timer_for_room_doc(session, room, reset=True)
        bump_session_updated_at(session)
        cache_and_save_if_significant_change(session, prev=before)
        return True

    if status == "playing":
        if not room.players:
            return False
        actor = room.players[room.current_turn_index % len(room.players)]
        if not actor.hand:
            sync_turn_timer_for_room_doc(session, room, reset=True)
            bump_session_updated_at(session)
            cache_and_save_if_significant_change(session, prev=before)
            return True

        legal_indexes = engine.legal_card_indexes(room, actor)
        card_index = penalty_auto_play_card_index(room, actor, legal_indexes)
        card_index = max(0, min(card_index, len(actor.hand) - 1))
        chosen = actor.hand[card_index]
        if chosen.kind == "tigress" and chosen.tigress_as not in {"pirate", "escape"}:
            # Timeout path keeps a penalty/default action character.
            chosen.tigress_as = "escape"
        before_trick = list(room.current_trick)
        try:
            engine.play_card(room, actor.id, card_index)
        except ValueError:
            sync_turn_timer_for_room_doc(session, room, reset=True)
            bump_session_updated_at(session)
            cache_and_save_if_significant_change(session, prev=before)
            return True

        next_doc = build_next_session_doc_after_play(
            room,
            session,
            actor_id=actor.id,
            actor_name=actor.name or actor.id,
            chosen_card=chosen,
            before_trick=before_trick,
            timeout_auto=True,
        )
        mark_player_timeout_penalty(next_doc, player_id=actor.id)
        session.clear()
        session.update(next_doc)
        cache_and_save_if_significant_change(session, prev=before)
        return True

    return False


def build_session_public_state_context(
    session: Dict[str, Any],
    *,
    room: Optional[engine.RoomState] = None,
) -> Dict[str, Any]:
    room = room or session_doc_to_room(session)
    current_trick = trick_payload_from_room(room)

    last_trick_raw = session.get("last_trick") or []
    if not isinstance(last_trick_raw, list):
        last_trick_raw = []
    last_trick = []
    for play in last_trick_raw:
        if not isinstance(play, dict):
            continue
        card_dict = play.get("card")
        if not isinstance(card_dict, dict):
            continue
        c = session_card_to_engine_card(card_dict)
        last_trick.append(
            {
                "player_id": str(play.get("player_id", "")),
                "player_name": str(play.get("player_name", play.get("player_id", ""))),
                "card": client_card_payload_from_engine_card(c),
            }
        )

    session_players = session.get("players") if isinstance(session.get("players"), list) else []
    session_player_meta: Dict[str, Dict[str, Any]] = {
        str(sp.get("id", "")): sp
        for sp in session_players
        if isinstance(sp, dict)
    }
    raw_logs = session.get("logs", [])
    if not isinstance(raw_logs, list):
        raw_logs = []
    flow_events = session.get("flow_events") if isinstance(session.get("flow_events"), list) else []
    room_player_by_id = {str(player.id): player for player in room.players}
    score_breakdown = [
        {
            "player_id": str(p.id),
            "bid": p.bid,
            "tricks_won": int(p.tricks_won),
            "success": (p.bid is not None and int(p.bid) == int(p.tricks_won)),
            "round_bonus": int(p.round_bonus),
            "score": int(p.score),
        }
        for p in room.players
    ]
    return {
        "room": room,
        "current_trick": current_trick,
        "last_trick": last_trick,
        "session_player_meta": session_player_meta,
        "raw_logs": raw_logs,
        "flow_events": flow_events,
        "room_player_by_id": room_player_by_id,
        "score_breakdown": score_breakdown,
        "trick_hold_until": int(session.get("trick_hold_until", 0) or 0),
        "now_ts": int(time.time()),
    }


def session_public_state(
    session: Dict[str, Any],
    viewer_id: str,
    *,
    compact: bool = False,
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    state_context = context or build_session_public_state_context(session)
    room: engine.RoomState = state_context["room"]
    public = engine.room_public_view(room, viewer_id)
    current_trick = state_context["current_trick"]
    last_trick = state_context["last_trick"]
    session_player_meta: Dict[str, Dict[str, Any]] = state_context["session_player_meta"]
    room_player_by_id: Dict[str, engine.PlayerState] = state_context.get("room_player_by_id", {})
    raw_logs: List[str] = state_context["raw_logs"]
    flow_events: List[Dict[str, Any]] = state_context["flow_events"]
    score_breakdown = state_context["score_breakdown"]
    now_ts = int(state_context.get("now_ts", int(time.time())))
    viewer_id_str = str(viewer_id or "")
    server_time_ms = current_updated_at_ms()

    players_view = []
    for p in public.get("players", []):
        if not isinstance(p, dict):
            continue
        player_id = str(p.get("id", ""))
        me = player_id == viewer_id
        hand_cards = p.get("hand") or []
        if not isinstance(hand_cards, list):
            hand_cards = []
        room_player = room_player_by_id.get(player_id)
        legal = (
            legal_card_indexes_room(room, room_player)
            if me and room_player is not None and room.phase == "playing"
            else []
        )
        player_payload: Dict[str, Any] = {
            "id": player_id,
            "name": str(p.get("name", "Unknown")),
            "state": normalize_player_state(str(session_player_meta.get(player_id, {}).get("state", "not_ready"))),
            "score": int(p.get("score", 0)),
            "bid": p.get("bid"),
            "tricks_won": int(p.get("tricks_won", 0)),
            "round_bonus": int(p.get("round_bonus", 0)),
            "hand_count": int(p.get("hand_count", len(hand_cards))),
            "hand": [client_card_payload_from_engine_card(engine_card_dict_to_card(c)) for c in hand_cards if isinstance(c, dict)] if me else [],
            "legal_indexes": legal,
            "connection_state": effective_connection_state(session_player_meta.get(player_id, {}), now_ts),
            "reconnect_deadline_at": reconnect_deadline_at(session_player_meta.get(player_id, {})),
            "afk": bool(session_player_meta.get(player_id, {}).get("afk", False)),
        }
        if compact:
            if player_id == viewer_id_str:
                player_payload["consecutive_timeout_count"] = int(
                    session_player_meta.get(player_id, {}).get("consecutive_timeout_count", 0) or 0
                )
        else:
            player_payload.update(
                {
                    "last_seen_at": int(session_player_meta.get(player_id, {}).get("last_seen_at", 0) or 0),
                    "disconnected_at": int(session_player_meta.get(player_id, {}).get("disconnected_at", 0) or 0),
                    "reconnect_grace_seconds": RECONNECT_GRACE_SECONDS,
                    "consecutive_timeout_count": int(
                        session_player_meta.get(player_id, {}).get("consecutive_timeout_count", 0) or 0
                    ),
                    "discord_user_id": session_player_meta.get(player_id, {}).get("discord_user_id"),
                    "avatar_url": session_player_meta.get(player_id, {}).get("avatar_url"),
                }
            )
        players_view.append(player_payload)

    viewer_meta = session_player_meta.get(str(viewer_id), {})
    viewer_role = "player" if str(viewer_id) in session_player_meta else "spectator"
    viewer_discord_user_id = str(viewer_meta.get("discord_user_id") or "").strip()
    current_turn_player_id = current_turn_player_id_from_room(room)
    public_status = session_status_from_room(room)
    match_scope = match_session_phase_scope(public_status)
    if viewer_role == "player":
        viewer_presence = {
            "activity_presence": "playing" if str(room.status) == "playing" else "waiting",
            "activity_status": str(session.get("room_status") or room.status or "unknown"),
            "in_session": True,
        }
    else:
        viewer_presence = get_viewer_presence_state(
            player_id=str(viewer_id),
            discord_user_id=viewer_discord_user_id,
        )
    logs_payload = [] if compact else raw_logs
    latest_log = raw_logs[0] if raw_logs else ""
    if compact and len(flow_events) > 4:
        flow_events = flow_events[-4:]

    return {
        "session_id": room.id,
        "server_time_ms": server_time_ms,
        "updated_at": int(session.get("updated_at", int(time.time()))),
        "status": session_status_from_room(room),
        "room_status": str(session.get("room_status") or room.status),
        "phase": str(session.get("phase") or room.phase),
        "room_name": room.name,
        "settings": session.get("settings") or {},
        "has_password": bool(session.get("room_password")),
        "host_id": room.host_player,
        "round_number": room.round_number,
        "cards_dealt": room.round_number,
        "leader_index": room.leader_index,
        "turn_index": room.current_turn_index,
        "current_turn_player_id": current_turn_player_id,
        "tricks_completed": room.tricks_completed,
        "turn_started_at": int(session.get("turn_started_at", 0) or 0),
        "turn_deadline_at": int(session.get("turn_deadline_at", 0) or 0),
        "turn_limit_seconds": int(session.get("turn_limit_seconds", TURN_LIMIT_SECONDS) or TURN_LIMIT_SECONDS),
        "trick_hold_until": int(state_context.get("trick_hold_until", 0) or 0),
        "last_event": "",
        "flow_events": flow_events,
        "latest_log": latest_log,
        "last_winner_id": session.get("last_winner_id"),
        "logs": logs_payload,
        "players": players_view,
        "current_trick": current_trick,
        "last_trick": last_trick,
        "score_breakdown": score_breakdown,
        "viewer_role": viewer_role,
        "viewer_is_member": viewer_role == "player",
        "viewer_read_only": viewer_role != "player",
        "spectator_allowed": ALLOW_ACTIVITY_SPECTATORS,
        "spectator_policy": SPECTATOR_POLICY,
        "reconnect_grace_seconds": RECONNECT_GRACE_SECONDS,
        "afk_timeout_streak_limit": AFK_TIMEOUT_STREAK_LIMIT,
        "viewer_presence": viewer_presence.get("activity_presence", "unknown"),
        "viewer_status": viewer_presence.get("activity_status", "unknown"),
        "viewer_in_session": bool(viewer_presence.get("in_session", False)),
        "match_session": {
            "mode": "shared_activity_session",
            "session_key": f"activity-session:{room.id}",
            "phase_scope": match_scope,
            "server_authoritative": True,
            "commands_transport": "http",
            "replication_transport": "websocket_with_poll_fallback",
            "resume_strategy": "snapshot_rehydrate",
            "resume_window_seconds": RECONNECT_GRACE_SECONDS,
            "match_continues_during_reconnect": match_scope in {"match_runtime", "post_match"},
        },
        "transport": {
            "protocol_version": TRANSPORT_PROTOCOL_VERSION,
            "snapshot_revision": int(session.get("updated_at", int(time.time()))),
            "snapshot_generated_at_ms": int(server_time_ms),
            "compact": bool(compact),
        },
    }


def get_viewer_presence_state(player_id: str = "", discord_user_id: str = "") -> Dict[str, Any]:
    """
    Resolve viewer state strictly from UserDB sync snapshot.
    """
    candidates: List[str] = []
    if discord_user_id:
        candidates.append(str(discord_user_id))
    if player_id:
        pid = str(player_id)
        candidates.append(pid)
        if pid.startswith("discord-"):
            candidates.append(pid[len("discord-") :])

    seen = set()
    for key in candidates:
        if not key or key in seen:
            continue
        seen.add(key)
        try:
            user = GAME_SERVICE.user_db.load_sync(key) if GAME_SERVICE is not None else None
        except Exception:
            user = None
        if not isinstance(user, dict):
            continue
        # Immediately reconcile stale room bindings:
        # if user points to a non-existent/finished activity session, clear it in UserDB.
        bound_session_id = str(user.get("activity_session_id") or "").strip()
        bound_room_id = str(user.get("current_room_id") or "").strip()
        stale_binding = False

        for candidate in [bound_session_id, bound_room_id]:
            if not candidate:
                continue
            linked = resolve_session(candidate, create_if_missing=False)
            if linked is None:
                stale_binding = True
                break
            if str(linked.get("status") or "").lower() == "finished":
                stale_binding = True
                break

        if stale_binding and GAME_SERVICE is not None:
            try:
                GAME_SERVICE.user_db.update_sync(
                    key,
                    {
                        "activity_presence": "waiting",
                        "activity_status": "idle",
                        "activity_phase": "idle",
                        "activity_session_id": None,
                        "current_room_id": None,
                        "activity_updated_at": int(time.time()),
                    },
                )
            except Exception:
                pass
            return {"activity_presence": "waiting", "activity_status": "idle", "in_session": False}

        return {
            "activity_presence": str(user.get("activity_presence") or "unknown"),
            "activity_status": str(user.get("activity_status") or "unknown"),
            "in_session": bool(user.get("activity_session_id") or user.get("current_room_id")),
        }

    return {"activity_presence": "unknown", "activity_status": "unknown", "in_session": False}


def user_keys_for_player(player_id: str = "", discord_user_id: str = "") -> List[str]:
    keys: List[str] = []
    if discord_user_id:
        keys.append(str(discord_user_id).strip())
    if player_id:
        pid = str(player_id).strip()
        keys.append(pid)
        if pid.startswith("discord-"):
            keys.append(pid[len("discord-") :])
    dedup: List[str] = []
    seen = set()
    for key in keys:
        if not key or key in seen:
            continue
        seen.add(key)
        dedup.append(key)
    return dedup


def clear_user_activity_presence_sync(*, player_id: str = "", discord_user_id: str = "") -> None:
    if GAME_SERVICE is None:
        return
    now_ts = int(time.time())
    updates = {
        "activity_presence": "waiting",
        "activity_status": "idle",
        "activity_phase": "idle",
        "activity_session_id": None,
        "current_room_id": None,
        "activity_updated_at": now_ts,
    }
    for key in user_keys_for_player(player_id=player_id, discord_user_id=discord_user_id):
        with contextlib.suppress(Exception):
            GAME_SERVICE.user_db.update_sync(key, updates)


def sync_user_connection_state(
    *,
    player_id: str,
    discord_user_id: str,
    connected: bool,
    session_id: str,
    room_status: str,
    phase: str,
) -> None:
    if GAME_SERVICE is None:
        return
    now_ts = int(time.time())
    updates: Dict[str, Any] = {
        "activity_connection": "connected" if connected else "disconnected",
        "activity_last_seen_at": now_ts,
        "activity_updated_at": now_ts,
        "activity_session_id": session_id if room_status != "finished" else None,
        "current_room_id": session_id if room_status != "finished" else None,
        "activity_status": room_status,
        "activity_phase": phase,
    }
    for key in user_keys_for_player(player_id=player_id, discord_user_id=discord_user_id):
        with contextlib.suppress(Exception):
            GAME_SERVICE.user_db.update_sync(key, updates)


def set_player_connection_state(
    session_id: str,
    player_id: str,
    *,
    connected: bool,
) -> bool:
    with LOCK:
        session = resolve_session(session_id, create_if_missing=False)
        if session is None:
            return False

        normalize_session_status_fields(session)
        players = session.get("players") if isinstance(session.get("players"), list) else []
        target = next((p for p in players if isinstance(p, dict) and str(p.get("id", "")) == str(player_id)), None)
        if target is None:
            return False

        now_ts = int(time.time())
        old_state = str(target.get("connection_state", "connected"))
        new_state = "connected" if connected else "disconnected"
        changed = old_state != new_state

        if not changed:
            return False

        target["connection_state"] = new_state
        target["last_seen_at"] = now_ts
        if connected:
            target["disconnected_at"] = 0
            target["reconnect_failed_at"] = 0
        else:
            target["disconnected_at"] = int(target.get("disconnected_at", 0) or now_ts)

        bump_session_updated_at(session)
        cache_set_session(session)
        save_session_to_store(session)

        sync_user_connection_state(
            player_id=str(target.get("id", "")),
            discord_user_id=str(target.get("discord_user_id", "") or ""),
            connected=connected,
            session_id=str(session.get("session_id", session_id)),
            room_status=str(session.get("room_status", "waiting")),
            phase=str(session.get("phase", "idle")),
        )
        return changed


def touch_player_connection_liveness_locked(
    session: Dict[str, Any],
    *,
    player_id: str,
) -> bool:
    normalize_session_status_fields(session)
    players = session.get("players") if isinstance(session.get("players"), list) else []
    target = next((p for p in players if isinstance(p, dict) and str(p.get("id", "")) == str(player_id)), None)
    if target is None:
        return False

    now_ts = int(time.time())
    old_state = str(target.get("connection_state", "connected") or "connected").strip().lower()
    changed = old_state != "connected"

    target["last_seen_at"] = now_ts
    if changed:
        target["connection_state"] = "connected"
        target["disconnected_at"] = 0
        target["reconnect_failed_at"] = 0
        bump_session_updated_at(session)
        sync_user_connection_state(
            player_id=str(target.get("id", "")),
            discord_user_id=str(target.get("discord_user_id", "") or ""),
            connected=True,
            session_id=str(session.get("session_id", "")),
            room_status=str(session.get("room_status", "waiting")),
            phase=str(session.get("phase", "idle")),
        )
    return changed


def maybe_prune_stale_disconnected_locked(session: Dict[str, Any]) -> str:
    """
    Returns: "none" | "updated" | "deleted"
    """
    normalize_session_status_fields(session)
    status = str(session.get("status", "lobby")).lower()
    if status not in {"lobby", "waiting_round"}:
        return "none"

    players = session.get("players") if isinstance(session.get("players"), list) else []
    if not players:
        return "none"

    now_ts = int(time.time())
    remained: List[Dict[str, Any]] = []
    removed: List[Dict[str, Any]] = []
    for p in players:
        if not isinstance(p, dict):
            continue
        leave_requested_at = int(p.get("leave_requested_at", 0) or 0)
        if leave_requested_at > 0:
            removed.append(p)
            continue
        is_disconnected = str(p.get("connection_state", "connected")) == "disconnected"
        disconnected_at = int(p.get("disconnected_at", 0) or 0)
        if is_disconnected and disconnected_at > 0 and (now_ts - disconnected_at) >= DISCONNECT_GRACE_SECONDS:
            removed.append(p)
            continue
        remained.append(p)

    if not removed:
        return "none"

    removed_names = ", ".join(str(p.get("name") or p.get("id") or "unknown") for p in removed[:3])
    if not remained:
        sid = str(session.get("session_id", ""))
        cache_delete_session(sid)
        delete_session_from_store(sid)
        return "deleted"

    session["players"] = remained
    transfer_host_if_needed(session)

    if str(session.get("status", "")).lower() == "waiting_round" and count_participating_players(session) < 2:
        finalize_session_due_to_player_shortage(
            session,
            reason="Game ended: not enough active players to continue.",
        )

    add_log(session, f"Disconnected players removed after grace: {removed_names}")
    cache_set_session(session)
    save_session_to_store(session)
    return "updated"


class JoinPayload(BaseModel):
    player_id: str = Field(min_length=1, max_length=64)
    player_name: str = Field(min_length=1, max_length=32)
    room_password: Optional[str] = Field(default=None, max_length=32)
    discord_user_id: Optional[str] = Field(default=None, max_length=64)
    avatar_url: Optional[str] = Field(default=None, max_length=512)
    activity_instance_id: Optional[str] = Field(default=None, max_length=128)


class BidPayload(BaseModel):
    player_id: str = Field(min_length=1, max_length=64)
    bid: int = Field(ge=0, le=14)
    request_id: Optional[str] = Field(default=None, max_length=128)


class PlayerStatePayload(BaseModel):
    player_id: str = Field(min_length=1, max_length=64)
    state: str = Field(min_length=1, max_length=32)


class PlayPayload(BaseModel):
    player_id: str = Field(min_length=1, max_length=64)
    card_index: int = Field(ge=0)
    tigress_mode: Optional[str] = Field(default=None)
    request_id: Optional[str] = Field(default=None, max_length=128)


class NextRoundPayload(BaseModel):
    player_id: str = Field(min_length=1, max_length=64)


class LeavePayload(BaseModel):
    player_id: str = Field(min_length=1, max_length=64)


class OAuthExchangePayload(BaseModel):
    code: str = Field(min_length=1)


class PresenceClearPayload(BaseModel):
    player_id: str = Field(default="", max_length=64)
    discord_user_id: str = Field(default="", max_length=64)


class CreateSessionPayload(BaseModel):
    player_id: str = Field(min_length=1, max_length=64)
    player_name: str = Field(min_length=1, max_length=32)
    discord_user_id: Optional[str] = Field(default=None, max_length=64)
    avatar_url: Optional[str] = Field(default=None, max_length=512)
    activity_instance_id: Optional[str] = Field(default=None, max_length=128)
    room_name: str = Field(default="새 방", min_length=1, max_length=40)
    max_players: int = Field(default=6, ge=2, le=8)
    bonus_enabled: bool = False
    advanced_rules_enabled: bool = False
    room_password: Optional[str] = Field(default=None, max_length=32)
    turn_limit_seconds: int = Field(default=15, ge=5, le=120)
    allow_spectators: bool = False


class UpdateSettingsPayload(BaseModel):
    player_id: str = Field(min_length=1, max_length=64)
    turn_limit_seconds: Optional[int] = Field(default=None, ge=5, le=120)
    allow_spectators: Optional[bool] = None
    bonus_enabled: Optional[bool] = None
    advanced_rules_enabled: Optional[bool] = None


SESSIONS: Dict[str, Dict[str, Any]] = {}
LOCK = threading.Lock()
FIREBASE_SESSIONS_ENABLED = False
GAME_SERVICE: Optional[GameService] = None
USE_MEMORY_SESSION_CACHE = os.getenv("ACTIVITY_USE_MEMORY_CACHE", "0").strip().lower() in {"1", "true", "yes", "on"}
TIMEOUT_WATCHER_STOP = threading.Event()
TIMEOUT_WATCHER_THREAD: Optional[threading.Thread] = None

app = FastAPI(title="Skull King Activity Server")
_cors_origins_raw = os.getenv("ACTIVITY_CORS_ORIGINS", "").strip()
_cors_origins = [x.strip() for x in _cors_origins_raw.split(",") if x.strip()]
_cors_use_credentials = bool(_cors_origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins if _cors_use_credentials else ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=_cors_use_credentials,
)


@app.middleware("http")
async def request_observability_middleware(request: FastAPIRequest, call_next: Any) -> Response:
    request_id = str(request.headers.get("x-request-id") or uuid.uuid4().hex[:16])
    started_at = time.perf_counter()
    limited = consume_rate_limit_slot(request)
    if limited is not None:
        duration_ms = (time.perf_counter() - started_at) * 1000.0
        response = JSONResponse(
            status_code=429,
            content={
                "detail": "rate_limit_exceeded",
                "request_id": request_id,
                "bucket": limited["bucket"],
                "retry_after_seconds": int(limited["retry_after_seconds"]),
            },
        )
        response.headers["Retry-After"] = str(int(limited["retry_after_seconds"]))
        apply_observability_headers(response, request, request_id)
        observe_request_metric(str(request.url.path or ""), response.status_code, duration_ms, rate_limited=True)
        logger.warning(
            "request rate-limited method=%s path=%s status=%s duration_ms=%.2f request_id=%s client_ip=%s bucket=%s",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            request_id,
            limited["client_ip"],
            limited["bucket"],
        )
        return response

    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (time.perf_counter() - started_at) * 1000.0
        observe_request_metric(str(request.url.path or ""), 500, duration_ms)
        logger.exception(
            "request failed method=%s path=%s status=500 duration_ms=%.2f request_id=%s client_ip=%s",
            request.method,
            request.url.path,
            duration_ms,
            request_id,
            request_client_ip(request),
        )
        raise

    duration_ms = (time.perf_counter() - started_at) * 1000.0
    apply_observability_headers(response, request, request_id)
    observe_request_metric(str(request.url.path or ""), int(response.status_code), duration_ms)
    log_fn = logger.warning if int(response.status_code) >= 400 else logger.info
    log_fn(
        "request completed method=%s path=%s status=%s duration_ms=%.2f request_id=%s client_ip=%s",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        request_id,
        request_client_ip(request),
    )
    return response

APP_DIR = Path(__file__).resolve().parent / "app"
CONFIG_PATH = Path(__file__).resolve().parent / "config" / "discord_config.local.json"
mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("application/javascript", ".cjs")
mimetypes.add_type("application/javascript", ".js")
NO_CACHE_HEADERS = {"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"}
WS_EVENT_LOOP: Optional[asyncio.AbstractEventLoop] = None
WS_SUBSCRIBERS: Dict[str, Dict[int, Dict[str, Any]]] = {}
WS_SUBSCRIBERS_LOCK = threading.Lock()
WS_BROADCAST_QUEUE_LOCK = threading.Lock()
WS_BROADCAST_QUEUE: Dict[str, Dict[str, bool]] = {}
IDENTITY_SIGNING_KEY: Optional[bytes] = None
RATE_LIMIT_BUCKETS_LOCK = threading.Lock()
RATE_LIMIT_BUCKETS: Dict[str, Dict[str, float]] = {}
REQUEST_METRICS_LOCK = threading.Lock()
REQUEST_METRICS: Dict[str, Any] = {
    "started_at": APP_STARTED_AT,
    "requests_total": 0,
    "errors_total": 0,
    "rate_limited_total": 0,
    "request_duration_ms_total": 0.0,
    "status_counts": defaultdict(int),
    "path_counts": defaultdict(int),
    "persistence_failures_total": 0,
    "persistence_failure_counts": defaultdict(int),
}


def request_client_ip(request: FastAPIRequest) -> str:
    forwarded_for = str(request.headers.get("x-forwarded-for", "") or "").strip()
    if forwarded_for:
        return forwarded_for.split(",")[0].strip() or "unknown"
    real_ip = str(request.headers.get("x-real-ip", "") or "").strip()
    if real_ip:
        return real_ip
    if request.client and request.client.host:
        return str(request.client.host)
    return "unknown"


def request_is_https(request: FastAPIRequest) -> bool:
    forwarded_proto = str(request.headers.get("x-forwarded-proto", "") or "").strip().lower()
    if forwarded_proto:
        return forwarded_proto == "https"
    return str(request.url.scheme).lower() == "https"


def classify_rate_limit_bucket(request: FastAPIRequest) -> Optional[tuple[str, int]]:
    path = str(request.url.path or "")
    method = str(request.method or "GET").upper()
    if method == "OPTIONS":
        return None
    if path in {"/", "/health", "/metrics", "/app.js", "/styles.css", "/discord-oauth-callback"}:
        return None
    if path.startswith("/assets/") or path.startswith("/vendor/") or path.startswith("/ws/"):
        return None
    if path.endswith("/state"):
        return ("state", RATE_LIMIT_STATE_MAX_REQUESTS)
    if method in {"POST", "PUT", "PATCH", "DELETE"} and (path.startswith("/activity/") or path.startswith("/api/")):
        return ("mutation", RATE_LIMIT_MUTATION_MAX_REQUESTS)
    return ("default", RATE_LIMIT_DEFAULT_MAX_REQUESTS)


def consume_rate_limit_slot(request: FastAPIRequest) -> Optional[Dict[str, Any]]:
    if not ENABLE_RATE_LIMIT:
        return None
    bucket_policy = classify_rate_limit_bucket(request)
    if bucket_policy is None:
        return None
    bucket_name, bucket_limit = bucket_policy
    client_ip = request_client_ip(request)
    now = time.time()
    window_id = int(now // RATE_LIMIT_WINDOW_SECONDS)
    bucket_key = f"{bucket_name}:{client_ip}"
    with RATE_LIMIT_BUCKETS_LOCK:
        entry = RATE_LIMIT_BUCKETS.get(bucket_key)
        if entry is None or int(entry.get("window_id", -1)) != window_id:
            entry = {"window_id": float(window_id), "count": 0.0}
            RATE_LIMIT_BUCKETS[bucket_key] = entry
        entry["count"] = float(entry.get("count", 0.0)) + 1.0
        if int(entry["count"]) > bucket_limit:
            retry_after = max(1, RATE_LIMIT_WINDOW_SECONDS - int(now % RATE_LIMIT_WINDOW_SECONDS))
            return {
                "bucket": bucket_name,
                "client_ip": client_ip,
                "limit": bucket_limit,
                "retry_after_seconds": retry_after,
            }
        if len(RATE_LIMIT_BUCKETS) > 4096:
            stale_window_id = window_id - 2
            stale_keys = [key for key, value in RATE_LIMIT_BUCKETS.items() if int(value.get("window_id", -1)) < stale_window_id]
            for stale_key in stale_keys[:2048]:
                RATE_LIMIT_BUCKETS.pop(stale_key, None)
    return None


def observe_request_metric(path: str, status_code: int, duration_ms: float, *, rate_limited: bool = False) -> None:
    status_group = f"{int(status_code) // 100}xx"
    with REQUEST_METRICS_LOCK:
        REQUEST_METRICS["requests_total"] = int(REQUEST_METRICS.get("requests_total", 0)) + 1
        REQUEST_METRICS["request_duration_ms_total"] = float(
            REQUEST_METRICS.get("request_duration_ms_total", 0.0)
        ) + float(duration_ms)
        REQUEST_METRICS["status_counts"][status_group] += 1
        REQUEST_METRICS["path_counts"][path] += 1
        if int(status_code) >= 400:
            REQUEST_METRICS["errors_total"] = int(REQUEST_METRICS.get("errors_total", 0)) + 1
        if rate_limited:
            REQUEST_METRICS["rate_limited_total"] = int(REQUEST_METRICS.get("rate_limited_total", 0)) + 1


def record_persistence_failure(operation: str) -> None:
    with REQUEST_METRICS_LOCK:
        REQUEST_METRICS["persistence_failures_total"] = int(REQUEST_METRICS.get("persistence_failures_total", 0)) + 1
        REQUEST_METRICS["persistence_failure_counts"][operation] += 1


def ws_connected_subscriber_count() -> int:
    with WS_SUBSCRIBERS_LOCK:
        return sum(1 for subscribers in WS_SUBSCRIBERS.values() for conn in subscribers.values() if conn.get("websocket") is not None)


def session_count_snapshot() -> int:
    cached = cache_all_sessions() if "cache_all_sessions" in globals() else {}
    if cached:
        return len(cached)
    if USE_MEMORY_SESSION_CACHE:
        return len(SESSIONS)
    if FIREBASE_SESSIONS_ENABLED:
        with contextlib.suppress(Exception):
            return len(load_all_sessions_from_store())
    return len(SESSIONS)


def build_metrics_payload() -> Dict[str, Any]:
    with REQUEST_METRICS_LOCK:
        requests_total = int(REQUEST_METRICS.get("requests_total", 0))
        duration_total = float(REQUEST_METRICS.get("request_duration_ms_total", 0.0))
        average_duration_ms = round(duration_total / requests_total, 2) if requests_total > 0 else 0.0
        status_counts = dict(sorted((REQUEST_METRICS.get("status_counts") or {}).items()))
        path_counts = dict(sorted((REQUEST_METRICS.get("path_counts") or {}).items()))
        persistence_failure_counts = dict(sorted((REQUEST_METRICS.get("persistence_failure_counts") or {}).items()))
        errors_total = int(REQUEST_METRICS.get("errors_total", 0))
        rate_limited_total = int(REQUEST_METRICS.get("rate_limited_total", 0))
        persistence_failures_total = int(REQUEST_METRICS.get("persistence_failures_total", 0))

    return {
        "requests_total": requests_total,
        "errors_total": errors_total,
        "rate_limited_total": rate_limited_total,
        "average_request_duration_ms": average_duration_ms,
        "status_counts": status_counts,
        "path_counts": path_counts,
        "persistence_failures_total": persistence_failures_total,
        "persistence_failure_counts": persistence_failure_counts,
        "active_sessions": session_count_snapshot(),
        "websocket_subscribers": ws_connected_subscriber_count(),
    }


def build_health_payload() -> Dict[str, Any]:
    oauth_config = load_discord_runtime_config()
    identity_key_configured = bool(
        os.getenv("ACTIVITY_IDENTITY_SIGNING_KEY", "").strip() or oauth_config.get("discord_client_secret", "").strip()
    )
    critical_issues: List[str] = []
    warnings: List[str] = []
    if not oauth_config.get("discord_client_id") or not oauth_config.get("discord_client_secret"):
        critical_issues.append("discord_oauth_config_missing")
    if not identity_key_configured:
        critical_issues.append("identity_signing_key_missing")
    if DEPLOYMENT_MODE != "single_instance":
        critical_issues.append("single_instance_only")
    if not FIREBASE_SESSIONS_ENABLED:
        warnings.append("firebase_persistence_disabled")

    status = "ok"
    if critical_issues:
        status = "not_ready"
    elif warnings:
        status = "degraded"

    return {
        "ok": True,
        "ready": not critical_issues,
        "status": status,
        "server_time_ms": current_updated_at_ms(),
        "uptime_seconds": int(max(0, time.time() - APP_STARTED_AT)),
        "deployment_mode": DEPLOYMENT_MODE,
        "persistence_backend": "firebase" if FIREBASE_SESSIONS_ENABLED else "memory_only",
        "rate_limit_enabled": ENABLE_RATE_LIMIT,
        "active_sessions": session_count_snapshot(),
        "websocket_subscribers": ws_connected_subscriber_count(),
        "oauth_configured": bool(oauth_config.get("discord_client_id") and oauth_config.get("discord_client_secret")),
        "identity_signing_key_configured": identity_key_configured,
        "critical_issues": critical_issues,
        "warnings": warnings,
    }


def apply_observability_headers(response: Response, request: FastAPIRequest, request_id: str) -> None:
    response.headers["X-Request-ID"] = request_id
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    if request_is_https(request):
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + padding).encode("ascii"))


def identity_cookie_name(session_id: str) -> str:
    safe = "".join(ch if ch.isalnum() else "_" for ch in str(session_id))
    return f"sk_activity_identity_{safe[:48]}"


def resolve_identity_signing_key() -> bytes:
    global IDENTITY_SIGNING_KEY
    if IDENTITY_SIGNING_KEY is not None:
        return IDENTITY_SIGNING_KEY

    explicit = os.getenv("ACTIVITY_IDENTITY_SIGNING_KEY", "").strip()
    if explicit:
        IDENTITY_SIGNING_KEY = explicit.encode("utf-8")
        return IDENTITY_SIGNING_KEY

    cfg = load_discord_runtime_config()
    fallback = cfg.get("discord_client_secret", "").strip()
    if fallback:
        IDENTITY_SIGNING_KEY = fallback.encode("utf-8")
        return IDENTITY_SIGNING_KEY

    seed = f"skullking-identity-{uuid.uuid4().hex}-{time.time_ns()}".encode("utf-8")
    IDENTITY_SIGNING_KEY = hashlib.sha256(seed).digest()
    return IDENTITY_SIGNING_KEY


def issue_identity_token(session_id: str, player_id: str, discord_user_id: str = "") -> str:
    now_ts = int(time.time())
    payload = {
        "session_id": str(session_id),
        "player_id": str(player_id),
        "discord_user_id": str(discord_user_id or ""),
        "issued_at": now_ts,
        "nonce": uuid.uuid4().hex,
    }
    payload_bytes = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
    signature = hmac.new(resolve_identity_signing_key(), payload_bytes, hashlib.sha256).digest()
    return f"{_b64url_encode(payload_bytes)}.{_b64url_encode(signature)}"


def decode_identity_token(token: str) -> Dict[str, Any]:
    parts = str(token or "").split(".", 1)
    if len(parts) != 2:
        raise HTTPException(status_code=403, detail="invalid_identity_token")
    try:
        payload_bytes = _b64url_decode(parts[0])
        sig_bytes = _b64url_decode(parts[1])
    except Exception as exc:
        raise HTTPException(status_code=403, detail="invalid_identity_token_encoding") from exc

    expected_sig = hmac.new(resolve_identity_signing_key(), payload_bytes, hashlib.sha256).digest()
    if not hmac.compare_digest(sig_bytes, expected_sig):
        raise HTTPException(status_code=403, detail="invalid_identity_token_signature")

    try:
        payload = json.loads(payload_bytes.decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=403, detail="invalid_identity_token_payload") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=403, detail="invalid_identity_token_payload")

    issued_at = int(payload.get("issued_at", 0) or 0)
    now_ts = int(time.time())
    if issued_at <= 0 or issued_at > (now_ts + IDENTITY_TOKEN_SKEW_SECONDS):
        raise HTTPException(status_code=403, detail="invalid_identity_token_iat")
    if (now_ts - issued_at) > IDENTITY_TOKEN_TTL_SECONDS:
        raise HTTPException(status_code=403, detail="expired_identity_token")
    return payload


def get_identity_cookie_value(request: Optional[FastAPIRequest], session_id: str) -> str:
    if request is None:
        return ""
    return str(request.cookies.get(identity_cookie_name(session_id), "") or "")


def get_identity_cookie_value_ws(websocket: WebSocket, session_id: str) -> str:
    return str(websocket.cookies.get(identity_cookie_name(session_id), "") or "")


def _normalize_identity_token(raw_value: Any) -> str:
    return str(raw_value or "").strip()


def get_identity_token_value(request: Optional[FastAPIRequest], session_id: str) -> str:
    cookie_value = get_identity_cookie_value(request, session_id)
    if cookie_value:
        return cookie_value
    if request is None:
        return ""
    header_value = _normalize_identity_token(request.headers.get("x-sk-activity-identity"))
    if header_value:
        return header_value
    auth_value = _normalize_identity_token(request.headers.get("authorization"))
    if auth_value.lower().startswith("bearer "):
        bearer = auth_value[7:].strip()
        if bearer:
            return bearer
    query_string = request.scope.get("query_string", b"")
    query_params = QueryParams(query_string)
    query_value = _normalize_identity_token(query_params.get("identity_token"))
    if query_value:
        return query_value
    return ""


def get_identity_token_value_ws(websocket: WebSocket, session_id: str) -> str:
    cookie_value = get_identity_cookie_value_ws(websocket, session_id)
    if cookie_value:
        return cookie_value
    header_value = _normalize_identity_token(websocket.headers.get("x-sk-activity-identity"))
    if header_value:
        return header_value
    auth_value = _normalize_identity_token(websocket.headers.get("authorization"))
    if auth_value.lower().startswith("bearer "):
        bearer = auth_value[7:].strip()
        if bearer:
            return bearer
    query_value = _normalize_identity_token(websocket.query_params.get("identity_token"))
    if query_value:
        return query_value
    return ""


def issue_identity_token_for_session_player(session: Dict[str, Any], session_id: str, player_id: str) -> str:
    players = session.get("players") if isinstance(session.get("players"), list) else []
    target = next((p for p in players if isinstance(p, dict) and str(p.get("id", "")) == str(player_id)), None)
    discord_user_id = str(target.get("discord_user_id", "") or "") if isinstance(target, dict) else ""
    return issue_identity_token(session_id, player_id, discord_user_id)


def _parsed_header_url(raw_value: str) -> tuple[str, str]:
    raw = str(raw_value or "").split(",")[0].strip()
    if not raw:
        return "", ""
    with contextlib.suppress(Exception):
        parsed = urlparse(raw)
        return str(parsed.scheme or "").lower(), str(parsed.netloc or "").lower()
    return "", ""


def resolve_identity_cookie_policy(request: Optional[FastAPIRequest] = None) -> tuple[str, bool]:
    samesite = IDENTITY_COOKIE_SAMESITE
    secure = IDENTITY_COOKIE_SECURE

    if samesite == "auto":
        scheme = ""
        host = ""
        origin_scheme = ""
        origin_host = ""
        referer_scheme = ""
        referer_host = ""
        fetch_site = ""
        if request is not None:
            forwarded_proto = str(request.headers.get("x-forwarded-proto", "") or "").split(",")[0].strip().lower()
            forwarded_host = str(request.headers.get("x-forwarded-host", "") or "").split(",")[0].strip().lower()
            origin_scheme, origin_host = _parsed_header_url(request.headers.get("origin", ""))
            referer_scheme, referer_host = _parsed_header_url(request.headers.get("referer", ""))
            fetch_site = str(request.headers.get("sec-fetch-site", "") or "").strip().lower()
            scheme = forwarded_proto or str(getattr(request.url, "scheme", "") or "").lower()
            host = forwarded_host or str(request.headers.get("host", "") or "").lower()
        observed_hosts = [host, origin_host, referer_host]
        is_local_host = any(
            candidate and any(token in candidate for token in ("localhost", "127.0.0.1", "[::1]"))
            for candidate in observed_hosts
        )
        cross_site_signal = fetch_site == "cross-site"
        https_signal = any(candidate == "https" for candidate in (scheme, origin_scheme, referer_scheme))
        if not is_local_host and (https_signal or cross_site_signal):
            return "none", True
        return "lax", False

    if samesite == "none":
        secure = True
    return samesite, secure


def set_identity_cookie(
    response: Response,
    session_id: str,
    player_id: str,
    discord_user_id: str = "",
    *,
    request: Optional[FastAPIRequest] = None,
) -> None:
    token = issue_identity_token(session_id, player_id, discord_user_id)
    samesite, secure = resolve_identity_cookie_policy(request)
    response.set_cookie(
        key=identity_cookie_name(session_id),
        value=token,
        httponly=True,
        samesite=samesite,
        secure=secure,
        max_age=IDENTITY_TOKEN_TTL_SECONDS,
        path="/",
    )


def clear_identity_cookie(response: Response, session_id: str, *, request: Optional[FastAPIRequest] = None) -> None:
    samesite, secure = resolve_identity_cookie_policy(request)
    response.delete_cookie(
        key=identity_cookie_name(session_id),
        path="/",
        samesite=samesite,
        secure=secure,
    )


def verify_player_identity_for_session(
    session: Dict[str, Any],
    *,
    session_id: str,
    player_id: str,
    identity_token: str,
) -> None:
    players = session.get("players") if isinstance(session.get("players"), list) else []
    target = next((p for p in players if isinstance(p, dict) and str(p.get("id", "")) == str(player_id)), None)
    if target is None:
        raise HTTPException(status_code=404, detail="player not found")
    if int(target.get("leave_requested_at", 0) or 0) > 0 and str(session.get("status", "")).lower() in {"bidding", "playing"}:
        raise HTTPException(status_code=403, detail="player_forfeited_cannot_act")
    if not identity_token:
        raise HTTPException(status_code=403, detail="identity_token_required")
    claims = decode_identity_token(identity_token)
    if str(claims.get("session_id", "")) != str(session_id):
        raise HTTPException(status_code=403, detail="identity_token_session_mismatch")
    if str(claims.get("player_id", "")) != str(player_id):
        raise HTTPException(status_code=403, detail="identity_token_player_mismatch")

    bound_discord_user_id = str(target.get("discord_user_id", "") or "")
    claimed_discord_user_id = str(claims.get("discord_user_id", "") or "")
    if bound_discord_user_id and claimed_discord_user_id and bound_discord_user_id != claimed_discord_user_id:
        raise HTTPException(status_code=403, detail="identity_token_discord_mismatch")


def ws_register_subscriber(
    session_id: str,
    websocket: WebSocket,
    *,
    player_id: str,
    discord_user_id: str,
    compact: bool,
) -> int:
    with WS_SUBSCRIBERS_LOCK:
        bucket = WS_SUBSCRIBERS.setdefault(session_id, {})
        key = id(websocket)
        bucket[key] = {
            "websocket": websocket,
            "player_id": player_id,
            "discord_user_id": discord_user_id,
            "compact": bool(compact),
            "last_updated_at": -1,
        }
    return key


def ws_unregister_subscriber(session_id: str, key: int) -> None:
    with WS_SUBSCRIBERS_LOCK:
        bucket = WS_SUBSCRIBERS.get(session_id)
        if not bucket:
            return
        bucket.pop(key, None)
        if not bucket:
            WS_SUBSCRIBERS.pop(session_id, None)


def ws_has_connected_player(session_id: str, player_id: str) -> bool:
    with WS_SUBSCRIBERS_LOCK:
        bucket = WS_SUBSCRIBERS.get(session_id) or {}
        for conn in bucket.values():
            if str(conn.get("player_id", "")) == str(player_id):
                return True
    return False


def ws_snapshot_subscribers(session_id: str) -> Dict[int, Dict[str, Any]]:
    with WS_SUBSCRIBERS_LOCK:
        bucket = WS_SUBSCRIBERS.get(session_id) or {}
        return {key: dict(conn) for key, conn in bucket.items()}


def ws_get_subscriber(session_id: str, key: int) -> Optional[Dict[str, Any]]:
    with WS_SUBSCRIBERS_LOCK:
        bucket = WS_SUBSCRIBERS.get(session_id) or {}
        conn = bucket.get(key)
        return dict(conn) if isinstance(conn, dict) else None


def ws_mark_subscriber_updated(session_id: str, key: int, updated_at: int) -> None:
    with WS_SUBSCRIBERS_LOCK:
        bucket = WS_SUBSCRIBERS.get(session_id) or {}
        conn = bucket.get(key)
        if isinstance(conn, dict):
            conn["last_updated_at"] = int(updated_at)


def _flush_session_broadcast(session_id: str) -> None:
    with WS_BROADCAST_QUEUE_LOCK:
        task = WS_BROADCAST_QUEUE.pop(session_id, None)
    if not task:
        return
    closed = bool(task.get("closed", False))
    force = bool(task.get("force", False))
    coro = (
        ws_broadcast_session_closed(session_id)
        if closed
        else ws_broadcast_session_state(session_id, force=force)
    )
    asyncio.create_task(coro)


def _enqueue_broadcast(session_id: str, *, closed: bool, force: bool) -> bool:
    with WS_BROADCAST_QUEUE_LOCK:
        task = WS_BROADCAST_QUEUE.get(session_id)
        if task is None:
            task = {"closed": False, "force": False, "scheduled": False}
            WS_BROADCAST_QUEUE[session_id] = task
        task["closed"] = bool(task.get("closed")) or closed
        task["force"] = bool(task.get("force")) or force
        if task.get("scheduled"):
            return False
        task["scheduled"] = True
        return True


def schedule_session_broadcast(session_id: str, *, closed: bool = False, force: bool = False) -> None:
    loop = WS_EVENT_LOOP
    if loop is None or loop.is_closed():
        return
    should_schedule = _enqueue_broadcast(session_id, closed=closed, force=force)
    if not should_schedule:
        return
    with contextlib.suppress(Exception):
        loop.call_soon_threadsafe(_flush_session_broadcast, session_id)


def _ws_relevant_session_copy(session_id: str) -> Optional[Dict[str, Any]]:
    with LOCK:
        session = resolve_session(session_id, create_if_missing=False)
        if session is None:
            return None
        maybe_apply_server_timeouts_locked(session)
        return copy.deepcopy(session)


async def ws_broadcast_session_closed(session_id: str) -> None:
    targets = ws_snapshot_subscribers(session_id)
    if not targets:
        return
    for key, conn in targets.items():
        websocket = conn.get("websocket")
        if websocket is None:
            ws_unregister_subscriber(session_id, key)
            continue
        with contextlib.suppress(Exception):
            await websocket.send_json({"type": "session_not_found"})
        with contextlib.suppress(Exception):
            await websocket.close(code=1008)
        ws_unregister_subscriber(session_id, key)


async def ws_broadcast_session_state(session_id: str, *, force: bool = False) -> None:
    bucket = ws_snapshot_subscribers(session_id)
    if not bucket:
        return

    outbound: List[Dict[str, Any]] = []
    session = _ws_relevant_session_copy(session_id)
    if session is None:
        for key in bucket.keys():
            outbound.append(
                {
                    "session_id": session_id,
                    "key": key,
                    "close": True,
                    "payload": {"type": "session_not_found"},
                }
            )
    else:
        session_context = build_session_public_state_context(session)
        updated_at = int(session.get("updated_at", 0) or 0)
        for key, conn in bucket.items():
            player_id = str(conn.get("player_id", ""))
            role = viewer_role_in_session(session, player_id)
            if role == "forbidden":
                outbound.append(
                    {
                        "session_id": session_id,
                        "key": key,
                        "close": True,
                        "payload": {"type": "access_denied", "reason": "spectator_not_allowed"},
                    }
                )
                continue

            if not force and int(conn.get("last_updated_at", -1)) == updated_at:
                continue

            compact = bool(conn.get("compact", True))
            state = session_public_state(session, player_id, compact=compact, context=session_context)
            outbound.append(
                {
                    "session_id": session_id,
                    "key": key,
                    "close": False,
                    "payload": {"type": "state", "data": state},
                    "updated_at": updated_at,
                }
            )

    if not outbound:
        return

    async def send_outbound(item: Dict[str, Any]) -> None:
        sid = item["session_id"]
        key = int(item["key"])
        conn = ws_get_subscriber(sid, key)
        if not conn:
            return
        websocket = conn.get("websocket")
        if websocket is None:
            ws_unregister_subscriber(sid, key)
            return
        try:
            await websocket.send_json(item["payload"])
        except Exception:
            ws_unregister_subscriber(sid, key)
            with contextlib.suppress(Exception):
                await websocket.close(code=1011)
            return

        if item.get("close"):
            ws_unregister_subscriber(sid, key)
            with contextlib.suppress(Exception):
                await websocket.close(code=1008)
            return

        ws_mark_subscriber_updated(sid, key, int(item.get("updated_at", conn.get("last_updated_at", -1))))

    await asyncio.gather(*(send_outbound(item) for item in outbound))


def load_discord_runtime_config() -> Dict[str, str]:
    raw: Dict[str, Any] = {}
    if CONFIG_PATH.exists():
        try:
            raw = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            if not isinstance(raw, dict):
                raw = {}
        except Exception:
            raw = {}

    client_id = str(
        raw.get("discord_client_id")
        or raw.get("client_id")
        or os.getenv("DISCORD_CLIENT_ID", "")
    ).strip()
    client_secret = str(
        raw.get("discord_client_secret")
        or raw.get("client_secret")
        or os.getenv("DISCORD_CLIENT_SECRET", "")
    ).strip()
    return {
        "discord_client_id": client_id,
        "discord_client_secret": client_secret,
    }


def cache_get_session(session_id: str) -> Optional[Dict[str, Any]]:
    if not USE_MEMORY_SESSION_CACHE:
        return None
    return SESSIONS.get(session_id)


def cache_set_session(session: Dict[str, Any]) -> None:
    if not USE_MEMORY_SESSION_CACHE:
        return
    sid = str(session.get("session_id") or "")
    if sid:
        SESSIONS[sid] = session


def cache_all_sessions() -> Dict[str, Dict[str, Any]]:
    if not USE_MEMORY_SESSION_CACHE:
        return {}
    return dict(SESSIONS)


def cache_delete_session(session_id: str) -> None:
    if not USE_MEMORY_SESSION_CACHE:
        return
    SESSIONS.pop(str(session_id), None)


def init_activity_session_store() -> None:
    global FIREBASE_SESSIONS_ENABLED, GAME_SERVICE
    try:
        GAME_SERVICE = GameService()
        FIREBASE_SESSIONS_ENABLED = True
        logger.info("firebase activity session store connected")
    except Exception as exc:
        FIREBASE_SESSIONS_ENABLED = False
        GAME_SERVICE = None
        logger.warning("firebase activity session store disabled error=%s", exc)


def load_session_from_store(session_id: str) -> Optional[Dict[str, Any]]:
    if not FIREBASE_SESSIONS_ENABLED:
        return None
    try:
        if GAME_SERVICE is None:
            return None
        data = GAME_SERVICE.get_raw_room_sync(session_id)
        if not isinstance(data, dict):
            return None
        if data.get("_doc_type") != "activity_session":
            return None
        normalize_session_status_fields(data)
        return data
    except Exception as exc:
        record_persistence_failure("load")
        logger.warning("firebase load failed session_id=%s error=%s", session_id, exc)
        return None


def save_session_to_store(session: Dict[str, Any], *, async_write: bool = True) -> None:
    if async_write:
        snapshot = copy.deepcopy(session)
        threading.Thread(
            target=save_session_to_store,
            kwargs={"session": snapshot, "async_write": False},
            daemon=True,
        ).start()
        return
    if not FIREBASE_SESSIONS_ENABLED:
        return
    try:
        normalize_session_status_fields(session)
        if int(session.get("updated_at", 0) or 0) <= 0:
            session["updated_at"] = current_updated_at_ms()
        session["_doc_type"] = "activity_session"
        if GAME_SERVICE is None:
            return
        GAME_SERVICE.save_raw_room_sync(session["session_id"], session)
        # UserDB에도 참여자 상태(게임중/대기중)를 동기화한다. (PlayerState 기반)
        room = session_doc_to_room(session)
        player_meta_by_id = {
            str(p.get("id")): p
            for p in (session.get("players") or [])
            if isinstance(p, dict) and p.get("id")
        }
        GAME_SERVICE.sync_activity_users_from_room_sync(room, player_meta_by_id=player_meta_by_id)
    except Exception as exc:
        record_persistence_failure("save")
        logger.warning("firebase save failed session_id=%s error=%s", session.get("session_id"), exc)


def save_session_to_store_async(session: Dict[str, Any], *, detached: bool = False) -> None:
    if detached:
        threading.Thread(
            target=save_session_to_store,
            kwargs={"session": session, "async_write": False},
            daemon=True,
        ).start()
        return
    save_session_to_store(session, async_write=True)


def delete_session_from_store(session_id: str) -> None:
    if not FIREBASE_SESSIONS_ENABLED or GAME_SERVICE is None:
        return
    try:
        # Activity sessions are persisted in Rooms as raw docs.
        GAME_SERVICE.room_db.delete_sync(str(session_id))
        schedule_session_broadcast(str(session_id), closed=True)
    except Exception as exc:
        record_persistence_failure("delete")
        logger.warning("firebase delete failed session_id=%s error=%s", session_id, exc)


def resolve_session(session_id: str, *, create_if_missing: bool = False) -> Optional[Dict[str, Any]]:
    session = cache_get_session(session_id)
    # Hot path optimization:
    # For active activity sessions, prefer in-memory cache regardless of store backend.
    # Endpoints mutate the cache under LOCK and persist afterward, so reloading from
    # Firebase on every read causes unnecessary latency across all interactions.
    if session is not None:
        normalize_session_status_fields(session)
        return session

    loaded = load_session_from_store(session_id) if FIREBASE_SESSIONS_ENABLED else None
    if loaded is not None:
        normalize_session_status_fields(loaded)
        cache_set_session(loaded)
        return loaded

    if create_if_missing:
        created = build_session(session_id)
        normalize_session_status_fields(created)
        save_session_to_store(created)
        cache_set_session(created)
        return created

    if session is not None:
        normalize_session_status_fields(session)
    return session


def load_all_sessions_from_store() -> Dict[str, Dict[str, Any]]:
    if not FIREBASE_SESSIONS_ENABLED:
        return {}
    try:
        raw = GAME_SERVICE.load_all_raw_rooms_sync() if GAME_SERVICE is not None else {}
        result: Dict[str, Dict[str, Any]] = {}
        for _, value in (raw or {}).items():
            if (
                isinstance(value, dict)
                and value.get("session_id")
                and value.get("_doc_type") == "activity_session"
            ):
                normalize_session_status_fields(value)
                result[value["session_id"]] = value
        return result
    except Exception as exc:
        record_persistence_failure("load_all")
        logger.warning("firebase load-all failed error=%s", exc)
        return {}


def session_summary(session: Dict[str, Any]) -> Dict[str, Any]:
    normalize_session_status_fields(session)
    settings = session.get("settings") or {}
    players = session.get("players") or []
    host_id = session.get("host_id")
    host_name = "Unknown"
    if isinstance(players, list):
        for p in players:
            if isinstance(p, dict) and str(p.get("id", "")) == str(host_id):
                host_name = str(p.get("name", "Unknown"))
                break
    return {
        "session_id": session["session_id"],
        "room_name": session.get("room_name") or session["session_id"],
        "status": session["status"],
        "player_count": len(session.get("players") or []),
        "max_players": int(settings.get("max_players", MAX_PLAYERS)),
        "host_id": host_id,
        "host_name": host_name,
        "round_number": session.get("round_number", 0),
        "bonus_enabled": bool(settings.get("bonus_enabled", False)),
        "advanced_rules_enabled": bool(settings.get("advanced_rules_enabled", False)),
        "has_password": bool(session.get("room_password")),
        "activity_instance_id": str(session.get("activity_instance_id") or ""),
        "updated_at": session.get("updated_at", 0),
    }


def player_in_session(session: Dict[str, Any], player_id: str = "", discord_user_id: str = "") -> bool:
    players = session.get("players") or []
    if not isinstance(players, list):
        return False
    candidates = set()
    if player_id:
        candidates.add(str(player_id))
    if discord_user_id:
        candidates.add(str(discord_user_id))
        candidates.add(f"discord-{discord_user_id}")
    if not candidates:
        return False
    for p in players:
        if isinstance(p, dict) and (
            str(p.get("id", "")) in candidates
                or (discord_user_id and str(p.get("discord_user_id", "") or "") == str(discord_user_id))
        ):
            return True
    return False


def find_player_entry_in_session(
    session: Dict[str, Any],
    *,
    player_id: str = "",
    discord_user_id: str = "",
) -> Optional[Dict[str, Any]]:
    players = session.get("players") or []
    if not isinstance(players, list):
        return None
    safe_player_id = str(player_id or "").strip()
    safe_discord_user_id = str(discord_user_id or "").strip()
    candidates = set()
    if safe_player_id:
        candidates.add(safe_player_id)
    if safe_discord_user_id:
        candidates.add(safe_discord_user_id)
        candidates.add(f"discord-{safe_discord_user_id}")
    for player in players:
        if not isinstance(player, dict):
            continue
        pid = str(player.get("id", "")).strip()
        did = str(player.get("discord_user_id", "") or "").strip()
        if pid in candidates or (safe_discord_user_id and did == safe_discord_user_id):
            return player
    return None


def is_player_entry_active(player_entry: Optional[Dict[str, Any]]) -> bool:
    if not isinstance(player_entry, dict):
        return False
    return int(player_entry.get("leave_requested_at", 0) or 0) <= 0


def active_player_in_session(session: Dict[str, Any], *, player_id: str = "", discord_user_id: str = "") -> bool:
    return is_player_entry_active(
        find_player_entry_in_session(session, player_id=player_id, discord_user_id=discord_user_id)
    )


def find_active_session_conflict(
    *,
    player_id: str = "",
    discord_user_id: str = "",
    exclude_session_id: str = "",
) -> Optional[Dict[str, Any]]:
    sessions_map = cache_all_sessions()
    if not sessions_map and FIREBASE_SESSIONS_ENABLED:
        sessions_map = load_all_sessions_from_store()
    safe_exclude = str(exclude_session_id or "").strip()
    for session in sessions_map.values():
        if not isinstance(session, dict):
            continue
        sid = str(session.get("session_id") or "").strip()
        if not sid or sid == safe_exclude:
            continue
        if maybe_expire_idle_session_locked(session) == "deleted":
            schedule_session_broadcast(sid, closed=True)
            continue
        normalize_session_status_fields(session)
        if str(session.get("status", "")).lower() == "finished":
            continue
        if not active_player_in_session(session, player_id=player_id, discord_user_id=discord_user_id):
            continue
        return session_summary(session)
    return None


def player_last_activity_ts(player: Dict[str, Any], default_ts: int) -> int:
    return max(
        int(default_ts or 0),
        int(player.get("last_seen_at", 0) or 0),
        int(player.get("joined_at", 0) or 0),
        int(player.get("disconnected_at", 0) or 0),
    )


def maybe_expire_idle_session_locked(session: Dict[str, Any]) -> str:
    """
    Returns: "none" | "deleted"
    """
    normalize_session_status_fields(session)
    players = session.get("players") if isinstance(session.get("players"), list) else []
    sid = str(session.get("session_id", "")).strip()
    if not sid:
        return "none"

    active_players = [p for p in players if isinstance(p, dict) and int(p.get("leave_requested_at", 0) or 0) <= 0]
    if not active_players:
        base_ts = int(session.get("created_at", 0) or 0)
        updated_ms = int(session.get("updated_at", 0) or 0)
        if updated_ms > 0:
            base_ts = max(base_ts, updated_ms // 1000)
        if (int(time.time()) - base_ts) < EMPTY_SESSION_GRACE_SECONDS:
            return "none"
        cache_delete_session(sid)
        delete_session_from_store(sid)
        return "deleted"

    status = str(session.get("status", "lobby")).lower()
    if status not in {"lobby", "waiting_round"}:
        return "none"
    if len(active_players) != 1:
        return "none"

    solo_player = active_players[0]
    session_anchor_ts = int(session.get("created_at", 0) or 0)
    updated_ms = int(session.get("updated_at", 0) or 0)
    if updated_ms > 0:
        session_anchor_ts = max(session_anchor_ts, updated_ms // 1000)
    last_activity_ts = player_last_activity_ts(solo_player, session_anchor_ts)
    if (int(time.time()) - last_activity_ts) < SOLO_LOBBY_EXPIRY_SECONDS:
        return "none"

    cache_delete_session(sid)
    delete_session_from_store(sid)
    return "deleted"


def generate_activity_session_id() -> str:
    for _ in range(50):
        candidate = f"activity-{random.randint(0, 99_999):05d}"
        if resolve_session(candidate, create_if_missing=False) is None:
            return candidate

    return f"activity-{uuid.uuid4().hex[:8]}"


init_activity_session_store()


def run_timeout_watcher_loop() -> None:
    while not TIMEOUT_WATCHER_STOP.is_set():
        try:
            with LOCK:
                sessions_map = cache_all_sessions()
                if not sessions_map and FIREBASE_SESSIONS_ENABLED:
                    sessions_map = load_all_sessions_from_store()
                now_ts = int(time.time())
                for session in sessions_map.values():
                    if not isinstance(session, dict):
                        continue
                    sid = str(session.get("session_id") or "")
                    expiry_result = maybe_expire_idle_session_locked(session)
                    if expiry_result == "deleted" and sid:
                        schedule_session_broadcast(sid, closed=True)
                        continue
                    reconnect_policy_changed = apply_reconnect_failure_policy_locked(session)
                    if reconnect_policy_changed and sid:
                        cache_set_session(session)
                        save_session_to_store(session)
                        schedule_session_broadcast(sid)
                    prune_result = maybe_prune_stale_disconnected_locked(session)
                    if prune_result == "updated" and sid:
                        schedule_session_broadcast(sid)
                    elif prune_result == "deleted" and sid:
                        schedule_session_broadcast(sid, closed=True)
                        continue

                    status = str(session.get("status") or "").lower()
                    if status not in {"bidding", "playing"}:
                        continue
                    deadline = int(session.get("turn_deadline_at", 0) or 0)
                    if deadline <= 0 or now_ts >= deadline:
                        maybe_apply_server_timeouts_locked(session)
        except Exception as exc:
            logger.exception("timeout watcher error error=%s", exc)
        TIMEOUT_WATCHER_STOP.wait(TIMEOUT_WATCH_INTERVAL_SECONDS)


@app.on_event("startup")
def startup_timeout_watcher() -> None:
    global TIMEOUT_WATCHER_THREAD, WS_EVENT_LOOP
    with contextlib.suppress(Exception):
        WS_EVENT_LOOP = asyncio.get_event_loop()
    # Warm the in-memory cache from Firebase so list/resume never need to hit the store.
    if FIREBASE_SESSIONS_ENABLED:
        try:
            loaded = load_all_sessions_from_store()
            for s in loaded.values():
                cache_set_session(s)
            if loaded:
                logger.info("firebase cache warmed session_count=%s", len(loaded))
        except Exception as exc:
            logger.warning("firebase cache warmup failed error=%s", exc)
    if TIMEOUT_WATCHER_THREAD is not None and TIMEOUT_WATCHER_THREAD.is_alive():
        return
    if DEPLOYMENT_MODE != "single_instance":
        logger.warning("deployment mode is not supported for current realtime architecture mode=%s", DEPLOYMENT_MODE)
    TIMEOUT_WATCHER_STOP.clear()
    TIMEOUT_WATCHER_THREAD = threading.Thread(
        target=run_timeout_watcher_loop,
        name="activity-timeout-watcher",
        daemon=True,
    )
    TIMEOUT_WATCHER_THREAD.start()
    logger.info(
        "startup complete deployment_mode=%s persistence_backend=%s rate_limit_enabled=%s",
        DEPLOYMENT_MODE,
        "firebase" if FIREBASE_SESSIONS_ENABLED else "memory_only",
        ENABLE_RATE_LIMIT,
    )


@app.on_event("shutdown")
def shutdown_timeout_watcher() -> None:
    global WS_EVENT_LOOP
    TIMEOUT_WATCHER_STOP.set()
    watcher = TIMEOUT_WATCHER_THREAD
    if watcher is not None and watcher.is_alive():
        watcher.join(timeout=2.0)
    WS_EVENT_LOOP = None
    logger.info("shutdown complete")


@app.get("/")
def serve_root() -> FileResponse:
    return FileResponse(APP_DIR / "index.html", headers=NO_CACHE_HEADERS)


@app.get("/app.js")
def serve_app_js() -> FileResponse:
    return FileResponse(
        APP_DIR / "app.js",
        media_type="application/javascript",
        headers=NO_CACHE_HEADERS,
    )


@app.get("/styles.css")
def serve_styles() -> FileResponse:
    return FileResponse(APP_DIR / "styles.css", media_type="text/css", headers=NO_CACHE_HEADERS)


@app.get("/app-config.js")
def serve_app_config() -> Response:
    config = load_discord_runtime_config()
    payload = (
        f"window.DISCORD_CLIENT_ID = {json.dumps(config['discord_client_id'])};\n"
    )
    return Response(payload, media_type="application/javascript", headers=NO_CACHE_HEADERS)


@app.get("/assets/{file_path:path}")
def serve_assets(file_path: str) -> FileResponse:
    safe_rel = Path(file_path)
    target = (APP_DIR / "assets" / safe_rel).resolve()
    root = (APP_DIR / "assets").resolve()

    if not str(target).startswith(str(root)):
        raise HTTPException(status_code=400, detail="invalid asset path")
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="asset not found")

    return FileResponse(target, headers=NO_CACHE_HEADERS)


@app.get("/ui")
def serve_ui() -> FileResponse:
    return FileResponse(APP_DIR / "index.html", headers=NO_CACHE_HEADERS)


@app.get("/vendor/discord-sdk/output/{file_path:path}")
def serve_discord_sdk_vendor(file_path: str) -> FileResponse:
    safe_rel = Path(file_path)
    target = (APP_DIR / "vendor" / "discord-sdk" / "output" / safe_rel).resolve()
    root = (APP_DIR / "vendor" / "discord-sdk" / "output").resolve()

    if not str(target).startswith(str(root)):
        raise HTTPException(status_code=400, detail="invalid vendor path")
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="vendor file not found")

    suffix = target.suffix.lower()
    media_type = "application/javascript" if suffix in {".mjs", ".cjs", ".js"} else None
    return FileResponse(target, media_type=media_type)


@app.get("/health")
def health() -> Dict[str, Any]:
    return build_health_payload()


@app.api_route("/ping", methods=["GET", "HEAD"])
def ping() -> Response:
    return Response(status_code=204, headers={"x-server-time-ms": str(current_updated_at_ms())})


@app.get("/metrics")
def metrics() -> Dict[str, Any]:
    payload = build_metrics_payload()
    payload["server_time_ms"] = current_updated_at_ms()
    payload["uptime_seconds"] = int(max(0, time.time() - APP_STARTED_AT))
    payload["deployment_mode"] = DEPLOYMENT_MODE
    payload["persistence_backend"] = "firebase" if FIREBASE_SESSIONS_ENABLED else "memory_only"
    return payload


@app.get("/discord-oauth-callback")
def discord_oauth_callback() -> FileResponse:
    return FileResponse(APP_DIR / "index.html", headers=NO_CACHE_HEADERS)


@app.post("/api/discord/exchange")
def exchange_discord_code(body: OAuthExchangePayload) -> Dict[str, Any]:
    config = load_discord_runtime_config()
    client_id = config["discord_client_id"]
    client_secret = config["discord_client_secret"]

    if not client_id or not client_secret:
        raise HTTPException(
            status_code=400,
            detail=(
                "missing oauth config: "
                f"DISCORD_CLIENT_ID={'set' if client_id else 'missing'}, "
                f"DISCORD_CLIENT_SECRET={'set' if client_secret else 'missing'}, "
                f"config_path={CONFIG_PATH.name}, "
                "DISCORD_REDIRECT_URI=not-required-for-rpc-flow"
            ),
        )

    form = urlencode(
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "authorization_code",
            "code": body.code,
        }
    ).encode("utf-8")

    req = UrlRequest(
        "https://discord.com/api/v10/oauth2/token",
        data=form,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "User-Agent": "SkullKingActivity/1.0 (+https://discord.com)",
        },
        method="POST",
    )

    try:
        with urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8")
    except HTTPError as exc:
        error_body = ""
        try:
            error_body = exc.read().decode("utf-8", errors="ignore")
        except Exception:
            error_body = ""
        detail = f"discord token exchange failed: HTTP {exc.code} {exc.reason}"
        if error_body:
            detail = f"{detail} | {error_body}"
        raise HTTPException(status_code=400, detail=detail)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"discord token exchange failed: {exc}")

    import json

    payload = json.loads(raw)
    if "access_token" not in payload:
        raise HTTPException(status_code=400, detail=f"discord token exchange failed: {payload}")

    profile_payload: Optional[Dict[str, Any]] = None
    profile_req = UrlRequest(
        "https://discord.com/api/v10/users/@me",
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {payload['access_token']}",
            "User-Agent": "SkullKingActivity/1.0 (+https://discord.com)",
        },
        method="GET",
    )
    try:
        with urlopen(profile_req, timeout=15) as resp:
            profile_raw = resp.read().decode("utf-8")
        decoded_profile = json.loads(profile_raw)
        if isinstance(decoded_profile, dict):
            profile_payload = decoded_profile
    except Exception:
        profile_payload = None

    return {
        "access_token": payload["access_token"],
        "token_type": payload.get("token_type", "Bearer"),
        "expires_in": payload.get("expires_in"),
        "scope": payload.get("scope"),
        "user": profile_payload,
    }


@app.post("/activity/presence/clear")
def clear_activity_presence(body: PresenceClearPayload) -> Dict[str, Any]:
    candidates: List[str] = []
    if body.discord_user_id:
        candidates.append(str(body.discord_user_id))
    if body.player_id:
        pid = str(body.player_id)
        candidates.append(pid)
        if pid.startswith("discord-"):
            candidates.append(pid[len("discord-") :])

    seen = set()
    updated = 0
    now_ts = int(time.time())
    for key in candidates:
        if not key or key in seen:
            continue
        seen.add(key)
        try:
            user = GAME_SERVICE.user_db.load_sync(key) if GAME_SERVICE is not None else None
            if not isinstance(user, dict):
                continue
            if GAME_SERVICE is not None:
                GAME_SERVICE.user_db.update_sync(
                    key,
                    {
                        "activity_presence": "waiting",
                        "activity_status": "idle",
                        "activity_phase": "idle",
                        "activity_session_id": None,
                        "current_room_id": None,
                        "activity_updated_at": now_ts,
                    },
                )
                updated += 1
        except Exception:
            continue
    return {"ok": True, "updated": updated}


@app.post("/activity/sessions/{session_id}/settings")
def update_settings(session_id: str, body: UpdateSettingsPayload, request: FastAPIRequest) -> Dict[str, Any]:
    with LOCK:
        session = resolve_session(session_id, create_if_missing=False)
        if session is None:
            raise HTTPException(status_code=404, detail="session not found")
        if str(session.get("host_id", "")) != str(body.player_id):
            raise HTTPException(status_code=403, detail="only host can change settings")
        if str(session.get("status", "")) != "lobby":
            raise HTTPException(status_code=400, detail="settings can only be changed in lobby")
        settings = session.setdefault("settings", {})
        payload = body.model_dump(exclude_unset=True)
        if "turn_limit_seconds" in payload:
            settings["turn_limit_seconds"] = int(payload["turn_limit_seconds"])
            session["turn_limit_seconds"] = int(payload["turn_limit_seconds"])
        if "allow_spectators" in payload:
            settings["allow_spectators"] = bool(payload["allow_spectators"])
        if "bonus_enabled" in payload:
            settings["bonus_enabled"] = bool(payload["bonus_enabled"])
        if "advanced_rules_enabled" in payload:
            settings["advanced_rules_enabled"] = bool(payload["advanced_rules_enabled"])
        bump_session_updated_at(session)
        cache_set_session(session)
        save_session_to_store(session)
        schedule_session_broadcast(session_id, force=True)
        return session_public_state(session, body.player_id)


@app.get("/activity/sessions")
def list_sessions(limit: int = Query(default=20, ge=1, le=100)) -> Dict[str, Any]:
    with LOCK:
        sessions_map = cache_all_sessions()
        if not sessions_map and FIREBASE_SESSIONS_ENABLED:
            sessions_map = load_all_sessions_from_store()
        active_sessions: List[Dict[str, Any]] = []
        for session in list(sessions_map.values()):
            if not isinstance(session, dict):
                continue
            sid = str(session.get("session_id") or "")
            expiry_result = maybe_expire_idle_session_locked(session)
            if expiry_result == "deleted":
                if sid:
                    schedule_session_broadcast(sid, closed=True)
                continue
            active_sessions.append(session)
        rooms = [session_summary(s) for s in active_sessions]
        rooms = [r for r in rooms if r.get("status") == "lobby"]
        rooms.sort(key=lambda x: x.get("updated_at", 0), reverse=True)
        return {"rooms": rooms[:limit]}


@app.get("/activity/sessions/resume")
def find_resume_session(
    player_id: str = Query(default="", min_length=0),
    discord_user_id: str = Query(default="", min_length=0),
) -> Dict[str, Any]:
    with LOCK:
        merged = cache_all_sessions()
        if not merged and FIREBASE_SESSIONS_ENABLED:
            merged = load_all_sessions_from_store()
        matched = []
        for s in list(merged.values()):
            if not isinstance(s, dict):
                continue
            sid = str(s.get("session_id") or "")
            expiry_result = maybe_expire_idle_session_locked(s)
            if expiry_result == "deleted":
                if sid:
                    schedule_session_broadcast(sid, closed=True)
                continue
            status = str(s.get("status", "lobby"))
            if status == "finished":
                continue
            if active_player_in_session(s, player_id=player_id, discord_user_id=discord_user_id):
                matched.append(session_summary(s))

        if not matched:
            return {"session": None}

        priority = {"playing": 4, "bidding": 3, "waiting_round": 2, "lobby": 1}
        matched.sort(key=lambda x: (priority.get(str(x.get("status")), 0), x.get("updated_at", 0)), reverse=True)
        return {"session": matched[0]}


@app.post("/activity/sessions")
def create_session(body: CreateSessionPayload, response: Response, request: FastAPIRequest) -> Dict[str, Any]:
    with LOCK:
        conflict = find_active_session_conflict(
            player_id=body.player_id,
            discord_user_id=str(body.discord_user_id or ""),
        )
        if conflict is not None:
            raise HTTPException(
                status_code=409,
                detail=f"already_joined_session:{conflict['session_id']}",
            )
        session_id = generate_activity_session_id()
        settings = engine.Settings(
            bonus_enabled=bool(body.bonus_enabled),
            advanced_rules_enabled=bool(body.advanced_rules_enabled),
            max_players=int(body.max_players),
            max_rounds=MAX_ROUNDS,
        )
        room = engine.build_room(
            room_id=session_id,
            room_name=body.room_name[:40],
            host_player={"id": body.player_id, "name": body.player_name[:32]},
            settings=settings,
        )
        session = room_to_session_doc(
            room,
            prev={
                "room_password": (body.room_password or "").strip() or None,
                "logs": [],
                "activity_instance_id": str(body.activity_instance_id or "").strip() or None,
            },
        )
        session.setdefault("settings", {})
        session["settings"]["turn_limit_seconds"] = int(body.turn_limit_seconds)
        session["settings"]["allow_spectators"] = bool(body.allow_spectators)
        for p in session.get("players", []):
            if isinstance(p, dict) and p.get("id") == body.player_id:
                p["discord_user_id"] = body.discord_user_id
                p["avatar_url"] = body.avatar_url
                p["state"] = "not_ready"
                p["connection_state"] = "connected"
                p["last_seen_at"] = int(time.time())
                p["disconnected_at"] = 0
                p["reconnect_failed_at"] = 0
                p["leave_requested_at"] = 0
                p["afk"] = False
                p["afk_since"] = 0
                p["consecutive_timeout_count"] = 0
                break
        sync_turn_timer_for_room_doc(session, room, reset=True)
        add_log(session, f"{body.player_name} opened {session['room_name']}.")
        cache_set_session(session)
        save_session_to_store(session)
        schedule_session_broadcast(session_id, force=True)
        set_identity_cookie(
            response,
            session_id=session_id,
            player_id=body.player_id,
            discord_user_id=str(body.discord_user_id or ""),
            request=request,
        )

        return {
            "session_id": session_id,
            "room_name": session["room_name"],
            "settings": session["settings"],
            "has_password": bool(session.get("room_password")),
            "identity_token": issue_identity_token(session_id, body.player_id, str(body.discord_user_id or "")),
        }


@app.post("/activity/sessions/{session_id}/join")
def join_session(session_id: str, body: JoinPayload, response: Response, request: FastAPIRequest) -> Dict[str, Any]:
    with LOCK:
        conflict = find_active_session_conflict(
            player_id=body.player_id,
            discord_user_id=str(body.discord_user_id or ""),
            exclude_session_id=session_id,
        )
        if conflict is not None:
            raise HTTPException(
                status_code=409,
                detail=f"already_joined_session:{conflict['session_id']}",
            )
        session = resolve_session(session_id, create_if_missing=True)
        if session is None:
            raise HTTPException(status_code=500, detail="failed to resolve session")
        session.setdefault("room_name", session_id)
        if session.get("room_password"):
            if (body.room_password or "") != str(session.get("room_password")):
                raise HTTPException(status_code=403, detail="wrong room password")

        room = session_doc_to_room(session)
        if session_status_from_room(room) != "lobby" and all(p.id != body.player_id for p in room.players):
            raise HTTPException(status_code=400, detail="game already started")
        was_existing = any(p.id == body.player_id for p in room.players)
        if was_existing and str(session.get("status", "")).lower() in {"bidding", "playing"}:
            players_meta = session.get("players") if isinstance(session.get("players"), list) else []
            prior = next((p for p in players_meta if isinstance(p, dict) and str(p.get("id", "")) == str(body.player_id)), None)
            if isinstance(prior, dict) and int(prior.get("leave_requested_at", 0) or 0) > 0:
                raise HTTPException(status_code=403, detail="player_forfeited_cannot_rejoin_in_round")
        try:
            engine.enter_room(room, body.player_id, body.player_name[:32])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        if not room.host_player:
            room.host_player = body.player_id

        next_doc = room_to_session_doc(room, prev=session)
        if body.activity_instance_id:
            next_doc["activity_instance_id"] = str(body.activity_instance_id).strip() or next_doc.get("activity_instance_id")
        for p in next_doc.get("players", []):
            if isinstance(p, dict) and p.get("id") == body.player_id:
                p["discord_user_id"] = body.discord_user_id
                p["avatar_url"] = body.avatar_url
                p["connection_state"] = "connected"
                p["last_seen_at"] = int(time.time())
                p["disconnected_at"] = 0
                p["reconnect_failed_at"] = 0
                p["leave_requested_at"] = 0
                p["afk"] = False
                p["afk_since"] = 0
                p["consecutive_timeout_count"] = 0
                if not was_existing:
                    p["state"] = "not_ready"
                break
        if not session.get("host_id"):
            next_doc["host_id"] = body.player_id
        if not was_existing:
            add_log(next_doc, f"{body.player_name} joined the table.")
        cache_set_session(next_doc)
        save_session_to_store(next_doc)
        sync_user_connection_state(
            player_id=body.player_id,
            discord_user_id=str(body.discord_user_id or ""),
            connected=True,
            session_id=str(next_doc.get("session_id", session_id)),
            room_status=str(next_doc.get("room_status", "waiting")),
            phase=str(next_doc.get("phase", "idle")),
        )
        schedule_session_broadcast(session_id, force=True)
        set_identity_cookie(
            response,
            session_id=session_id,
            player_id=body.player_id,
            discord_user_id=str(body.discord_user_id or ""),
            request=request,
        )
        public_state = session_public_state(next_doc, body.player_id)
        public_state["identity_token"] = issue_identity_token_for_session_player(next_doc, session_id, body.player_id)
        return public_state


@app.post("/activity/sessions/{session_id}/player-state")
def set_player_state(
    session_id: str,
    body: PlayerStatePayload,
    request: FastAPIRequest,
    compact: bool = Query(default=False),
) -> Dict[str, Any]:
    response_state: Dict[str, Any]
    store_snapshot: Optional[Dict[str, Any]] = None
    with LOCK:
        session = resolve_session(session_id, create_if_missing=False)
        if session is None:
            raise HTTPException(status_code=404, detail="session not found")
        verify_player_identity_for_session(
            session,
            session_id=session_id,
            player_id=body.player_id,
            identity_token=get_identity_token_value(request, session_id),
        )
        status = str(session.get("status") or "").lower()
        if status not in {"lobby", "waiting_round", "finished"}:
            raise HTTPException(status_code=400, detail="state can only be changed in lobby")

        desired = normalize_player_state(body.state)
        if desired not in {"ready", "not_ready"}:
            raise HTTPException(status_code=400, detail="state must be ready or not_ready")

        players = session.get("players") if isinstance(session.get("players"), list) else []
        target = next((p for p in players if isinstance(p, dict) and str(p.get("id", "")) == str(body.player_id)), None)
        if target is None:
            raise HTTPException(status_code=404, detail="player not found")
        if normalize_player_state(str(target.get("state", "not_ready"))) == desired:
            return session_public_state(session, body.player_id)
        target["state"] = desired
        bump_session_updated_at(session)
        cache_set_session(session)
        # Keep Ready UX responsive: return/broadcast first, persist store asynchronously.
        schedule_session_broadcast(session_id)
        response_state = session_public_state(session, body.player_id, compact=bool(compact))
        response_state["identity_token"] = issue_identity_token_for_session_player(session, session_id, body.player_id)
        store_snapshot = copy.deepcopy(session)
    if store_snapshot is not None:
        save_session_to_store_async(store_snapshot, detached=True)
    return response_state


@app.post("/activity/sessions/{session_id}/return-lobby")
def return_session_to_lobby(session_id: str, body: NextRoundPayload, request: FastAPIRequest) -> Dict[str, Any]:
    response_state: Dict[str, Any]
    store_snapshot: Optional[Dict[str, Any]] = None
    with LOCK:
        session = resolve_session(session_id, create_if_missing=False)
        if session is None:
            raise HTTPException(status_code=404, detail="session not found")
        verify_player_identity_for_session(
            session,
            session_id=session_id,
            player_id=body.player_id,
            identity_token=get_identity_token_value(request, session_id),
        )

        players = session.get("players") if isinstance(session.get("players"), list) else []
        if not any(isinstance(p, dict) and str(p.get("id", "")) == str(body.player_id) for p in players):
            raise HTTPException(status_code=403, detail="방에 참가한 플레이어만 로비로 돌아갈 수 있습니다.")

        current_status = str(session.get("status") or "").lower()
        if current_status not in {"finished", "lobby"}:
            raise HTTPException(status_code=400, detail="게임 종료 후에만 로비로 돌아갈 수 있습니다.")

        if current_status == "finished":
            reset_session_to_lobby(session)
            add_log(session, "Returned to lobby. Ready states reset.")
            cache_set_session(session)
            schedule_session_broadcast(session_id, force=True)
            store_snapshot = copy.deepcopy(session)

        response_state = session_public_state(session, body.player_id)
        response_state["identity_token"] = issue_identity_token_for_session_player(session, session_id, body.player_id)
    if store_snapshot is not None:
        save_session_to_store_async(store_snapshot, detached=True)
    return response_state


@app.post("/activity/sessions/{session_id}/leave")
def leave_session(session_id: str, body: LeavePayload, request: FastAPIRequest, response: Response) -> Dict[str, Any]:
    with LOCK:
        session = resolve_session(session_id, create_if_missing=False)
        if session is None:
            return {"ok": True, "left": False}
        verify_player_identity_for_session(
            session,
            session_id=session_id,
            player_id=body.player_id,
            identity_token=get_identity_token_value(request, session_id),
        )

        players = session.get("players") if isinstance(session.get("players"), list) else []
        before_count = len(players)
        player_exists = any(isinstance(p, dict) and str(p.get("id", "")) == str(body.player_id) for p in players)
        if not player_exists:
            return {"ok": True, "left": False}
        player_meta = next((p for p in players if isinstance(p, dict) and str(p.get("id", "")) == str(body.player_id)), None)
        player_discord_user_id = str((player_meta or {}).get("discord_user_id", "") or "")

        status = str(session.get("status") or "").lower()
        if status in {"lobby", "waiting_round"}:
            remained = [
                p
                for p in players
                if not (isinstance(p, dict) and str(p.get("id", "")) == str(body.player_id))
            ]
            if not remained:
                cache_delete_session(session_id)
                delete_session_from_store(session_id)
                schedule_session_broadcast(session_id, closed=True)
                clear_identity_cookie(response, session_id, request=request)
                clear_user_activity_presence_sync(
                    player_id=body.player_id,
                    discord_user_id=player_discord_user_id,
                )
                return {"ok": True, "left": True, "deleted": True, "player_count": 0, "before_count": before_count}

            session["players"] = remained
            transfer_host_if_needed(session)
            bump_session_updated_at(session)
            add_log(session, f"{body.player_id} left the table.")
            cache_set_session(session)
            save_session_to_store(session)
            schedule_session_broadcast(session_id, force=True)
            clear_identity_cookie(response, session_id, request=request)
            clear_user_activity_presence_sync(
                player_id=body.player_id,
                discord_user_id=player_discord_user_id,
            )
            return {"ok": True, "left": True, "deleted": False, "player_count": len(remained), "before_count": before_count}

        # In-game: immediate forfeit (AFK) with seat retained so engine flow stays stable.
        now_ts = int(time.time())
        target = next((p for p in players if isinstance(p, dict) and str(p.get("id", "")) == str(body.player_id)), None)
        if target is None:
            return {"ok": True, "left": False}

        target["leave_requested_at"] = now_ts
        target["afk"] = True
        target["afk_since"] = int(target.get("afk_since", 0) or now_ts)
        target["consecutive_timeout_count"] = max(
            int(target.get("consecutive_timeout_count", 0) or 0),
            AFK_TIMEOUT_STREAK_LIMIT,
        )
        target["connection_state"] = "disconnected"
        target["disconnected_at"] = int(target.get("disconnected_at", 0) or now_ts)
        target["last_seen_at"] = now_ts

        transfer_host_if_needed(session)
        add_log(session, f"{target.get('name', body.player_id)} forfeited and left the live game.")
        if count_participating_players(session) < 2:
            finalize_session_due_to_player_shortage(
                session,
                reason="Game ended: not enough active players after mid-game leave.",
            )
        bump_session_updated_at(session)
        cache_set_session(session)
        save_session_to_store(session)
        schedule_session_broadcast(session_id, force=True)
        clear_identity_cookie(response, session_id, request=request)
        clear_user_activity_presence_sync(
            player_id=str(target.get("id", body.player_id)),
            discord_user_id=str(target.get("discord_user_id", "") or ""),
        )
        return {"ok": True, "left": True, "deleted": False, "forfeit": True, "player_count": len(players), "before_count": before_count}


@app.post("/activity/sessions/{session_id}/start")
def start_game(
    session_id: str,
    body: NextRoundPayload,
    request: FastAPIRequest,
    compact: bool = Query(default=False),
) -> Dict[str, Any]:
    response_state: Dict[str, Any]
    store_snapshot: Optional[Dict[str, Any]] = None
    with LOCK:
        session = resolve_session(session_id, create_if_missing=False)
        if session is None:
            raise HTTPException(status_code=404, detail="session not found")
        verify_player_identity_for_session(
            session,
            session_id=session_id,
            player_id=body.player_id,
            identity_token=get_identity_token_value(request, session_id),
        )
        maybe_apply_server_timeouts_locked(session)
        room = session_doc_to_room(session)
        if all(p.id != body.player_id for p in room.players):
            raise HTTPException(status_code=403, detail="방에 참가한 플레이어만 시작할 수 있습니다.")
        host_id = str(session.get("host_id") or room.host_player or "")
        if host_id and str(body.player_id) != host_id:
            raise HTTPException(status_code=403, detail="호스트만 Start를 누를 수 있습니다.")

        if len(room.players) < 2:
            raise HTTPException(status_code=400, detail="2인 이상이서 Start 할 수 있습니다.")

        current_status = str(session.get("status") or "").lower()
        session_players = session.get("players") if isinstance(session.get("players"), list) else []
        # Round -> Round transition: do not require ready checks again.
        if current_status != "waiting_round":
            for p in session_players:
                if isinstance(p, dict) and str(p.get("id", "")) == str(body.player_id):
                    p["state"] = "ready"
                    break
            not_ready = [
                str(p.get("name", p.get("id", "Unknown")))
                for p in session_players
                if isinstance(p, dict) and str(p.get("state", "not_ready")) != "ready"
            ]
            if not_ready:
                bump_session_updated_at(session)
                cache_set_session(session)
                save_session_to_store(session)
                names = ", ".join(not_ready[:4])
                raise HTTPException(status_code=400, detail=f"Ready를 하지 않은 플레이어가 있습니다: {names}")
        try:
            engine.start_round(room)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        next_doc = room_to_session_doc(room, prev=session)
        reset_player_timeout_penalty(next_doc, player_id=body.player_id)
        sync_turn_timer_for_room_doc(next_doc, room, reset=True)
        add_log(next_doc, f"Round {room.round_number} started. Cards dealt: {room.round_number}")
        set_flow_events(
            next_doc,
            build_flow_event(
                "game_started" if current_status == "lobby" else "round_started",
                room=room,
                actor_id=body.player_id,
                current_turn_player_id=current_turn_player_id_from_room(room),
                cards_dealt=int(room.round_number),
            ),
            build_flow_event(
                "turn_changed",
                room=room,
                current_turn_player_id=current_turn_player_id_from_room(room),
            ),
        )
        cache_set_session(next_doc)
        schedule_session_broadcast(session_id, force=True)
        response_context = build_session_public_state_context(next_doc, room=room)
        response_state = session_public_state(next_doc, body.player_id, compact=bool(compact), context=response_context)
        response_state["identity_token"] = issue_identity_token_for_session_player(next_doc, session_id, body.player_id)
        store_snapshot = copy.deepcopy(next_doc)
    if store_snapshot is not None:
        save_session_to_store_async(store_snapshot, detached=True)
    return response_state


@app.post("/activity/sessions/{session_id}/bid")
def submit_bid(
    session_id: str,
    body: BidPayload,
    request: FastAPIRequest,
    compact: bool = Query(default=False),
) -> Dict[str, Any]:
    response_state: Dict[str, Any]
    store_snapshot: Optional[Dict[str, Any]] = None
    with LOCK:
        session = resolve_session(session_id, create_if_missing=False)
        if session is None:
            raise HTTPException(status_code=404, detail="session not found")
        cached = check_idempotency(session, body.request_id)
        if cached is not None:
            return cached
        verify_player_identity_for_session(
            session,
            session_id=session_id,
            player_id=body.player_id,
            identity_token=get_identity_token_value(request, session_id),
        )
        maybe_apply_server_timeouts_locked(session)
        room = session_doc_to_room(session)
        try:
            engine.set_bid(room, body.player_id, int(body.bid))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        next_doc = room_to_session_doc(room, prev=session)
        reset_player_timeout_penalty(next_doc, player_id=body.player_id)
        actor = next((p for p in room.players if p.id == body.player_id), None)
        add_log(next_doc, f"{(actor.name if actor else body.player_id)} placed a bid.")
        flow_events = [
            build_flow_event(
                "bid_submitted",
                room=room,
                actor_id=body.player_id,
                actor_name=(actor.name if actor else body.player_id),
            )
        ]
        if room.phase == "playing":
            add_log(next_doc, "All bids locked. Play begins.")
            flow_events.append(
                build_flow_event(
                    "turn_changed",
                    room=room,
                    current_turn_player_id=current_turn_player_id_from_room(room),
                )
            )
        set_flow_events(next_doc, *flow_events)
        sync_turn_timer_for_room_doc(next_doc, room, reset=(room.phase == "playing"))
        response_context = build_session_public_state_context(next_doc, room=room)
        response_state = session_public_state(next_doc, body.player_id, compact=bool(compact), context=response_context)
        response_state["identity_token"] = issue_identity_token_for_session_player(next_doc, session_id, body.player_id)
        store_idempotency(next_doc, body.request_id, response_state)
        cache_set_session(next_doc)
        schedule_session_broadcast(session_id, force=True)
        store_snapshot = copy.deepcopy(next_doc)
    if store_snapshot is not None:
        save_session_to_store_async(store_snapshot, detached=True)
    return response_state


@app.post("/activity/sessions/{session_id}/play")
def play_card(
    session_id: str,
    body: PlayPayload,
    request: FastAPIRequest,
    compact: bool = Query(default=False),
) -> Dict[str, Any]:
    response_state: Dict[str, Any]
    store_snapshot: Optional[Dict[str, Any]] = None
    with LOCK:
        session = resolve_session(session_id, create_if_missing=False)
        if session is None:
            raise HTTPException(status_code=404, detail="session not found")
        cached = check_idempotency(session, body.request_id)
        if cached is not None:
            return cached
        verify_player_identity_for_session(
            session,
            session_id=session_id,
            player_id=body.player_id,
            identity_token=get_identity_token_value(request, session_id),
        )
        maybe_apply_server_timeouts_locked(session)
        room = session_doc_to_room(session)
        trick_hold_until = int(session.get("trick_hold_until", 0) or 0)
        if trick_hold_until > int(time.time()):
            raise HTTPException(status_code=409, detail="trick reveal in progress")
        if room.phase != "playing":
            raise HTTPException(status_code=400, detail="not in playing phase")
        actor = room.find_player(body.player_id)
        if len(room.current_trick) >= len(room.players):
            raise HTTPException(status_code=409, detail="trick already closed; refresh state")
        if any(tp.player_id == body.player_id for tp in room.current_trick):
            raise HTTPException(status_code=409, detail="player already played in this trick")
        if current_turn_player_id_from_room(room) != str(body.player_id):
            raise HTTPException(status_code=409, detail="not your turn")
        if body.card_index < 0 or body.card_index >= len(actor.hand):
            raise HTTPException(status_code=400, detail="card index out of range")
        legal_indexes = engine.legal_card_indexes(room, actor)
        if body.card_index not in legal_indexes:
            raise HTTPException(status_code=400, detail="must follow lead suit")
        chosen = actor.hand[body.card_index]
        if chosen.kind == "tigress":
            if body.tigress_mode not in {"pirate", "escape"}:
                raise HTTPException(status_code=400, detail="tigress_mode must be pirate or escape")
            chosen.tigress_as = body.tigress_mode

        before_trick = list(room.current_trick)
        try:
            engine.play_card(room, body.player_id, body.card_index)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        next_doc = build_next_session_doc_after_play(
            room,
            session,
            actor_id=body.player_id,
            actor_name=actor.name,
            chosen_card=chosen,
            before_trick=before_trick,
            timeout_auto=False,
        )
        reset_player_timeout_penalty(next_doc, player_id=body.player_id)
        response_context = build_session_public_state_context(next_doc, room=room)
        response_state = session_public_state(next_doc, body.player_id, compact=bool(compact), context=response_context)
        response_state["identity_token"] = issue_identity_token_for_session_player(next_doc, session_id, body.player_id)
        store_idempotency(next_doc, body.request_id, response_state)
        cache_set_session(next_doc)
        schedule_session_broadcast(session_id, force=True)
        store_snapshot = copy.deepcopy(next_doc)
    if store_snapshot is not None:
        save_session_to_store_async(store_snapshot, detached=True)
    return response_state


@app.get("/activity/sessions/{session_id}/state")
def get_state(
    session_id: str,
    request: FastAPIRequest,
    player_id: str = Query(..., min_length=1),
    discord_user_id: str = Query(default="", min_length=0),
    since: int = Query(default=0, ge=0),
    wait_ms: int = Query(default=0, ge=0, le=20000),
    compact: bool = Query(default=False),
) -> Dict[str, Any]:
    deadline = time.time() + (wait_ms / 1000.0 if wait_ms > 0 else 0.0)

    while True:
        should_broadcast_connected = False
        should_persist_connected = False
        with LOCK:
            session = resolve_session(session_id, create_if_missing=False)
            if session is None:
                raise HTTPException(status_code=404, detail="session not found")
            reconnect_policy_changed = apply_reconnect_failure_policy_locked(session)
            if reconnect_policy_changed:
                cache_set_session(session)
                save_session_to_store(session)
                schedule_session_broadcast(session_id)
            timeout_changed = maybe_apply_server_timeouts_locked(session)
            if timeout_changed:
                schedule_session_broadcast(session_id)

            # Fast membership check (avoid rebuilding full room on every poll tick).
            viewer_role = viewer_role_in_session(session, player_id, discord_user_id)
            if viewer_role == "forbidden":
                logger.warning(
                    "state auth denied: spectator_not_allowed session=%s player_id=%s discord_user_id=%s",
                    session_id,
                    player_id,
                    discord_user_id,
                )
                raise HTTPException(status_code=403, detail="spectator_not_allowed")
            canonical_player_id = canonical_viewer_player_id(
                session,
                player_id=player_id,
                discord_user_id=discord_user_id,
            )
            if viewer_role == "player":
                try:
                    verify_player_identity_for_session(
                        session,
                        session_id=session_id,
                        player_id=canonical_player_id,
            identity_token=get_identity_token_value(request, session_id),
                    )
                except HTTPException as exc:
                    logger.warning(
                        "state auth denied: session=%s requested_player=%s canonical_player=%s discord_user_id=%s detail=%s",
                        session_id,
                        player_id,
                        canonical_player_id,
                        discord_user_id,
                        exc.detail,
                    )
                    raise
                if touch_player_connection_liveness_locked(session, player_id=canonical_player_id):
                    cache_set_session(session)
                    should_broadcast_connected = True
                    should_persist_connected = True

            updated_at = int(session.get("updated_at", 0) or 0)
            should_return = wait_ms <= 0 or since <= 0 or updated_at > since or time.time() >= deadline
            if should_return:
                state_context = build_session_public_state_context(session)
                state = session_public_state(session, canonical_player_id, compact=bool(compact), context=state_context)
                if viewer_role == "player":
                    state["identity_token"] = issue_identity_token_for_session_player(
                        session,
                        session_id,
                        canonical_player_id,
                    )
                if should_persist_connected:
                    save_session_to_store(session)
                if should_broadcast_connected:
                    schedule_session_broadcast(session_id)
                return state

        # Long-poll wait loop (outside lock)
        time.sleep(STATE_WAIT_POLL_INTERVAL_SECONDS)


@app.websocket("/ws/activity/sessions/{session_id}")
async def ws_session_state(
    websocket: WebSocket,
    session_id: str,
    player_id: str = Query(..., min_length=1),
    discord_user_id: str = Query(default="", min_length=0),
    compact: bool = Query(default=True),
) -> None:
    await websocket.accept()
    subscriber_key: Optional[int] = None
    canonical_player_id = str(player_id or "")
    logger.info(
        "ws accepted session=%s player_id=%s discord_user_id=%s compact=%s",
        session_id,
        player_id,
        discord_user_id,
        compact,
    )
    try:
        with LOCK:
            session = resolve_session(session_id, create_if_missing=False)
            if session is None:
                await websocket.send_json({"type": "session_not_found"})
                await websocket.close(code=1008)
                return
            reconnect_policy_changed = apply_reconnect_failure_policy_locked(session)
            if reconnect_policy_changed:
                cache_set_session(session)
                save_session_to_store(session)
                schedule_session_broadcast(session_id)
            timeout_changed = maybe_apply_server_timeouts_locked(session)
            if timeout_changed:
                schedule_session_broadcast(session_id)
            viewer_role = viewer_role_in_session(session, player_id, discord_user_id)
            if viewer_role == "forbidden":
                logger.warning(
                    "ws auth denied: spectator_not_allowed session=%s player_id=%s discord_user_id=%s",
                    session_id,
                    player_id,
                    discord_user_id,
                )
                await websocket.send_json({"type": "access_denied", "reason": "spectator_not_allowed"})
                await websocket.close(code=1008)
                return
            canonical_player_id = canonical_viewer_player_id(
                session,
                player_id=player_id,
                discord_user_id=discord_user_id,
            )
            if viewer_role == "player":
                try:
                    verify_player_identity_for_session(
                        session,
                        session_id=session_id,
                        player_id=canonical_player_id,
                        identity_token=get_identity_token_value_ws(websocket, session_id),
                    )
                except HTTPException as exc:
                    logger.warning(
                        "ws auth denied: session=%s requested_player=%s canonical_player=%s discord_user_id=%s detail=%s",
                        session_id,
                        player_id,
                        canonical_player_id,
                        discord_user_id,
                        exc.detail,
                    )
                    raise

        subscriber_key = ws_register_subscriber(
            session_id,
            websocket,
            player_id=canonical_player_id,
            discord_user_id=discord_user_id,
            compact=bool(compact),
        )
        logger.info(
            "ws registered session=%s requested_player=%s canonical_player=%s subscriber_key=%s",
            session_id,
            player_id,
            canonical_player_id,
            subscriber_key,
        )

        connection_changed = await asyncio.to_thread(
            set_player_connection_state,
            session_id,
            canonical_player_id,
            connected=True,
        )
        if connection_changed:
            schedule_session_broadcast(session_id)
        await ws_broadcast_session_state(session_id, force=True)

        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=25.0)
                safe_msg = str(msg).strip()
                if safe_msg.lower() == "close":
                    logger.info(
                        "ws client requested close session=%s canonical_player=%s subscriber_key=%s",
                        session_id,
                        canonical_player_id,
                        subscriber_key,
                    )
                    await websocket.close()
                    return
                with contextlib.suppress(Exception):
                    parsed = json.loads(safe_msg)
                    if isinstance(parsed, dict) and str(parsed.get("type", "")).lower() == "ping":
                        await websocket.send_json(
                            {
                                "type": "pong",
                                "token": str(parsed.get("token", "") or ""),
                                "server_time_ms": current_updated_at_ms(),
                            }
                        )
                        with LOCK:
                            session = resolve_session(session_id, create_if_missing=False)
                            if session is not None:
                                touch_player_connection_liveness_locked(session, player_id=canonical_player_id)
                        continue
            except asyncio.TimeoutError:
                logger.debug(
                    "ws idle keepalive session=%s canonical_player=%s subscriber_key=%s",
                    session_id,
                    canonical_player_id,
                    subscriber_key,
                )
                with LOCK:
                    session = resolve_session(session_id, create_if_missing=False)
                    if session is not None:
                        touch_player_connection_liveness_locked(session, player_id=canonical_player_id)
                continue
    except WebSocketDisconnect as exc:
        logger.info(
            "ws disconnected session=%s canonical_player=%s subscriber_key=%s code=%s",
            session_id,
            canonical_player_id,
            subscriber_key,
            getattr(exc, "code", None),
        )
        return
    except Exception as exc:
        logger.exception(
            "ws handler failed session=%s canonical_player=%s subscriber_key=%s error=%s",
            session_id,
            canonical_player_id,
            subscriber_key,
            exc,
        )
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
    finally:
        logger.info(
            "ws cleanup session=%s canonical_player=%s subscriber_key=%s",
            session_id,
            canonical_player_id,
            subscriber_key,
        )
        if subscriber_key is not None:
            ws_unregister_subscriber(session_id, subscriber_key)
        if not ws_has_connected_player(session_id, canonical_player_id):
            connection_changed = await asyncio.to_thread(
                set_player_connection_state,
                session_id,
                canonical_player_id,
                connected=False,
            )
            if connection_changed:
                schedule_session_broadcast(session_id)


@app.get("/{full_path:path}")
def spa_fallback(full_path: str) -> FileResponse:
    # Keep this route at the end so it does not shadow API routes.
    # Discord Activity can send encoded path like "/%3Fsession=...".
    if full_path.startswith(("activity/", "api/", "vendor/", "health")):
        raise HTTPException(status_code=404, detail="not found")
    return FileResponse(APP_DIR / "index.html", headers=NO_CACHE_HEADERS)


def run() -> None:
    import uvicorn

    host = os.getenv("ACTIVITY_HOST", "0.0.0.0").strip() or "0.0.0.0"
    port = int(os.getenv("ACTIVITY_PORT", "8010"))
    reload_enabled = os.getenv("ACTIVITY_DEV_RELOAD", "0").strip().lower() in {"1", "true", "yes", "on"}
    uvicorn.run(
        "discord_activity_skullking.api_server:app",
        host=host,
        port=port,
        reload=reload_enabled,
    )


if __name__ == "__main__":
    run()
