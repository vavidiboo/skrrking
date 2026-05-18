export type CurrentView = "home" | "lobby" | "game";

export type ConnectionState = "connected" | "reconnecting" | "disconnected";
export type LobbyPlayerState = "not_ready" | "ready" | "bid" | "playing" | "finished";

export type Suit = "yellow" | "green" | "purple" | "black";

export type SpecialCardKind =
  | "skull_king"
  | "pirate"
  | "mermaid"
  | "escape"
  | "tigress"
  | "kraken"
  | "white_whale";

export type CardKind = "suit" | SpecialCardKind | "special" | "default";

export interface GameCardLike {
  id?: string;
  type?: string | null;
  kind?: string | null;
  effectType?: string | null;
  suit?: Suit | string | null;
  value?: number | null;
  label?: string;
  name?: string;
  title?: string;
  mode?: "pirate" | "escape";
  [key: string]: unknown;
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
  round_number: number;
  status: string;
  phase: string;
  tricks_completed: number;
  at: number;
  actor_id?: string;
  actor_name?: string;
  current_turn_player_id?: string;
  winner_id?: string;
  applied_rule?: string;
  discarded?: boolean;
  [key: string]: unknown;
}
