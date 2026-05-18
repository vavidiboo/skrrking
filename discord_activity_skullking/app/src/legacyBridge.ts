import { buildClientStoreSnapshot } from "./adapters/sessionSnapshot";
import type { ReactUiBridgeState, ReactUiState } from "./types";

type ReactUiListener = () => void;
type ReactUiPatch = Partial<ReactUiBridgeState>;

const initialBridgeState: ReactUiBridgeState = {
  currentView: "home",
  gameState: null,
  viewerId: "",
  lobbyModel: null,
  splashVisible: true,
  splashMode: "boot",
};

let reactUiState: ReactUiState = {
  ...initialBridgeState,
  clientState: buildClientStoreSnapshot(initialBridgeState),
};

const listeners = new Set<ReactUiListener>();

function emitChange(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (_) {
      // Ignore listener failures so the shell stays responsive.
    }
  });
}

export function subscribeReactUi(listener: ReactUiListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getReactUiSnapshot(): ReactUiState {
  return reactUiState;
}

export function setReactUiState(patch: ReactUiPatch | null | undefined): void {
  const { clientState: _clientState, ...prevBridgeState } = reactUiState;
  const nextBridgeState: ReactUiBridgeState = {
    ...prevBridgeState,
    ...(patch && typeof patch === "object" ? patch : {}),
  };
  const nextState: ReactUiState = {
    ...nextBridgeState,
    clientState: buildClientStoreSnapshot(nextBridgeState),
  };

  const changed = Object.keys(nextState).some((key) => {
    const typedKey = key as keyof ReactUiState;
    return !Object.is(nextState[typedKey], reactUiState[typedKey]);
  });

  if (!changed) {
    return;
  }

  reactUiState = nextState;
  emitChange();
}
