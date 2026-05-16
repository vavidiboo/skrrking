# Project Audit: Skull King Activity

**Date:** 2026-04-07  
**Scope:** Backend, Frontend, Event Contract, State Sync, Performance, Tests  
**Method:** Static analysis of all source files, tests, and documentation

---

## Summary

Skull King Activity is a server-authoritative multiplayer card game built with FastAPI + vanilla JS. Core gameplay (10-round deal-bid-play-score loop) is fully implemented end-to-end. The project has strong architecture separation (pure game engine, service layer, API layer) and robust reconnection handling.

**Key findings:**

| Area | Status |
|------|--------|
| Core gameplay | Fully functional (lobby → bidding → playing → scoring → finish) |
| Frontend parity | High — all game phases rendered, some placeholder UI (Shop, Quests, Settings) |
| Event contract | 95% compliant — snapshot-based sync works well, minor doc gaps |
| State sync risks | 3 critical, 4 medium — global lock + Firebase I/O is the primary concern |
| Performance | Global lock under synchronous Firebase I/O is the bottleneck |
| Test coverage | ~25% of functions tested — scoring bonuses, game engine, WebSocket untested |

---

## Backend Features

### REST Endpoints (14)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/discord/exchange` | Discord OAuth code → access token |
| POST | `/activity/presence/clear` | Clear user activity presence |
| GET | `/activity/sessions` | List lobby sessions (paginated) |
| GET | `/activity/sessions/resume` | Find resumable session for player |
| POST | `/activity/sessions` | Create new session (with password, mode, settings) |
| POST | `/activity/sessions/{id}/join` | Join session (password validation) |
| POST | `/activity/sessions/{id}/player-state` | Toggle ready/not_ready in lobby |
| POST | `/activity/sessions/{id}/leave` | Leave session (forfeit if mid-game) |
| POST | `/activity/sessions/{id}/start` | Start game / next round (host only) |
| POST | `/activity/sessions/{id}/bid` | Submit bid (0 to round_number) |
| POST | `/activity/sessions/{id}/play` | Play card (with Tigress mode selection) |
| GET | `/activity/sessions/{id}/state` | Long-poll session state (delta support) |
| GET | `/health` | Health check |
| GET | `/discord-oauth-callback` | OAuth redirect handler |

### WebSocket (1)

| Path | Purpose |
|------|---------|
| `/ws/activity/sessions/{id}` | Real-time state broadcast (receive-only for client) |

### Game Engine Capabilities

- **Phases:** idle → bidding → playing → scoring → waiting_next_round → finished
- **Cards:** 70 base (56 numbered + 14 special) / 72 with advanced (+ Kraken, White Whale)
- **Special cards:** Skull King, Pirate (5), Mermaid (2), Escape (5), Tigress (wild)
- **Advanced cards:** Kraken (discards trick), White Whale (specials become escapes)
- **Scoring:** Bid match (20×bid + bonus), bid miss (-10×|diff|), zero bid (±10×round)
- **Bonuses:** 14-card (+10/+20), Pirate captures Mermaid (+20), SK captures Pirate (+30), Mermaid captures SK (+40)
- **Lead suit enforcement:** Must follow lead suit if able
- **Trick resolution:** 9-tier priority (Mermaid>SK, SK>Pirate, Pirate>Mermaid, etc.)

### Server Features

- Identity tokens (HMAC-SHA256, 12h TTL, HTTP-only cookies)
- Player connection state tracking (connected/disconnected/reconnecting)
- Disconnect grace period (90s) with auto-AFK after 3 consecutive timeouts
- Timeout auto-actions: auto-bid 0, auto-play lowest penalty card
- Host auto-transfer on host disconnect
- Game auto-end when <2 participating players
- Session caching with fingerprint-based change detection
- Firebase persistence with memory fallback (USE_MEMORY_SESSION_CACHE)
- Flow events (game_started, round_started, bid_submitted, card_played, trick_resolved, round_scored, game_finished)
- Spectator mode (configurable, read-only)
- Room password protection

---

## Frontend Features

### Implemented Screens

| Screen | Status | Notes |
|--------|--------|-------|
| Home | Complete | Create/Join room, room list refresh |
| Create Room Dialog | Complete | 2-step: mode selection → room options (name, password, max players, bonus, advanced) |
| Find Room Dialog | Complete | Room list with join buttons, password prompt |
| Lobby | Complete | Circular seat layout, ready states, host controls, invite |
| Game — Bidding | Complete | Modal dialog with ±step, validation (0 to cards_dealt) |
| Game — Playing | Complete | Fan hand layout, drag-to-play + click-to-play, legal move highlighting |
| Game — Tigress | Complete | Mode selection dialog (Pirate / Escape) |
| Game — Trick Center | Complete | Played cards display with progress indicator |
| Game — Player Ring | Complete | Circular seats with avatars, bids, tricks won, turn indicator |
| Game — Turn Timer | Complete | Visual progress bar synced with server deadline |
| Score Drawer | Complete | Tabs: Scores / History / Guide, draggable |
| Round Result | Complete | Score delta per player, bid hit/miss status |
| Game Finish | Complete | Winner highlight, final scoreboard, Home/Lobby buttons |
| Reconnect Overlay | Complete | Hard-blocks input, grace period countdown |
| Battle Log | Complete | Last 20 events |

### Communication Pattern

- **Outbound:** HTTP POST for all game actions (create, join, bid, play, leave, start)
- **Inbound:** WebSocket for real-time state updates, long-poll fallback
- **State sync:** Snapshot-based diffing via `ingestServerState()` → `buildTransitionDiff()` → `runStateTransitionEffects()`
- **Reconnection:** Exponential backoff (1s → 15s max), automatic WS → polling fallback

### Additional Frontend Features

- Discord SDK integration (OAuth, guild nick, presence)
- Spectator mode (read-only, interaction locked)
- Toast notifications (Korean localized)
- Responsive layout (mobile/tablet/desktop)
- Viewport fit calculation
- UI render caching (cache keys per component)
- Error handling (session expired, network issues, invalid moves, access denied)
- AFK display on player seats and scoreboards

---

## Missing Parity Items

### Backend exists, Frontend missing or placeholder

| Feature | Backend | Frontend | Gap |
|---------|---------|----------|-----|
| Shop | N/A | Icon only (🛍️), no handler | Placeholder UI |
| Quests | N/A | Icon only (📜), no handler | Placeholder UI |
| Season Pass | N/A | Icon only (👑), no handler | Placeholder UI |
| Settings menu | N/A | Icon only (⚙️), no handler | Placeholder UI |
| Message/mail | N/A | Icon only (✉️), no handler | Placeholder UI |
| Home room list | Sessions endpoint exists | `homeRoomList` element exists but never populated by JS | Dead element |
| Advanced rules visual | Engine supports Kraken/White Whale | Toggle sent to server, but no special UI rendering for advanced card types | Functional gap |
| Bot fill | Server has no bot AI | Toggle exists in lobby setup | UI with no backend |

### Frontend dead code (JS references elements not in HTML)

| JS Reference | Status |
|--------------|--------|
| `playActionBar` | Element not in HTML |
| `selectedCardText` | Element not in HTML |
| `clearCardSelectionBtn` | Element not in HTML |
| `submitSelectedCardBtn` | Element not in HTML |
| `latestLogLabel` | Element not in HTML |
| `bidInput` / `bidBtn` (old flow) | Superseded by `bidDialog`, never used |

---

## Event Contract Mismatches

**Reference:** `docs/skull-king/event-contract.md`  
**Compliance:** ~95%

### Architecture Alignment

The contract describes domain events (player_joined, bid_submitted, etc.) as conceptual detection patterns. The implementation correctly uses **snapshot-based synchronization** — not a discrete event bus. Frontend detects transitions via `buildTransitionDiff()` comparing previous and current snapshots.

### Mismatches Found

| Item | Contract | Implementation | Severity |
|------|----------|---------------|----------|
| `hand_dealt` event | Listed as domain event | Not emitted as flow_event; implicit in `game_started`/`round_started` via round_number increment | Low — functionally equivalent |
| `round_started` event | Not listed separately | Emitted when transitioning waiting_round → bidding (distinct from `game_started`) | Low — extra event, not breaking |
| Extra snapshot fields | Not documented | `viewer_presence`, `viewer_status`, `viewer_in_session`, `reconnect_grace_seconds`, `afk_timeout_streak_limit`, `spectator_allowed`, `has_password` | Low — extensions for Discord Activity |
| Frontend event model | Contract implies event listeners | Frontend uses snapshot-diff transitions, not explicit event handlers | None — more robust than contract implies |

### Contract-Implementation Field Compliance

All 50+ contract-specified snapshot fields are present and correctly structured in `session_public_state()`. Player object fields (id, name, state, score, bid, tricks_won, hand_count, hand, legal_indexes, connection_state, afk) all match.

### Flow Event Kinds (Backend ↔ Frontend)

| Flow Event | Backend emits | Frontend handles in `describeFlowEvent()` |
|------------|--------------|---------------------------------------------|
| game_started | Yes | Yes |
| round_started | Yes | Yes |
| bid_submitted | Yes | Yes |
| card_played | Yes | Yes |
| turn_changed | Yes | Yes |
| trick_resolved | Yes | Yes |
| round_scored | Yes | Yes |
| game_finished | Yes | Yes |

---

## State Sync Risks

### Critical

| # | Risk | Location | Description |
|---|------|----------|-------------|
| 1 | **Global lock + sync Firebase I/O** | `api_server.py` all endpoints | Every endpoint holds `LOCK` while performing synchronous Firebase reads/writes (100-500ms each). 10 concurrent requests → 5s total serialized latency. |
| 2 | **No idempotency for game actions** | `api_server.py` POST endpoints | No idempotency keys. If client retries on network timeout, duplicate action may succeed or fail unpredictably. Engine rejects duplicate bids but relies on state consistency. |
| 3 | **Non-atomic Firebase writes** | `api_server.py:895-913` | Room state and user presence are separate writes. Server crash between them leaves inconsistent state (room says player is in game, UserDB says player left). |

### Medium

| # | Risk | Location | Description |
|---|------|----------|-------------|
| 4 | **Stale snapshot after reconnection** | `app.js` refreshState, `api_server.py` long-poll | Timestamp-based comparison is insufficient — multiple server updates within same second can be missed. No sequence numbers on messages. |
| 5 | **WS→Polling fallback not coordinated** | `app.js`, `api_server.py` | WebSocket and long-poll handlers operate independently. Switching from WS to polling mid-session can miss intermediate updates. |
| 6 | **No event journal** | All state endpoints | Only last 20 log strings kept. Cannot replay missed events, cannot detect state corruption, cannot verify client-server sequence alignment. |
| 7 | **Client applies state without validation** | `app.js` ingestServerState | No structural integrity checks — if server sends corrupted state (e.g., 5 cards in 3-player trick), client applies it unchecked. |

### Edge Cases

- **Host transfer race:** Host disconnect during "start" action → new host auto-elected, but old start action still in flight
- **Bidding clock skew:** No bid timestamps tracked; near-simultaneous bids resolved by lock order, not intent
- **Spectator join mid-round:** No explicit code path; could produce inconsistent player state

---

## Performance Bottlenecks

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 1 | **Sync Firebase I/O under global lock** | Critical | All requests serialize. Lock held 100-500ms per Firebase round-trip. Under load (8 players × frequent actions), tail latency reaches seconds. |
| 2 | **O(n) session list loading** | Medium | `list_sessions()` loads ALL sessions from Firebase, filters by status, sorts. Degrades linearly with total session count (including finished). |
| 3 | **Full state serialization per request** | Medium | `session_public_state()` deserializes all cards, rebuilds player views, computes legal indexes — for every GET/poll request. ~40 serializations/s during active play with 10 clients. |
| 4 | **Unbounded session cache** | Medium | Finished sessions never evicted from memory. `find_expired_waiting_rooms()` only targets idle rooms, not completed games. Memory grows indefinitely. |
| 5 | **No Firebase query filters** | Medium | `load_all_sync()` downloads entire "Rooms"/"ActivitySessions" branch. No server-side filtering by status or timestamp. |
| 6 | **Naive cache — no copy-on-write** | Low | `cache_set_session()` stores dict reference directly. Two threads holding same dict reference can see unexpected mutations. |
| 7 | **No circuit breaker for Firebase** | Low | If Firebase is slow/down, all endpoints block indefinitely. No timeout, no fallback to memory-only mode. |

---

## Test Gaps

### Coverage Summary

| Module | Functions | Tested | Coverage | Risk |
|--------|-----------|--------|----------|------|
| `card_rules.py` | 15 | 3 | 20% | Medium |
| `skull_king_rules.py` | 13 | 7 | 54% | Medium |
| `game_engine.py` | 13 | 0 (indirect only) | 0% direct | **High** |
| `activity_service.py` | 8 | 0 | 0% | Medium |
| `api_server.py` | 80+ | 23 | ~28% | **High** |
| **Total** | **129+** | **33** | **~25%** | **High** |

### Critical Untested Areas

| Area | What's Missing | Risk |
|------|---------------|------|
| **Scoring bonuses** | `calculate_trick_bonus()` — zero tests for 14-card bonus, Pirate×Mermaid, SK×Pirate, Mermaid×SK bonuses | Scoring bugs go undetected |
| **Full game lifecycle** | No test plays 10 rounds end-to-end | Phase transition bugs accumulate |
| **Tigress interactions** | Zero tests for Tigress mode selection + all card combo interactions | Wild card logic unverified |
| **Game engine (direct)** | `build_room()`, `enter_room()`, `room_public_view()`, `legal_card_indexes()` — no unit tests | Core logic unverified in isolation |
| **WebSocket broadcast** | All `ws_*` functions untested | Real-time sync bugs undetectable |
| **Timeout auto-play** | `penalty_auto_play_card_index()`, `maybe_apply_server_timeouts_locked()` | AFK handling logic unverified |
| **Concurrent access** | No tests for simultaneous bids/plays | Race conditions undetectable |
| **Activity service** | `generate_room_id()`, `get_room_state()`, `save_room_state()` — zero tests | Persistence layer unverified |
| **Disconnect during play** | Only basic presence test; no mid-trick/mid-bid disconnect scenarios | Game can stall |
| **Error paths** | Invalid card index, must-follow-suit violations, expired tokens, malformed requests | Edge case failures |

### What IS Well-Tested

- API session lifecycle (create → join → ready → start → bid → play → leave)
- Identity token encoding/decoding
- Reconnect grace period logic
- Basic trick resolution (6 card combos)
- Basic scoring (bid match/miss)
- Session status normalization
- Presence state transitions

---

## Top 5 Priorities

### 1. Move Firebase I/O Outside the Global Lock
**Impact:** Critical performance + state sync  
The global `LOCK` holding synchronous Firebase reads/writes is the single biggest bottleneck. It serializes all concurrent requests and adds 100-500ms per request. Solution: lock protects only in-memory state; queue Firebase writes to a background thread.

### 2. Add Scoring Bonus Tests
**Impact:** Correctness  
`calculate_trick_bonus()` has zero tests. This function computes 14-card bonuses, Pirate×Mermaid captures, SK×Pirate captures, and Mermaid×SK captures — all critical to correct scoring. A single bug here silently corrupts every game's scores.

### 3. Add Idempotency Keys to Game Action Endpoints
**Impact:** Reliability  
Network timeouts cause client retries. Without idempotency tokens, duplicate bids/plays can produce unpredictable results. Add `idempotency_key` parameter with server-side 5-minute cache of (key, response) pairs.

### 4. Test Full 10-Round Game Lifecycle
**Impact:** Confidence  
No test currently plays a complete game through all 10 rounds. Phase transitions, score accumulation, round resets, and game completion logic are only tested in fragments. An end-to-end test would catch state leaks between rounds.

### 5. Clean Up Dead Frontend Code + Implement Missing Parity
**Impact:** Maintainability  
JS references 8+ DOM elements that don't exist in HTML (old bidding UI, card selection bar). `homeRoomList` element exists but is never populated. Advanced rules toggle is sent to server but produces no visual difference. Clean dead code and decide which placeholders (Shop, Quests, Settings) to implement or remove.
