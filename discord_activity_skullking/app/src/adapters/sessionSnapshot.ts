import type { ConnectionState, CurrentView, LobbyPlayerState } from "../types";
import type {
  ClientInteractionState,
  ClientSessionState,
  ClientStoreSnapshot,
  ClientTransportPayloadMode,
  ClientTransportState,
  ReactUiBridgeState,
  SessionPlayerSnapshot,
  SessionScoreBreakdownSnapshot,
  SessionSnapshotResponse,
  TrickPlaySnapshot,
} from "../types";

const DEFAULT_MAX_PLAYERS = 6;
const DEFAULT_MAX_ROUNDS = 10;
const DEFAULT_TURN_LIMIT_SECONDS = 15;

function numberOrDefault(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeLobbyPlayerState(state: unknown): LobbyPlayerState {
  const safe = String(state || "").trim().toLowerCase();
  if (safe === "ready" || safe === "bid" || safe === "playing" || safe === "finished") {
    return safe;
  }
  return "not_ready";
}

function normalizeConnectionState(state: unknown): ConnectionState | "unknown" {
  const safe = String(state || "").trim().toLowerCase();
  if (safe === "reconnecting" || safe === "disconnected" || safe === "connected") {
    return safe;
  }
  return "unknown";
}

function normalizeCurrentView(view: unknown): CurrentView {
  const safe = String(view || "").trim().toLowerCase();
  if (safe === "lobby" || safe === "game") {
    return safe;
  }
  return "home";
}

function normalizePayloadMode(mode: unknown, snapshot?: SessionSnapshotResponse | null): ClientTransportPayloadMode {
  const safe = String(mode || "").trim().toLowerCase();
  if (safe === "full" || safe === "compact" || safe === "unknown") {
    return safe;
  }
  if (typeof snapshot?.transport?.compact === "boolean") {
    return snapshot.transport.compact ? "compact" : "full";
  }
  return "unknown";
}

function normalizePlayer(player: SessionPlayerSnapshot, hostId: string) {
  const safePlayer = player && typeof player === "object" ? player : {};
  const hand = Array.isArray(safePlayer.hand) ? safePlayer.hand : [];
  const legalCardIndexes = Array.isArray(safePlayer.legal_indexes)
    ? safePlayer.legal_indexes.map((index) => numberOrDefault(index)).filter((index) => index >= 0)
    : [];
  const connectionState = normalizeConnectionState(safePlayer.connection_state);

  return {
    id: String(safePlayer.id || ""),
    name: String(safePlayer.name || "Player"),
    state: normalizeLobbyPlayerState(safePlayer.state),
    connectionState: connectionState === "unknown" ? "connected" : connectionState,
    avatarUrl: safePlayer.avatar_url ? String(safePlayer.avatar_url) : null,
    afk: Boolean(safePlayer.afk),
    bid: safePlayer.bid === null || safePlayer.bid === undefined ? null : numberOrDefault(safePlayer.bid),
    score: numberOrDefault(safePlayer.score),
    tricksWon: numberOrDefault(safePlayer.tricks_won),
    hand,
    handCount: Math.max(hand.length, numberOrDefault(safePlayer.hand_count, hand.length)),
    legalCardIndexes,
    reconnectGraceSeconds: Math.max(0, numberOrDefault(safePlayer.reconnect_grace_seconds)),
    isHost: Boolean(hostId) && String(safePlayer.id || "") === hostId,
  };
}

function normalizeTrickPlay(play: TrickPlaySnapshot) {
  const safePlay = play && typeof play === "object" ? play : {};
  return {
    playerId: String(safePlay.player_id || ""),
    playerName: String(safePlay.player_name || ""),
    card: safePlay.card && typeof safePlay.card === "object" ? safePlay.card : null,
  };
}

function normalizeScoreBreakdownRow(row: SessionScoreBreakdownSnapshot) {
  const safeRow = row && typeof row === "object" ? row : {};
  return {
    playerId: String(safeRow.player_id || ""),
    bid: safeRow.bid === null || safeRow.bid === undefined ? null : numberOrDefault(safeRow.bid),
    tricksWon: numberOrDefault(safeRow.tricks_won),
    success: Boolean(safeRow.success),
    roundBonus: numberOrDefault(safeRow.round_bonus),
    score: numberOrDefault(safeRow.score),
  };
}

export function normalizeSessionSnapshot(snapshot: SessionSnapshotResponse | null | undefined): ClientSessionState | null {
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }

  const hostId = String(snapshot.host_id || "");
  const players = (Array.isArray(snapshot.players) ? snapshot.players : []).map((player) => normalizePlayer(player, hostId));
  const currentTurnPlayerId =
    String(snapshot.current_turn_player_id || "") ||
    players[numberOrDefault(snapshot.turn_index)]?.id ||
    "";
  const flowEvents = Array.isArray(snapshot.flow_events) ? snapshot.flow_events : [];

  return {
    sessionId: String(snapshot.session_id || ""),
    hostId,
    status: String(snapshot.status || "lobby").toLowerCase(),
    roomStatus: String(snapshot.room_status || snapshot.status || "lobby").toLowerCase(),
    phase: String(snapshot.phase || snapshot.status || "idle").toLowerCase(),
    roundNumber: Math.max(0, numberOrDefault(snapshot.round_number)),
    cardsDealt: Math.max(0, numberOrDefault(snapshot.cards_dealt, numberOrDefault(snapshot.round_number))),
    tricksCompleted: Math.max(0, numberOrDefault(snapshot.tricks_completed)),
    currentTurnPlayerId,
    players,
    currentTrick: (Array.isArray(snapshot.current_trick) ? snapshot.current_trick : []).map(normalizeTrickPlay),
    lastTrick: (Array.isArray(snapshot.last_trick) ? snapshot.last_trick : []).map(normalizeTrickPlay),
    scoreBreakdown: (Array.isArray(snapshot.score_breakdown) ? snapshot.score_breakdown : []).map(normalizeScoreBreakdownRow),
    flowEvents,
    latestFlowEvent: flowEvents.length ? flowEvents[flowEvents.length - 1] : null,
    logs: Array.isArray(snapshot.logs) ? snapshot.logs.filter((line): line is string => typeof line === "string") : [],
    latestLog: String(snapshot.latest_log || ""),
    settings: {
      maxPlayers: Math.max(2, numberOrDefault(snapshot.settings?.max_players ?? snapshot.settings?.maxPlayers, DEFAULT_MAX_PLAYERS)),
      maxRounds: Math.max(1, numberOrDefault(snapshot.settings?.max_rounds ?? snapshot.settings?.maxRounds, DEFAULT_MAX_ROUNDS)),
      bonusEnabled: Boolean(snapshot.settings?.bonus_enabled ?? snapshot.settings?.bonusEnabled),
      advancedRulesEnabled: Boolean(snapshot.settings?.advanced_rules_enabled ?? snapshot.settings?.advancedRulesEnabled),
      allowSpectators: Boolean(snapshot.settings?.allow_spectators ?? snapshot.settings?.allowSpectators),
      turnLimitSeconds: Math.max(
        1,
        numberOrDefault(snapshot.settings?.turn_limit_seconds ?? snapshot.settings?.turnLimitSeconds, DEFAULT_TURN_LIMIT_SECONDS),
      ),
    },
    updatedAt: numberOrDefault(snapshot.updated_at),
    protocolVersion: String(snapshot.transport?.protocol_version || ""),
    snapshotRevision: Math.max(0, numberOrDefault(snapshot.transport?.snapshot_revision, numberOrDefault(snapshot.updated_at))),
    viewerRole: String(snapshot.viewer_role || "player").toLowerCase(),
    viewerPresence: String(snapshot.viewer_presence || "unknown").toLowerCase(),
    viewerInSession: Boolean(snapshot.viewer_in_session),
    viewerIsMember: Boolean(snapshot.viewer_is_member),
    spectatorAllowed: Boolean(snapshot.spectator_allowed),
    spectatorPolicy: String(snapshot.spectator_policy || ""),
    reconnectGraceSeconds: Math.max(0, numberOrDefault(snapshot.reconnect_grace_seconds)),
  };
}

function buildInteractionState(source: ReactUiBridgeState, session: ClientSessionState | null): ClientInteractionState {
  const interactionState = source.interactionState || {};
  const viewerId = String(source.viewerId || "");
  const viewerPlayer =
    session?.players.find((player) => String(player.id) === viewerId) ||
    (session?.players.length === 1 ? session.players[0] : null);
  const viewerRole = String(interactionState.viewerRole || session?.viewerRole || "player").toLowerCase();

  return {
    viewerId,
    viewerPlayerId: String(interactionState.viewerPlayerId || viewerPlayer?.id || viewerId),
    viewerRole,
    legalCardIndexes: Array.isArray(interactionState.legalCardIndexes)
      ? interactionState.legalCardIndexes.map((index) => numberOrDefault(index)).filter((index) => index >= 0)
      : (viewerPlayer?.legalCardIndexes || []),
    selectedCardIndex:
      interactionState.selectedCardIndex === null || interactionState.selectedCardIndex === undefined
        ? null
        : numberOrDefault(interactionState.selectedCardIndex),
    pendingActionKind: String(interactionState.pendingActionKind || "none"),
    pendingActionKey: String(interactionState.pendingActionKey || ""),
    pendingActionActive: Boolean(interactionState.pendingActionActive),
    readOnly: Boolean(interactionState.readOnly ?? (viewerRole !== "player")),
  };
}

function buildTransportState(source: ReactUiBridgeState, session: ClientSessionState | null): ClientTransportState {
  const transportState = source.transportState || {};
  const viewerConnectionState =
    session?.players.find((player) => String(player.id) === String(source.viewerId || ""))?.connectionState || "unknown";

  return {
    protocolVersion: String(transportState.protocolVersion || session?.protocolVersion || ""),
    snapshotRevision: Math.max(0, numberOrDefault(transportState.snapshotRevision, session?.snapshotRevision ?? 0)),
    payloadMode: normalizePayloadMode(transportState.payloadMode, source.gameState),
    websocketActive: Boolean(transportState.websocketActive),
    pollingActive: Boolean(transportState.pollingActive),
    lastSuccessfulSyncAt: Math.max(0, numberOrDefault(transportState.lastSuccessfulSyncAt)),
    lastServerUpdatedAt: Math.max(0, numberOrDefault(transportState.lastServerUpdatedAt, session?.updatedAt ?? 0)),
    sessionConnectionState: normalizeConnectionState(transportState.sessionConnectionState || viewerConnectionState),
  };
}

export function buildClientStoreSnapshot(source: ReactUiBridgeState): ClientStoreSnapshot {
  const session = normalizeSessionSnapshot(source.gameState);
  return {
    session,
    ui: {
      currentView: normalizeCurrentView(source.currentView),
      splashVisible: Boolean(source.splashVisible),
      splashMode: String(source.splashMode || "boot"),
      lobbyModel: source.lobbyModel || null,
    },
    interaction: buildInteractionState(source, session),
    transport: buildTransportState(source, session),
  };
}
