# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Run the server:**
```bash
python -m uvicorn discord_activity_skullking.api_server:app --host 0.0.0.0 --port 8010 --reload
```

**Access in browser (bypasses Discord OAuth):**
```
http://localhost:8010/?session=skullking-main
```

**Run tests:**
```bash
python -m pytest tests/
python -m pytest tests/test_card_rules.py  # card rules only
python -m pytest tests/test_activity_api.py  # API/session only
```

Tests use in-memory session cache (no Firebase needed): `USE_MEMORY_SESSION_CACHE=True` is set automatically in test mode.

## Architecture

**Layer structure:**
1. `api_server.py` — FastAPI app: REST endpoints, WebSocket handlers, Discord OAuth, static file serving
2. `activity_service.py` — `GameService`: orchestrates room/user lifecycle, bridges API and game engine
3. `core/game_engine.py` — Pure game state machine (`RoomState`, `PlayerState` dataclasses)
4. `core/skull_king_rules.py` — Trick resolution, scoring, lead suit determination
5. `core/card_rules.py` — Card type definitions and predicate helpers
6. `core/firebase_store.py` — Database abstraction (memory or Firebase)

Game logic in `core/` is pure Python with no framework dependencies, making it independently testable.

**Frontend** (`app/`): Single-page vanilla JS app. Data flow: `appState → deriveUiModel() → render()`. Communicates via WebSocket and Discord SDK RPC. No build step — static files served directly.

**Server-authoritative design**: All game state lives on the server. The client is UI-only and renders whatever state the server sends.

## Game Flow

Rounds 1–10. Each round: deal N cards (where N = round number) → bidding phase → playing phase (N tricks) → scoring → next round. Trick winner leads next trick; round winner leads next round.

Special cards (in rough priority order when resolving tricks): Skull King > Pirates > Mermaids > Trump suits > Lead suit > Escapes. Tigress is wild (Pirate or Escape). Bonus: 60 points if Skull King captures a Mermaid; 30 if Mermaid captures Skull King.

## Key Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `FIREBASE_CREDENTIALS_PATH` | `config/firebase.json` | Firebase service account path |
| `USE_MEMORY_SESSION_CACHE` | `False` | Skip Firebase (dev/test) |
| `ACTIVITY_TURN_LIMIT_SECONDS` | `20` | Per-turn timeout |
| `ACTIVITY_ALLOW_SPECTATORS` | `False` | Read-only spectator access |
| `ACTIVITY_DISCONNECT_GRACE_SECONDS` | `90` | Reconnect window before eviction |
| `ACTIVITY_AFK_TIMEOUT_STREAK_LIMIT` | `3` | Timeouts before AFK kick |

Config files not checked in: `config/discord_config.local.json` (OAuth), `config/firebase.json` (Firebase credentials).

## Domain Documentation

`docs/skull-king/` contains detailed specs:
- `spec.md` — Game rules and design principles
- `entity-map.md` — Entity relationships mapped to code
- `event-contract.md` — WebSocket event protocol
- `realtime-flow.md` — Message flow diagrams
- `implementation-plan.md` — Feature roadmap and known gaps
