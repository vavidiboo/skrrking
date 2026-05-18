import type { ConnectionState, CurrentView, FlowEvent, GameCardLike, LobbyPlayerState } from "./domain";

export interface ClientSessionSettings {
  maxPlayers: number;
  maxRounds: number;
  bonusEnabled: boolean;
  advancedRulesEnabled: boolean;
  allowSpectators: boolean;
  turnLimitSeconds: number;
}

export interface ClientPlayerState {
  id: string;
  name: string;
  state: LobbyPlayerState;
  connectionState: ConnectionState;
  avatarUrl: string | null;
  afk: boolean;
  bid: number | null;
  score: number;
  tricksWon: number;
  hand: GameCardLike[];
  handCount: number;
  legalCardIndexes: number[];
  reconnectGraceSeconds: number;
  isHost: boolean;
}

export interface ClientTrickPlay {
  playerId: string;
  playerName: string;
  card: GameCardLike | null;
}

export interface ClientScoreBreakdownRow {
  playerId: string;
  bid: number | null;
  tricksWon: number;
  success: boolean;
  roundBonus: number;
  score: number;
}

export interface ClientRoundSummaryRow {
  playerId: string;
  playerName: string;
  bid: number | null;
  tricksWon: number;
  score: number;
  roundBonus: number;
  success: boolean;
}

export interface ClientRoundSummary {
  title: string;
  status: string;
  phase: string;
  roundNumber: number;
  rows: ClientRoundSummaryRow[];
}

export interface ClientSessionState {
  sessionId: string;
  hostId: string;
  status: string;
  roomStatus: string;
  phase: string;
  roundNumber: number;
  cardsDealt: number;
  tricksCompleted: number;
  currentTurnPlayerId: string;
  players: ClientPlayerState[];
  currentTrick: ClientTrickPlay[];
  lastTrick: ClientTrickPlay[];
  scoreBreakdown: ClientScoreBreakdownRow[];
  flowEvents: FlowEvent[];
  latestFlowEvent: FlowEvent | null;
  logs: string[];
  latestLog: string;
  settings: ClientSessionSettings;
  updatedAt: number;
  protocolVersion: string;
  snapshotRevision: number;
  viewerRole: string;
  viewerPresence: string;
  viewerInSession: boolean;
  viewerIsMember: boolean;
  spectatorAllowed: boolean;
  spectatorPolicy: string;
  reconnectGraceSeconds: number;
}

export interface ClientLobbyModel {
  heading: string;
  summary: string;
  settingsLine: string;
  actionHint: string;
}

export interface ClientUiState {
  currentView: CurrentView;
  splashVisible: boolean;
  splashMode: string;
  lobbyModel: ClientLobbyModel | null;
}

export interface ClientInteractionState {
  viewerId: string;
  viewerPlayerId: string;
  viewerRole: string;
  legalCardIndexes: number[];
  selectedCardIndex: number | null;
  pendingActionKind: string;
  pendingActionKey: string;
  pendingActionActive: boolean;
  readOnly: boolean;
}

export type ClientTransportPayloadMode = "full" | "compact" | "unknown";

export interface ClientTransportState {
  protocolVersion: string;
  snapshotRevision: number;
  payloadMode: ClientTransportPayloadMode;
  websocketActive: boolean;
  pollingActive: boolean;
  lastSuccessfulSyncAt: number;
  lastServerUpdatedAt: number;
  sessionConnectionState: ConnectionState | "unknown";
}

export interface ClientStoreSnapshot {
  session: ClientSessionState | null;
  ui: ClientUiState;
  interaction: ClientInteractionState;
  transport: ClientTransportState;
}
