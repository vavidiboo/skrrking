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
  [key: string]: unknown;
}

export interface TrickPlaySnapshot {
  player_id?: string;
  player_name?: string;
  card?: GameCardLike;
  [key: string]: unknown;
}

export interface SessionSnapshotResponse {
  session_id?: string;
  host_id?: string;
  status?: string;
  room_status?: string;
  phase?: string;
  round_number?: number;
  players?: SessionPlayerSnapshot[];
  current_trick?: TrickPlaySnapshot[];
  flow_events?: FlowEvent[];
  logs?: string[];
  settings?: SessionSettingsSnapshot;
  updated_at?: number;
  transport?: {
    protocol_version?: string;
    compact?: boolean;
    snapshot_revision?: number;
  };
  identity_token?: string;
  [key: string]: unknown;
}
