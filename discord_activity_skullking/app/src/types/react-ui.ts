import type { CurrentView } from "./domain";
import type { SessionSnapshotResponse } from "./transport";

export interface ReactUiState {
  currentView: CurrentView;
  gameState: SessionSnapshotResponse | null;
  viewerId: string;
  lobbyModel: unknown | null;
  splashVisible: boolean;
  splashMode: string;
}
