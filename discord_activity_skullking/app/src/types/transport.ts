import type { ConnectionState, FlowEvent, GameCardLike, LobbyPlayerState } from "./domain";

export interface SessionSettingsSnapshot {
  max_players?: number;
  maxPlayers?: number;
  max_rounds?: number;
  maxRounds?: number;
  bonus_enabled?: boolean;
  bonusEnabled?: boolean;
  advanced_rules_enabled?: boolean;
  advancedRulesEnabled?: boolean;
  allow_spectators?: boolean;
  allowSpectators?: boolean;
  turn_limit_seconds?: number;
  turnLimitSeconds?: number;
  [key: string]: unknown;
}

export interface SessionPlayerSnapshot {
  id?: string;
  name?: string;
  state?: LobbyPlayerState | string;
  connection_state?: ConnectionState | string;
  avatar_url?: string | null;
  afk?: boolean;
  hostId?: string;
  bid?: number | null;
  score?: number;
  tricks_won?: number;
  hand?: GameCardLike[];
  hand_count?: number;
  legal_indexes?: number[];
  reconnect_grace_seconds?: number;
  [key: string]: unknown;
}

export interface TrickPlaySnapshot {
  player_id?: string;
  player_name?: string;
  card?: GameCardLike;
  [key: string]: unknown;
}

export interface SessionScoreBreakdownSnapshot {
  player_id?: string;
  bid?: number | null;
  tricks_won?: number;
  success?: boolean;
  round_bonus?: number;
  score?: number;
  [key: string]: unknown;
}

export interface SessionSnapshotResponse {
  session_id?: string;
  host_id?: string;
  status?: string;
  room_status?: string;
  phase?: string;
  round_number?: number;
  cards_dealt?: number;
  turn_index?: number;
  current_turn_player_id?: string;
  tricks_completed?: number;
  players?: SessionPlayerSnapshot[];
  current_trick?: TrickPlaySnapshot[];
  last_trick?: TrickPlaySnapshot[];
  score_breakdown?: SessionScoreBreakdownSnapshot[];
  flow_events?: FlowEvent[];
  logs?: string[];
  latest_log?: string;
  settings?: SessionSettingsSnapshot;
  viewer_role?: string;
  viewer_presence?: string;
  viewer_in_session?: boolean;
  viewer_is_member?: boolean;
  spectator_allowed?: boolean;
  spectator_policy?: string;
  reconnect_grace_seconds?: number;
  updated_at?: number;
  transport?: {
    protocol_version?: string;
    compact?: boolean;
    snapshot_revision?: number;
  };
  identity_token?: string;
  [key: string]: unknown;
}
