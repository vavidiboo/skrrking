import type { CurrentView } from "./domain";
import type { ClientInteractionState, ClientLobbyModel, ClientStoreSnapshot, ClientTransportState } from "./store";
import type { SessionSnapshotResponse } from "./transport";

export interface ReactUiBridgeState {
  currentView: CurrentView;
  gameState: SessionSnapshotResponse | null;
  viewerId: string;
  lobbyModel: ClientLobbyModel | null;
  splashVisible: boolean;
  splashMode: string;
  interactionState?: Partial<ClientInteractionState> | null;
  transportState?: Partial<ClientTransportState> | null;
}

export interface ReactUiState extends ReactUiBridgeState {
  clientState: ClientStoreSnapshot;
}
