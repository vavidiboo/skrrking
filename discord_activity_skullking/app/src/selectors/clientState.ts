import type { ClientPlayerState, ClientRoundSummary, ClientStoreSnapshot, ConnectionState, CurrentView } from "../types";

function connectionStateLabel(state: ConnectionState | "unknown"): string {
  if (state === "reconnecting") {
    return "Reconnecting";
  }
  if (state === "disconnected") {
    return "Disconnected";
  }
  if (state === "connected") {
    return "Connected";
  }
  return "Unknown";
}

function selectSession(state: ClientStoreSnapshot | null | undefined) {
  return state?.session || null;
}

export function selectCurrentView(state: ClientStoreSnapshot | null | undefined): CurrentView {
  return state?.ui.currentView || "home";
}

export function selectLobbyPlayers(state: ClientStoreSnapshot | null | undefined): ClientPlayerState[] {
  return selectSession(state)?.players || [];
}

export function selectViewerPlayer(state: ClientStoreSnapshot | null | undefined): ClientPlayerState | null {
  const session = selectSession(state);
  if (!session) {
    return null;
  }
  const targetId = String(state?.interaction.viewerPlayerId || state?.interaction.viewerId || "");
  if (!targetId) {
    return null;
  }
  return session.players.find((player) => String(player.id) === targetId) || null;
}

export function selectConnectionStateLabel(state: ClientStoreSnapshot | null | undefined): string {
  const viewerPlayer = selectViewerPlayer(state);
  if (viewerPlayer) {
    return connectionStateLabel(viewerPlayer.connectionState);
  }
  return connectionStateLabel(state?.transport.sessionConnectionState || "unknown");
}

export function selectCurrentTurnLabel(state: ClientStoreSnapshot | null | undefined): string {
  const session = selectSession(state);
  if (!session) {
    return "-";
  }
  const currentTurnPlayer = session.players.find((player) => player.id === session.currentTurnPlayerId);
  return currentTurnPlayer?.name || "-";
}

export function selectRoundSummary(state: ClientStoreSnapshot | null | undefined): ClientRoundSummary | null {
  const session = selectSession(state);
  if (!session) {
    return null;
  }
  if (session.status !== "waiting_round" && session.status !== "finished") {
    return null;
  }

  return {
    title: session.status === "finished" ? `Final Round ${session.roundNumber}` : `Round ${session.roundNumber} Summary`,
    status: session.status,
    phase: session.phase,
    roundNumber: session.roundNumber,
    rows: session.players.map((player) => {
      const breakdown = session.scoreBreakdown.find((row) => row.playerId === player.id);
      return {
        playerId: player.id,
        playerName: player.name,
        bid: breakdown?.bid ?? player.bid,
        tricksWon: breakdown?.tricksWon ?? player.tricksWon,
        score: breakdown?.score ?? player.score,
        roundBonus: breakdown?.roundBonus ?? 0,
        success: breakdown?.success ?? false,
      };
    }),
  };
}
