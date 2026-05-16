let reactUiState = {
  currentView: "home",
  gameState: null,
  viewerId: "",
  lobbyModel: null,
  splashVisible: true,
  splashMode: "boot",
};

const listeners = new Set();

function emitChange() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (_) {}
  });
}

export function subscribeReactUi(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getReactUiSnapshot() {
  return reactUiState;
}

export function setReactUiState(patch) {
  const nextState = {
    ...reactUiState,
    ...(patch && typeof patch === "object" ? patch : {}),
  };
  const changed = Object.keys(nextState).some((key) => !Object.is(nextState[key], reactUiState[key]));
  if (!changed) {
    return;
  }
  reactUiState = nextState;
  emitChange();
}
