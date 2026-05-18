# TypeScript Migration

## Goal

Standardize the frontend on TypeScript and use typed domain contracts to reduce refactor risk across UI, effects, transport, and future R3F work.

## Migration Principles

- Do not rename files to `.ts` or `.tsx` without defining the domain types first
- Separate backend payload types from client-facing domain types
- Use adapters and shims for transitional legacy interop
- Make state contracts explicit before large rendering changes

## Target Conversion Order

1. Add shared domain and transport types
2. Convert `legacyBridge.js` to `legacyBridge.ts`
3. Convert `effectPresets.js` to `effectPresets.ts`
4. Convert `effectBus.js` to `effectBus.ts`
5. Convert `CardEffectLayer.jsx` to `CardEffectLayer.tsx`
6. Convert `App.jsx` to `App.tsx`
7. Convert `main.jsx` to `main.tsx`
8. Add typed legacy interop boundaries
9. Introduce typed Zustand slices

## File Conversion Rules

- `.jsx` becomes `.tsx`
- `.js` becomes `.ts`
- DOM query results should use explicit element types
- Effect events should use discriminated unions
- Transport payloads should use backend-shape types plus normalized client types

## Core Domain Types

```ts
export type Suit = "yellow" | "green" | "purple" | "black";

export type SpecialCardKind =
  | "skull_king"
  | "pirate"
  | "mermaid"
  | "escape"
  | "tigress"
  | "kraken"
  | "white_whale";

export type Card =
  | {
      id: string;
      type: "suit";
      suit: Suit;
      value: number;
      label: string;
    }
  | {
      id: string;
      type: SpecialCardKind;
      suit: null;
      value: null;
      label: string;
      mode?: "pirate" | "escape";
    };

export interface Player {
  id: string;
  name: string;
  order: number;
  score: number;
  bid: number | null;
  tricksWon: number;
  roundBonus: number;
  state: "not_ready" | "ready" | "bid" | "playing" | "finished";
  connectionState: "connected" | "reconnecting" | "disconnected";
  avatarUrl?: string | null;
  afk?: boolean;
  hand?: Card[];
  handCount?: number;
}

export interface TrickPlay {
  playerId: string;
  playerName?: string;
  card: Card;
}

export type FlowEventType =
  | "game_started"
  | "round_started"
  | "turn_changed"
  | "bid_submitted"
  | "trick_resolved"
  | "round_scored"
  | "match_finished";

export interface FlowEvent {
  kind: FlowEventType;
  roundNumber: number;
  status: string;
  phase: string;
  tricksCompleted: number;
  at: number;
  actorId?: string;
  actorName?: string;
  currentTurnPlayerId?: string;
  winnerId?: string;
  appliedRule?: string;
  discarded?: boolean;
}

export interface MatchSettings {
  bonusEnabled: boolean;
  advancedRulesEnabled: boolean;
  maxPlayers: number;
  maxRounds: number;
  turnLimitSeconds: number;
}

export interface MatchState {
  sessionId: string;
  status: "lobby" | "bidding" | "playing" | "waiting_round" | "finished";
  phase: "idle" | "bidding" | "playing" | "scoring" | "waiting_next_round";
  roomStatus: "waiting" | "playing" | "finished";
  roundNumber: number;
  players: Player[];
  currentTrick: TrickPlay[];
  flowEvents: FlowEvent[];
  logs: string[];
  settings: MatchSettings;
  updatedAt: number;
}
```

## Effect Types

```ts
export type EffectPriority = "critical" | "high" | "normal" | "low";
export type EffectQualityTier = "ultra" | "high" | "medium" | "low" | "lite";
export type EffectChannel = "board" | "camera" | "card" | "particles" | "overlay" | "score" | "audio";

export type EffectEventType =
  | "card.play"
  | "card.special.skullKing"
  | "card.special.mermaid"
  | "trick.resolve"
  | "round.scoreDelta"
  | "match.finish"
  | "ui.turnUrgent"
  | "camera.shake";

export interface EffectEvent {
  id: string;
  type: EffectEventType;
  priority: EffectPriority;
  channels: EffectChannel[];
  qualityTier?: EffectQualityTier;
  card?: Card;
  sourcePlayerId?: string;
  targetPlayerId?: string;
  payload?: Record<string, unknown>;
  createdAt: number;
}
```

## Transport Types

```ts
export interface SessionSnapshotResponse {
  session_id: string;
  status: string;
  room_status: string;
  phase: string;
  round_number: number;
  players: unknown[];
  current_trick: unknown[];
  flow_events: unknown[];
  logs: string[];
  settings: Record<string, unknown>;
  updated_at: number;
  transport?: {
    protocol_version?: string;
    compact?: boolean;
    snapshot_revision?: number;
  };
  identity_token?: string;
}
```

## Zustand Store Typing

Recommended slices:

- `sessionSlice`
- `uiSlice`
- `interactionSlice`
- `effectSlice`
- `transportSlice`
- `settingsSlice`

Note:

- Do not introduce real Zustand runtime state in Stage 2
- Only prepare shared store-facing types so Stage 3 can adopt them cleanly

Example:

```ts
export interface SessionSlice {
  match: MatchState | null;
  viewerId: string;
  applySnapshot: (snapshot: SessionSnapshotResponse) => void;
}

export interface InteractionSlice {
  selectedCardId: string | null;
  hoveredCardId: string | null;
  legalCardIds: string[];
  setSelectedCard: (cardId: string | null) => void;
}

export type GameStore = SessionSlice & InteractionSlice;
```

## R3F Typing

- Use explicit Three.js and R3F event types
- Separate domain props from render props
- Avoid storing raw Three objects in broad global state

Example:

```ts
export interface CardActorProps {
  card: Card;
  ownerSeat: number;
  isPlayable: boolean;
  isSelected: boolean;
  worldPosition: [number, number, number];
  onSelect?: (cardId: string) => void;
}
```

## Interop Strategy

`legacy-app.js` is not the first full TypeScript target. It is the first interop target.

Plan:

- define minimal legacy bridge types
- type `window.SkullKingFX` and bridge payloads
- keep legacy code behind typed adapter boundaries
- reduce `any` usage as ownership moves out of legacy

## Migration Anti-Patterns

- hiding real uncertainty with `as any`
- passing raw backend payloads directly into UI components
- mixing snake_case backend shapes with camelCase domain state without adapters
- storing DOM node references in global store state

## Definition of Done

- core domain and transport contracts are defined
- effect and store boundaries are typed
- converted files compile cleanly
- legacy interop is explicit instead of implicit
