import type { ReactUiState } from "./types";

type ReactUiListener = () => void;
type ReactUiPatch = Partial<ReactUiState>;

let reactUiState: ReactUiState = {
  currentView: "home",
  gameState: null,
  viewerId: "",
  lobbyModel: null,
  splashVisible: true,
  splashMode: "boot",
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
  const nextState: ReactUiState = {
    ...reactUiState,
    ...(patch && typeof patch === "object" ? patch : {}),
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
