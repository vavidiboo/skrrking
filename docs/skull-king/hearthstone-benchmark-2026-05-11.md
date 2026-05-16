## Hearthstone Benchmark Notes

Date: 2026-05-11

### Goal

Use Hearthstone as a benchmark for a server-authoritative turn-based card game, then translate the useful parts into the Skull King Activity without forcing an unnecessary full rewrite.

### Source Notes

The exact production transport used by Hearthstone is not publicly documented end-to-end by Blizzard. The benchmark below combines:

- Blizzard's reconnect-era patch notes showing that a live match continues on the server while the client reconnects.
- Community-maintained reverse-engineering notes that describe separate session-server style responsibilities.

This means the protocol details below are partly inference, but the product behavior is well established:

- Match state is server authoritative.
- Reconnect is resume-oriented, not replay-oriented.
- The client is expected to rehydrate from fresh state after reconnect.

References:

- Blizzard patch notes (reconnect feature): https://news.blizzard.com/en-us/article/13154924/1-0-0-4944
- Hearthstone wiki entry on the Session Server: https://hearthstone.wiki.gg/wiki/Session_Server

### What Hearthstone Gets Right

1. The match runtime is treated as its own server-owned session.

The important design point is not "WebSocket vs not WebSocket". The important point is that the active match lives on the server as a separate authoritative runtime with its own lifecycle.

2. The match keeps progressing while a client is absent.

If a player disconnects, the match does not stop and wait for that browser. The reconnect window is a resume window, not a pause button.

3. Reconnect restores from current truth.

The client does not need to reconstruct every past packet. It only needs a fresh accepted state from the match server.

4. The client is thin at the authority boundary.

The client can predict UI and cache local intent, but the match result, legal actions, timers, and final accepted commands belong to the server.

### Mapping That Benchmark To Skull King

Our current architecture is already fairly close in spirit:

- Commands go through HTTP mutation endpoints.
- The server owns turn order, legal actions, timers, AFK, and reconnect policy.
- State is replicated through WebSocket with long-poll fallback.

That means the benchmark does not tell us to replace everything with a new transport. It tells us to make the session contract clearer.

### Gaps In The Current Contract

1. The snapshot does not clearly describe the match session itself.

We have `transport`, but not a first-class `match_session` block that explains how this runtime behaves.

2. Reconnect timing is not explicit enough.

We expose reconnect grace in seconds, but not a concrete reconnect deadline per affected player.

3. The client message around reconnect is too generic.

For a Hearthstone-like experience, the UI should make it clear that:

- the match is still running on the server
- the player is resuming a live session
- the reconnect window is finite

### Recommended Changes

1. Keep the existing command/replication split.

For Skull King, `HTTP commands + WebSocket snapshots + polling fallback` is a good turn-based architecture.

2. Add a `match_session` snapshot block.

This is the contract that explains the runtime:

- server authoritative
- command transport
- state replication transport
- resume strategy
- reconnect window
- whether the match continues during reconnect

3. Add `reconnect_deadline_at` per player.

The client should not have to derive everything from a generic grace constant when the server already knows the real reconnect window anchor.

4. Update the reconnect UI copy to match the real model.

Instead of a generic "recovering connection" message, the client should say that the live match continues on the server and that the client is resuming via a fresh snapshot.

### Concrete Scope For This Round

This benchmark is implemented in a low-risk way:

- add `match_session` metadata to public state
- add `reconnect_deadline_at` to player payloads
- update reconnect messaging in the client
- keep the current gameplay engine and command model intact

### Why This Is The Right Level Of Change

Hearthstone's lesson is not "copy a hidden transport stack".
The lesson is "make the match session explicit, authoritative, and resumable".

That is exactly the kind of improvement that helps this Skull King project now without creating migration risk.
