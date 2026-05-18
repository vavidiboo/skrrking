import { setReactUiState } from "./src/legacyBridge.js";

const DEFAULT_API_BASE = window.location.origin;
const DEFAULT_CLIENT_ID = "1488188343849324706";
const UNSET_CLIENT_ID = "YOUR_DISCORD_APPLICATION_ID";
const TURN_LIMIT_SECONDS = 15;
const PRE_BID_DELAY_SECONDS = 10;
const BOOT_SPLASH_MIN_VISIBLE_MS = 2200;
const ACTION_SPLASH_MIN_VISIBLE_MS = 650;
const STATE_LONG_POLL_WAIT_MS = 20000;
const STATE_POLL_RETRY_MS = 1500;
const STATE_POLL_RESUME_MS = 250;
const WS_OPEN_TIMEOUT_MS = 6000;
const WS_QUICK_CLOSE_THRESHOLD_MS = 1500;
const PING_PROBE_INTERVAL_MS = 3000;
const PING_STALE_AFTER_MS = 9000;
const WS_PING_TIMEOUT_MS = 2500;
const SPLASH_BACKGROUND_PATHS = [
  "/assets/images/splash/bg_splash_ship_1.jpg",
  "/assets/images/splash/bg_splash_ship_2.jpg",
  "/assets/images/splash/bg_splash_ship_3.jpg",
  "/assets/images/splash/bg_splash_ship_4.jpg",
  "/assets/images/splash/bg_splash_ship_5.jpg",
];

const CONNECTION_STATUS = Object.freeze({
  CONNECTED: "connected",
  RECONNECTING: "reconnecting",
  DISCONNECTED: "disconnected",
});

const ROOM_STATUS = Object.freeze({
  LOBBY: "lobby",
  BIDDING: "bidding",
  PLAYING: "playing",
  WAITING_ROUND: "waiting_round",
  FINISHED: "finished",
});

const GAME_PHASE = Object.freeze({
  IDLE: "idle",
  BIDDING: "bidding",
  PLAYING: "playing",
  SCORING: "scoring",
  WAITING_NEXT_ROUND: "waiting_next_round",
});

const VIEWER_ROLE = Object.freeze({
  PLAYER: "player",
  SPECTATOR: "spectator",
});

const PENDING_ACTION_KIND = Object.freeze({
  NONE: "none",
  ROOM_STATE: "room_state",
  START_ROUND: "start_round",
  SUBMIT_BID: "submit_bid",
  SUBMIT_CARD: "submit_card",
  RETURN_LOBBY: "return_lobby",
  LEAVE_ROOM: "leave_room",
});

/**
 * @typedef {{
 *   kind: string,
 *   active: boolean,
 *   key: string,
 *   cardIndex: number | null,
 *   startedAt: number
 * }} PendingActionState
 */

/**
 * @typedef {{
 *   connectionStatus: string,
 *   roomState: string,
 *   gamePhase: string,
 *   viewerRole: string,
 *   isReadOnly: boolean,
 *   me: any,
 *   hostPlayer: any,
 *   currentTurnPlayer: any,
 *   playerList: any[],
 *   myHand: any[],
 *   legalMoves: number[],
 *   selectedCardIndex: number | null,
 *   pendingAction: PendingActionState,
 *   playedCards: any[],
 *   trickResultSummary: string,
 *   roundResultSummary: { title: string, lines: string[], key: string, rows?: any[] } | null,
 *   ruleSummary: string,
 *   currentTurnLabel: string,
 *   connectionLabel: string,
 *   trickSummaryTitle: string,
 *   reconnect: { visible: boolean, hardBlock: boolean, title: string, body: string },
 *   flowEvents: any[],
 *   latestFlowEvent: any | null,
 *   roundInfoSummary: string,
 *   predictionSummary: string,
 *   syncSummary: string,
 * }} DerivedUiModel
 */

let homePanel = document.getElementById("homePanel");
let lobbyPanel = document.getElementById("lobbyPanel");
let gamePanel = document.getElementById("gamePanel");
const sessionInput = document.getElementById("sessionInput");
const nameInput = document.getElementById("nameInput");
const roomList = document.getElementById("roomList");
const refreshRoomsBtn = document.getElementById("refreshRoomsBtn");
const playNowBtn = document.getElementById("playNowBtn");
const createRoomBtn = document.getElementById("createRoomBtn");
const homePingChip = document.getElementById("homePingChip");
const createRoomDialog = document.getElementById("createRoomDialog");
const findRoomDialog = document.getElementById("findRoomDialog");
const joinPasswordDialog = document.getElementById("joinPasswordDialog");
const joinPasswordRoomName = document.getElementById("joinPasswordRoomName");
const joinPasswordInput = document.getElementById("joinPasswordInput");
const joinPasswordError = document.getElementById("joinPasswordError");
const joinPasswordCancelBtn = document.getElementById("joinPasswordCancelBtn");
const joinPasswordSubmitBtn = document.getElementById("joinPasswordSubmitBtn");
const refreshRoomsInModalBtn = document.getElementById("refreshRoomsInModalBtn");
const closeFindRoomBtn = document.getElementById("closeFindRoomBtn");
const roomNameInput = document.getElementById("roomNameInput");
const maxPlayersInput = document.getElementById("maxPlayersInput");
const bonusEnabledInput = document.getElementById("bonusEnabledInput");
const advancedRulesInput = document.getElementById("advancedRulesInput");
const useRoomPasswordInput = document.getElementById("useRoomPasswordInput");
const roomPasswordFieldWrap = document.getElementById("roomPasswordFieldWrap");
const roomPasswordInput = document.getElementById("roomPasswordInput");
const createRoomSubtitle = document.getElementById("createRoomSubtitle");
const createRoomStepMode = document.getElementById("createRoomStepMode");
const createRoomStepOptions = document.getElementById("createRoomStepOptions");
const createRoomNextBtn = document.getElementById("createRoomNextBtn");
const createRoomBackBtn = document.getElementById("createRoomBackBtn");
const createModeCasual = document.getElementById("createModeCasual");
const createModeAdvanced = document.getElementById("createModeAdvanced");
const confirmCreateRoomBtn = document.getElementById("confirmCreateRoomBtn");
const cancelCreateRoomBtn = document.getElementById("cancelCreateRoomBtn");
const startBtn = document.getElementById("startBtn");
const lobbyBackBtn = document.getElementById("lobbyBackBtn");
const lobbyInviteBtn = document.getElementById("lobbyInviteBtn");
const lobbyInfo = document.getElementById("lobbyInfo");
const playerList = document.getElementById("playerList");
const lobbyTopbarDisplayName = document.getElementById("lobbyTopbarDisplayName");
const lobbyRoomCode = document.getElementById("lobbyRoomCode");
const lobbyPlayersChip = document.getElementById("lobbyPlayersChip");
const lobbyPingChip = document.getElementById("lobbyPingChip");
const lobbyTurnTimerVal = document.getElementById("lobbyTurnTimerVal");
const lobbyTurnTimerDown = document.getElementById("lobbyTurnTimerDown");
const lobbyTurnTimerUp = document.getElementById("lobbyTurnTimerUp");
const lobbyBonusToggle = document.getElementById("lobbyBonusToggle");
const lobbyAdvancedToggle = document.getElementById("lobbyAdvancedToggle");
const lobbySpectatorsToggle = document.getElementById("lobbySpectatorsToggle");
const roundTitle = document.getElementById("roundTitle");
const phaseBadge = document.getElementById("phaseBadge");
const turnBadge = document.getElementById("turnBadge");
const connectionBadge = document.getElementById("connectionBadge");
const gamePingBadge = document.getElementById("gamePingBadge");
const turnProgress = document.getElementById("turnProgress");
const turnProgressFill = document.getElementById("turnProgressFill");
const turnProgressMeta = document.getElementById("turnProgressMeta");
const playerRing = document.getElementById("playerRing");
const trickCenter = document.getElementById("trickCenter");
const tableCinematicFx = document.getElementById("tableCinematicFx");
const gameMiniBidValue = document.getElementById("gameMiniBidValue");
const gameMiniWonValue = document.getElementById("gameMiniWonValue");
const gameMiniScoreValue = document.getElementById("gameMiniScoreValue");
const reconnectOverlay = document.getElementById("reconnectOverlay");
const reconnectTitle = document.getElementById("reconnectTitle");
const reconnectBody = document.getElementById("reconnectBody");
const scoreDialog = document.getElementById("scoreDialog");
const closeScoreDrawerBtn = document.getElementById("closeScoreDrawerBtn");
const scoreDrawerHeader = document.getElementById("scoreDrawerHeader");
const bidDialog = document.getElementById("bidDialog");
const bidDialogInput = document.getElementById("bidDialogInput");
const bidMinusBtn = document.getElementById("bidMinusBtn");
const bidPlusBtn = document.getElementById("bidPlusBtn");
const bidDialogSubmitBtn = document.getElementById("bidDialogSubmitBtn");
const bidDialogHint = document.getElementById("bidDialogHint");
const bidDialogMeta = document.getElementById("bidDialogMeta");
const interactionHud = document.getElementById("interactionHud");
const interactionHudKicker = document.getElementById("interactionHudKicker");
const interactionHudTitle = document.getElementById("interactionHudTitle");
const interactionHudBody = document.getElementById("interactionHudBody");
const handArea = document.getElementById("handArea");
const scoreRows = document.getElementById("scoreRows");
const scoreTabScores = document.getElementById("scoreTabScores");
const scoreTabHistory = document.getElementById("scoreTabHistory");
const scoreTabGuide = document.getElementById("scoreTabGuide");
const scoreScoresPanel = document.getElementById("scoreScoresPanel");
const scoreHistoryPanel = document.getElementById("scoreHistoryPanel");
const scoreGuidePanel = document.getElementById("scoreGuidePanel");
const scoreHistoryRows = document.getElementById("scoreHistoryRows");
const gameForfeitBtn = document.getElementById("gameForfeitBtn");
const nextRoundBtn = document.getElementById("nextRoundBtn");
const eventDialog = document.getElementById("eventDialog");
const eventDialogTitle = document.getElementById("eventDialogTitle");
const eventDialogBody = document.getElementById("eventDialogBody");
const roundResultDialog = document.getElementById("roundResultDialog");
const roundResultTitle = document.getElementById("roundResultTitle");
const roundResultBody = document.getElementById("roundResultBody");
const closeRoundResultBtn = document.getElementById("closeRoundResultBtn");
const finishDialog = document.getElementById("finishDialog");
const finishToLobbyBtn = document.getElementById("finishToLobbyBtn");
const finishToHomeBtn = document.getElementById("finishToHomeBtn");
const finishResultTitle = document.getElementById("finishResultTitle");
const finishResultSub = document.getElementById("finishResultSub");
const finishResultCoin = document.getElementById("finishResultCoin");
const finishSummaryText = document.getElementById("finishSummaryText");
const finishSummaryPill = document.getElementById("finishSummaryPill");
const finishResultRows = document.getElementById("finishResultRows");
const finishEventChips = document.getElementById("finishEventChips");
const logDialog = document.getElementById("logDialog");
const closeLogBtn = document.getElementById("closeLogBtn");
const logArea = document.getElementById("logArea");
const toast = document.getElementById("toast");
const tigressDialog = document.getElementById("tigressDialog");
const splash = document.getElementById("splash");
const splashStatus = document.getElementById("splashStatus");
const splashProgressFill = document.getElementById("splashProgressFill");
const splashPercent = document.getElementById("splashPercent");
const splashDetail = document.getElementById("splashDetail");
function getTopbarNodes() {
  return {
    displayNames: [
      document.getElementById("topbarDisplayName"),
      document.getElementById("lobbyTopbarDisplayName"),
      document.getElementById("gameMiniDisplayName"),
    ].filter(Boolean),
    identityLabels: [
      document.getElementById("topbarIdentityLabel"),
      document.getElementById("lobbyTopbarIdentityLabel"),
      document.getElementById("gameMiniIdentityLabel"),
    ].filter(Boolean),
    avatars: [
      document.querySelector("#homePanel .topbar .avatar"),
      document.querySelector("#lobbyPanel .topbar .avatar"),
      document.getElementById("gameMiniAvatar"),
    ].filter(Boolean),
  };
}

function getPingDisplayNodes() {
  return [
    document.getElementById("homePingChip"),
    document.getElementById("lobbyPingChip"),
    document.getElementById("gamePingBadge"),
  ].filter(Boolean);
}

function getCreateRoomNodes() {
  return {
    dialog: document.getElementById("createRoomDialog"),
    roomNameInput: document.getElementById("roomNameInput"),
    maxPlayersInput: document.getElementById("maxPlayersInput"),
    bonusEnabledInput: document.getElementById("bonusEnabledInput"),
    advancedRulesInput: document.getElementById("advancedRulesInput"),
    useRoomPasswordInput: document.getElementById("useRoomPasswordInput"),
    roomPasswordFieldWrap: document.getElementById("roomPasswordFieldWrap"),
    roomPasswordInput: document.getElementById("roomPasswordInput"),
    createRoomSubtitle: document.getElementById("createRoomSubtitle"),
    createRoomStepMode: document.getElementById("createRoomStepMode"),
    createRoomStepOptions: document.getElementById("createRoomStepOptions"),
    createModeCasual: document.getElementById("createModeCasual"),
    createModeAdvanced: document.getElementById("createModeAdvanced"),
  };
}

function getFindRoomNodes() {
  return {
    dialog: document.getElementById("findRoomDialog"),
    roomList: document.getElementById("roomList"),
  };
}

function getJoinPasswordNodes() {
  return {
    dialog: document.getElementById("joinPasswordDialog"),
    roomName: document.getElementById("joinPasswordRoomName"),
    input: document.getElementById("joinPasswordInput"),
    error: document.getElementById("joinPasswordError"),
  };
}

function getManagedDialogs() {
  return [
    document.getElementById("createRoomDialog"),
    document.getElementById("findRoomDialog"),
    document.getElementById("joinPasswordDialog"),
    document.getElementById("tigressDialog"),
    document.getElementById("bidDialog"),
    document.getElementById("roundResultDialog"),
    document.getElementById("eventDialog"),
    document.getElementById("finishDialog"),
    document.getElementById("logDialog"),
  ].filter(Boolean);
}

function ensureViewPanels() {
  homePanel = document.getElementById("homePanel");
  lobbyPanel = document.getElementById("lobbyPanel");
  gamePanel = document.getElementById("gamePanel");
  return Boolean(homePanel && lobbyPanel && gamePanel);
}

const appState = {
  // Backend-authoritative/session-sync state. These fields mirror server
  // snapshots or transport metadata and remain the runtime source of truth.
  apiBase: readApiBase(),
  sessionId: null,
  playerId: readPlayerId(),
  discordUserId: null,
  discordDisplayName: "",
  playerName: "",
  game: null,
  pollingTimer: null,
  pollingActive: false,
  pollingMode: "off",
  pollToken: 0,
  lastServerUpdatedAt: 0,
  lastSuccessfulSyncAt: 0,
  ws: null,
  wsActive: false,
  wsToken: 0,
  wsFallbackTimer: null,
  wsReconnectTimer: null,
  wsReconnectAttempt: 0,
  statePayloadMode: "full",
  stateRequestPromise: null,
  stateRequestSeq: 0,
  actionLock: false,
  latestAppliedUpdatedAt: 0,
  latestServerTimeMs: 0,
  serverClockOffsetMs: 0,
  // Local UI/runtime state. These values are derived, optimistic, or DOM-facing
  // and should not be treated as gameplay authority.
  selectedCardIndex: null,
  pendingAction: {
    kind: PENDING_ACTION_KIND.NONE,
    active: false,
    key: "",
    cardIndex: null,
    startedAt: 0,
  },
  playSubmitPreview: null,
  playSubmitSyncTimer: null,
  forfeitConfirm: {
    armedUntil: 0,
    timer: null,
  },
  uiModel: null,
  activityInstanceId: null,
  discordReady: false,
  discordSdkStatus: "disconnected",
  oauthReady: false,
  guildNickByUserId: {},
  discordProfilesByUserId: {},
  playerMetaById: {},
  logLines: [],
  roomPasswordsBySession: {},
  identityTokensBySession: {},
  startupWarmDone: false,
  sdk: null,
  inviteDialogPending: false,
  tableFxTimer: null,
  subscriptionsReady: false,
  playerIdFrozen: false,
  lastSnapshot: null,
  uiCache: {
    trickKey: "",
    trickAnimationStageKey: "",
    trickAnimatedCardsByPlayer: {},
    animatedTrickCardKeys: {},
    cinematicFxKeys: {},
    handKey: "",
    ringKey: "",
    lobbyKey: "",
    scoreKey: "",
    logKey: "",
  },
  lobbySettingsPending: false,
  autoRound: {
    pending: false,
    lastTriggeredRound: -1,
    retryCount: 0,
    lastAttemptAt: 0,
  },
  turnClock: {
    key: "",
    startedAtMs: Date.now(),
    limitSeconds: TURN_LIMIT_SECONDS,
    serverStartedAtSec: 0,
    serverDeadlineAtSec: 0,
    rafId: null,
    lastRenderedSecond: -1,
    lastRenderedPreBidSecond: -1,
    lastRenderedRoundText: "",
    lastPreBidActive: false,
  },
  finishUI: {
    shownKey: "",
  },
  trickReveal: {
    key: "",
    timer: null,
    expiresAtMs: 0,
    trick: [],
    winnerId: "",
    appliedRule: "",
    discarded: false,
  },
  scoreDrawerTab: "scores",
  finishedLobbyMode: false,
  bidPrompt: {
    key: "",
    startedAtMs: 0,
  },
  preBidInspect: {
    key: "",
    startedAtMs: 0,
  },
  roundResultModal: {
    key: "",
    title: "",
    lines: [],
    dismissedKey: "",
  },
  scoreAutoCloseTimer: null,
  scoreAutoDismissArmed: false,
  eventAutoCloseTimer: null,
  finishAutoReturnTimer: null,
  splashProgress: 0,
  splashTargetProgress: 0,
  splashAutoTimer: null,
  splashHideTimer: null,
  splashShownAt: 0,
  splashMinVisibleMs: 0,
  splashMode: "boot",
  splashReadyForDismiss: false,
  splashDismissResolver: null,
  scoreDrawerDrag: null,
  handDrag: null,
  handInspect: null,
  handDragSuppressUntil: 0,
  currentView: null,
  booting: false,
  pendingView: null,
  viewTransitionToken: 0,
  renderPending: false,
  roomsLoadPromise: null,
  roomsLastLoadedAt: 0,
  lastTransitionSignature: "",
  lastHandledFlowSignature: "",
  uiEffectTimer: null,
  transitionSnapshot: null,
  joinPasswordPrompt: {
    resolver: null,
    roomKey: "",
  },
  ping: {
    valueMs: 0,
    samples: [],
    jitterMs: 0,
    lastSource: "",
    lastUpdatedAt: 0,
    timer: null,
    inFlight: false,
    pendingToken: "",
    startedAtPerf: 0,
    timeout: null,
  },
  transport: {
    wsAttemptSeq: 0,
    wsConnectingSessionId: "",
    wsConnectedSessionId: "",
    wsConnectStartedAt: 0,
    wsOpenedAt: 0,
    lastWsCloseAt: 0,
    lastWsCloseCode: 0,
    lastWsCloseReason: "",
    wsTerminalReason: "",
    protocolVersion: "",
    snapshotRevision: 0,
    lastPayloadMode: "unknown",
  },
};

function logTransport(event, details = {}) {
  try {
    console.log("[SkullKing][Transport]", event, {
      sessionId: appState.sessionId || "",
      wsActive: Boolean(appState.wsActive),
      pollingActive: Boolean(appState.pollingActive),
      pollingMode: appState.pollingMode || "off",
      ...details,
    });
  } catch (_) {}
}

function resetTransportSessionState() {
  appState.transport.wsConnectingSessionId = "";
  appState.transport.wsConnectedSessionId = "";
  appState.transport.wsConnectStartedAt = 0;
  appState.transport.wsOpenedAt = 0;
  appState.transport.lastWsCloseAt = 0;
  appState.transport.lastWsCloseCode = 0;
  appState.transport.lastWsCloseReason = "";
  appState.transport.wsTerminalReason = "";
  appState.transport.protocolVersion = "";
  appState.transport.snapshotRevision = 0;
  appState.transport.lastPayloadMode = "unknown";
}

function markWsTerminal(reason = "") {
  appState.transport.wsTerminalReason = String(reason || "").trim();
}

function stateRevisionFromPayload(state) {
  const transportRevision = Number(state?.transport?.snapshot_revision || 0);
  if (Number.isFinite(transportRevision) && transportRevision > 0) {
    return transportRevision;
  }
  const updatedAt = Number(state?.updated_at || 0);
  if (Number.isFinite(updatedAt) && updatedAt > 0) {
    return updatedAt;
  }
  return 0;
}

function syncTransportMetadataFromState(state) {
  const transport = state?.transport;
  if (!transport || typeof transport !== "object") {
    return;
  }
  appState.transport.protocolVersion = String(transport.protocol_version || appState.transport.protocolVersion || "");
  appState.transport.snapshotRevision = stateRevisionFromPayload(state);
  if (typeof transport.compact === "boolean") {
    appState.transport.lastPayloadMode = transport.compact ? "compact" : "full";
  }
}

if (nameInput) {
  nameInput.value = "Discord 계정 확인 중...";
}
if (sessionInput) {
  sessionInput.value = readInitialSession();
}
restoreSessionCaches();
restoreIdentityCache();
syncTopbarDisplayName();
syncTopbarAvatar();
localStorage.removeItem("skullking-theme");
document.body.classList.add("performance-lite");

if (refreshRoomsBtn) {
  refreshRoomsBtn.addEventListener("click", onLobbyInvite);
}
if (playNowBtn) {
  playNowBtn.addEventListener("click", openFindRoomDialog);
}
if (createRoomBtn) {
  createRoomBtn.addEventListener("click", openCreateRoomDialog);
}
if (createModeCasual) {
  createModeCasual.addEventListener("click", () => setCreateRoomMode("casual"));
}
if (createModeAdvanced) {
  createModeAdvanced.addEventListener("click", () => setCreateRoomMode("advanced"));
}
if (createRoomNextBtn) {
  createRoomNextBtn.addEventListener("click", () => setCreateRoomStep(2));
}
if (createRoomBackBtn) {
  createRoomBackBtn.addEventListener("click", () => setCreateRoomStep(1));
}
if (useRoomPasswordInput) {
  useRoomPasswordInput.addEventListener("change", updateCreateRoomPasswordField);
}
if (refreshRoomsInModalBtn) {
  refreshRoomsInModalBtn.addEventListener("click", () => loadRooms(true));
}
if (closeFindRoomBtn) {
  closeFindRoomBtn.addEventListener("click", () => findRoomDialog?.close?.());
}
if (joinPasswordCancelBtn) {
  joinPasswordCancelBtn.addEventListener("click", () => settleJoinPasswordPrompt(null));
}
if (joinPasswordSubmitBtn) {
  joinPasswordSubmitBtn.addEventListener("click", () => submitJoinPasswordPrompt());
}
if (joinPasswordInput) {
  joinPasswordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitJoinPasswordPrompt();
    }
  });
}
if (joinPasswordDialog) {
  joinPasswordDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    settleJoinPasswordPrompt(null);
  });
  joinPasswordDialog.addEventListener("close", () => {
    if (typeof appState.joinPasswordPrompt.resolver === "function") {
      const resolver = appState.joinPasswordPrompt.resolver;
      appState.joinPasswordPrompt.resolver = null;
      appState.joinPasswordPrompt.roomKey = "";
      resolver(null);
    }
  });
}
if (confirmCreateRoomBtn) {
  confirmCreateRoomBtn.addEventListener("click", onCreateRoom);
}
if (cancelCreateRoomBtn) {
  cancelCreateRoomBtn.addEventListener("click", () => createRoomDialog?.close());
}
if (startBtn) {
  startBtn.addEventListener("click", onLobbyAction);
}
if (lobbyBackBtn) {
  lobbyBackBtn.addEventListener("click", onLobbyBack);
}
if (lobbyInviteBtn) {
  lobbyInviteBtn.addEventListener("click", onLobbyInvite);
}
document.addEventListener("click", (event) => {
  const createRoomTrigger = event.target?.closest?.("#createRoomBtn");
  if (createRoomTrigger) {
    event.preventDefault();
    openCreateRoomDialog();
    return;
  }
  const playNowTrigger = event.target?.closest?.("#playNowBtn");
  if (playNowTrigger) {
    event.preventDefault();
    openFindRoomDialog().catch(() => {});
    return;
  }
  const createModeCasualTrigger = event.target?.closest?.("#createModeCasual");
  if (createModeCasualTrigger) {
    event.preventDefault();
    setCreateRoomMode("casual");
    return;
  }
  const createModeAdvancedTrigger = event.target?.closest?.("#createModeAdvanced");
  if (createModeAdvancedTrigger) {
    event.preventDefault();
    setCreateRoomMode("advanced");
    return;
  }
  const createRoomNextTrigger = event.target?.closest?.("#createRoomNextBtn");
  if (createRoomNextTrigger) {
    event.preventDefault();
    setCreateRoomStep(2);
    return;
  }
  const createRoomBackTrigger = event.target?.closest?.("#createRoomBackBtn");
  if (createRoomBackTrigger) {
    event.preventDefault();
    setCreateRoomStep(1);
    return;
  }
  const confirmCreateRoomTrigger = event.target?.closest?.("#confirmCreateRoomBtn");
  if (confirmCreateRoomTrigger) {
    event.preventDefault();
    onCreateRoom();
    return;
  }
  const cancelCreateRoomTrigger = event.target?.closest?.("#cancelCreateRoomBtn");
  if (cancelCreateRoomTrigger) {
    event.preventDefault();
    forceCloseDialog(getCreateRoomNodes().dialog);
    return;
  }
  const refreshRoomsInModalTrigger = event.target?.closest?.("#refreshRoomsInModalBtn");
  if (refreshRoomsInModalTrigger) {
    event.preventDefault();
    loadRooms(true);
    return;
  }
  const closeFindRoomTrigger = event.target?.closest?.("#closeFindRoomBtn");
  if (closeFindRoomTrigger) {
    event.preventDefault();
    forceCloseDialog(getFindRoomNodes().dialog);
    return;
  }
  const joinPasswordCancelTrigger = event.target?.closest?.("#joinPasswordCancelBtn");
  if (joinPasswordCancelTrigger) {
    event.preventDefault();
    settleJoinPasswordPrompt(null);
    return;
  }
  const joinPasswordSubmitTrigger = event.target?.closest?.("#joinPasswordSubmitBtn");
  if (joinPasswordSubmitTrigger) {
    event.preventDefault();
    submitJoinPasswordPrompt();
    return;
  }
  const backTrigger = event.target?.closest?.("#lobbyBackBtn");
  if (!backTrigger) {
    return;
  }
  event.preventDefault();
  onLobbyBack();
});
document.addEventListener("change", (event) => {
  if (event.target?.id === "useRoomPasswordInput") {
    updateCreateRoomPasswordField();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target?.id === "joinPasswordInput") {
    event.preventDefault();
    submitJoinPasswordPrompt();
  }
});

function onSplashStartIntent(event) {
  if (event.type === "keydown" && !["Enter", " ", "Spacebar"].includes(event.key)) {
    return;
  }
  if (!appState.splashReadyForDismiss || appState.splashMode !== "boot") {
    return;
  }
  event.preventDefault();
  resolveSplashStartIntent();
}

function resolveSplashStartIntent() {
  const resolver = appState.splashDismissResolver;
  appState.splashDismissResolver = null;
  appState.splashReadyForDismiss = false;
  const { splash, splashCta, splashCtaLabel } = getSplashNodes();
  if (splash) {
    splash.dataset.ready = "false";
    splash.removeAttribute("aria-label");
  }
  if (splashCta) {
    splashCta.classList.remove("is-ready");
    splashCta.disabled = true;
  }
  if (splashCtaLabel) {
    splashCtaLabel.textContent = "출항 중...";
  }
  if (typeof resolver === "function") {
    resolver();
  }
}

if (splash) {
  splash.addEventListener("click", onSplashStartIntent);
  splash.addEventListener("keydown", onSplashStartIntent);
}
const splashCta = document.getElementById("splashCta");
if (splashCta) {
  splashCta.addEventListener("click", onSplashStartIntent);
}

// ── Lobby settings controls ───────────────────────────────────────────────

const TURN_TIMER_OPTIONS = [5, 10, 15, 20, 30, 45, 60];

function isLobbyHost() {
  return String(appState.game?.host_id || "") === String(appState.playerId || "");
}

function setLobbySettingsPending(active) {
  appState.lobbySettingsPending = Boolean(active);
  requestRender();
}

async function postLobbySettings(patch) {
  if (!appState.sessionId || !isLobbyHost() || appState.lobbySettingsPending) return;
  const payload = normalizeLobbySettingsPatch(patch);
  if (!Object.keys(payload).length) return;
  const optimisticSnapshot = applyOptimisticLobbySettings(payload);
  setLobbySettingsPending(true);
  try {
    const state = await post(`/activity/sessions/${appState.sessionId}/settings`, {
      player_id: appState.playerId,
      ...payload,
    });
    applyServerState(state, { replaceLogs: false });
  } catch (err) {
    rollbackOptimisticLobbySettings(optimisticSnapshot);
    showToast(err.message || "설정 변경 실패");
  } finally {
    setLobbySettingsPending(false);
  }
}

function normalizeLobbySettingsPatch(patch) {
  const normalized = {};
  if (!patch || typeof patch !== "object") {
    return normalized;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "turn_limit_seconds")) {
    normalized.turn_limit_seconds = Number(patch.turn_limit_seconds || TURN_LIMIT_SECONDS);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "bonus_enabled")) {
    normalized.bonus_enabled = Boolean(patch.bonus_enabled);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "advanced_rules_enabled")) {
    normalized.advanced_rules_enabled = Boolean(patch.advanced_rules_enabled);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "allow_spectators")) {
    normalized.allow_spectators = Boolean(patch.allow_spectators);
  }
  return normalized;
}

function applyOptimisticLobbySettings(patch) {
  const game = appState.game;
  if (!game) {
    return null;
  }
  const previousSettings = { ...(game.settings || {}) };
  const previousTurnLimit = Number(game.turn_limit_seconds || previousSettings.turn_limit_seconds || TURN_LIMIT_SECONDS);
  const nextSettings = {
    ...previousSettings,
    ...patch,
  };
  game.settings = nextSettings;
  if (Object.prototype.hasOwnProperty.call(patch, "turn_limit_seconds")) {
    game.turn_limit_seconds = Number(nextSettings.turn_limit_seconds || TURN_LIMIT_SECONDS);
  }
  requestRender();
  return {
    settings: previousSettings,
    turnLimitSeconds: previousTurnLimit,
  };
}

function rollbackOptimisticLobbySettings(snapshot) {
  if (!snapshot || !appState.game) {
    return;
  }
  appState.game.settings = { ...(snapshot.settings || {}) };
  appState.game.turn_limit_seconds = Number(snapshot.turnLimitSeconds || TURN_LIMIT_SECONDS);
  requestRender();
}

function syncLobbySettingsUi(game) {
  if (!game?.settings) return;
  const isHost = isLobbyHost();
  const settingsPending = Boolean(appState.lobbySettingsPending);
  const s = game.settings;

  const tl = Number(s.turn_limit_seconds || TURN_LIMIT_SECONDS);
  if (lobbyTurnTimerVal) lobbyTurnTimerVal.textContent = `${tl}s`;
  if (lobbyTurnTimerDown) lobbyTurnTimerDown.disabled = !isHost || settingsPending;
  if (lobbyTurnTimerUp) lobbyTurnTimerUp.disabled = !isHost || settingsPending;

  for (const [el, key] of [
    [lobbyBonusToggle, "bonus_enabled"],
    [lobbyAdvancedToggle, "advanced_rules_enabled"],
    [lobbySpectatorsToggle, "allow_spectators"],
  ]) {
    if (!el) continue;
    const on = Boolean(s[key]);
    el.dataset.on = String(on);
    el.textContent = on ? "ON" : "OFF";
    el.disabled = !isHost || settingsPending;
    el.setAttribute("aria-pressed", on ? "true" : "false");
    el.title = !isHost
      ? "호스트만 로비 설정을 변경할 수 있습니다."
      : settingsPending
        ? "설정 저장 중입니다."
        : isHost
      ? `${on ? "활성화됨" : "비활성화됨"} · 다른 토글 값은 유지됩니다.`
      : "";
  }
}

if (lobbyTurnTimerDown) {
  lobbyTurnTimerDown.addEventListener("click", () => {
    const cur = Number(appState.game?.settings?.turn_limit_seconds || TURN_LIMIT_SECONDS);
    const idx = TURN_TIMER_OPTIONS.indexOf(cur);
    const next = TURN_TIMER_OPTIONS[Math.max(0, idx - 1)];
    if (next !== cur) postLobbySettings({ turn_limit_seconds: next });
  });
}
if (lobbyTurnTimerUp) {
  lobbyTurnTimerUp.addEventListener("click", () => {
    const cur = Number(appState.game?.settings?.turn_limit_seconds || TURN_LIMIT_SECONDS);
    const idx = TURN_TIMER_OPTIONS.indexOf(cur);
    const next = TURN_TIMER_OPTIONS[Math.min(TURN_TIMER_OPTIONS.length - 1, idx + 1)];
    if (next !== cur) postLobbySettings({ turn_limit_seconds: next });
  });
}
for (const [el, key] of [
  [lobbyBonusToggle, "bonus_enabled"],
  [lobbyAdvancedToggle, "advanced_rules_enabled"],
  [lobbySpectatorsToggle, "allow_spectators"],
]) {
  if (!el) continue;
  el.addEventListener("click", () => {
    const cur = el.dataset.on === "true";
    postLobbySettings({ [key]: !cur });
  });
}

if (bidDialogSubmitBtn) {
  bidDialogSubmitBtn.addEventListener("click", async () => {
    const raw = String(bidDialogInput?.value ?? "").trim();
    if (raw === "") {
      showToast("배팅 숫자를 선택해줘.");
      return;
    }
    const n = Number(raw);
    await onSubmitBid(n);
  });
}
if (bidMinusBtn) {
  bidMinusBtn.addEventListener("click", () => stepBidDialogValue(-1));
}
if (bidPlusBtn) {
  bidPlusBtn.addEventListener("click", () => stepBidDialogValue(1));
}
if (bidDialogInput) {
  bidDialogInput.addEventListener("input", () => {
    normalizeBidDialogValue();
    pulseBidValue();
    updateBidStepButtons();
  });
}
if (roundTitle) {
  roundTitle.addEventListener("click", () => toggleScoreDrawer());
}
if (closeScoreDrawerBtn) {
  closeScoreDrawerBtn.addEventListener("click", () => closeScoreDrawer());
}
if (scoreTabScores) {
  scoreTabScores.addEventListener("click", () => setScoreDrawerTab("scores"));
}
if (scoreTabHistory) {
  scoreTabHistory.addEventListener("click", () => setScoreDrawerTab("history"));
}
if (scoreTabGuide) {
  scoreTabGuide.addEventListener("click", () => setScoreDrawerTab("guide"));
}
if (scoreDrawerHeader) {
  scoreDrawerHeader.addEventListener("pointerdown", onScoreDrawerDragStart);
}
document.addEventListener("pointerdown", () => {
  if (eventDialog?.open) {
    closeEventDialog();
    return;
  }
  if (!appState.scoreAutoDismissArmed) {
    return;
  }
  if (!isScoreDrawerOpen()) {
    appState.scoreAutoDismissArmed = false;
    return;
  }
  closeAutoScoreDialog();
});
if (finishToLobbyBtn) {
  finishToLobbyBtn.addEventListener("click", onFinishToLobby);
}
if (finishToHomeBtn) {
  finishToHomeBtn.addEventListener("click", onFinishToHome);
}
if (closeLogBtn) {
  closeLogBtn.addEventListener("click", () => forceCloseDialog(logDialog));
}
if (closeRoundResultBtn) {
  closeRoundResultBtn.addEventListener("click", () => closeRoundResultModal());
}
if (roundResultDialog) {
  roundResultDialog.addEventListener("close", () => {
    appState.roundResultModal.dismissedKey = String(appState.roundResultModal.key || "");
  });
}
if (nextRoundBtn) {
  nextRoundBtn.addEventListener("click", onStartRound);
}
if (gameForfeitBtn) {
  gameForfeitBtn.addEventListener("click", onGameForfeit);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden || !appState.sessionId) {
    return;
  }
  const forceFull = shouldForceFullStateRefresh();
  refreshState({ longPoll: false, full: forceFull }).catch(() => {});
  if (!appState.wsActive && !appState.pollingActive) {
    startPolling({ immediate: true, longPoll: true, full: forceFull });
  }
});

window.addEventListener("online", () => {
  if (!appState.sessionId) {
    return;
  }
  const forceFull = shouldForceFullStateRefresh();
  refreshState({ longPoll: false, full: forceFull }).catch(() => {});
  if (!appState.wsActive) {
    startPolling({ immediate: true, longPoll: true, full: forceFull });
    startStateWebSocket();
  }
});

fitViewport();
window.addEventListener("resize", fitViewport);
window.addEventListener("error", (event) => {
  console.error("[SkullKing][RuntimeError]", event?.error || event?.message || event);
  setStatus(`클라이언트 오류: ${event?.message || "unknown"}`);
  endBootFlow("home");
  hideSplash();
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("[SkullKing][UnhandledRejection]", event?.reason || event);
  setStatus(`클라이언트 오류: ${event?.reason?.message || event?.reason || "promise rejection"}`);
  endBootFlow("home");
  hideSplash();
});

// Always start from home view; async Discord init can then transition as needed.
setView("home");
beginBootFlow();
showSplash("클라이언트 초기화 중...", { mode: "boot", minVisibleMs: BOOT_SPLASH_MIN_VISIBLE_MS });
startTurnClockAnimator();
renderPingDisplays();
startPingProbeLoop();
initDiscord();

// updateViewportMode: React의 ShellPanel도 body 클래스를 관리하지만(App.jsx useEffect),
// 바닐라 JS 코드가 직접 DOM 클래스를 읽으므로 여기서도 유지한다.
function updateViewportMode() {
  if (!ensureViewPanels()) {
    return;
  }
  const isHomeVisible = !homePanel.classList.contains("hidden");
  const isLobbyVisible = !lobbyPanel.classList.contains("hidden");
  const isGameVisible = !gamePanel.classList.contains("hidden");
  const isSessionVisible = isLobbyVisible || isGameVisible;
  document.body.classList.toggle("mode-home", isHomeVisible);
  document.body.classList.toggle("mode-session", isSessionVisible);
}

// setView: React 상태(setReactUiState)와 직접 DOM 조작을 모두 수행한다.
// 이중 제어가 의도적인 이유:
//   1. setReactUiState → React가 다음 프레임에 ShellPanel을 통해 className/style 반영
//   2. classList/style 직접 조작 → 현재 프레임에서 즉시 패널 전환 (React 렌더 전 깜빡임 방지)
// 두 경로가 동일한 결과를 만들므로 충돌 없음.
function setView(view) {
  if (!ensureViewPanels()) {
    appState.currentView = view;
    appState.pendingView = view;
    return;
  }
  const prevView = appState.currentView;
  const normalizedView = view;
  if (appState.booting) {
    appState.pendingView = normalizedView;
    return;
  }
  setReactUiState({ currentView: normalizedView });
  const showHome = normalizedView === "home";
  const showLobby = normalizedView === "lobby";
  const showGame = normalizedView === "game";
  // 즉각 DOM 반영 (React 비동기 렌더 이전 깜빡임 방지)
  homePanel.classList.toggle("hidden", !showHome);
  lobbyPanel.classList.toggle("hidden", !showLobby);
  gamePanel.classList.toggle("hidden", !showGame);
  homePanel.style.display = showHome ? "" : "none";
  lobbyPanel.style.display = showLobby ? "" : "none";
  gamePanel.style.display = showGame ? "" : "none";
  document.body.classList.toggle("mode-home", showHome);
  document.body.classList.toggle("mode-session", !showHome);
  appState.currentView = normalizedView;
  const bootSplashVisible = Boolean(
    getSplashNodes().splash &&
    appState.splashMode === "boot" &&
    !getSplashNodes().splash.classList.contains("hidden"),
  );
  if ((showLobby || showGame) && !bootSplashVisible) {
    hideSplash({ force: true });
  }
  if (showHome && prevView && prevView !== "home") {
    forceCloseDialog(finishDialog);
    forceCloseDialog(roundResultDialog);
    forceCloseDialog(eventDialog);
    forceCloseDialog(bidDialog);
    forceCloseDialog(logDialog);
    forceCloseDialog(tigressDialog);
    forceCloseDialog(createRoomDialog);
    forceCloseDialog(findRoomDialog);
    closeAutoScoreDialog();
  }
  updateViewportMode();
}

function beginBootFlow() {
  appState.booting = true;
  appState.pendingView = null;
}

function endBootFlow(defaultView = "home") {
  const pending = appState.pendingView;
  appState.pendingView = null;
  appState.booting = false;
  setView(pending || defaultView);
}

function waitForAnimationFrames(count = 1) {
  const total = Math.max(1, Number(count) || 1);
  return new Promise((resolve) => {
    let settled = false;
    let remaining = total;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }
      resolve();
    };
    const tick = () => {
      if (settled) {
        return;
      }
      remaining -= 1;
      if (remaining <= 0) {
        finish();
        return;
      }
      requestAnimationFrame(tick);
    };
    const fallbackTimer = window.setTimeout(finish, Math.max(120, total * 80));
    requestAnimationFrame(tick);
  });
}

async function settleBootUi(defaultView = "home") {
  endBootFlow(defaultView);
  requestRender();
  await waitForAnimationFrames(2);
  const remaining = Math.max(0, appState.splashMinVisibleMs - (Date.now() - Number(appState.splashShownAt || 0)));
  if (remaining > 0) {
    await delay(remaining);
  }
  armBootSplashForLaunch(defaultView);
  await waitForSplashStartIntent();
  hideSplash({ force: true });
}

function setStatus(message) {
  const { splashStatus: currentSplashStatus, splashDetail: currentSplashDetail } = getSplashNodes();
  if (currentSplashStatus) {
    currentSplashStatus.textContent = message;
  }
  const target = inferSplashProgress(message);
  appState.splashTargetProgress = target;
  setSplashProgress(target);
  if (currentSplashDetail) {
    currentSplashDetail.textContent = inferSplashDetail(message);
  }
}

function getSplashNodes() {
  return {
    splash: document.getElementById("splash"),
    splashStatus: document.getElementById("splashStatus"),
    splashProgressFill: document.getElementById("splashProgressFill"),
    splashPercent: document.getElementById("splashPercent"),
    splashDetail: document.getElementById("splashDetail"),
    splashCta: document.getElementById("splashCta"),
    splashCtaLabel: document.getElementById("splashCtaLabel"),
  };
}

function armBootSplashForLaunch(defaultView = "home") {
  const {
    splash: currentSplash,
    splashStatus: currentSplashStatus,
    splashDetail: currentSplashDetail,
    splashCta,
    splashCtaLabel,
  } = getSplashNodes();
  stopSplashAutoProgress();
  appState.splashTargetProgress = 100;
  setSplashProgress(100, true);
  appState.splashReadyForDismiss = true;
  if (currentSplash) {
    currentSplash.dataset.ready = "true";
    currentSplash.setAttribute("aria-label", "터치하여 시작");
  }
  if (currentSplashStatus) {
    currentSplashStatus.textContent = "터치하여 시작";
  }
  if (currentSplashDetail) {
    currentSplashDetail.textContent =
      defaultView === "lobby"
        ? "크루 테이블로 바로 출항합니다."
        : defaultView === "game"
          ? "곧장 전장으로 진입합니다."
          : "메인 항구가 준비되었습니다.";
  }
  if (splashCta) {
    splashCta.classList.add("is-ready");
    splashCta.disabled = false;
  }
  if (splashCtaLabel) {
    splashCtaLabel.textContent = "터치하여 출항";
  }
}

function waitForSplashStartIntent() {
  if (!appState.splashReadyForDismiss || appState.splashMode !== "boot") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    appState.splashDismissResolver = resolve;
  });
}

function restoreSessionCaches() {
  try {
    const raw = sessionStorage.getItem("skullking-player-meta-v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        appState.playerMetaById = parsed;
      }
    }
  } catch (_) {}
  try {
    const raw = sessionStorage.getItem("skullking-identity-tokens-v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        appState.identityTokensBySession = parsed;
      }
    }
  } catch (_) {}
}

function persistSessionCaches() {
  try {
    sessionStorage.setItem("skullking-player-meta-v1", JSON.stringify(appState.playerMetaById || {}));
  } catch (_) {}
  try {
    sessionStorage.setItem("skullking-identity-tokens-v1", JSON.stringify(appState.identityTokensBySession || {}));
  } catch (_) {}
}

function restoreIdentityCache() {
  try {
    const raw = localStorage.getItem("skullking-discord-profile-v1");
    const parsed = raw ? JSON.parse(raw) : null;
    const storedDiscordId = localStorage.getItem("skullking-discord-id");
    const fallbackMeta = appState.playerMetaById?.[String(appState.playerId || "")] || {};
    const discordId = String(
      parsed?.discordUserId ||
        storedDiscordId ||
        fallbackMeta.discord_user_id ||
        "",
    ).trim();
    if (discordId) {
      appState.discordUserId = discordId;
      const prev = appState.discordProfilesByUserId[discordId] || {};
      appState.discordProfilesByUserId[discordId] = {
        displayName: String(
          parsed?.displayName ||
            parsed?.playerName ||
            prev.displayName ||
            fallbackMeta.name ||
            "",
        ).trim(),
        avatarUrl: String(parsed?.avatarUrl || prev.avatarUrl || fallbackMeta.avatar_url || "").trim(),
      };
    }
    const displayName = String(
      parsed?.displayName ||
        parsed?.playerName ||
        appState.playerMetaById?.[String(appState.playerId || "")]?.name ||
        appState.playerName ||
        "",
    ).trim();
    if (displayName && !isFallbackIdentityName(displayName)) {
      appState.discordDisplayName = appState.discordDisplayName || displayName.slice(0, 32);
    }
  } catch (_) {}
}

function persistIdentityCache() {
  try {
    const discordId = String(appState.discordUserId || "").trim();
    const profile = discordId ? (appState.discordProfilesByUserId[discordId] || {}) : {};
    const preferredDisplayName = getPreferredDiscordDisplayName();
    localStorage.setItem(
      "skullking-discord-profile-v1",
      JSON.stringify({
        discordUserId: discordId,
        displayName: preferredDisplayName,
        playerName: String(appState.playerName || "").trim(),
        avatarUrl: String(profile.avatarUrl || "").trim(),
      }),
    );
  } catch (_) {}
}

function isFallbackIdentityName(value) {
  const safe = String(value || "").trim();
  if (!safe) {
    return true;
  }
  return /^(unknown|user)$/i.test(safe) || /^sailor-/i.test(safe) || /^pirate-/i.test(safe);
}

function pickBestIdentityName(...values) {
  for (const value of values) {
    const safe = String(value || "").trim();
    if (safe && !isFallbackIdentityName(safe)) {
      return safe;
    }
  }
  return "";
}

function getResolvedDiscordIdentityName() {
  const discordId = String(appState.discordUserId || "").trim();
  const currentPlayerMeta = appState.playerMetaById?.[String(appState.playerId || "")] || {};
  const currentPlayerMetaDiscordId = String(currentPlayerMeta.discord_user_id || "").trim();
  const matchedMetaByDiscordId = discordId
    ? Object.values(appState.playerMetaById || {}).find(
        (meta) => String(meta?.discord_user_id || "").trim() === discordId,
      )
    : null;
  const cachedProfileName = discordId
    ? String(appState.discordProfilesByUserId[discordId]?.displayName || "").trim()
    : "";
  const guildNick = discordId ? String(appState.guildNickByUserId[discordId] || "").trim() : "";
  const stateLinkedName =
    !discordId || !currentPlayerMetaDiscordId || currentPlayerMetaDiscordId === discordId
      ? String(currentPlayerMeta.name || "").trim()
      : "";

  return pickBestIdentityName(
    guildNick,
    String(appState.discordDisplayName || "").trim(),
    cachedProfileName,
    String(matchedMetaByDiscordId?.name || "").trim(),
    stateLinkedName,
    discordId ? String(appState.playerName || "").trim() : "",
  );
}

function getPreferredDiscordDisplayName() {
  return (
    getResolvedDiscordIdentityName() ||
    pickBestIdentityName(
      String(appState.playerName || "").trim(),
      String(appState.playerMetaById?.[String(appState.playerId || "")]?.name || "").trim(),
    )
  );
}

function mergePlayerMetaFromState(state) {
  const players = Array.isArray(state?.players) ? state.players : [];
  if (!players.length) {
    return;
  }
  let changed = false;
  for (const p of players) {
    const pid = String(p?.id || "");
    if (!pid) {
      continue;
    }
    const prev = appState.playerMetaById[pid] || {};
    const next = {
      id: pid,
      name: String(p?.name || prev.name || ""),
      avatar_url: String(p?.avatar_url || prev.avatar_url || ""),
      discord_user_id: String(p?.discord_user_id || prev.discord_user_id || ""),
      updated_at: Date.now(),
    };
    if (
      next.name !== prev.name ||
      next.avatar_url !== prev.avatar_url ||
      next.discord_user_id !== prev.discord_user_id
    ) {
      appState.playerMetaById[pid] = next;
      changed = true;
    }
  }
  if (changed) {
    persistSessionCaches();
  }
}

function mergeLogsFromState(state, options = {}) {
  if (!state || typeof state !== "object") {
    return;
  }
  const replace = Boolean(options.replace);
  const incomingLogs = Array.isArray(state.logs) ? state.logs.filter((x) => typeof x === "string" && x.trim()) : [];
  const latestLog = typeof state.latest_log === "string" ? state.latest_log.trim() : "";

  if (replace && incomingLogs.length > 0) {
    appState.logLines = incomingLogs.slice(0, 20);
  } else if (latestLog) {
    if (appState.logLines[0] !== latestLog) {
      appState.logLines.unshift(latestLog);
      appState.logLines = appState.logLines.slice(0, 20);
    }
  }

  state.logs = appState.logLines.slice();
}

function displayMessageFromLogLine(line) {
  const safe = String(line || "").trim();
  if (!safe) {
    return "";
  }
  return safe.replace(/^\[R\d+\]\s*/, "").trim();
}

function flowEventsSignature(flowEvents) {
  const list = Array.isArray(flowEvents) ? flowEvents : [];
  return list
    .map((event) => {
      const safe = event && typeof event === "object" ? event : {};
      return [
        String(safe.kind || ""),
        String(safe.at || ""),
        String(safe.actor_id || ""),
        String(safe.current_turn_player_id || ""),
        String(safe.winner_id || ""),
      ].join(":");
    })
    .join("|");
}

function computeStateSignature(state) {
  if (!state || typeof state !== "object") {
    return "empty";
  }
  const players = Array.isArray(state.players) ? state.players : [];
  const settings = state.settings && typeof state.settings === "object" ? state.settings : {};
  const playerStateKey = players
    .map((p) => {
      const pid = String(p?.id || "");
      const conn = normalizedConnectionState(p?.connection_state);
      const lobbyState = normalizeLobbyPlayerState(p?.state);
      const afk = Boolean(p?.afk) ? "1" : "0";
      return `${pid}:${conn}:${lobbyState}:${afk}`;
    })
    .join("|");
  const settingsKey = [
    Number(settings.turn_limit_seconds || state.turn_limit_seconds || TURN_LIMIT_SECONDS),
    Boolean(settings.bonus_enabled) ? "1" : "0",
    Boolean(settings.advanced_rules_enabled) ? "1" : "0",
    Boolean(settings.allow_spectators) ? "1" : "0",
  ].join(":");
  const status = String(state.status || "").toLowerCase();
  const phase = String(state.phase || status || "").toLowerCase();
  const round = Number(state.round_number || 0);
  const tricks = Number(state.tricks_completed || 0);
  const trickLen = Array.isArray(state.current_trick) ? state.current_trick.length : 0;
  const turnOwner = String(
    state.current_turn_player_id ||
      players[Number(state.turn_index || 0)]?.id ||
      "",
  );
  const sessionId = String(state.session_id || "");
  const latestLog = String(state.latest_log || "");
  const flowSignature = flowEventsSignature(state.flow_events);
  return `${sessionId}:${status}:${phase}:${round}:${tricks}:${trickLen}:${turnOwner}:${playerStateKey}:${settingsKey}:${latestLog}:${flowSignature}`;
}

function buildTransitionDiff(prevSnapshot, nextSnapshot) {
  const prev = prevSnapshot || null;
  const next = nextSnapshot || null;
  const prevStatus = String(prev?.status || "");
  const nextStatus = String(next?.status || "");
  return {
    lobbyToGame:
      (prevStatus === "lobby" || prevStatus === "waiting_round") &&
      (nextStatus === "bidding" || nextStatus === "playing"),
    biddingToPlaying: prevStatus === "bidding" && nextStatus === "playing",
    playingToResolution:
      prevStatus === "playing" &&
      (nextStatus === "waiting_round" || nextStatus === "scoring" || nextStatus === "finished"),
    roundChanged: Number(prev?.round || 0) !== Number(next?.round || 0),
    trickCompleted: Number(next?.tricks || 0) > Number(prev?.tricks || 0),
    reconnectChanged: String(prev?.meConnection || "") !== String(next?.meConnection || ""),
    phaseChanged: String(prev?.phase || "") !== String(next?.phase || ""),
    statusChanged: prevStatus !== nextStatus,
  };
}

function hasTransportRecoveryInProgress() {
  // Long-polling is also a normal steady-state transport, so it should not
  // lock lobby/game inputs by itself. Only surface websocket recovery when we
  // also have not received a fresh authoritative state recently.
  if (!appState.sessionId || (!appState.wsReconnectTimer && !appState.wsFallbackTimer)) {
    return false;
  }
  const lastSyncAt = Number(appState.lastSuccessfulSyncAt || 0);
  return !lastSyncAt || (Date.now() - lastSyncAt) > 2500;
}

function deriveTransitionSnapshot(state) {
  if (!state || typeof state !== "object") {
    return null;
  }
  const players = Array.isArray(state.players) ? state.players : [];
  const me = resolveCurrentPlayer(state);
  const status = String(state.status || "").toLowerCase();
  const phase = String(state.phase || status || "").toLowerCase();
  const round = Number(state.round_number || 0);
  const tricks = Number(state.tricks_completed || 0);
  const trickLen = Array.isArray(state.current_trick) ? state.current_trick.length : 0;
  const turnOwner = String(
    state.current_turn_player_id ||
      players[Number(state.turn_index || 0)]?.id ||
      "",
  );
  const meConnection = normalizedConnectionState(me?.connection_state);
  const viewerPresence = String(state.viewer_presence || "").toLowerCase();
  return {
    status,
    phase,
    round,
    tricks,
    trickLen,
    turnOwner,
    meConnection,
    viewerPresence,
  };
}

function deriveViewFromState(state) {
  if (!state || typeof state !== "object") {
    return "home";
  }
  const me = resolveCurrentPlayer(state);
  const normalizedStatus = String(state.status || "").toLowerCase();
  const inGame = ["bidding", "playing", "waiting_round", "finished"].includes(normalizedStatus);
  const viewerPresence = String(state.viewer_presence || "").toLowerCase();
  const isParticipant = ["waiting", "playing"].includes(viewerPresence) && Boolean(state.viewer_in_session);
  const isFinished = normalizedStatus === "finished";
  const inSession = isParticipant || Boolean(me) || String(state.viewer_role || "") === "spectator";
  const matchesActiveSession =
    Boolean(appState.sessionId) &&
    String(state.session_id || "") &&
    String(state.session_id || "") === String(appState.sessionId || "");
  const hasSessionStatus = ["lobby", "bidding", "playing", "waiting_round", "finished"].includes(normalizedStatus);
  if (!inSession && matchesActiveSession && hasSessionStatus) {
    if (isFinished && appState.finishedLobbyMode) {
      return "lobby";
    }
    return inGame ? "game" : "lobby";
  }
  if (!inSession) {
    return "home";
  }
  if (isFinished && appState.finishedLobbyMode) {
    return "lobby";
  }
  if (inGame) {
    return "game";
  }
  return "lobby";
}

function maybeToastConnectionTransition(prevSnapshot, nextSnapshot) {
  if (!prevSnapshot || !nextSnapshot) {
    return;
  }
  if (prevSnapshot.meConnection === nextSnapshot.meConnection) {
    return;
  }
  if (nextSnapshot.meConnection === "reconnecting") {
    showToast("연결이 불안정해요. 재연결 중...");
    return;
  }
  if (nextSnapshot.meConnection === "connected" && prevSnapshot.meConnection !== "connected") {
    showToast("연결이 복구됐어.");
    return;
  }
  if (nextSnapshot.meConnection === "disconnected") {
    showToast("연결이 끊겼어. 자동 복구를 시도해요.");
  }
}

function runStateTransitionEffects(state, signature, transitionDiff) {
  if (!state || typeof state !== "object") {
    return;
  }
  if (appState.uiEffectTimer) {
    clearTimeout(appState.uiEffectTimer);
    appState.uiEffectTimer = null;
  }
  appState.uiEffectTimer = setTimeout(() => {
    appState.uiEffectTimer = null;
    if (signature !== appState.lastTransitionSignature) {
      return;
    }
    if (transitionDiff?.lobbyToGame || transitionDiff?.biddingToPlaying) {
      closeEventDialog();
      closeBidDialog();
    }
    handleGameTransitions(state);
    maybeAutoStartNextRound(state);
    maybeShowFinishedUi(state);
    const latestMessage = displayMessageFromLogLine(state.latest_log);
    if (latestMessage) {
      maybeToast(latestMessage);
    }
  }, 0);
}

function syncPreBidInspectState(state) {
  const status = String(state?.status || "").toLowerCase();
  if (status !== ROOM_STATUS.BIDDING) {
    appState.preBidInspect.key = "";
    appState.preBidInspect.startedAtMs = 0;
    return;
  }

  const inspectKey = `${String(state?.session_id || "")}:${Number(state?.round_number || 0)}:bidding`;
  if (appState.preBidInspect.key !== inspectKey) {
    appState.preBidInspect.key = inspectKey;
    appState.preBidInspect.startedAtMs = serverNowMs();
    closeBidDialog();
  }
}

function ingestServerState(state, options = {}) {
  if (!state || typeof state !== "object") {
    return;
  }
  if (!shouldAcceptIncomingState(state)) {
    return;
  }
  const replaceLogs = options.replaceLogs !== false;
  const serverUpdatedAt = stateRevisionFromPayload(state);
  if (Number.isFinite(serverUpdatedAt) && serverUpdatedAt > 0) {
    appState.lastServerUpdatedAt = Math.max(Number(appState.lastServerUpdatedAt || 0), serverUpdatedAt);
  }
  syncServerClock(state?.server_time_ms);
  syncTransportMetadataFromState(state);
  appState.lastSuccessfulSyncAt = Date.now();
  mergePlayerMetaFromState(state);
  mergeLogsFromState(state, { replace: replaceLogs });
  syncIdentityFromState(state);
  appState.statePayloadMode = "compact";
  const prevSnapshot = appState.transitionSnapshot;
  const nextSnapshot = deriveTransitionSnapshot(state);
  const transitionDiff = buildTransitionDiff(prevSnapshot, nextSnapshot);
  const signature = computeStateSignature(state);
  const reactState = buildReactGameState(state);
  const reactViewerId = String(appState.playerId || resolveCurrentPlayer(state)?.id || "");
  const shouldReleasePlaySubmit = stateReflectsPlaySubmit(state, appState.playSubmitPreview);
  rememberIdentityTokenFromPayload(state, state?.session_id || appState.sessionId || "");
  syncPreBidInspectState(state);
  appState.game = state;
  setReactUiState({
    currentView: deriveViewFromState(state),
    gameState: reactState,
    viewerId: reactViewerId,
    interactionState: {
      selectedCardIndex: appState.selectedCardIndex,
      pendingActionKind: appState.pendingAction?.kind || PENDING_ACTION_KIND.NONE,
      pendingActionKey: appState.pendingAction?.key || "",
      pendingActionActive: Boolean(appState.pendingAction?.active),
    },
    transportState: {
      protocolVersion: appState.transport.protocolVersion,
      snapshotRevision: appState.transport.snapshotRevision,
      payloadMode: appState.statePayloadMode,
      websocketActive: Boolean(appState.wsActive),
      pollingActive: Boolean(appState.pollingActive),
      lastSuccessfulSyncAt: Number(appState.lastSuccessfulSyncAt || 0),
      lastServerUpdatedAt: Number(appState.lastServerUpdatedAt || 0),
      sessionConnectionState: resolveCurrentPlayer(state)?.connection_state || CONNECTION_STATUS.CONNECTED,
    },
  });
  if (shouldReleasePlaySubmit) {
    clearPlaySubmitSyncTimer();
    clearPlaySubmitPreview({ skipRender: true });
    clearPendingAction(PENDING_ACTION_KIND.SUBMIT_CARD);
  }
  applyLatestAppliedTimestamp(state);
  appState.transitionSnapshot = nextSnapshot;
  appState.uiModel = deriveUiModel(state);
  setView(deriveViewFromState(state));
  maybeToastConnectionTransition(prevSnapshot, nextSnapshot);
  if (signature !== appState.lastTransitionSignature) {
    appState.lastTransitionSignature = signature;
    runStateTransitionEffects(state, signature, transitionDiff);
  }
  requestRender();
}

function applyServerState(state, options = {}) {
  ingestServerState(state, options);
}

function shouldForceFullStateRefresh() {
  if (!appState.game || appState.statePayloadMode !== "compact") {
    return true;
  }
  const myMeta = appState.playerMetaById?.[String(appState.playerId || "")] || {};
  return !String(myMeta.name || "").trim();
}

function syncIdentityFromState(state) {
  const players = Array.isArray(state?.players) ? state.players : [];
  if (!players.length) {
    syncTopbarDisplayName();
    syncTopbarAvatar();
    return;
  }
  let me = players.find((p) => String(p?.id || "") === String(appState.playerId || ""));
  if (!me && appState.discordUserId) {
    const did = String(appState.discordUserId || "");
    me = players.find((p) => String(p?.discord_user_id || p?.discordUserId || "") === did);
  }
  if (!me) {
    syncTopbarDisplayName();
    syncTopbarAvatar();
    return;
  }
  const serverName = String(me.name || "").trim();
  const discordId = String(me.discord_user_id || me.discordUserId || appState.discordUserId || "").trim();
  const avatarUrl = String(me.avatar_url || "").trim();
  if (discordId) {
    appState.discordUserId = discordId;
    const prev = appState.discordProfilesByUserId[discordId] || {};
    appState.discordProfilesByUserId[discordId] = {
      displayName: pickBestIdentityName(
        getResolvedDiscordIdentityName(),
        prev.displayName,
        serverName,
      ),
      avatarUrl: avatarUrl || prev.avatarUrl || "",
    };
  }
  if (serverName) {
    if (!isFallbackIdentityName(serverName)) {
      appState.discordDisplayName = serverName.slice(0, 32);
    }
    appState.playerName = serverName.slice(0, 32);
    if (nameInput) {
      nameInput.value = appState.playerName;
    }
  }
  persistIdentityCache();
  syncTopbarDisplayName();
  syncTopbarAvatar();
}

function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

async function warmStartupCaches() {
  if (appState.startupWarmDone) {
    return;
  }
  appState.startupWarmDone = true;
  const preloadTargets = [
    `${window.location.origin}/assets/images/splash/bg_splash_ship_1.jpg`,
    `${window.location.origin}/assets/images/splash/bg_splash_ship_2.jpg`,
    `${window.location.origin}/assets/images/splash/bg_splash_ship_3.jpg`,
    `${window.location.origin}/assets/images/splash/bg_splash_ship_4.jpg`,
    `${window.location.origin}/assets/images/splash/bg_splash_ship_5.jpg`,
    `${window.location.origin}/assets/images/lobby/bg_lobby.jpg`,
    `${window.location.origin}/assets/images/game/bg_game_table_day.jpg`,
  ];
  const avatarTargets = [];
  if (appState.discordUserId) {
    const self = appState.discordProfilesByUserId[String(appState.discordUserId)]?.avatarUrl || "";
    if (self) {
      avatarTargets.push(self);
    }
  }
  const allTargets = [...preloadTargets, ...avatarTargets].filter(Boolean);
  if (!allTargets.length) {
    return;
  }
  for (const src of allTargets) {
    await preloadImage(src);
  }
}

function applyRandomSplashBackground() {
  const { splash: currentSplash } = getSplashNodes();
  if (!currentSplash || !SPLASH_BACKGROUND_PATHS.length) {
    return;
  }
  const previousPath = String(appState.currentSplashBackgroundPath || "");
  const candidates = SPLASH_BACKGROUND_PATHS.filter((path) => path !== previousPath);
  const sourcePool = candidates.length ? candidates : SPLASH_BACKGROUND_PATHS;
  const nextPath = sourcePool[Math.floor(Math.random() * sourcePool.length)];
  appState.currentSplashBackgroundPath = nextPath;
  currentSplash.style.setProperty("--splash-bg-image", `url('${nextPath}')`);
}

function fitViewport() {
  const width = Math.max(320, Math.round(window.innerWidth || 0));
  const height = Math.max(320, Math.round(window.innerHeight || 0));
  const aspectRatio = width / Math.max(height, 1);
  const isCompactWidth = width < 1280;
  const isNarrowWidth = width < 1100;
  const isShortHeight = height < 820;
  const isUltraShortHeight = height < 700;

  let lobbySeatScale = 1;
  if (isCompactWidth || isShortHeight) {
    lobbySeatScale = 0.92;
  }
  if (isNarrowWidth || isUltraShortHeight) {
    lobbySeatScale = 0.84;
  }

  let gameSeatScale = 1;
  let gameMiniScale = 1;
  if (isCompactWidth || isShortHeight) {
    gameSeatScale = 0.92;
    gameMiniScale = 0.94;
  }
  if (isNarrowWidth || isUltraShortHeight) {
    gameSeatScale = 0.84;
    gameMiniScale = 0.88;
  }

  document.documentElement.style.setProperty("--ui-scale", "1");
  document.documentElement.style.setProperty("--viewport-width", `${width}px`);
  document.documentElement.style.setProperty("--viewport-height", `${height}px`);
  document.documentElement.style.setProperty("--viewport-aspect", String(aspectRatio));
  document.documentElement.style.setProperty("--lobby-seat-scale", String(lobbySeatScale));
  document.documentElement.style.setProperty("--game-seat-scale", String(gameSeatScale));
  document.documentElement.style.setProperty("--game-mini-scale", String(gameMiniScale));

  document.body.classList.toggle("viewport-compact-width", isCompactWidth);
  document.body.classList.toggle("viewport-narrow-width", isNarrowWidth);
  document.body.classList.toggle("viewport-short-height", isShortHeight);
  document.body.classList.toggle("viewport-ultra-short-height", isUltraShortHeight);
}

function hideSplash(options = {}) {
  const { splash: currentSplash, splashDetail: currentSplashDetail } = getSplashNodes();
  const force = Boolean(options.force);
  if (force) {
    resolveSplashStartIntent();
  }
  if (appState.splashHideTimer) {
    clearTimeout(appState.splashHideTimer);
    appState.splashHideTimer = null;
  }
  const remaining = Math.max(0, appState.splashMinVisibleMs - (Date.now() - Number(appState.splashShownAt || 0)));
  if (!force && remaining > 0) {
    appState.splashHideTimer = window.setTimeout(() => {
      appState.splashHideTimer = null;
      hideSplash({ force: true });
    }, remaining);
    return;
  }
  stopSplashAutoProgress();
  appState.splashTargetProgress = 100;
  setSplashProgress(100, true);
  if (currentSplashDetail) {
    currentSplashDetail.textContent = "완료";
  }
  if (!currentSplash) {
    return;
  }
  currentSplash.dataset.splashMode = "hidden";
  currentSplash.style.display = "none";
  currentSplash.style.opacity = "0";
  currentSplash.style.visibility = "hidden";
  currentSplash.style.pointerEvents = "none";
  currentSplash.classList.add("hidden");
  setReactUiState({
    splashVisible: false,
    splashMode: "hidden",
  });
}

function showSplash(message = "처리 중...", options = {}) {
  const {
    splash: currentSplash,
    splashDetail: currentSplashDetail,
    splashCta,
    splashCtaLabel,
  } = getSplashNodes();
  const splashMode = options.mode === "action" ? "action" : "boot";
  if (splashMode !== "action" && (appState.currentView === "lobby" || appState.currentView === "game")) {
    hideSplash({ force: true });
    return;
  }
  if (!currentSplash) {
    return;
  }
  if (splashMode === "boot") {
    applyRandomSplashBackground();
  }
  if (appState.splashHideTimer) {
    clearTimeout(appState.splashHideTimer);
    appState.splashHideTimer = null;
  }
  const minVisibleMs = Math.max(0, Number(options.minVisibleMs) || 0);
  currentSplash.dataset.splashMode = splashMode;
  currentSplash.style.display = "grid";
  currentSplash.style.opacity = "";
  currentSplash.style.visibility = "";
  currentSplash.style.pointerEvents = "";
  currentSplash.classList.remove("hidden");
  currentSplash.dataset.ready = "false";
  currentSplash.removeAttribute("aria-label");
  appState.splashMode = splashMode;
  appState.splashShownAt = Date.now();
  appState.splashMinVisibleMs = minVisibleMs;
  appState.splashTargetProgress = 0;
  appState.splashReadyForDismiss = false;
  appState.splashDismissResolver = null;
  setSplashProgress(0, true);
  if (currentSplashDetail) {
    currentSplashDetail.textContent = inferSplashDetail(message);
  }
  if (splashCta) {
    splashCta.classList.remove("is-ready");
    splashCta.disabled = true;
  }
  if (splashCtaLabel) {
    splashCtaLabel.textContent = splashMode === "action" ? "전황 동기화 중..." : "로딩 중...";
  }
  setReactUiState({
    splashVisible: true,
    splashMode,
  });
  startSplashAutoProgress();
  setStatus(message);
}

async function runWithSplash(message, task, minVisibleMs = ACTION_SPLASH_MIN_VISIBLE_MS) {
  showSplash(message, { mode: "action", minVisibleMs });
  try {
    return await task();
  } finally {
    const remaining = Math.max(0, appState.splashMinVisibleMs - (Date.now() - Number(appState.splashShownAt || 0)));
    if (remaining > 0) {
      await delay(remaining + 120);
    }
    await waitForAnimationFrames(2);
    hideSplash();
  }
}

function startSplashAutoProgress() {
  stopSplashAutoProgress();
  appState.splashAutoTimer = window.setInterval(() => {
    const { splash: currentSplash } = getSplashNodes();
    if (!currentSplash || currentSplash.classList.contains("hidden")) {
      stopSplashAutoProgress();
      return;
    }
    const current = Number(appState.splashProgress || 0);
    const target = Math.max(current, Number(appState.splashTargetProgress || 0));
    const softCeil = appState.splashMode === "boot" ? 94 : 90;
    if (current < target) {
      const gap = target - current;
      const step = Math.max(0.6, Math.min(4.5, gap * 0.24));
      setSplashProgress(current + step);
      return;
    }
    if (current >= softCeil) {
      return;
    }
    const idleStep = appState.splashMode === "boot" ? 0.18 : 0.1;
    setSplashProgress(Math.min(softCeil, current + idleStep));
  }, 160);
}

function stopSplashAutoProgress() {
  if (!appState.splashAutoTimer) {
    return;
  }
  clearInterval(appState.splashAutoTimer);
  appState.splashAutoTimer = null;
}

function setSplashProgress(percent, force = false) {
  const { splashProgressFill: currentSplashProgressFill, splashPercent: currentSplashPercent } = getSplashNodes();
  const safe = Math.max(0, Math.min(100, Number(percent) || 0));
  const next = force ? safe : Math.max(appState.splashProgress || 0, safe);
  appState.splashProgress = next;
  if (currentSplashProgressFill) {
    currentSplashProgressFill.style.width = `${next}%`;
  }
  if (currentSplashPercent) {
    currentSplashPercent.textContent = `${Math.round(next)}%`;
  }
}

function inferSplashProgress(message) {
  const text = String(message || "").toLowerCase();
  if (!text) return appState.splashProgress || 0;
  if (text.includes("클라이언트 초기화")) return 4;
  if (text.includes("초기화 시작")) return 8;
  if (text.includes("sdk import 시도")) return 16;
  if (text.includes("sdk 로드 중")) return 22;
  if (text.includes("sdk 인스턴스")) return 35;
  if (text.includes("ready 대기")) return 52;
  if (text.includes("사용자 정보 확인")) return 66;
  if (text.includes("인증 흐름")) return 70;
  if (text.includes("세션 복원 확인")) return 78;
  if (text.includes("로비 목록 불러오는 중")) return 88;
  if (text.includes("리소스 준비 중")) return 84;
  if (text.includes("연결 완료")) return 96;
  if (text.includes("실패")) return 92;
  if (text.includes("미설정")) return 88;
  if (text.includes("지연")) return 86;
  return appState.splashProgress || 0;
}

function inferSplashDetail(message) {
  const text = String(message || "").toLowerCase();
  if (text.includes("클라이언트 초기화")) return "초기 화면 구성";
  if (text.includes("초기화 시작")) return "앱 환경 확인";
  if (text.includes("sdk import 시도")) return "SDK 소스 탐색";
  if (text.includes("sdk 로드 중")) return "Discord SDK 불러오는 중";
  if (text.includes("sdk 인스턴스")) return "SDK 인스턴스 생성";
  if (text.includes("ready 대기")) return "Discord 클라이언트 연결 대기";
  if (text.includes("사용자 정보 확인")) return "Discord 사용자 정보 동기화";
  if (text.includes("인증 흐름")) return "OAuth 인증 처리";
  if (text.includes("세션 복원 확인")) return "이전 게임 세션 확인";
  if (text.includes("로비 목록 불러오는 중")) return "홈 화면 데이터 준비";
  if (text.includes("연결 완료")) return "로비 진입 준비";
  if (text.includes("실패")) return "오류 복구 및 로컬 모드 전환";
  if (text.includes("미설정")) return "앱 설정 확인";
  if (text.includes("지연")) return "로딩 지연 감지, 로비 우선 표시";
  return "클라이언트 준비 중";
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms),
    ),
  ]);
}

function readApiBase() {
  const queryBase = getQueryParams().get("api");
  return (queryBase || window.ACTIVITY_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");
}

function readInitialSession() {
  const query = getQueryParams();
  return query.get("session") || query.get("room") || "";
}

function readLaunchSessionTarget() {
  const query = getQueryParams();
  const explicit = String(query.get("session") || query.get("room") || "").trim();
  if (explicit) {
    return explicit;
  }
  return "";
}

function deriveLaunchSessionId() {
  const explicit = String(readLaunchSessionTarget() || "").trim();
  if (explicit) {
    return explicit;
  }
  return "";
}

function shouldUseDiscordOAuth() {
  const raw = String(getQueryParams().get("oauth") || "").trim().toLowerCase();
  if (!raw) {
    return true;
  }
  return !(raw === "0" || raw === "false" || raw === "no" || raw === "off");
}

function getQueryParams() {
  const direct = new URLSearchParams(window.location.search);
  if ([...direct.keys()].length > 0) {
    return direct;
  }

  // Discord can open the app with encoded pathname like "/%3Fsession%3D...".
  const path = window.location.pathname || "";
  if (path.startsWith("/%3F") || path.startsWith("/?")) {
    const decoded = decodeURIComponent(path.slice(1)); // remove leading "/"
    if (decoded.startsWith("?")) {
      return new URLSearchParams(decoded);
    }
  }
  return direct;
}

function normalizeDiscordLaunchQuery() {
  if (window.location.search) {
    return false;
  }

  const path = window.location.pathname || "";
  if (!path.startsWith("/%3F") && !path.startsWith("/?")) {
    return false;
  }

  try {
    const decoded = decodeURIComponent(path.slice(1));
    if (!decoded.startsWith("?")) {
      return false;
    }
    const nextUrl = `${window.location.origin}/${decoded}${window.location.hash || ""}`;
    window.history.replaceState(window.history.state, "", nextUrl);
    return true;
  } catch (error) {
    console.warn("[SkullKing][LaunchQueryNormalizeFailed]", error);
    return false;
  }
}

function hasDiscordLaunchContext() {
  const query = new URLSearchParams(window.location.search || "");
  return Boolean(query.get("frame_id") && query.get("instance_id") && query.get("platform"));
}

function readPlayerId() {
  const key = "skullking-player-id";
  let value = localStorage.getItem(key);
  if (!value) {
    value = `player-${cryptoRandomId()}`;
    localStorage.setItem(key, value);
  }
  return value;
}

function cryptoRandomId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function applyFallbackIdentity(forceCommit = false) {
  const shortId = appState.playerId.slice(-6);
  const fallbackName = `Sailor-${shortId}`;
  if (forceCommit) {
    if (!appState.playerName) {
      appState.playerName = fallbackName;
    }
    if (nameInput) {
      nameInput.value = appState.playerName;
    }
    syncTopbarDisplayName();
    return;
  }
  if (!appState.playerName) {
    if (nameInput) {
      nameInput.value = "Discord 계정 확인 중...";
    }
  }
  syncTopbarDisplayName();
}

function syncTopbarDisplayName() {
  const { displayNames, identityLabels } = getTopbarNodes();
  if (!displayNames.length) {
    return;
  }
  const resolvedDiscordName = getResolvedDiscordIdentityName();
  const fallbackVisibleName = String(
    appState.playerName ||
      appState.playerMetaById?.[String(appState.playerId || "")]?.name ||
      "",
  ).trim();
  const displayName =
    resolvedDiscordName ||
    getPreferredDiscordDisplayName() ||
    fallbackVisibleName ||
    "Discord User";
  displayNames.forEach((el) => {
    el.textContent = displayName;
  });
  const label = resolvedDiscordName ? "Current Player" : (fallbackVisibleName ? "Crew Member" : "Connecting");
  identityLabels.forEach((el) => {
    el.textContent = label;
  });
}

function syncTopbarAvatar() {
  const avatarUrl = getSelfAvatarUrl();
  const { avatars } = getTopbarNodes();
  avatars.forEach((el) => {
    applyAvatarToElement(el, avatarUrl);
    applyAvatarConnectionState(el);
  });
}

function pickDiscordDisplayName(src) {
  if (!src) {
    return "";
  }
  return (
    src.nick ||
    src.member?.nick ||
    src.voice_state?.nick ||
    src.display_name ||
    src.displayName ||
    src.global_name ||
    src.globalName ||
    src.nick ||
    src.nickname ||
    src.username ||
    src.name ||
    src.user?.display_name ||
    src.user?.displayName ||
    src.user?.global_name ||
    src.user?.globalName ||
    src.user?.nick ||
    src.user?.nickname ||
    src.user?.username ||
    src.user?.name ||
    ""
  );
}

function pickDiscordId(src) {
  if (!src) {
    return "";
  }
  return String(
    src.id ||
      src.user_id ||
      src.userId ||
      src.discord_user_id ||
      src.discordUserId ||
      src.user?.id ||
      src.user?.user_id ||
      src.user?.userId ||
      "",
  );
}

function pickDiscordAvatarUrl(src) {
  if (!src) {
    return "";
  }
  const avatarHash =
    src.avatar ||
    src.avatar_hash ||
    src.avatarHash ||
    src.user?.avatar ||
    src.user?.avatar_hash ||
    src.user?.avatarHash ||
    "";
  const uid = pickDiscordId(src);
  if (uid && avatarHash) {
    const ext = String(avatarHash).startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${uid}/${avatarHash}.${ext}?size=128`;
  }
  if (uid) {
    return discordDefaultAvatarUrl(uid);
  }
  return (
    src.avatar_url ||
    src.avatarUrl ||
    src.user?.avatar_url ||
    src.user?.avatarUrl ||
    ""
  );
}

function cacheDiscordProfile(userLike) {
  const uid = pickDiscordId(userLike);
  if (!uid) {
    return;
  }
  const displayName = pickDiscordDisplayName(userLike);
  const avatarUrl = pickDiscordAvatarUrl(userLike);
  const prev = appState.discordProfilesByUserId[uid] || {};
  appState.discordProfilesByUserId[uid] = {
    displayName: displayName || prev.displayName || "",
    avatarUrl: avatarUrl || prev.avatarUrl || "",
  };
}

function tryApplyIdentityCandidate(userLike) {
  if (!userLike) {
    return false;
  }
  cacheDiscordProfile(userLike);
  const candidateId = pickDiscordId(userLike);
  const candidateName = pickBestIdentityName(
    pickDiscordDisplayName(userLike),
    candidateId ? appState.guildNickByUserId[candidateId] : "",
    candidateId ? appState.discordProfilesByUserId[candidateId]?.displayName : "",
  );
  if (!candidateId || !candidateName) {
    return false;
  }
  setDiscordIdentity(userLike);
  return true;
}

async function hydrateDiscordIdentityFromChannel(sdk, participantList = []) {
  const channelId = String(sdk?.channelId || "").trim();
  if (!channelId || !sdk?.commands?.getChannel) {
    return false;
  }
  try {
    const channel = await sdk.commands.getChannel({ channel_id: channelId });
    const voiceStates = Array.isArray(channel?.voice_states) ? channel.voice_states : [];
    if (!voiceStates.length) {
      return false;
    }
    voiceStates.forEach((state) => cacheDiscordProfile(state));
    const discordId = String(appState.discordUserId || "").trim();
    const directMatch = discordId
      ? voiceStates.find((state) => pickDiscordId(state) === discordId)
      : null;
    if (directMatch && tryApplyIdentityCandidate(directMatch)) {
      return true;
    }
    if (participantList.length === 1 && voiceStates.length === 1 && tryApplyIdentityCandidate(voiceStates[0])) {
      return true;
    }
    const bySharedId = voiceStates.find((state) =>
      participantList.some((participant) => pickDiscordId(participant) === pickDiscordId(state)),
    );
    if (bySharedId && tryApplyIdentityCandidate(bySharedId)) {
      return true;
    }
    const firstNamed = voiceStates.find((state) => pickBestIdentityName(pickDiscordDisplayName(state)));
    if (firstNamed && tryApplyIdentityCandidate(firstNamed)) {
      return true;
    }
  } catch (error) {
    console.warn("[SkullKing][GetChannelIdentityFailed]", error);
  }
  return false;
}

function setDiscordIdentity(user) {
  console.log("[SkullKing][DiscordUserRaw]", user);
  cacheDiscordProfile(user);
  const discordId = pickDiscordId(user);
  const pickedName = String(pickDiscordDisplayName(user) || "").trim();

  if (discordId) {
    appState.discordUserId = discordId;
    if (!appState.sessionId && !appState.playerIdFrozen) {
      appState.playerId = `discord-${discordId}`;
      localStorage.setItem("skullking-player-id", appState.playerId);
    }
    localStorage.setItem("skullking-discord-id", discordId);
  }
  const resolvedName = pickBestIdentityName(
    pickedName,
    discordId ? appState.guildNickByUserId[discordId] : "",
    discordId ? appState.discordProfilesByUserId[discordId]?.displayName : "",
  );
  if (resolvedName) {
    appState.discordDisplayName = resolvedName.slice(0, 32);
  }

  if (
    resolvedName &&
    (!appState.playerName || isFallbackIdentityName(appState.playerName) || appState.discordUserId === discordId)
  ) {
    appState.playerName = resolvedName.slice(0, 32);
    if (nameInput) {
      nameInput.value = appState.playerName;
    }
  }
  syncTopbarDisplayName();
  syncTopbarAvatar();
  console.log("[SkullKing][IdentityMapped]", {
    playerId: appState.playerId,
    discordUserId: appState.discordUserId,
    playerName: appState.playerName,
    discordDisplayName: appState.discordDisplayName,
  });
  persistIdentityCache();
  if (resolvedName) {
    syncJoinedName().catch((error) => console.warn("[SkullKing][SyncJoinedNameFailed]", error));
  }
}

function ensureIdentitySubscriptions(sdk) {
  if (appState.subscriptionsReady || !sdk?.subscribe) {
    return;
  }
  appState.subscriptionsReady = true;
  try {
    sdk.subscribe("CURRENT_USER_UPDATE", (payload) => {
      console.log("[SkullKing][CURRENT_USER_UPDATE]", payload);
      const user = payload?.user || payload;
      setDiscordIdentity(user);
    });
    const guildId = String(sdk?.guildId || "").trim();
    if (guildId) {
      sdk.subscribe(
        "CURRENT_GUILD_MEMBER_UPDATE",
        (payload) => {
          console.log("[SkullKing][CURRENT_GUILD_MEMBER_UPDATE]", payload);
          const guildMember = payload?.guild_member || payload;
          const uid = pickDiscordId(guildMember);
          const nick = pickDiscordDisplayName(guildMember);
          if (uid && nick) {
            appState.guildNickByUserId[uid] = nick;
          }
          if (uid && !appState.discordUserId) {
            appState.discordUserId = uid;
          }
          if (tryApplyIdentityCandidate(guildMember)) {
            syncJoinedName().catch((error) => console.warn("[SkullKing][SyncJoinedNameFailed]", error));
          } else {
            syncTopbarDisplayName();
            syncTopbarAvatar();
          }
        },
        { guild_id: guildId },
      );
    }
    sdk.subscribe("ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE", (payload) => {
      console.log("[SkullKing][ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE]", payload);
      const participants = Array.isArray(payload?.participants) ? payload.participants : [];
      participants.forEach((participant) => cacheDiscordProfile(participant));
      const meById = participants.find(
        (participant) => pickDiscordId(participant) === String(appState.discordUserId || ""),
      );
      if (meById) {
        setDiscordIdentity(meById);
        return;
      }
      const me = participants.find((participant) => participant.is_current_user || participant.isCurrentUser || participant.self);
      if (me) {
        setDiscordIdentity(me);
      }
    });
  } catch {
    // ignore subscribe failures
  }
}

async function hydrateDiscordIdentity(sdk) {
  ensureIdentitySubscriptions(sdk);

  try {
    const result = await sdk.commands.getInstanceConnectedParticipants();
    console.log("[SkullKing][Participants]", result);
    const participants = result?.participants || result?.users || [];
    participants.forEach((p) => cacheDiscordProfile(p));
    if (participants.length > 0) {
      const meById = participants.find(
        (p) => pickDiscordId(p) === String(appState.discordUserId || ""),
      );
      if (meById) {
        setDiscordIdentity(meById);
        return;
      }
    }

    if (participants.length === 1) {
      setDiscordIdentity(participants[0]);
      return;
    }

    const me = participants.find((p) => p.is_current_user || p.isCurrentUser || p.self);
    if (me) {
      setDiscordIdentity(me);
      return;
    }

    const storedDiscordId = localStorage.getItem("skullking-discord-id");
    if (storedDiscordId) {
      const matched = participants.find((p) => pickDiscordId(p) === storedDiscordId);
      if (matched) {
        setDiscordIdentity(matched);
        return;
      }
    }

    // Last-resort fallback: if we have participants, use the first displayable name.
    const firstNamed = participants.find((p) => pickDiscordDisplayName(p));
    if (firstNamed) {
      setDiscordIdentity(firstNamed);
      return;
    }
  } catch {
    // ignore and fallback
  }

  if (await hydrateDiscordIdentityFromChannel(sdk)) {
    return;
  }

  applyFallbackIdentity();
}

async function probeIdentityUntilResolved(sdk) {
  for (let i = 0; i < 8; i += 1) {
    if (getResolvedDiscordIdentityName()) {
      return;
    }
    try {
      await hydrateDiscordIdentity(sdk);
    } catch {
      // ignore probe errors
    }
    await delay(1000);
  }
}

async function setupDiscordAuth(sdk, clientId) {
  try {
    const state = cryptoRandomId();
    const auth = await sdk.commands.authorize({
      client_id: clientId,
      response_type: "code",
      state,
      prompt: "none",
      scope: ["identify"],
    });
    console.log("[SkullKing][AuthorizeResponse]", auth);

    const exchange = await post("/api/discord/exchange", {
      code: auth.code,
    });
    console.log("[SkullKing][ExchangeResponse]", exchange);
    const exchangeUser = exchange?.user || null;
    if (exchangeUser && pickDiscordId(exchangeUser)) {
      setDiscordIdentity(exchangeUser);
    }

    const authn = await sdk.commands.authenticate({
      access_token: exchange.access_token,
    });
    console.log("[SkullKing][AuthenticateResponse]", authn);
    const authUser = authn?.user || authn;
    if (authUser && pickDiscordId(authUser)) {
      setDiscordIdentity(authUser);
    } else if (exchangeUser && pickDiscordId(exchangeUser)) {
      setDiscordIdentity(exchangeUser);
    }
    appState.oauthReady = true;
  } catch (error) {
    console.warn("[SkullKing][OAuthFlowFailed]", error);
    const msg = error?.message || String(error);
    if (/Failed to fetch/i.test(msg)) {
      setStatus(`OAuth 실패: Failed to fetch (apiBase=${appState.apiBase})`);
    } else {
      setStatus(`OAuth 실패: ${msg}`);
    }
    appState.oauthReady = false;
  }
}

async function resolveDiscordSDKClass() {
  setStatus("Discord SDK 로드 중...");
  if (window.DiscordSDK) {
    console.log("[SkullKing][SDKLoadedByGlobal]");
    return window.DiscordSDK;
  }

  const moduleCandidates = [
    `${window.location.origin}/vendor/discord-sdk/output/index.mjs`,
    "https://cdn.jsdelivr.net/npm/@discord/embedded-app-sdk@1.8.0/+esm",
    "https://unpkg.com/@discord/embedded-app-sdk@1.8.0/output/index.mjs",
  ];

  for (const modUrl of moduleCandidates) {
    try {
      setStatus(`Discord SDK import 시도: ${modUrl}`);
      const mod = await import(modUrl);
      const SDKClass = mod?.DiscordSDK || mod?.default?.DiscordSDK || mod?.default;
      if (SDKClass) {
        console.log("[SkullKing][SDKLoadedByImport]", modUrl);
        return SDKClass;
      }
    } catch (error) {
      console.warn("[SkullKing][SDKImportFailed]", modUrl, error);
      resolveDiscordSDKClass.lastError = `${modUrl} :: ${error?.message || String(error)}`;
    }
  }

  if (!resolveDiscordSDKClass.lastError) {
    resolveDiscordSDKClass.lastError = "Unknown SDK load failure";
  }
  return null;
}

async function initDiscord() {
  setStatus("Discord Activity 초기화 시작...");
  normalizeDiscordLaunchQuery();
  const queryClientId = getQueryParams().get("client_id");
  const clientId = window.DISCORD_CLIENT_ID || queryClientId || DEFAULT_CLIENT_ID;
  if (!clientId || clientId === UNSET_CLIENT_ID) {
    appState.discordReady = false;
    appState.discordSdkStatus = "disconnected";
    syncTopbarAvatar();
    setStatus("Discord App ID 미설정 (로컬 모드)");
    applyFallbackIdentity(true);
    const fallbackView = preferredBootFallbackView();
    const settleView = await settleBootToLaunchSessionOrFallback(fallbackView);
    await settleBootUi(settleView);
    return;
  }

  if (!hasDiscordLaunchContext()) {
    appState.discordReady = false;
    appState.discordSdkStatus = "disconnected";
    syncTopbarAvatar();
    setStatus("Discord Activity 컨텍스트 미설정 (로컬 모드)");
    applyFallbackIdentity(true);
    const fallbackView = preferredBootFallbackView();
    const settleView = await settleBootToLaunchSessionOrFallback(fallbackView);
    await settleBootUi(settleView);
    return;
  }

  const SDKClass = await resolveDiscordSDKClass();
  if (!SDKClass) {
    appState.discordReady = false;
    appState.discordSdkStatus = "disconnected";
    syncTopbarAvatar();
    setStatus(`Discord SDK 미감지: ${resolveDiscordSDKClass.lastError}`);
    applyFallbackIdentity(true);
    const fallbackView = preferredBootFallbackView();
    const settleView = await settleBootToLaunchSessionOrFallback(fallbackView);
    await settleBootUi(settleView);
    return;
  }

  try {
    setStatus("Discord SDK 인스턴스 생성...");
    const sdk = new SDKClass(clientId);
    appState.sdk = sdk;
    setStatus("Discord ready 대기 중...");
    await withTimeout(sdk.ready(), 8000, "sdk.ready");
    appState.discordReady = true;
    appState.discordSdkStatus = "connected";
    syncTopbarAvatar();
    if (shouldUseDiscordOAuth()) {
      setStatus("Discord 인증 흐름 시작...");
      await setupDiscordAuth(sdk, clientId);
    } else {
      appState.oauthReady = false;
      console.log("[SkullKing][OAuthSkipped] enable with ?oauth=1");
    }
    appState.activityInstanceId = sdk.instanceId || null;
    setStatus("Discord 사용자 정보 확인 중...");
    await hydrateDiscordIdentity(sdk);
    await probeIdentityUntilResolved(sdk);
    if (!appState.playerName) {
      applyFallbackIdentity(true);
      console.warn("[SkullKing][NameFallbackCommitted] display name not resolved from SDK payloads");
    }
    setStatus("리소스 준비 중...");
    await warmStartupCaches();
    setStatus("Discord Activity 연결 완료");
    setStatus("세션 복원 확인 중...");
    const resumed = await tryAutoResume();
    let settleView = "home";
    if (!resumed) {
      setStatus("참가할 방 확인 중...");
      const autoJoined = await tryAutoJoinLaunchSession();
      if (autoJoined) {
        settleView = preferredBootFallbackView();
        updateViewportMode();
      } else {
        const fallbackView = preferredBootFallbackView();
        settleView = fallbackView;
        if (fallbackView === "home") {
          setView("home");
          setStatus("로비 목록 불러오는 중...");
          await loadRooms(false);
        }
      }
    } else {
      settleView = preferredBootFallbackView();
      updateViewportMode();
    }
    await settleBootUi(settleView);
  } catch (error) {
    console.error(error);
    appState.discordReady = false;
    appState.discordSdkStatus = "disconnected";
    syncTopbarAvatar();
    setStatus(`Discord 연결 실패: ${error?.message || String(error)}`);
    applyFallbackIdentity(true);
    const fallbackView = preferredBootFallbackView();
    const settleView = await settleBootToLaunchSessionOrFallback(fallbackView);
    await settleBootUi(settleView);
  }
}

function discordDefaultAvatarUrl(discordUserId) {
  const safe = String(discordUserId || "").trim();
  if (!safe) {
    return "";
  }
  let index = 0;
  try {
    index = Number(BigInt(safe) % 6n);
  } catch {
    index = 0;
  }
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

function setJoinPasswordError(message = "") {
  const { error } = getJoinPasswordNodes();
  if (!error) {
    return;
  }
  const safe = String(message || "").trim();
  error.textContent = safe;
  error.classList.toggle("hidden", !safe);
}

function settleJoinPasswordPrompt(value) {
  const resolver = appState.joinPasswordPrompt?.resolver;
  appState.joinPasswordPrompt.resolver = null;
  appState.joinPasswordPrompt.roomKey = "";
  forceCloseDialog(getJoinPasswordNodes().dialog);
  if (typeof resolver === "function") {
    resolver(value);
  }
}

function submitJoinPasswordPrompt() {
  const { input } = getJoinPasswordNodes();
  const value = String(input?.value || "").trim();
  if (!value) {
    setJoinPasswordError("비밀번호를 입력해줘.");
    input?.focus?.();
    return;
  }
  settleJoinPasswordPrompt(value);
}

function rememberRoomPassword(sessionId, roomPassword) {
  const key = String(sessionId || "").trim();
  if (!key) {
    return;
  }
  const value = typeof roomPassword === "string" ? roomPassword.trim() : "";
  if (!value) {
    delete appState.roomPasswordsBySession[key];
    return;
  }
  appState.roomPasswordsBySession[key] = value;
}

function getRememberedRoomPassword(sessionId) {
  const key = String(sessionId || "").trim();
  if (!key) {
    return "";
  }
  return String(appState.roomPasswordsBySession[key] || "").trim();
}

function rememberIdentityToken(sessionId, token) {
  const key = String(sessionId || "").trim();
  const value = String(token || "").trim();
  if (!key) {
    return;
  }
  if (!value) {
    delete appState.identityTokensBySession[key];
    persistSessionCaches();
    return;
  }
  appState.identityTokensBySession[key] = value;
  persistSessionCaches();
}

function getRememberedIdentityToken(sessionId) {
  const key = String(sessionId || "").trim();
  if (!key) {
    return "";
  }
  return String(appState.identityTokensBySession[key] || "").trim();
}

function rememberIdentityTokenFromPayload(payload, fallbackSessionId = "") {
  const sessionId = String(payload?.session_id || fallbackSessionId || "").trim();
  const identityToken = String(payload?.identity_token || "").trim();
  if (!sessionId || !identityToken) {
    return;
  }
  rememberIdentityToken(sessionId, identityToken);
}

function requestRoomPassword(room, options = {}) {
  const message = String(options.errorMessage || "").trim();
  const joinPasswordNodes = getJoinPasswordNodes();
  const joinPasswordDialog = joinPasswordNodes.dialog;
  if (!joinPasswordDialog?.showModal) {
    const fallback = window.prompt(
      message || `${room?.room_name || room?.session_id || "이 방"} 비밀번호를 입력해줘.`,
    );
    if (fallback === null) {
      return Promise.resolve(null);
    }
    return Promise.resolve(String(fallback).trim());
  }

  return new Promise((resolve) => {
    appState.joinPasswordPrompt.resolver = resolve;
    appState.joinPasswordPrompt.roomKey = String(room?.session_id || room?.room_name || "");
    if (joinPasswordNodes.roomName) {
      joinPasswordNodes.roomName.textContent = room?.room_name || room?.session_id || "Private Room";
    }
    if (joinPasswordNodes.input) {
      joinPasswordNodes.input.value = "";
    }
    setJoinPasswordError(message);
    if (!joinPasswordDialog.dataset.boundHandlers) {
      joinPasswordDialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        settleJoinPasswordPrompt(null);
      });
      joinPasswordDialog.addEventListener("close", () => {
        if (typeof appState.joinPasswordPrompt.resolver === "function") {
          const resolver = appState.joinPasswordPrompt.resolver;
          appState.joinPasswordPrompt.resolver = null;
          appState.joinPasswordPrompt.roomKey = "";
          resolver(null);
        }
      });
      joinPasswordDialog.dataset.boundHandlers = "true";
    }
    safeOpenDialog(joinPasswordDialog);
    setTimeout(() => {
      joinPasswordNodes.input?.focus?.();
      joinPasswordNodes.input?.select?.();
    }, 0);
  });
}

async function joinBySession(sessionId, room, options = {}) {
  if (!sessionId) {
    showToast("입장할 방을 선택해줘.");
    return false;
  }
  if (!appState.playerName) {
    applyFallbackIdentity(true);
  }
  let roomPassword = typeof options.roomPassword === "string" ? options.roomPassword.trim() : "";
  if (!roomPassword) {
    roomPassword = getRememberedRoomPassword(sessionId);
  }
  if (room?.has_password && !roomPassword) {
    roomPassword = await requestRoomPassword(room);
    if (roomPassword === null) {
      showToast("입장을 취소했어.");
      return false;
    }
  }

  appState.playerIdFrozen = true;
  resetTransportSessionState();

  appState.sessionId = sessionId;
  appState.lastServerUpdatedAt = 0;
  appState.latestAppliedUpdatedAt = 0;
  appState.statePayloadMode = "full";
  appState.lastSnapshot = null;
  appState.transitionSnapshot = null;
  appState.lastTransitionSignature = "";
  appState.lastHandledFlowSignature = "";
  appState.selectedCardIndex = null;
  clearPendingAction();
  appState.uiModel = null;
  appState.roundResultModal.key = "";
  appState.roundResultModal.title = "";
  appState.roundResultModal.lines = [];
  appState.roundResultModal.dismissedKey = "";
  clearTrickReveal({ skipRender: true });
  if (appState.uiEffectTimer) {
    clearTimeout(appState.uiEffectTimer);
    appState.uiEffectTimer = null;
  }
  appState.logLines = [];
  appState.autoRound.pending = false;
  appState.autoRound.lastTriggeredRound = -1;
  appState.autoRound.retryCount = 0;
  resetRenderCache();

  try {
    await runWithSplash("테이블 연결 중...", async () => {
      const joinedState = await post(`/activity/sessions/${sessionId}/join`, {
        player_id: appState.playerId,
        player_name: appState.playerName,
        room_password: roomPassword,
        discord_user_id: appState.discordUserId || null,
        avatar_url: getSelfAvatarUrl() || null,
        activity_instance_id: appState.activityInstanceId || null,
      });

      applyServerState(joinedState, { replaceLogs: true });
      rememberRoomPassword(sessionId, roomPassword);
      startStateWebSocket();
      await waitForAnimationFrames(2);
    }, 900);

    // Identity probe runs AFTER the splash is dismissed — it can take up to 8 s
    // when Discord identity is slow to resolve (e.g. dev/local mode), and keeping
    // it inside runWithSplash would make the splash appear frozen for that duration.
    if (appState.sdk) {
      probeIdentityUntilResolved(appState.sdk)
        .then(() => syncJoinedName())
        .catch(() => {});
    }

    findRoomDialog?.close?.();
    if (!options.suppressJoinedToast) {
      showToast("테이블에 입장했어.");
    }
    return true;
  } catch (error) {
    appState.playerIdFrozen = false;
    appState.sessionId = null;
    const detailText = String(error?.detail || error?.message || "").trim();
    if (/^already_joined_session:/i.test(detailText)) {
      const conflictSessionId = detailText.split(":").slice(1).join(":").trim();
      if (conflictSessionId && conflictSessionId !== sessionId) {
        return joinBySession(conflictSessionId, null, { suppressJoinedToast: options.suppressJoinedToast });
      }
    }
    if (/wrong room password/i.test(String(error?.detail || error?.message || ""))) {
      const retryPassword = await requestRoomPassword(room, { errorMessage: "비밀번호가 올바르지 않습니다." });
      if (retryPassword !== null) {
        return joinBySession(sessionId, room, { roomPassword: retryPassword });
      }
      showToast("입장을 취소했어.");
      return false;
    }
    showToast(error.message || "입장 실패");
    return false;
  }
}

async function onCreateRoom() {
  const {
    dialog: currentCreateRoomDialog,
    roomNameInput: currentRoomNameInput,
    maxPlayersInput: currentMaxPlayersInput,
    bonusEnabledInput: currentBonusEnabledInput,
    advancedRulesInput: currentAdvancedRulesInput,
    useRoomPasswordInput: currentUseRoomPasswordInput,
    roomPasswordInput: currentRoomPasswordInput,
  } = getCreateRoomNodes();
  if (!appState.playerName) {
    applyFallbackIdentity(true);
  }
  appState.playerIdFrozen = true;
  const roomName = (currentRoomNameInput?.value || "").trim() || `Skull Room ${new Date().toLocaleTimeString("ko-KR", { hour12: false })}`;
  const maxPlayers = Number(currentMaxPlayersInput?.value || 6);
  const bonusEnabled = Boolean(currentBonusEnabledInput?.checked);
  const advancedRulesEnabled = Boolean(currentAdvancedRulesInput?.checked);
  const usePassword = Boolean(currentUseRoomPasswordInput?.checked);
  const roomPassword = usePassword ? (currentRoomPasswordInput?.value || "").trim() : "";
  if (usePassword && !roomPassword) {
    showToast("비밀번호를 입력해줘.");
    return;
  }
  try {
    const created = await post("/activity/sessions", {
      player_id: appState.playerId,
      player_name: appState.playerName,
      discord_user_id: appState.discordUserId || null,
      avatar_url: getSelfAvatarUrl() || null,
      activity_instance_id: appState.activityInstanceId || null,
      room_name: roomName,
      max_players: Number.isInteger(maxPlayers) ? maxPlayers : 6,
      bonus_enabled: bonusEnabled,
      advanced_rules_enabled: advancedRulesEnabled,
      room_password: roomPassword || null,
    });
    forceCloseDialog(currentCreateRoomDialog);
    if (sessionInput) {
      sessionInput.value = created.session_id;
    }
    await joinBySession(created.session_id, created, { roomPassword });
  } catch (error) {
    appState.playerIdFrozen = false;
    showToast(error.message || "방 생성 실패");
  }
}

async function tryAutoResume() {
  const pid = encodeURIComponent(appState.playerId || "");
  const did = encodeURIComponent(appState.discordUserId || "");
  try {
    const payload = await get(`/activity/sessions/resume?player_id=${pid}&discord_user_id=${did}`);
    const session = payload?.session;
    if (!session?.session_id) {
      return false;
    }
    const status = String(session.status || "").toLowerCase();
    // Auto-resume for both in-progress sessions and joined lobby sessions.
    if (!["lobby", "bidding", "playing", "waiting_round"].includes(status)) {
      return false;
    }
    await joinBySession(session.session_id, session);
    return true;
  } catch {
    return false;
  }
}

async function tryAutoJoinLaunchSession() {
  const targetSessionId = String(deriveLaunchSessionId() || "").trim();
  if (!targetSessionId) {
    return false;
  }
  try {
    const payload = await get("/activity/sessions?limit=30");
    const rooms = Array.isArray(payload?.rooms) ? payload.rooms : [];
    const matchedRoom = rooms.find((room) => {
      const roomSessionId = String(room?.session_id || "").trim();
      return targetSessionId && roomSessionId === targetSessionId;
    });
    if (!matchedRoom) {
      return false;
    }
    return await joinBySession(String(matchedRoom.session_id || targetSessionId || ""), matchedRoom, { suppressJoinedToast: true });
  } catch {
    return false;
  }
}

function openCreateRoomDialog() {
  const { dialog, advancedRulesInput } = getCreateRoomNodes();
  setCreateRoomMode(advancedRulesInput?.checked ? "advanced" : "casual");
  setCreateRoomStep(1);
  updateCreateRoomPasswordField();
  if (!dialog?.showModal) {
    onCreateRoom();
    return;
  }
  safeOpenDialog(dialog);
}

function setCreateRoomMode(mode) {
  const { advancedRulesInput, createModeCasual, createModeAdvanced } = getCreateRoomNodes();
  const selected = mode === "advanced" ? "advanced" : "casual";
  if (advancedRulesInput) {
    advancedRulesInput.checked = selected === "advanced";
  }
  createModeCasual?.classList.toggle("selected", selected === "casual");
  createModeAdvanced?.classList.toggle("selected", selected === "advanced");
}

function setCreateRoomStep(step) {
  const { dialog, createRoomStepMode, createRoomStepOptions, createRoomSubtitle } = getCreateRoomNodes();
  const safeStep = Number(step) === 2 ? 2 : 1;
  dialog?.classList.toggle("step-options", safeStep === 2);
  createRoomStepMode?.classList.toggle("hidden", safeStep !== 1);
  createRoomStepOptions?.classList.toggle("hidden", safeStep !== 2);
  if (createRoomSubtitle) {
    createRoomSubtitle.textContent =
      safeStep === 1
        ? "1단계 · 게임 모드를 선택하세요."
        : "2단계 · 방 정보와 옵션을 설정하세요.";
  }
}

function updateCreateRoomPasswordField() {
  const { useRoomPasswordInput, roomPasswordFieldWrap, roomPasswordInput } = getCreateRoomNodes();
  const enabled = Boolean(useRoomPasswordInput?.checked);
  roomPasswordFieldWrap?.classList.toggle("hidden", !enabled);
  if (!enabled && roomPasswordInput) {
    roomPasswordInput.value = "";
  }
}

async function loadRooms(showToastOnDone = false) {
  const now = Date.now();
  if (appState.roomsLoadPromise) {
    return appState.roomsLoadPromise;
  }
  // Guard against burst duplicate calls from startup + manual refresh overlap.
  if (now - Number(appState.roomsLastLoadedAt || 0) < 700) {
    return;
  }

  appState.roomsLoadPromise = (async () => {
    try {
      const payload = await get("/activity/sessions?limit=30");
      const rooms = payload?.rooms || [];
      renderRoomList(rooms);
      appState.roomsLastLoadedAt = Date.now();
      if (showToastOnDone) {
        showToast("방 목록 갱신 완료");
      }
    } catch (error) {
      const { roomList } = getFindRoomNodes();
      if (roomList) {
        roomList.innerHTML = `<div class="log-item">방 목록을 불러오지 못했어: ${error.message || error}</div>`;
      }
    } finally {
      appState.roomsLoadPromise = null;
    }
  })();

  return appState.roomsLoadPromise;
}

function renderRoomList(rooms) {
  const { roomList } = getFindRoomNodes();
  if (!roomList) {
    return;
  }
  roomList.innerHTML = "";
  if (!rooms.length) {
    const empty = document.createElement("div");
    empty.className = "room-empty-state";
    empty.innerHTML = `
      <strong>아직 열린 테이블이 없어요.</strong>
      <span>새 방을 만들어 첫 항해를 시작해보세요.</span>
    `;
    roomList.appendChild(empty);
    return;
  }

  rooms.forEach((room) => {
    const item = document.createElement("div");
    item.className = "room-item";
    const info = document.createElement("div");
    info.className = "room-copy";
    const title = document.createElement("div");
    title.className = "room-title";
    title.textContent = getRoomDisplayName(room);
    const code = document.createElement("div");
    code.className = "room-code";
    code.textContent = String(room.session_id || "").toUpperCase();
    const meta = document.createElement("div");
    meta.className = "meta";
    const modeLabel = room.advanced_rules_enabled ? "Advanced Rule" : "Casual";
    const privacyLabel = room.has_password ? "Private" : "Open";
    meta.textContent = `${room.player_count}/${room.max_players || 8}명 · 방장 ${room.host_name || "Unknown"} · ${modeLabel} · ${privacyLabel}`;
    info.appendChild(title);
    info.appendChild(code);
    info.appendChild(meta);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "room-join-btn";
    btn.textContent = "입장";
    btn.addEventListener("click", () => {
      if (sessionInput) {
        sessionInput.value = room.session_id;
      }
      joinBySession(room.session_id, room);
    });

    item.appendChild(info);
    item.appendChild(btn);
    roomList.appendChild(item);
  });
}

function getRoomDisplayName(room) {
  const roomName = String(room?.room_name || "").trim();
  const sessionId = String(room?.session_id || "").trim();
  const normalizedRoomName = roomName.toLowerCase();
  const normalizedSessionId = sessionId.toLowerCase();
  const looksLikeInternalId =
    !roomName ||
    normalizedRoomName === normalizedSessionId ||
    /^activity-\d+$/i.test(roomName) ||
    /^session[-_]/i.test(roomName);
  if (!looksLikeInternalId) {
    return roomName;
  }
  const hostName = String(room?.host_name || "").trim();
  const modeLabel = room?.advanced_rules_enabled ? "전략" : "캐주얼";
  if (hostName) {
    return `${hostName}의 ${modeLabel} 테이블`;
  }
  return room?.advanced_rules_enabled ? "전략 테이블" : "캐주얼 테이블";
}

async function syncJoinedName() {
  const syncedName = getPreferredDiscordDisplayName() || String(appState.playerName || "").trim();
  if (!appState.sessionId || !syncedName) {
    return;
  }
  const roomPassword = getRememberedRoomPassword(appState.sessionId);
  appState.playerName = syncedName.slice(0, 32);
  if (nameInput) {
    nameInput.value = appState.playerName;
  }
  const state = await post(`/activity/sessions/${appState.sessionId}/join`, {
    player_id: appState.playerId,
    player_name: appState.playerName,
    room_password: roomPassword || null,
    discord_user_id: appState.discordUserId || null,
    avatar_url: getSelfAvatarUrl() || null,
    activity_instance_id: appState.activityInstanceId || null,
  });
  applyServerState(state, { replaceLogs: true });
  return state;
}

async function openFindRoomDialog() {
  const { dialog } = getFindRoomNodes();
  if (!dialog?.showModal) {
    await loadRooms(true);
    return;
  }
  safeOpenDialog(dialog);
  await loadRooms(false);
}

function normalizeLobbyPlayerState(state) {
  const safe = String(state || "").trim().toLowerCase();
  if (["not_ready", "ready", "bid", "playing", "finished"].includes(safe)) {
    return safe;
  }
  return "not_ready";
}

function areAllLobbyPlayersReady(players = []) {
  return players.every((player) => normalizeLobbyPlayerState(player?.state) === "ready");
}

function spectatorPolicyLabel(state) {
  return String(state?.spectator_policy || "").toLowerCase() === "allow_read_only" ? "Read-only Spectator" : "Spectator Off";
}

function roundBonusValue(player, scoreRow) {
  const value = Number(scoreRow?.round_bonus ?? player?.round_bonus ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function formatRoundBonusText(player, scoreRow) {
  const value = roundBonusValue(player, scoreRow);
  if (!value) {
    return "Bonus 0";
  }
  return `Bonus ${value > 0 ? "+" : ""}${value}`;
}

function scoreDeltaFromSnapshots(player) {
  const previousScores = appState.lastSnapshot?.scores || {};
  const previous = Number(previousScores[String(player?.id || "")] ?? player?.score ?? 0);
  const next = Number(player?.score ?? 0);
  const delta = next - previous;
  return Number.isFinite(delta) ? delta : 0;
}

function formatScoreDelta(delta) {
  if (!Number.isFinite(delta) || delta === 0) {
    return "0";
  }
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function normalizedConnectionState(state) {
  const safe = String(state || "").trim().toLowerCase();
  if (safe === "connected" || safe === "disconnected" || safe === "reconnecting") {
    return safe;
  }
  return "connected";
}

function connectionStateLabel(state) {
  const safe = normalizedConnectionState(state);
  if (safe === "reconnecting") {
    return "Reconnecting";
  }
  if (safe === "disconnected") {
    return "Disconnected";
  }
  return "Connected";
}

function preBidDelayRemainingSeconds(game) {
  if (PRE_BID_DELAY_SECONDS <= 0) {
    return 0;
  }
  if (String(game?.status || "").toLowerCase() !== ROOM_STATUS.BIDDING) {
    return 0;
  }
  const startSec = Number(game?.turn_started_at || 0);
  if (startSec > 0) {
    const remainingMs = startSec * 1000 + PRE_BID_DELAY_SECONDS * 1000 - serverNowMs();
    return Math.max(0, Math.ceil(remainingMs / 1000));
  }
  const inspectStartedAtMs = Number(appState.preBidInspect?.startedAtMs || 0);
  if (inspectStartedAtMs <= 0) {
    return PRE_BID_DELAY_SECONDS;
  }
  const remainingMs = inspectStartedAtMs + PRE_BID_DELAY_SECONDS * 1000 - serverNowMs();
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

function isPreBidDelayActive(game) {
  return preBidDelayRemainingSeconds(game) > 0;
}

function trickHoldRemainingSeconds(game) {
  const serverUntilMs = Number(game?.trick_hold_until || 0) * 1000;
  const localUntilMs = Number(appState.trickReveal?.expiresAtMs || 0);
  const untilMs = Math.max(serverUntilMs, localUntilMs);
  if (untilMs <= 0) {
    return 0;
  }
  return Math.max(0, Math.ceil((untilMs - serverNowMs()) / 1000));
}

function resolvedTurnLimitSeconds(game) {
  const settingsLimit = Number(game?.settings?.turn_limit_seconds || 0);
  const stateLimit = Number(game?.turn_limit_seconds || 0);
  const limit = settingsLimit > 0 ? settingsLimit : stateLimit > 0 ? stateLimit : TURN_LIMIT_SECONDS;
  return Math.max(5, limit);
}

function roundTitleLabel(game) {
  const round = Number(game?.round_number || 0);
  return round > 0 ? `Round ${round}` : "Round -";
}

function buildTrickRevealKey(game, flowEvent = null) {
  const sourceTrick = Array.isArray(game?.last_trick) ? game.last_trick : [];
  const trickSignature = sourceTrick
    .map((play) => `${String(play?.player_id || "")}:${cardStateSignature(play?.card)}`)
    .join("|");
  return [
    String(game?.session_id || appState.sessionId || ""),
    String(game?.round_number || 0),
    String(game?.tricks_completed || 0),
    String(flowEvent?.winner_id || game?.last_winner_id || ""),
    trickSignature,
  ].join("~");
}

function reconnectDeadlineRemainingSeconds(player) {
  const deadlineSec = Number(player?.reconnect_deadline_at || 0);
  if (deadlineSec <= 0) {
    return 0;
  }
  return Math.max(0, Math.ceil((deadlineSec * 1000 - serverNowMs()) / 1000));
}

function reconnectResumeMessage(state, me) {
  const remainingSeconds = reconnectDeadlineRemainingSeconds(me);
  const resumeWindowSeconds = Number(
    state?.match_session?.resume_window_seconds
      || state?.reconnect_grace_seconds
      || me?.reconnect_grace_seconds
      || 0
  );
  const matchContinues = Boolean(state?.match_session?.match_continues_during_reconnect);

  if (remainingSeconds > 0) {
    if (matchContinues) {
      return `매치 세션은 서버에서 계속 진행 중입니다. 약 ${remainingSeconds}초 안에 다시 붙으면 최신 스냅샷으로 복구합니다.`;
    }
    return `약 ${remainingSeconds}초 안에 다시 붙으면 최신 스냅샷으로 복구합니다.`;
  }

  if (resumeWindowSeconds > 0) {
    if (matchContinues) {
      return `매치 세션은 서버에서 계속 진행 중입니다. 재연결 유예 ${resumeWindowSeconds}초 기준으로 현재 상태를 다시 동기화하는 중입니다.`;
    }
    return `재연결 유예 ${resumeWindowSeconds}초 기준으로 서버 상태를 복구 중입니다.`;
  }

  return "세션 연결을 복구하고 최신 상태를 다시 동기화하는 중입니다.";
}

function shouldShowBidWonBadges(game) {
  const status = String(game?.status || "").toLowerCase();
  if (status === ROOM_STATUS.PLAYING || status === ROOM_STATUS.WAITING_ROUND || status === ROOM_STATUS.FINISHED) {
    return true;
  }
  return false;
}

function isPendingAction(kind = "") {
  if (!appState.pendingAction?.active) {
    return false;
  }
  if (!kind) {
    return true;
  }
  return String(appState.pendingAction.kind || "") === String(kind);
}

function setPendingAction(kind, options = {}) {
  appState.pendingAction = {
    kind: kind || PENDING_ACTION_KIND.NONE,
    active: Boolean(kind && kind !== PENDING_ACTION_KIND.NONE),
    key: String(options.key || ""),
    cardIndex: Number.isInteger(options.cardIndex) ? Number(options.cardIndex) : null,
    startedAt: Date.now(),
  };
  appState.actionLock = appState.pendingAction.active;
}

function clearPendingAction(kind = "") {
  if (kind && String(appState.pendingAction.kind || "") !== String(kind)) {
    return;
  }
  appState.pendingAction = {
    kind: PENDING_ACTION_KIND.NONE,
    active: false,
    key: "",
    cardIndex: null,
    startedAt: 0,
  };
  appState.actionLock = false;
  requestRender();
}

function clearSelectedCard(options = {}) {
  appState.selectedCardIndex = null;
  appState.uiModel = null;
  if (!options.skipRender) {
    requestRender();
  }
}

function setSelectedCardIndex(index) {
  appState.selectedCardIndex = Number.isInteger(index) && index >= 0 ? index : null;
  appState.uiModel = null;
  requestRender();
}

function setPlaySubmitPreview(preview) {
  appState.playSubmitPreview = preview && typeof preview === "object"
    ? {
        sessionId: String(preview.sessionId || appState.sessionId || ""),
        playerId: String(preview.playerId || appState.playerId || ""),
        index: Number.isInteger(preview.index) ? Number(preview.index) : null,
        card: preview.card || null,
        animationKey: String(preview.animationKey || ""),
        requestId: String(preview.requestId || ""),
        createdAt: Date.now(),
      }
    : null;
  requestRender();
}

function clearPlaySubmitPreview(options = {}) {
  if (!appState.playSubmitPreview) {
    return;
  }
  appState.playSubmitPreview = null;
  if (!options.skipRender) {
    requestRender();
  }
}

function resolvePlaySubmitPreview(game) {
  const preview = appState.playSubmitPreview;
  if (!preview || !game) {
    return null;
  }
  if (String(preview.sessionId || "") !== String(game.session_id || appState.sessionId || "")) {
    return null;
  }
  return preview;
}

function normalizedCardMode(card) {
  return String(card?.mode || card?.tigress_mode || card?.tigress_as || "").toLowerCase();
}

function cardAnimationSignature(card) {
  if (!card || typeof card !== "object") {
    return "none";
  }
  return [
    String(card.type || card.kind || ""),
    String(card.suit || ""),
    String(card.value ?? card.number ?? ""),
    normalizedCardMode(card),
  ].join(":");
}

function buildPlayedCardAnimationKey({
  sessionId = appState.sessionId || "",
  roundNumber = appState.game?.round_number || 0,
  tricksCompleted = appState.game?.tricks_completed || 0,
  playerId = "",
  card = null,
} = {}) {
  return [
    String(sessionId || ""),
    String(roundNumber || 0),
    String(tricksCompleted || 0),
    String(playerId || ""),
    cardAnimationSignature(card),
  ].join(":");
}

function playMatchesPreview(play, preview) {
  if (!play || !preview) {
    return false;
  }
  return (
    String(play?.player_id || "") === String(preview.playerId || "")
    && cardAnimationSignature(play?.card) === cardAnimationSignature(preview.card)
  );
}

function stateReflectsPlaySubmit(state, preview) {
  if (!preview || !state) {
    return true;
  }
  const currentTrick = Array.isArray(state?.current_trick) ? state.current_trick : [];
  if (currentTrick.some((play) => playMatchesPreview(play, preview))) {
    return true;
  }
  const lastTrick = Array.isArray(state?.last_trick) ? state.last_trick : [];
  if (lastTrick.some((play) => playMatchesPreview(play, preview))) {
    return true;
  }
  const status = String(state?.status || "").toLowerCase();
  if (status === ROOM_STATUS.WAITING_ROUND || status === ROOM_STATUS.FINISHED) {
    return true;
  }
  const currentTurnId = String(
    state?.current_turn_player_id ||
    state?.players?.[Number(state?.turn_index || 0)]?.id ||
    "",
  );
  if (currentTurnId && currentTurnId !== String(preview.playerId || "")) {
    return true;
  }
  return false;
}

function clearPlaySubmitSyncTimer() {
  if (appState.playSubmitSyncTimer) {
    clearTimeout(appState.playSubmitSyncTimer);
    appState.playSubmitSyncTimer = null;
  }
}

function schedulePlaySubmitSync() {
  clearPlaySubmitSyncTimer();
  appState.playSubmitSyncTimer = setTimeout(() => {
    appState.playSubmitSyncTimer = null;
    if (!isPendingAction(PENDING_ACTION_KIND.SUBMIT_CARD) || !appState.playSubmitPreview) {
      return;
    }
    refreshState({ longPoll: false, full: true }).catch(() => {});
  }, 300);
}

function selectedCardFromUiModel(uiModel) {
  const idx = Number(uiModel?.selectedCardIndex);
  if (!Number.isInteger(idx) || idx < 0) {
    return null;
  }
  return uiModel?.myHand?.[idx] || null;
}

function shouldAcceptIncomingState(state) {
  const incomingSessionId = String(state?.session_id || "");
  if (appState.sessionId && incomingSessionId && incomingSessionId !== String(appState.sessionId)) {
    return false;
  }
  if (!appState.sessionId && appState.currentView === "home" && incomingSessionId) {
    return false;
  }
  const updatedAt = stateRevisionFromPayload(state);
  const latestApplied = Number(appState.latestAppliedUpdatedAt || 0);
  if (!updatedAt || !latestApplied) {
    return true;
  }
  if (updatedAt > latestApplied) {
    return true;
  }
  if (updatedAt < latestApplied) {
    return false;
  }
  const nextSignature = computeStateSignature(state);
  return nextSignature !== String(appState.lastTransitionSignature || "");
}

function applyLatestAppliedTimestamp(state) {
  const updatedAt = stateRevisionFromPayload(state);
  if (Number.isFinite(updatedAt) && updatedAt > 0) {
    appState.latestAppliedUpdatedAt = Math.max(Number(appState.latestAppliedUpdatedAt || 0), updatedAt);
  }
}

function shouldKeepSelectedCard(state, me) {
  if (!state || !me) {
    return false;
  }
  if (String(state?.status || "").toLowerCase() !== ROOM_STATUS.PLAYING) {
    return false;
  }
  const selectedIndex = Number(appState.selectedCardIndex);
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0) {
    return false;
  }
  const currentTurnId = String(
    state?.current_turn_player_id ||
      state?.players?.[Number(state?.turn_index || 0)]?.id ||
      "",
  );
  if (String(me?.id || "") !== currentTurnId) {
    return false;
  }
  const legalIndexes = Array.isArray(me?.legal_indexes) ? me.legal_indexes : [];
  const hand = Array.isArray(me?.hand) ? me.hand : [];
  return selectedIndex < hand.length && legalIndexes.includes(selectedIndex);
}

function flowEventsFromState(state) {
  return Array.isArray(state?.flow_events) ? state.flow_events : [];
}

function latestFlowEventFromState(state) {
  const events = flowEventsFromState(state);
  return events.length ? events[events.length - 1] : null;
}

function playerNameById(state, playerId) {
  const safePlayerId = String(playerId || "");
  if (!safePlayerId) {
    return "";
  }
  const players = Array.isArray(state?.players) ? state.players : [];
  return players.find((player) => String(player?.id || "") === safePlayerId)?.name || "";
}

function buildRoundInfoSummary(state, me, currentTurnPlayer) {
  const status = String(state?.status || "").toLowerCase();
  const round = Number(state?.round_number || 0);
  const dealt = Number(state?.cards_dealt || round || 0);
  const completed = Number(state?.tricks_completed || 0);
  const meTurn = String(currentTurnPlayer?.id || "") === String(me?.id || appState.playerId || "");
  if (status === ROOM_STATUS.BIDDING) {
    return `Round ${round || "-"} · ${dealt || "-"}장 배분 · 동시 예측 제출`;
  }
  if (status === ROOM_STATUS.PLAYING) {
    return meTurn
      ? `Round ${round || "-"} · Trick ${completed + 1}/${dealt || "-"} · 내 턴`
      : `Round ${round || "-"} · Trick ${completed + 1}/${dealt || "-"} · ${currentTurnPlayer?.name || "다음 플레이어"} 차례`;
  }
  if (status === ROOM_STATUS.WAITING_ROUND) {
    return `Round ${round || "-"} 정산 완료 · 다음 라운드 준비`;
  }
  if (status === ROOM_STATUS.FINISHED) {
    return `Final Round ${round || "-"} · 최종 결과 확정`;
  }
  return `Round ${round || "-"} · 플레이어 대기 중`;
}

function buildPredictionSummary(state, me) {
  const players = Array.isArray(state?.players) ? state.players : [];
  const bidsSubmitted = players.filter((player) => player?.bid !== null && player?.bid !== undefined).length;
  const pendingCount = Math.max(0, players.length - bidsSubmitted);
  const myBid = me?.bid;
  const myWon = Number(me?.tricks_won || 0);
  const myBidText = myBid === null || myBid === undefined ? "미제출" : String(myBid);
  const status = String(state?.status || "").toLowerCase();

  if (status === ROOM_STATUS.BIDDING) {
    return myBid === null || myBid === undefined
      ? `내 예측 대기 중 · ${pendingCount}명 남음`
      : `내 예측 ${myBidText} · ${pendingCount}명 남음`;
  }
  if (status === ROOM_STATUS.PLAYING) {
    return `예측 ${myBidText} · 현재 획득 ${myWon}트릭`;
  }
  if (status === ROOM_STATUS.WAITING_ROUND || status === ROOM_STATUS.FINISHED) {
    return `최종 예측 ${myBidText} · 획득 ${myWon}트릭`;
  }
  return `예측 상태 대기 중 · ${pendingCount}명 준비`;
}

function describeFlowEvent(state, flowEvent) {
  if (!flowEvent || typeof flowEvent !== "object") {
    return "";
  }
  const kind = String(flowEvent.kind || "");
  const actorName = String(flowEvent.actor_name || playerNameById(state, flowEvent.actor_id) || "플레이어");
  const turnName = playerNameById(state, flowEvent.current_turn_player_id);
  const winnerName = playerNameById(state, flowEvent.winner_id);
  if (kind === "game_started") {
    return `게임 시작 · ${Number(flowEvent.cards_dealt || state?.cards_dealt || 0) || "-"}장 배분`;
  }
  if (kind === "round_started") {
    return `다음 라운드 시작 · ${Number(flowEvent.cards_dealt || state?.cards_dealt || 0) || "-"}장 배분`;
  }
  if (kind === "bid_submitted") {
    return `${actorName} 예측 제출 완료`;
  }
  if (kind === "card_played") {
    if (flowEvent.afk_auto) {
      return `${actorName} 카드 제출 · AFK 자동 제출`;
    }
    return `${actorName} 카드 제출${flowEvent.timeout_auto ? " · 시간 초과 자동 제출" : ""}`;
  }
  if (kind === "turn_changed") {
    return turnName ? `현재 턴 · ${turnName}` : "다음 턴으로 이동";
  }
  if (kind === "trick_resolved") {
    return winnerName
      ? `트릭 종료 · 승자 ${winnerName}`
      : `트릭 종료 · ${flowEvent.discarded ? "특수 규칙으로 승자 없음" : "승자 없음"}`;
  }
  if (kind === "round_scored") {
    return `라운드 점수 정산 완료`;
  }
  if (kind === "game_finished") {
    return winnerName ? `게임 종료 · 우승 ${winnerName}` : "게임 종료";
  }
  return "";
}

function buildSyncSummary(state, reconnect, interaction, latestFlowEvent, me, currentTurnPlayer) {
  if (reconnect?.visible) {
    return reconnect.body || "서버 스냅샷을 다시 동기화하는 중입니다.";
  }
  if (interaction?.locked) {
    return interaction.reason || "서버 상태가 안정화될 때까지 입력을 잠시 막고 있습니다.";
  }
  const pendingKind = String(appState.pendingAction?.kind || "");
  if (pendingKind === PENDING_ACTION_KIND.SUBMIT_BID) {
    return "예측 제출을 서버에 확인하는 중입니다.";
  }
  if (pendingKind === PENDING_ACTION_KIND.SUBMIT_CARD) {
    return "카드 제출을 서버에 확인하는 중입니다.";
  }
  const flowText = describeFlowEvent(state, latestFlowEvent);
  if (flowText) {
    return `${flowText} · 서버 authoritative 스냅샷 기준`;
  }
  return buildRuleSummary(state, me, currentTurnPlayer);
}

function buildTrickResultSummary(state) {
  const currentTrick = Array.isArray(state?.current_trick) ? state.current_trick : [];
  const lastTrick = Array.isArray(state?.last_trick) ? state.last_trick : [];
  const players = Array.isArray(state?.players) ? state.players : [];
  const winnerId = String(state?.last_winner_id || "");
  const winnerName = players.find((player) => String(player?.id || "") === winnerId)?.name || "";

  if (lastTrick.length > 0) {
    const cards = lastTrick
      .map((play) => `${String(play?.player_name || "Unknown")}: ${String(play?.card?.label || "Card")}`)
      .join(" · ");
    if (winnerName) {
      return `${winnerName} won the last trick. ${cards}`;
    }
    return cards;
  }

  if (currentTrick.length > 0) {
    const cards = currentTrick
      .map((play) => `${String(play?.player_name || "Unknown")} played ${String(play?.card?.label || "Card")}`)
      .join(" · ");
    return cards;
  }

  return "트릭이 아직 시작되지 않았습니다. 서버가 다음 플레이어와 합법 수를 알려줍니다.";
}

function buildRoundResultSummary(state) {
  const status = String(state?.status || "").toLowerCase();
  if (status !== ROOM_STATUS.WAITING_ROUND && status !== ROOM_STATUS.FINISHED) {
    return null;
  }

  const players = Array.isArray(state?.players) ? state.players : [];
  const breakdownByPlayer = Object.fromEntries(
    (Array.isArray(state?.score_breakdown) ? state.score_breakdown : []).map((row) => [String(row.player_id || ""), row]),
  );
  const prevScores = appState.lastSnapshot?.scores || {};
  const rows = players.map((player) => {
    const row = breakdownByPlayer[String(player.id || "")] || {};
    const previous = Number(prevScores[player.id] ?? player.score ?? 0);
    const next = Number(player.score ?? 0);
    const delta = next - previous;
    const signed = delta > 0 ? `+${delta}` : `${delta}`;
    const bidText = row.bid === null || row.bid === undefined ? "-" : String(row.bid);
    const wonText = String(row.tricks_won ?? player.tricks_won ?? 0);
    const success = typeof row.success === "boolean" ? row.success : Number(row.bid) === Number(row.tricks_won);
    const bonusText = formatRoundBonusText(player, row);
    const afkText = player.afk ? " · AFK" : "";
    return {
      playerId: String(player.id || ""),
      playerName: String(player.name || "Unknown"),
      bidText,
      wonText,
      bonusText,
      success,
      score: next,
      delta,
      deltaText: signed,
      afk: Boolean(player.afk),
      isMe: String(player.id || "") === String(appState.playerId || ""),
      line: `${player.name}: Bid ${bidText} · Won ${wonText} · ${bonusText} · ${success ? "Success" : "Fail"} · Score ${next} (${signed})${afkText}`,
    };
  });
  const lines = rows.map((row) => row.line);

  return {
    key: `${state.session_id}:${state.round_number}:${players.map((player) => `${player.id}:${player.score}`).join("|")}`,
    title: `Round ${Number(state.round_number || 0)} Result`,
    lines,
    rows,
  };
}

function buildRuleSummary(state, me, currentTurnPlayer) {
  const status = String(state?.status || "").toLowerCase();
  if (status === ROOM_STATUS.LOBBY) {
    return "Host starts after everyone is ready. Spectators stay read-only, and reconnecting players are temporarily input-locked.";
  }
  if (status === ROOM_STATUS.BIDDING) {
    return "서버가 배팅 페이즈를 관리합니다. 이번 라운드에서 가져갈 트릭 수를 예측하고 한 번만 제출할 수 있습니다.";
  }
  if (status === ROOM_STATUS.PLAYING) {
    const myTurn = String(currentTurnPlayer?.id || "") === String(appState.playerId || "");
    if (myTurn) {
      return "내 턴입니다. 강조된 합법 카드만 선택한 뒤 제출하세요. 규칙 판정은 서버가 처리합니다.";
    }
    return `현재는 ${currentTurnPlayer?.name || "다른 플레이어"}의 턴입니다. 손패는 볼 수 있지만 서버 승인 전까지 제출은 되지 않습니다.`;
  }
  if (status === ROOM_STATUS.WAITING_ROUND) {
    return "라운드 정산이 완료되었습니다. 마지막 라운드 전까지는 호스트 클라이언트가 자동으로 다음 라운드를 시작하며, 결과는 서버 스냅샷 기준으로 유지됩니다.";
  }
  if (status === ROOM_STATUS.FINISHED) {
    return "게임이 종료되었습니다. 최종 점수와 라운드 기록은 서버 스냅샷 기준으로 표시됩니다.";
  }
  return me ? `${me.name}의 상태를 서버 스냅샷과 동기화하고 있습니다.` : "게임 상태를 동기화 중입니다.";
}

function buildReconnectModel(state, me) {
  const meConnection = normalizedConnectionState(me?.connection_state);
  const transportRecovering = hasTransportRecoveryInProgress();
  const graceLabel = reconnectResumeMessage(state, me);
  const remainingSeconds = reconnectDeadlineRemainingSeconds(me);

  if (meConnection === CONNECTION_STATUS.DISCONNECTED) {
    return {
      visible: true,
      hardBlock: true,
      title: "Disconnected",
      body:
        remainingSeconds > 0
          ? `연결이 끊어졌습니다. 약 ${remainingSeconds}초 안에 복구하지 못하면 서버가 AFK로 처리할 수 있어요.`
          : "연결이 끊어졌습니다. 서버 스냅샷을 다시 받을 때까지 입력을 잠시 막고 있어요.",
    };
  }

  if (meConnection === CONNECTION_STATUS.RECONNECTING || transportRecovering) {
    return {
      visible: true,
      hardBlock: false,
      title: "Reconnecting",
      body: graceLabel,
    };
  }

  return {
    visible: false,
    hardBlock: false,
    title: "",
    body: "",
  };
}

function deriveInteractionLock(state, me, reconnect, viewerRole) {
  if (viewerRole !== VIEWER_ROLE.PLAYER) {
    return {
      locked: true,
      reason: "관전자 모드에서는 조작할 수 없습니다.",
    };
  }
  const meConnection = normalizedConnectionState(me?.connection_state);
  if (reconnect?.hardBlock || meConnection === CONNECTION_STATUS.DISCONNECTED) {
    return {
      locked: true,
      reason: "연결이 끊겨 입력을 잠시 막고 있습니다.",
    };
  }
  if (meConnection === CONNECTION_STATUS.RECONNECTING) {
    return {
      locked: true,
      reason: "재연결 중에는 최신 상태를 받을 때까지 조작할 수 없습니다.",
    };
  }
  const trickHoldSeconds = trickHoldRemainingSeconds(state);
  if (
    trickHoldSeconds > 0
    && String(state?.status || "").toLowerCase() === ROOM_STATUS.PLAYING
    && (!Array.isArray(state?.current_trick) || state.current_trick.length === 0)
  ) {
    return {
      locked: true,
      reason: `트릭 결과를 정리 중입니다. ${trickHoldSeconds}초 후 다음 트릭이 시작됩니다.`,
    };
  }
  return {
    locked: false,
    reason: "",
  };
}

function deriveUiModel(state) {
  const players = Array.isArray(state?.players) ? state.players : [];
  const me = resolveCurrentPlayer(state);
  const currentTurnPlayer =
    players.find((player) => String(player?.id || "") === String(state?.current_turn_player_id || "")) ||
    players[Number(state?.turn_index || 0)] ||
    null;
  const hostPlayer = players.find((player) => String(player?.id || "") === String(state?.host_id || "")) || null;
  const legalMoves = Array.isArray(me?.legal_indexes) ? me.legal_indexes : [];
  const pendingAction = appState.pendingAction;
  const selectedCardIndex = shouldKeepSelectedCard(state, me) ? Number(appState.selectedCardIndex) : null;
  const roomState = String(state?.status || ROOM_STATUS.LOBBY).toLowerCase();
  const gamePhase = String(state?.phase || roomState || GAME_PHASE.IDLE).toLowerCase();
  const viewerRole = String(state?.viewer_role || VIEWER_ROLE.PLAYER).toLowerCase();
  const connectionStatus = normalizedConnectionState(me?.connection_state);
  const reconnect = buildReconnectModel(state, me);
  const interaction = deriveInteractionLock(state, me, reconnect, viewerRole);
  const flowEvents = flowEventsFromState(state);
  const latestFlowEvent = latestFlowEventFromState(state);

  if (selectedCardIndex === null && appState.selectedCardIndex !== null) {
    appState.selectedCardIndex = null;
  }

  return {
    connectionStatus,
    roomState,
    gamePhase,
    viewerRole,
    isReadOnly: viewerRole !== VIEWER_ROLE.PLAYER,
    interactionLocked: Boolean(interaction.locked),
    interactionLockReason: interaction.reason || "",
    me,
    hostPlayer,
    currentTurnPlayer,
    playerList: players,
    myHand: Array.isArray(me?.hand) ? me.hand : [],
    legalMoves,
    selectedCardIndex,
    pendingAction,
    trickHoldSeconds: trickHoldRemainingSeconds(state),
    playedCards: Array.isArray(state?.current_trick) ? state.current_trick : [],
    trickResultSummary: buildTrickResultSummary(state),
    roundResultSummary: buildRoundResultSummary(state),
    ruleSummary: buildRuleSummary(state, me, currentTurnPlayer),
    roundInfoSummary: buildRoundInfoSummary(state, me, currentTurnPlayer),
    predictionSummary: buildPredictionSummary(state, me),
    syncSummary: buildSyncSummary(state, reconnect, interaction, latestFlowEvent, me, currentTurnPlayer),
    currentTurnLabel: currentTurnPlayer ? currentTurnPlayer.name : "-",
    connectionLabel: connectionStateLabel(connectionStatus),
    trickSummaryTitle: Array.isArray(state?.last_trick) && state.last_trick.length ? "Last Trick" : "Trick Result",
    reconnect,
    flowEvents,
    latestFlowEvent,
  };
}

function scoreStatusLabel(player, scoreRow) {
  const bid = player?.bid;
  const won = Number(player?.tricks_won || 0);
  if (bid === null || bid === undefined) {
    return "Pending";
  }
  const success = typeof scoreRow?.success === "boolean" ? scoreRow.success : Number(bid) === won;
  return success ? "Success" : "Fail";
}

async function onLobbyAction() {
  const game = appState.game;
  if (!game) {
    return;
  }
  const uiModel = appState.uiModel || deriveUiModel(game);
  if (uiModel.interactionLocked) {
    showToast(uiModel.interactionLockReason || "지금은 조작할 수 없어.");
    return;
  }
  const me = resolveCurrentPlayer(game);
  if (!me) {
    return;
  }
  const status = String(game.status || "").toLowerCase();
  const isHost = String(me.id || "") === String(game.host_id || "");
  if (isHost) {
    await onStartRound();
    return;
  }
  if (status === "waiting_round") {
    showToast("다음 라운드는 호스트가 시작합니다.");
    return;
  }
  const currentState = normalizeLobbyPlayerState(me.state);
  const nextState = currentState === "ready" ? "not_ready" : "ready";
  await setMyLobbyState(nextState);
}

function applyOptimisticLobbyState(nextState) {
  const liveGame = appState.game;
  if (!liveGame || !Array.isArray(liveGame.players)) {
    return null;
  }
  const myId = String(appState.playerId || "");
  const me = resolveCurrentPlayer(liveGame);
  const resolvedId = String(me?.id || myId);
  const target = liveGame.players.find((player) => String(player?.id || "") === resolvedId);
  if (!target) {
    return null;
  }
  const previousState = String(target.state || "not_ready");
  target.state = nextState;
  appState.uiModel = deriveUiModel(liveGame);
  requestRender();
  return {
    playerId: resolvedId,
    previousState,
  };
}

function rollbackOptimisticLobbyState(snapshot) {
  if (!snapshot || !appState.game || !Array.isArray(appState.game.players)) {
    return;
  }
  const target = appState.game.players.find((player) => String(player?.id || "") === String(snapshot.playerId || ""));
  if (!target) {
    return;
  }
  target.state = snapshot.previousState || "not_ready";
  appState.uiModel = deriveUiModel(appState.game);
  requestRender();
}

async function setMyLobbyState(nextState) {
  if (!appState.sessionId || isPendingAction()) {
    return;
  }
  const uiModel = appState.uiModel || deriveUiModel(appState.game);
  if (uiModel.interactionLocked) {
    showToast(uiModel.interactionLockReason || "지금은 조작할 수 없어.");
    return;
  }
  const liveStatus = String(appState.game?.status || "").toLowerCase();
  if (liveStatus === "waiting_round") {
    showToast("다음 라운드는 호스트가 시작합니다.");
    await refreshState({ longPoll: false, full: true }).catch(() => {});
    return;
  }
  if (!["lobby", "finished"].includes(liveStatus)) {
    await refreshState({ longPoll: false, full: true }).catch(() => {});
    return;
  }
  setPendingAction(PENDING_ACTION_KIND.ROOM_STATE, { key: `${appState.sessionId}:${nextState}` });
  const optimisticSnapshot = applyOptimisticLobbyState(nextState);
  try {
    const state = await post(`/activity/sessions/${appState.sessionId}/player-state?compact=true`, {
      player_id: appState.playerId,
      state: nextState,
    });
    applyServerState(state, { replaceLogs: true });
    showToast(nextState === "ready" ? "Ready 완료" : "Ready 취소");
  } catch (error) {
    rollbackOptimisticLobbyState(optimisticSnapshot);
    showToast(error.message || "상태 변경 실패");
  } finally {
    clearPendingAction(PENDING_ACTION_KIND.ROOM_STATE);
  }
}

async function onLobbyBack() {
  const activePendingKind = String(appState.pendingAction?.kind || "");
  if (activePendingKind === PENDING_ACTION_KIND.LEAVE_ROOM) {
    return;
  }
  const leavingSessionId = String(appState.sessionId || "");
  const leavingPlayerId = String(appState.playerId || "");
  const leavingDiscordUserId = String(appState.discordUserId || "");
  if (activePendingKind) {
    clearPendingAction();
  }
  setPendingAction(PENDING_ACTION_KIND.LEAVE_ROOM, { key: leavingSessionId });
  onLeaveToHome();
  try {
    if (leavingSessionId) {
      await post(`/activity/sessions/${leavingSessionId}/leave`, {
        player_id: leavingPlayerId,
      }).catch(() => {});
    }
    await clearViewerActivitySession(leavingPlayerId, leavingDiscordUserId);
  } finally {
    clearPendingAction(PENDING_ACTION_KIND.LEAVE_ROOM);
  }
}

async function onGameForfeit() {
  const sessionId = String(appState.sessionId || "");
  const playerId = String(appState.playerId || "");
  const discordUserId = String(appState.discordUserId || "");
  const status = String(appState.game?.status || "").toLowerCase();
  if (!sessionId || !playerId || isPendingAction()) {
    return;
  }
  if (!["bidding", "playing", "waiting_round"].includes(status)) {
    showToast("지금은 기권할 수 있는 게임 상태가 아니야.");
    return;
  }
  const now = Date.now();
  if (Number(appState.forfeitConfirm?.armedUntil || 0) <= now) {
    if (appState.forfeitConfirm?.timer) {
      clearTimeout(appState.forfeitConfirm.timer);
    }
    appState.forfeitConfirm.armedUntil = now + 5000;
    appState.forfeitConfirm.timer = setTimeout(() => {
      appState.forfeitConfirm.armedUntil = 0;
      appState.forfeitConfirm.timer = null;
      requestRender();
    }, 5000);
    requestRender();
    showToast("5초 안에 기권 버튼을 한 번 더 누르면 즉시 기권합니다.");
    return;
  }

  if (appState.forfeitConfirm?.timer) {
    clearTimeout(appState.forfeitConfirm.timer);
    appState.forfeitConfirm.timer = null;
  }
  appState.forfeitConfirm.armedUntil = 0;
  setPendingAction(PENDING_ACTION_KIND.LEAVE_ROOM, { key: `forfeit:${sessionId}:${playerId}` });
  try {
    await runWithSplash("기권 처리 중...", async () => {
      await post(`/activity/sessions/${sessionId}/leave`, {
        player_id: playerId,
      });
    });
    await clearViewerActivitySession(playerId, discordUserId);
    onLeaveToHome();
    showToast("기권 처리했어. 홈으로 돌아갈게.");
  } catch (error) {
    showToast(error.message || "기권 처리 실패");
    await refreshState({ longPoll: false, full: true }).catch(() => {});
  } finally {
    clearPendingAction(PENDING_ACTION_KIND.LEAVE_ROOM);
  }
}

async function onLobbyInvite() {
  if (appState.inviteDialogPending) {
    return;
  }
  const sdk = appState.sdk;
  const openInviteDialog = sdk?.commands?.openInviteDialog;
  if (!sdk || !appState.discordReady || typeof openInviteDialog !== "function") {
    showToast("Discord Activity 안에서만 친구 초대가 가능해.");
    return;
  }
  appState.inviteDialogPending = true;
  try {
    await openInviteDialog();
  } catch (error) {
    console.error("[SkullKing][InviteDialogFailed]", error);
    showToast(error?.message || "초대 창을 열지 못했어.");
  } finally {
    appState.inviteDialogPending = false;
  }
}

async function onStartRound(options = {}) {
  const auto = Boolean(options?.auto);
  if (!appState.sessionId || isPendingAction()) {
    return false;
  }
  const uiModel = appState.uiModel || deriveUiModel(appState.game);
  if (uiModel.interactionLocked) {
    if (!auto) {
      showToast(uiModel.interactionLockReason || "지금은 조작할 수 없어.");
    }
    return false;
  }
  setPendingAction(PENDING_ACTION_KIND.START_ROUND, {
    key: `${appState.sessionId}:${appState.game?.round_number || 0}:${auto ? "auto" : "manual"}`,
  });

  try {
    const precheckError = validateStartPreconditions(appState.game, resolveCurrentPlayer(appState.game));
    if (precheckError) {
      if (!auto) {
        showToast(precheckError);
      }
      return false;
    }

    const startTask = async () => {
      const state = await post(`/activity/sessions/${appState.sessionId}/start?compact=true`, {
        player_id: appState.playerId,
      });
      applyServerState(state, { replaceLogs: true });
    };
    if (auto) {
      await startTask();
    } else {
      await runWithSplash("항해 시작 중...", startTask, ACTION_SPLASH_MIN_VISIBLE_MS);
      showToast("라운드를 시작했어.");
    }
    return true;
  } catch (error) {
    const safeDetail = String(error?.detail || error?.message || "");
    const isExpectedAutoBlock =
      auto &&
      (error?.status === 400 || error?.status === 403) &&
      /호스트만|Ready|current round is not finished|current trick is not finished|방 상태|session not found/i.test(safeDetail);
    if (!auto || !isExpectedAutoBlock) {
      showToast(error.message || "시작 실패");
    }
    await refreshState({ longPoll: false, full: true }).catch(() => {});
    return false;
  } finally {
    clearPendingAction(PENDING_ACTION_KIND.START_ROUND);
  }
}

function validateStartPreconditions(game, me) {
  if (!game || !me) {
    return "방 상태를 확인할 수 없습니다.";
  }
  const isHost = String(me.id || "") === String(game.host_id || "");
  if (!isHost) {
    return "호스트만 Start를 누를 수 있습니다.";
  }
  const players = Array.isArray(game.players) ? game.players : [];
  if (players.length < 2) {
    return "2인 이상이서 Start 할 수 있습니다.";
  }
  const status = String(game.status || "").toLowerCase();
  if (status === "waiting_round") {
    return "";
  }
  const nonHost = players.filter((p) => String(p.id || "") !== String(game.host_id || ""));
  const notReady = nonHost.filter((p) => normalizeLobbyPlayerState(p.state) !== "ready");
  if (notReady.length > 0) {
    return "Ready를 하지 않은 플레이어가 있습니다.";
  }
  return "";
}

async function onSubmitBid(forcedBid = null) {
  if (!appState.sessionId || isPendingAction()) {
    return;
  }
  const uiModel = appState.uiModel || deriveUiModel(appState.game);
  if (uiModel.interactionLocked) {
    showToast(uiModel.interactionLockReason || "지금은 조작할 수 없어.");
    return;
  }
  const canBidNow =
    String(uiModel?.roomState || "").toLowerCase() === ROOM_STATUS.BIDDING &&
    uiModel?.me &&
    (uiModel.me.bid === null || uiModel.me.bid === undefined);
  if (!canBidNow) {
    await refreshState({ longPoll: false, full: true }).catch(() => {});
    return;
  }

  const bid = forcedBid ?? Number(bidDialogInput?.value);
  if (!Number.isInteger(bid) || bid < 0) {
    showToast("배팅 숫자를 확인해줘.");
    return;
  }
  const viewerPlayerId = String(uiModel?.me?.id || appState.playerId || "");

  setPendingAction(PENDING_ACTION_KIND.SUBMIT_BID, {
    key: `${appState.sessionId}:${appState.game?.round_number || 0}:${bid}`,
  });
  try {
    closeBidDialog();
    const optimisticPlayer = Array.isArray(appState.game?.players)
      ? appState.game.players.find((player) => String(player?.id || "") === viewerPlayerId)
      : null;
    if (optimisticPlayer) {
      optimisticPlayer.bid = bid;
      appState.uiModel = deriveUiModel(appState.game);
      requestRender();
    }
    const state = await post(`/activity/sessions/${appState.sessionId}/bid?compact=true`, {
      player_id: viewerPlayerId,
      bid,
      request_id: crypto.randomUUID(),
    });
    applyServerState(state, { replaceLogs: true });
    showToast("배팅 제출 완료");
  } catch (error) {
    if (error?.status === 409) {
      showToast(error.message || "배팅 상태가 바뀌어 다시 동기화했어.");
      await refreshState({ longPoll: false, full: true }).catch(() => {});
      return;
    }
    showToast(error.message || "배팅 실패");
    await refreshState({ longPoll: false, full: true }).catch(() => {});
  } finally {
    clearPendingAction(PENDING_ACTION_KIND.SUBMIT_BID);
  }
}

function stopPolling() {
  if (appState.pollingActive) {
    logTransport("poll-stop", { mode: appState.pollingMode || "off" });
  }
  appState.pollingActive = false;
  appState.pollingMode = "off";
  appState.pollToken += 1;
  if (appState.pollingTimer) {
    clearTimeout(appState.pollingTimer);
    appState.pollingTimer = null;
  }
}

function startPolling(options = {}) {
  if (!appState.sessionId) {
    return;
  }
  const mode = options.longPoll === false ? "short" : "long";
  const forceFull = options.full === undefined ? shouldForceFullStateRefresh() : Boolean(options.full);
  if (appState.pollingActive && appState.pollingMode === mode) {
    return;
  }
  logTransport("poll-start", { mode, forceFull, immediate: Boolean(options.immediate) });
  stopPolling();
  appState.pollingActive = true;
  appState.pollingMode = mode;
  const token = ++appState.pollToken;

  const scheduleNextTick = (delayMs) => {
    if (!appState.pollingActive || token !== appState.pollToken || !appState.sessionId) {
      return;
    }
    if (appState.pollingTimer) {
      clearTimeout(appState.pollingTimer);
    }
    appState.pollingTimer = setTimeout(runTick, Math.max(0, Number(delayMs || 0)));
  };

  const runTick = async () => {
    if (!appState.pollingActive || token !== appState.pollToken || !appState.sessionId) {
      return;
    }
    appState.pollingTimer = null;
    try {
      await refreshState({ longPoll: mode === "long", full: forceFull });
      if (mode === "short") {
        stopPolling();
        return;
      }
      scheduleNextTick(STATE_POLL_RESUME_MS);
    } catch (_) {
      scheduleNextTick(STATE_POLL_RETRY_MS);
    }
  };

  scheduleNextTick(Boolean(options.immediate) ? 0 : STATE_POLL_RESUME_MS);
}

function stopStateWebSocket() {
  const ws = appState.ws;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    logTransport("ws-stop", {
      readyState: ws.readyState,
      url: String(ws.url || ""),
    });
  }
  appState.wsActive = false;
  appState.wsToken += 1;
  clearPendingPingProbe();
  if (appState.wsFallbackTimer) {
    clearTimeout(appState.wsFallbackTimer);
    appState.wsFallbackTimer = null;
  }
  if (appState.wsReconnectTimer) {
    clearTimeout(appState.wsReconnectTimer);
    appState.wsReconnectTimer = null;
  }
  appState.ws = null;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    try {
      ws.close();
    } catch (_) {}
  }
}

function makeWsBaseUrl() {
  const base = String(appState.apiBase || window.location.origin || "").trim();
  if (base.startsWith("https://")) return `wss://${base.slice("https://".length)}`;
  if (base.startsWith("http://")) return `ws://${base.slice("http://".length)}`;
  if (base.startsWith("wss://") || base.startsWith("ws://")) return base;
  return window.location.origin.replace(/^http/, "ws");
}

function buildIdentityHeaders(sessionId = appState.sessionId) {
  const identityToken = getRememberedIdentityToken(sessionId);
  if (!identityToken) {
    return {};
  }
  return {
    "X-Sk-Activity-Identity": identityToken,
  };
}

function scheduleWsReconnect() {
  if (!appState.sessionId || appState.wsReconnectTimer) {
    return;
  }
  const attempt = Math.max(0, Number(appState.wsReconnectAttempt || 0));
  const delayMs = Math.min(15000, 1000 * Math.pow(2, attempt));
  appState.wsReconnectAttempt = attempt + 1;
  logTransport("ws-reconnect-scheduled", { attempt: attempt + 1, delayMs });
  appState.wsReconnectTimer = setTimeout(() => {
    appState.wsReconnectTimer = null;
    startStateWebSocket();
  }, delayMs);
}

function startStateWebSocket() {
  if (!appState.sessionId) {
    return;
  }
  const connectSeq = Number(appState.transport.wsAttemptSeq || 0) + 1;
  appState.transport.wsAttemptSeq = connectSeq;
  appState.transport.wsConnectingSessionId = String(appState.sessionId || "");
  appState.transport.wsConnectStartedAt = Date.now();
  stopStateWebSocket();
  stopPolling();
  appState.wsActive = true;
  const token = ++appState.wsToken;
  const wsBase = makeWsBaseUrl();
  const wsUrl =
    `${wsBase}/ws/activity/sessions/${encodeURIComponent(appState.sessionId)}` +
    `?player_id=${encodeURIComponent(appState.playerId)}` +
    `&discord_user_id=${encodeURIComponent(appState.discordUserId || "")}` +
    `&identity_token=${encodeURIComponent(getRememberedIdentityToken(appState.sessionId) || "")}` +
    `&compact=true`;
  logTransport("ws-start", {
    connectSeq,
    token,
    url: wsUrl,
  });

  let switchedToReconnect = false;
  const fallbackToReconnect = (reason = "unknown", extra = {}) => {
    if (switchedToReconnect || token !== appState.wsToken) {
      return;
    }
    switchedToReconnect = true;
    const openDurationMs = appState.transport.wsOpenedAt > 0
      ? Date.now() - Number(appState.transport.wsOpenedAt || 0)
      : 0;
    logTransport("ws-fallback", {
      reason,
      connectSeq,
      token,
      openDurationMs,
      ...extra,
    });
    stopStateWebSocket();
    startPolling({ immediate: true, longPoll: true, full: shouldForceFullStateRefresh() });
    scheduleWsReconnect();
  };

  try {
    const ws = new WebSocket(wsUrl);
    appState.ws = ws;
    ws.onopen = () => {
      if (!appState.wsActive || token !== appState.wsToken) {
        return;
      }
      appState.transport.wsOpenedAt = Date.now();
      appState.transport.wsConnectedSessionId = String(appState.sessionId || "");
      appState.transport.wsTerminalReason = "";
      appState.wsReconnectAttempt = 0;
      if (appState.wsFallbackTimer) {
        clearTimeout(appState.wsFallbackTimer);
        appState.wsFallbackTimer = null;
      }
      logTransport("ws-open", {
        connectSeq,
        token,
      });
      stopPolling();
      probePing().catch(() => {});
    };
    ws.onmessage = (event) => {
      if (!appState.wsActive || token !== appState.wsToken) {
        return;
      }
      try {
        const payload = JSON.parse(String(event.data || "{}"));
        if (payload?.type === "pong") {
          handleWsPong(payload);
          return;
        }
        if (payload?.type === "session_not_found") {
          markWsTerminal("session_not_found");
          showToast("방이 더 이상 존재하지 않아 홈으로 돌아갈게.");
          onLeaveToHome();
          return;
        }
        if (payload?.type === "access_denied") {
          markWsTerminal("access_denied");
          showToast("관전자 정책 또는 세션 권한이 변경되었습니다.");
          onLeaveToHome();
          return;
        }
        if (payload?.type !== "state" || !payload?.data) {
          return;
        }
        ingestServerState(payload.data, { replaceLogs: false });
      } catch (error) {
        console.warn("[SkullKing][WSParse]", error);
      }
    };
    ws.onerror = (event) => {
      logTransport("ws-error", {
        connectSeq,
        token,
        eventType: String(event?.type || "error"),
      });
      fallbackToReconnect("error", { eventType: String(event?.type || "error") });
    };
    ws.onclose = (event) => {
      const openDurationMs = appState.transport.wsOpenedAt > 0
        ? Date.now() - Number(appState.transport.wsOpenedAt || 0)
        : 0;
      appState.transport.lastWsCloseAt = Date.now();
      appState.transport.lastWsCloseCode = Number(event?.code || 0);
      appState.transport.lastWsCloseReason = String(event?.reason || "");
      logTransport("ws-close", {
        connectSeq,
        token,
        code: Number(event?.code || 0),
        reason: String(event?.reason || ""),
        wasClean: Boolean(event?.wasClean),
        openDurationMs,
        terminalReason: String(appState.transport.wsTerminalReason || ""),
      });
      if (Number(event?.code || 0) === 1008 && String(appState.transport.wsTerminalReason || "")) {
        logTransport("ws-terminal-close", {
          connectSeq,
          token,
          code: Number(event?.code || 0),
          terminalReason: String(appState.transport.wsTerminalReason || ""),
        });
        stopStateWebSocket();
        return;
      }
      const quickClose = openDurationMs > 0 && openDurationMs <= WS_QUICK_CLOSE_THRESHOLD_MS;
      fallbackToReconnect(quickClose ? "quick-close" : "close", {
        code: Number(event?.code || 0),
        reason: String(event?.reason || ""),
        wasClean: Boolean(event?.wasClean),
        openDurationMs,
      });
    };
    // If open never happens, fallback quickly.
    appState.wsFallbackTimer = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        fallbackToReconnect("open-timeout", { readyState: ws.readyState });
      }
    }, WS_OPEN_TIMEOUT_MS);
  } catch (_) {
    fallbackToReconnect("constructor-error");
  }
}

async function refreshState(options = {}) {
  if (!appState.sessionId) {
    return;
  }
  if (appState.stateRequestPromise) {
    return appState.stateRequestPromise;
  }
  const longPoll = Boolean(options.longPoll);
  const forceFull = Boolean(options.full);
  const compact = !forceFull && appState.statePayloadMode === "compact";
  const requestSessionId = String(appState.sessionId || "");
  const requestSeq = ++appState.stateRequestSeq;

  appState.stateRequestPromise = (async () => {
    try {
      const waitMs = longPoll ? STATE_LONG_POLL_WAIT_MS : 0;
      const since = longPoll ? Number(appState.lastServerUpdatedAt || 0) : 0;
      logTransport("state-request", {
        requestSeq,
        longPoll,
        forceFull,
        compact,
        since,
        waitMs,
      });
      const state = await get(
        `/activity/sessions/${requestSessionId}/state?player_id=${encodeURIComponent(appState.playerId)}&discord_user_id=${encodeURIComponent(appState.discordUserId || "")}&since=${encodeURIComponent(String(since))}&wait_ms=${encodeURIComponent(String(waitMs))}&compact=${compact ? "true" : "false"}`,
        { measurePing: !longPoll },
      );
      if (String(appState.sessionId || "") !== requestSessionId || requestSeq !== appState.stateRequestSeq) {
        return;
      }
      logTransport("state-response", {
        requestSeq,
        updatedAt: stateRevisionFromPayload(state),
        status: String(state?.status || ""),
      });
      ingestServerState(state, { replaceLogs: !compact });
    } catch (error) {
      if (String(appState.sessionId || "") !== requestSessionId) {
        return;
      }
      logTransport("state-error", {
        requestSeq,
        status: Number(error?.status || 0),
        detail: String(error?.detail || error?.message || ""),
      });
      if (error?.status === 404) {
        showToast("방이 더 이상 존재하지 않아 홈으로 돌아갈게.");
        onLeaveToHome();
        return;
      }
      if (error?.status === 403) {
        markWsTerminal("state_forbidden");
        stopStateWebSocket();
        stopPolling();
        showToast("세션 권한이 만료되었어. 다시 입장해줘.");
        onLeaveToHome();
        return;
      }
      throw error;
    } finally {
      appState.stateRequestPromise = null;
    }
  })();

  return appState.stateRequestPromise;
}

function render() {
  const game = appState.game;
  if (!game) {
    return;
  }
  const expectedView = deriveViewFromState(game);
  if (expectedView !== appState.currentView) {
    setView(expectedView);
  }

  const uiModel = deriveUiModel(game);
  appState.uiModel = uiModel;
  const normalizedStatus = String(game.status || "").toLowerCase();
  const inGame = ["bidding", "playing", "waiting_round", "finished"].includes(normalizedStatus);
  const lobbyVisible = !lobbyPanel.classList.contains("hidden");
  const gameVisible = !gamePanel.classList.contains("hidden");

  if (lobbyVisible) {
    renderRoomScreen(game, uiModel);
  }

  if (gameVisible) {
    const clock = updateTurnClock(game, uiModel.me, uiModel.currentTurnPlayer);
    renderGameTable(game, uiModel, clock);
  }

  const showHomePanel = !homePanel.classList.contains("hidden");
}

function renderRoomScreen(game, uiModel) {
  const bonusEnabled = Boolean(game.settings?.bonus_enabled);
  const reconnectGrace = Number(game.reconnect_grace_seconds || uiModel.me?.reconnect_grace_seconds || 0);
  const readOnlyText = uiModel.isReadOnly ? " · Read-only Spectator" : "";
  const lockText = uiModel.interactionLocked && !uiModel.isReadOnly ? " · 입력 잠금" : "";
  if (lobbyInfo) {
    lobbyInfo.textContent =
      `세션: ${game.session_id} · 상태: ${game.status}${readOnlyText}${lockText}` +
      ` · Bonus: ${bonusEnabled ? "On" : "Off"} · ${spectatorPolicyLabel(game)}` +
      `${reconnectGrace > 0 ? ` · Reconnect Grace ${reconnectGrace}s` : ""}`;
  }
  syncLobbySettingsUi(game);

  const isHost =
    (uiModel.me && String(uiModel.me.id) === String(game.host_id || "")) ||
    (!game.host_id && uiModel.me && game.players?.[0]?.id === uiModel.me.id);
  const meState = normalizeLobbyPlayerState(uiModel.me?.state);
  const maxRounds = Number(game.settings?.max_rounds || 10);
  const reachedMaxRound = Number(game.round_number || 0) >= maxRounds;
  const normalizedStatus = String(game.status || "").toLowerCase();
  const inLobbyLike = ["lobby", "waiting_round", "finished"].includes(normalizedStatus);
  const waitingRound = normalizedStatus === "waiting_round";
  const finished = normalizedStatus === "finished";
  const nonHostPlayers = (game.players || []).filter((player) => String(player.id || "") !== String(game.host_id || ""));
  const allNonHostReady = areAllLobbyPlayersReady(nonHostPlayers);
  const hasMinimumPlayers = Array.isArray(game.players) && game.players.length >= 2;

  if (uiModel.isReadOnly) {
    startBtn.textContent = "Read-only";
    startBtn.disabled = true;
    startBtn.title = "관전자 모드에서는 조작할 수 없습니다.";
  } else if (isHost) {
    startBtn.textContent = waitingRound ? "Auto Next Round" : "Start";
    startBtn.disabled =
      (!finished && reachedMaxRound) ||
      !inLobbyLike ||
      uiModel.interactionLocked ||
      isPendingAction(PENDING_ACTION_KIND.START_ROUND) ||
      (!waitingRound && (!hasMinimumPlayers || !allNonHostReady));
    startBtn.title = uiModel.interactionLocked
      ? uiModel.interactionLockReason
      : !hasMinimumPlayers
        ? "2인 이상이 모여야 시작할 수 있어요."
      : waitingRound
        ? "마지막 라운드 전까지는 호스트 클라이언트가 자동으로 다음 라운드를 시작합니다."
        : finished
          ? "새 게임을 시작하면 점수와 라운드가 초기화됩니다."
        : allNonHostReady
          ? ""
          : "전원이 Ready여야 시작할 수 있어요.";
  } else {
    startBtn.textContent = waitingRound ? "Waiting" : meState === "ready" ? "Cancel" : "Ready";
    startBtn.disabled =
      waitingRound ||
      !inLobbyLike ||
      uiModel.interactionLocked ||
      isPendingAction(PENDING_ACTION_KIND.ROOM_STATE);
    startBtn.title = uiModel.interactionLocked
      ? uiModel.interactionLockReason
      : waitingRound
        ? "다음 라운드는 호스트가 시작합니다."
        : "";
  }

  const settings = game.settings || {};
  const turnLimit = Number(settings.turn_limit_seconds || game.turn_limit_seconds || TURN_LIMIT_SECONDS);
  const summaryParts = [
    `세션 ${String(game.session_id || "-").toUpperCase()}`,
    `상태 ${String(game.status || "-")}`,
    spectatorPolicyLabel(game),
  ];
  if (uiModel.isReadOnly) {
    summaryParts.push("Read-only");
  }
  if (uiModel.interactionLocked && !uiModel.isReadOnly) {
    summaryParts.push("입력 잠금");
  }
  if (reconnectGrace > 0) {
    summaryParts.push(`Reconnect Grace ${reconnectGrace}s`);
  }

  const settingsLine = [
    `Timer ${turnLimit}s`,
    `Bonus ${Boolean(settings.bonus_enabled) ? "On" : "Off"}`,
    `Advanced ${Boolean(settings.advanced_rules_enabled) ? "On" : "Off"}`,
    `Spectators ${Boolean(settings.allow_spectators) ? "On" : "Off"}`,
  ].join(" · ");

  let actionHint = "";
  if (uiModel.interactionLocked) {
    actionHint = uiModel.interactionLockReason || "";
  } else if (!hasMinimumPlayers) {
    actionHint = "2인 이상이 모여야 시작할 수 있어요.";
  } else if (waitingRound && isHost) {
    actionHint = "다음 라운드는 호스트가 자동으로 이어서 시작합니다.";
  } else if (!isHost && waitingRound) {
    actionHint = "다음 라운드는 호스트가 시작합니다.";
  } else if (isHost && !allNonHostReady) {
    actionHint = "전원이 Ready 상태여야 시작할 수 있어요.";
  } else if (finished) {
    actionHint = "새 게임을 시작하면 점수와 라운드가 초기화됩니다.";
  }

  setReactUiState({
    lobbyModel: {
      heading: isHost ? "Host Control" : "Crew Status",
      summary: summaryParts.join(" · "),
      settingsLine,
      actionHint,
    },
  });
}

function renderGameTable(game, uiModel, clock) {
  const bidPendingCount = game.players.filter((player) => player.bid === null).length;
  const timeLeft = Number(clock?.holdActive ? clock?.holdSecondsLeft : clock?.secondsLeft ?? 0);
  const meTurn = uiModel.currentTurnPlayer && String(uiModel.currentTurnPlayer.id || "") === String(appState.playerId || "");
  const timeoutText = /timeout/i.test(String(game.latest_log || "")) ? " · 자동 플레이/베팅 반영" : "";
  const meAfk = uiModel.me && Boolean(uiModel.me.afk);
  const urgencyText = timeLeft <= 5 ? " · Timeout 임박" : "";
  const reconnectGrace = Number(game.reconnect_grace_seconds || uiModel.me?.reconnect_grace_seconds || 0);
  const isHost =
    (uiModel.me && String(uiModel.me.id) === String(game.host_id || "")) ||
    (!game.host_id && uiModel.me && game.players?.[0]?.id === uiModel.me.id);

  roundTitle.textContent = roundTitleLabel(game);
  renderTurnProgress(game, clock);
  renderGameMiniSummary(game, uiModel);

  const maxRounds = Number(game.settings?.max_rounds || 10);
  const reachedMaxRound = Number(game.round_number || 0) >= maxRounds;
  const autoRoundPending = game.status === ROOM_STATUS.WAITING_ROUND && !reachedMaxRound && isHost && !uiModel.isReadOnly;
  const canForfeit =
    Boolean(appState.sessionId) &&
    Boolean(appState.playerId) &&
    uiModel.viewerRole === VIEWER_ROLE.PLAYER &&
    !uiModel.isReadOnly &&
    String(game.status || "").toLowerCase() !== ROOM_STATUS.FINISHED;
  if (!canForfeit && appState.forfeitConfirm?.armedUntil) {
    if (appState.forfeitConfirm.timer) {
      clearTimeout(appState.forfeitConfirm.timer);
      appState.forfeitConfirm.timer = null;
    }
    appState.forfeitConfirm.armedUntil = 0;
  }
  const forfeitArmed = Number(appState.forfeitConfirm?.armedUntil || 0) > Date.now();
  if (gameForfeitBtn) {
    gameForfeitBtn.classList.toggle("hidden", !canForfeit);
    gameForfeitBtn.disabled = !canForfeit || isPendingAction();
    gameForfeitBtn.textContent = isPendingAction(PENDING_ACTION_KIND.LEAVE_ROOM)
      ? "기권 처리 중..."
      : forfeitArmed
        ? "한 번 더 누르면 기권"
        : "기권";
    gameForfeitBtn.title = canForfeit
      ? (forfeitArmed ? "5초 안에 다시 누르면 즉시 게임에서 이탈합니다." : "현재 게임을 포기하고 홈으로 돌아갑니다.")
      : "";
  }
  nextRoundBtn.classList.add("hidden");
  nextRoundBtn.disabled = true;
  nextRoundBtn.textContent = autoRoundPending ? "자동으로 다음 라운드 준비 중" : "다음 라운드 시작";
  nextRoundBtn.title = autoRoundPending ? "호스트 클라이언트가 자동으로 다음 라운드를 시작합니다." : "";

  renderTrickCenter(game, timeLeft);
  renderPlayerRing(game, clock?.holdActive ? null : uiModel.currentTurnPlayer);
  renderScoreboard(game);
  renderLogs(game.logs || []);
  renderHandFan(game, uiModel);
  renderInteractionHud(game, uiModel);
  renderBettingPanel(game, uiModel);
  renderReconnectOverlay(uiModel);
  renderRoundResultModal(uiModel);
}

function renderGameMiniSummary(game, uiModel) {
  const me = uiModel?.me || resolveCurrentPlayer(game);
  const bid = me?.bid === null || me?.bid === undefined ? "-" : String(me.bid);
  const won = Number(me?.tricks_won || 0);
  const score = Number(me?.score || 0);
  const myId = String(me?.id || appState.playerId || "");
  const currentTurnId = String(uiModel?.currentTurnPlayer?.id || game?.current_turn_player_id || "");
  const isMyTurn = Boolean(myId)
    && Boolean(currentTurnId)
    && myId === currentTurnId
    && String(game?.status || "").toLowerCase() === ROOM_STATUS.PLAYING
    && trickHoldRemainingSeconds(game) <= 0;
  document.querySelector("#gamePanel .game-mini-topbar")?.classList.toggle("is-turn", isMyTurn);
  if (gameMiniBidValue) {
    gameMiniBidValue.textContent = bid;
  }
  if (gameMiniWonValue) {
    gameMiniWonValue.textContent = String(won);
  }
  if (gameMiniScoreValue) {
    gameMiniScoreValue.textContent = String(score);
  }
}

function renderPhaseHud(game, uiModel, timeLeft) {
  const preBidLeft = preBidDelayRemainingSeconds(game);
  const trickHoldLeft = trickHoldRemainingSeconds(game);
  const biddingPhase = String(game.status || "").toLowerCase() === ROOM_STATUS.BIDDING;
  if (phaseBadge) {
    phaseBadge.textContent = trickHoldLeft > 0
      ? `Phase · trick resolve ${trickHoldLeft}s`
      : preBidLeft > 0
      ? `Phase · inspect hand ${preBidLeft}s`
      : `Phase · ${String(game.phase || game.status || "-").replaceAll("_", " ")}`;
  }
  if (turnBadge) {
    turnBadge.textContent = trickHoldLeft > 0
      ? `Resolve · next trick in ${trickHoldLeft}s`
      : biddingPhase ? "Bid · simultaneous" : `Turn · ${uiModel.currentTurnLabel || "-"}`;
    turnBadge.classList.toggle("warn", trickHoldLeft <= 0 && !biddingPhase && Boolean(uiModel.currentTurnPlayer) && timeLeft <= 5);
  }
  if (connectionBadge) {
    connectionBadge.textContent = `Link · ${uiModel.connectionLabel}${uiModel.me?.afk ? " / AFK" : ""}`;
    connectionBadge.classList.toggle("warn", uiModel.connectionStatus === CONNECTION_STATUS.RECONNECTING);
    connectionBadge.classList.toggle("danger", uiModel.connectionStatus === CONNECTION_STATUS.DISCONNECTED);
    connectionBadge.classList.toggle("soft-lock", uiModel.interactionLocked && !uiModel.isReadOnly);
  }
}

function renderReconnectOverlay(uiModel) {
  if (!reconnectOverlay) {
    return;
  }
  reconnectOverlay.classList.toggle("hidden", !uiModel.reconnect.visible);
  reconnectOverlay.classList.toggle("hard-block", Boolean(uiModel.reconnect.hardBlock));
  if (reconnectTitle) {
    reconnectTitle.textContent = uiModel.reconnect.title || "Connected";
  }
  if (reconnectBody) {
    reconnectBody.textContent = uiModel.reconnect.body || "";
  }
}

function renderRoundResultModal(uiModel) {
  if (!roundResultDialog || !roundResultTitle || !roundResultBody) {
    return;
  }
  if (!uiModel.roundResultSummary) {
    if (roundResultDialog.open) {
      forceCloseDialog(roundResultDialog);
    }
    return;
  }

  const summary = uiModel.roundResultSummary;
  appState.roundResultModal.key = summary.key;
  appState.roundResultModal.title = summary.title;
  appState.roundResultModal.lines = summary.lines.slice();

  roundResultTitle.textContent = summary.title;
  roundResultBody.innerHTML = "";
  const rows = Array.isArray(summary.rows) ? summary.rows : [];
  if (!rows.length) {
    summary.lines.forEach((line) => {
      const item = document.createElement("article");
      item.className = "round-result-line";
      item.textContent = line;
      roundResultBody.appendChild(item);
    });
    if (appState.roundResultModal.dismissedKey !== summary.key) {
      safeOpenDialog(roundResultDialog);
    }
    return;
  }
  const successCount = rows.filter((row) => row.success).length;
  const failCount = rows.length - successCount;
  const overview = document.createElement("div");
  overview.className = "round-result-overview";
  overview.innerHTML = `
    <div class="round-result-overview-card">
      <span class="round-result-overview-label">Players</span>
      <strong>${rows.length}</strong>
    </div>
    <div class="round-result-overview-card">
      <span class="round-result-overview-label">Success</span>
      <strong>${successCount}</strong>
    </div>
    <div class="round-result-overview-card">
      <span class="round-result-overview-label">Miss</span>
      <strong>${failCount}</strong>
    </div>
  `;
  roundResultBody.appendChild(overview);

  rows.forEach((row) => {
    const item = document.createElement("article");
    item.className = `round-result-line ${row.success ? "is-success" : "is-fail"}${row.isMe ? " is-me" : ""}${row.afk ? " is-afk" : ""}`;
    const scoreToneClass = row.delta > 0 ? "is-positive" : row.delta < 0 ? "is-negative" : "is-neutral";
    const stateLabel = row.afk ? "AFK" : row.success ? "Success" : "Miss";
    item.innerHTML = `
      <div class="round-result-line-top">
        <div class="round-result-player-block">
          <div class="round-result-player-name">${escapeHtml(row.playerName)}${row.isMe ? '<span class="round-result-me-tag">YOU</span>' : ""}</div>
          <div class="round-result-player-sub">${escapeHtml(row.bonusText)}</div>
        </div>
        <div class="round-result-score-badge ${scoreToneClass}">${escapeHtml(row.deltaText)}</div>
      </div>
      <div class="round-result-metrics">
        <div class="round-result-metric">
          <span class="round-result-metric-label">Bid</span>
          <strong>${escapeHtml(row.bidText)}</strong>
        </div>
        <div class="round-result-metric">
          <span class="round-result-metric-label">Won</span>
          <strong>${escapeHtml(row.wonText)}</strong>
        </div>
        <div class="round-result-metric">
          <span class="round-result-metric-label">Total</span>
          <strong>${escapeHtml(String(row.score))}</strong>
        </div>
        <div class="round-result-state-pill">${escapeHtml(stateLabel)}</div>
      </div>
    `;
    roundResultBody.appendChild(item);
  });

  if (appState.roundResultModal.dismissedKey !== summary.key) {
    safeOpenDialog(roundResultDialog);
  }
}

function closeRoundResultModal() {
  appState.roundResultModal.dismissedKey = String(appState.roundResultModal.key || "");
  forceCloseDialog(roundResultDialog);
}

function renderBettingPanel(game, uiModel) {
  renderBidPanel(game, uiModel.me, uiModel.currentTurnPlayer);
}

function renderHandFan(game, uiModel) {
  if (appState.selectedCardIndex !== null) {
    appState.selectedCardIndex = null;
  }
  renderHand(game, uiModel.me);
}

function renderPlayerSeat(player, options = {}) {
  const seat = document.createElement("div");
  seat.className = "seat";
  if (options.isSelf) {
    seat.classList.add("seat-self", "me");
  }
  if (options.isCurrentTurn) {
    seat.classList.add("turn");
  }
  if (options.isWinner) {
    seat.classList.add("winner");
  }
  if (options.scale) {
    seat.style.transform = `translate(-50%, -50%) scale(${options.scale})`;
  }
  if (options.left) {
    seat.style.left = options.left;
  }
  if (options.top) {
    seat.style.top = options.top;
  }
  if (options.rotation) {
    seat.style.setProperty("--seat-rot", options.rotation);
  }

  const avatarUrl = options.avatarUrl || "";
  const badgeClass = options.badgeClass || "ready";
  const infoHtml = options.infoClass
    ? `<div class="${options.infoClass}"><div class="${options.nameClass || "seat-name"}">${escapeHtml(player?.name || "Player")}</div>${options.metaHtml || ""}</div>`
    : `<div class="${options.nameClass || "seat-name"}">${escapeHtml(player?.name || "Player")}</div>${options.metaHtml || ""}`;
  seat.innerHTML = `
    ${options.showFan ? '<div class="avatar-fan"><span></span><span></span><span></span><span></span></div>' : ""}
    <div class="${options.avatarClass || "avatar"}">${avatarUrl ? `<img src="${avatarUrl}" alt="${escapeHtml(player?.name || "Player")}" loading="lazy" />` : playerInitial(player?.name)}</div>
    ${options.turnBadge ? `<div class="seat-turn-badge">${escapeHtml(options.turnBadge)}</div>` : ""}
    ${infoHtml}
    ${options.badgeText ? `<div class="${badgeClass}">${escapeHtml(options.badgeText)}</div>` : ""}
  `;
  const avatarEl = seat.querySelector(`.${options.avatarClass || "avatar"}`);
  if (avatarEl && !avatarUrl) {
    avatarEl.style.background = avatarColor(player?.id || player?.name || "?");
  }
  return seat;
}

function renderCard(card, options = {}) {
  const cardEl = document.createElement("div");
  cardEl.className = `${options.className || "hand-card"} ${buildCardVisualClass(card)}`.trim();
  if (Number.isInteger(options.cardIndex)) {
    cardEl.dataset.cardIndex = String(options.cardIndex);
  }
  if (options.selected) {
    cardEl.classList.add("selected");
  }
  if (options.playable) {
    cardEl.classList.add("playable");
  }
  if (options.legal) {
    cardEl.classList.add("legal");
  }
  if (options.blocked) {
    cardEl.classList.add("blocked", "illegal");
  }
  if (options.x != null) {
    cardEl.style.setProperty("--x", `${options.x}px`);
  }
  if (options.y != null) {
    cardEl.style.setProperty("--y", `${options.y}px`);
  }
  if (options.rot != null) {
    cardEl.style.setProperty("--rot", `${options.rot}deg`);
  }
  if (options.zIndex != null) {
    cardEl.style.zIndex = String(options.zIndex);
  }

  if (options.compact) {
    cardEl.innerHTML = buildCompactCardInner(card);
    return cardEl;
  }

  cardEl.innerHTML = buildHandCardInner(card);
  attachCardTilt(cardEl);
  return cardEl;
}

const SUIT_SYMBOLS = { yellow: "🪙", green: "🦜", purple: "🗺️", black: "🏴‍☠️" };
const COMPACT_SUIT_LABELS = { yellow: "Treasure", green: "Parrot", purple: "Map", black: "Black" };
const SPECIAL_ICONS = {
  skull_king: "💀",
  pirate:     "🗡️",
  mermaid:    "🧜",
  escape:     "🏳️",
  tigress:    "🐯",
  kraken:     "🐙",
  white_whale:"🐳",
};
const SPECIAL_KO = {
  skull_king: "스컬킹",
  pirate:     "해적",
  mermaid:    "인어",
  escape:     "탈출",
  tigress:    "티그리스",
  kraken:     "크라켄",
  white_whale:"흰수염고래",
};

function buildHandCardInner(card) {
  if (card?.type === "suit") {
    const val  = card.value ?? "?";
    const sym  = SUIT_SYMBOLS[card.suit] || "◆";
    const suit = escapeHtml(card.suit || "");
    return `
      <div class="card-corner top-left">
        <span class="card-val">${val}</span>
        <span class="card-suit-sym" data-suit="${suit}">${sym}</span>
      </div>
      <div class="card-body">
        <span class="card-center-val" data-suit="${suit}">${val}</span>
        <span class="card-center-sym" data-suit="${suit}">${sym}</span>
      </div>
      <div class="card-corner bot-right">
        <span class="card-suit-sym" data-suit="${suit}">${sym}</span>
        <span class="card-val">${val}</span>
      </div>`;
  }
  const type  = card?.type || "unknown";
  const icon  = SPECIAL_ICONS[type] || "✦";
  const name  = SPECIAL_KO[type] || escapeHtml(card?.label || type);
  return `
    <div class="card-special-top">
      <span class="card-special-badge">${escapeHtml(card?.label || type)}</span>
    </div>
    <div class="card-body">
      <span class="card-special-icon">${icon}</span>
    </div>
    <div class="card-special-bot">
      <span class="card-special-name">${name}</span>
    </div>`;
}

function buildCompactCardInner(card) {
  if (card?.type === "suit") {
    const sym = SUIT_SYMBOLS[card.suit] || "◆";
    const suit = escapeHtml(card.suit || "");
    const title = escapeHtml(COMPACT_SUIT_LABELS[card.suit] || suit || "Suit");
    return `
      <div class="compact-frame compact-frame-suit">
        <div class="compact-rank" data-suit="${suit}">${card.value ?? "?"}</div>
        <div class="compact-center">
          <span class="compact-glyph" data-suit="${suit}">${sym}</span>
        </div>
        <div class="compact-title" data-suit="${suit}">${title}</div>
      </div>`;
  }
  const icon = SPECIAL_ICONS[card?.type] || "✦";
  const name = SPECIAL_KO[card?.type] || escapeHtml(card?.label || "");
  const badge = escapeHtml(card?.label || name);
  return `
    <div class="compact-frame compact-frame-special">
      <div class="compact-ribbon">${badge}</div>
      <div class="compact-center">
        <span class="compact-icon">${icon}</span>
      </div>
      <div class="compact-title compact-title-special">${name}</div>
    </div>`;
}

const SUIT_NAMES_KO = {
  yellow: "노랑",
  green: "초록",
  purple: "보라",
  black: "검정",
};

const PREVIEW_RULE_LABELS = {
  mermaid_counters_skull_king: "인어가 스컬킹을 제압합니다.",
  skull_king_over_pirates: "스컬킹이 해적과 숫자 카드를 이깁니다.",
  pirate_over_mermaid: "해적이 인어보다 우선합니다.",
  pirate_over_numbered: "해적이 숫자 카드를 압도합니다.",
  mermaid_over_numbered: "인어가 숫자 카드보다 우선합니다.",
  highest_black_trump: "검은색 트럼프가 현재 우세입니다.",
  highest_lead_suit: "리드 슈트 최고 숫자가 우세합니다.",
  highest_numbered_card: "현재 가장 높은 숫자가 우세합니다.",
  first_escape: "모두 탈출 카드라 먼저 낸 카드가 유지됩니다.",
  kraken_discards_trick: "크라켄 효과로 이번 트릭은 버려집니다.",
  white_whale_highest_number: "백경 효과로 숫자 카드 최고값만 비교합니다.",
  white_whale_discards_special_only_trick: "백경이 등장했지만 숫자 카드가 없어 트릭이 버려집니다.",
};

function normalizedCardType(card) {
  return String(card?.type || card?.kind || "").toLowerCase();
}

function isSpecialCardType(cardType) {
  return String(cardType || "").trim().toLowerCase() !== "suit";
}

function isSpecialCard(card) {
  return isSpecialCardType(normalizedCardType(card));
}

function normalizedCardFxType(card) {
  const type = normalizedCardType(card);
  if (type === "suit") {
    return `suit-${String(card?.suit || "").toLowerCase() || "neutral"}`;
  }
  return type || "default";
}

function cardDisplayName(card) {
  if (!card || typeof card !== "object") {
    return "카드";
  }
  if (normalizedCardType(card) === "suit") {
    const suitName = SUIT_NAMES_KO[String(card?.suit || "").toLowerCase()] || String(card?.suit || "슈트");
    return `${suitName} ${card?.value ?? card?.number ?? "?"}`;
  }
  return SPECIAL_KO[normalizedCardType(card)] || String(card?.label || "스페셜 카드");
}

function trickRoleForCard(card) {
  const type = normalizedCardType(card);
  if (type === "suit") {
    return "numbered";
  }
  if (type === "tigress") {
    const mode = String(card?.tigress_mode || card?.tigress_as || "").toLowerCase();
    if (mode === "pirate" || mode === "escape") {
      return mode;
    }
    return "tigress";
  }
  if (
    type === "escape" ||
    type === "pirate" ||
    type === "mermaid" ||
    type === "skull_king" ||
    type === "kraken" ||
    type === "white_whale"
  ) {
    return type;
  }
  return "unknown";
}

function isNumberedPreviewCard(card) {
  return trickRoleForCard(card) === "numbered";
}

function determinePreviewLeadSuit(plays) {
  if (!Array.isArray(plays) || !plays.length) {
    return "";
  }
  const firstRole = trickRoleForCard(plays[0]?.card);
  if (firstRole === "numbered") {
    return String(plays[0]?.card?.suit || "");
  }
  if (firstRole === "escape") {
    const numbered = plays.find((play) => trickRoleForCard(play?.card) === "numbered");
    return String(numbered?.card?.suit || "");
  }
  return "";
}

function numberedPriority(card, leadSuit) {
  const suit = String(card?.suit || "");
  return {
    isTrump: suit === "black",
    followsLead: Boolean(leadSuit) && suit === leadSuit,
    rank: Number(card?.value ?? card?.number ?? 0),
  };
}

function compareNumberedCards(a, b, leadSuit) {
  const pa = numberedPriority(a, leadSuit);
  const pb = numberedPriority(b, leadSuit);
  if (pa.isTrump !== pb.isTrump) {
    return pa.isTrump ? 1 : -1;
  }
  if (pa.followsLead !== pb.followsLead) {
    return pa.followsLead ? 1 : -1;
  }
  return pa.rank - pb.rank;
}

function resolveLocalTrickOutcome(plays, options = {}) {
  if (!Array.isArray(plays) || !plays.length) {
    return null;
  }
  if (plays.some((play) => trickRoleForCard(play?.card) === "tigress")) {
    return {
      winnerId: "",
      winningCard: null,
      appliedRule: "tigress_mode_pending",
      leadSuit: determinePreviewLeadSuit(plays),
      discarded: false,
      pendingMode: true,
    };
  }

  const leadSuit = determinePreviewLeadSuit(plays);
  const advancedRulesEnabled = Boolean(options.advancedRulesEnabled);

  if (advancedRulesEnabled) {
    let lastEffect = null;
    plays.forEach((play) => {
      const role = trickRoleForCard(play?.card);
      if (role === "kraken" || role === "white_whale") {
        lastEffect = { role, play };
      }
    });

    if (lastEffect?.role === "kraken") {
      return {
        winnerId: "",
        winningCard: null,
        appliedRule: "kraken_discards_trick",
        leadSuit,
        discarded: true,
        nextLeaderId: String(lastEffect.play?.playerId || ""),
        pendingMode: false,
      };
    }

    if (lastEffect?.role === "white_whale") {
      const numbered = plays.filter((play) => trickRoleForCard(play?.card) === "numbered");
      if (!numbered.length) {
        return {
          winnerId: "",
          winningCard: null,
          appliedRule: "white_whale_discards_special_only_trick",
          leadSuit,
          discarded: true,
          nextLeaderId: String(lastEffect.play?.playerId || ""),
          pendingMode: false,
        };
      }
      const winner = numbered.reduce((best, current) => {
        if (!best) return current;
        return compareNumberedCards(current.card, best.card, "") > 0 ? current : best;
      }, null);
      return {
        winnerId: String(winner?.playerId || ""),
        winningCard: winner?.card || null,
        appliedRule: "white_whale_highest_number",
        leadSuit,
        discarded: false,
        nextLeaderId: String(lastEffect.play?.playerId || ""),
        pendingMode: false,
      };
    }
  }

  const firstByRole = (role) => plays.find((play) => trickRoleForCard(play?.card) === role) || null;
  if (firstByRole("skull_king")) {
    const mermaid = firstByRole("mermaid");
    const winner = mermaid || firstByRole("skull_king");
    return {
      winnerId: String(winner?.playerId || ""),
      winningCard: winner?.card || null,
      appliedRule: mermaid ? "mermaid_counters_skull_king" : "skull_king_over_pirates",
      leadSuit,
      discarded: false,
      pendingMode: false,
    };
  }

  if (firstByRole("pirate")) {
    return {
      winnerId: String(firstByRole("pirate")?.playerId || ""),
      winningCard: firstByRole("pirate")?.card || null,
      appliedRule: firstByRole("mermaid") ? "pirate_over_mermaid" : "pirate_over_numbered",
      leadSuit,
      discarded: false,
      pendingMode: false,
    };
  }

  if (firstByRole("mermaid")) {
    return {
      winnerId: String(firstByRole("mermaid")?.playerId || ""),
      winningCard: firstByRole("mermaid")?.card || null,
      appliedRule: "mermaid_over_numbered",
      leadSuit,
      discarded: false,
      pendingMode: false,
    };
  }

  const numbered = plays.filter((play) => trickRoleForCard(play?.card) === "numbered");
  if (numbered.length) {
    const black = numbered.filter((play) => String(play?.card?.suit || "") === "black");
    if (black.length) {
      const winner = black.reduce((best, current) => {
        if (!best) return current;
        return compareNumberedCards(current.card, best.card, leadSuit) > 0 ? current : best;
      }, null);
      return {
        winnerId: String(winner?.playerId || ""),
        winningCard: winner?.card || null,
        appliedRule: "highest_black_trump",
        leadSuit,
        discarded: false,
        pendingMode: false,
      };
    }

    if (leadSuit) {
      const followingLead = numbered.filter((play) => String(play?.card?.suit || "") === leadSuit);
      if (followingLead.length) {
        const winner = followingLead.reduce((best, current) => {
          if (!best) return current;
          return compareNumberedCards(current.card, best.card, leadSuit) > 0 ? current : best;
        }, null);
        return {
          winnerId: String(winner?.playerId || ""),
          winningCard: winner?.card || null,
          appliedRule: "highest_lead_suit",
          leadSuit,
          discarded: false,
          pendingMode: false,
        };
      }
    }

    const winner = numbered.reduce((best, current) => {
      if (!best) return current;
      return compareNumberedCards(current.card, best.card, leadSuit) > 0 ? current : best;
    }, null);
    return {
      winnerId: String(winner?.playerId || ""),
      winningCard: winner?.card || null,
      appliedRule: "highest_numbered_card",
      leadSuit,
      discarded: false,
      pendingMode: false,
    };
  }

  return {
    winnerId: String(plays[0]?.playerId || ""),
    winningCard: plays[0]?.card || null,
    appliedRule: "first_escape",
    leadSuit,
    discarded: false,
    pendingMode: false,
  };
}

function buildTrickPreview(game, extraPlay = null) {
  const players = Array.isArray(game?.players) ? game.players : [];
  const playerIndexById = Object.fromEntries(players.map((player, index) => [String(player?.id || ""), index]));
  const plays = (Array.isArray(game?.current_trick) ? game.current_trick : []).map((play) => ({
    playerId: String(play?.player_id || ""),
    playerName: String(play?.player_name || playerNameById(game, play?.player_id) || "Player"),
    playerIndex: Number(playerIndexById[String(play?.player_id || "")] ?? -1),
    card: play?.card || null,
    pendingPreview: Boolean(play?.pending_preview),
  }));

  if (extraPlay?.card && extraPlay?.playerId) {
    const alreadyIncluded = plays.some((play) => String(play.playerId || "") === String(extraPlay.playerId || ""));
    if (!alreadyIncluded) {
      plays.push({
        playerId: String(extraPlay.playerId || ""),
        playerName: String(extraPlay.playerName || playerNameById(game, extraPlay.playerId) || "You"),
        playerIndex: Number(playerIndexById[String(extraPlay.playerId || "")] ?? -1),
        card: extraPlay.card,
        pendingPreview: true,
      });
    }
  }

  const outcome = resolveLocalTrickOutcome(plays, {
    advancedRulesEnabled: Boolean(game?.settings?.advanced_rules_enabled),
  });
  const winnerPlay = outcome?.winnerId
    ? plays.find((play) => String(play?.playerId || "") === String(outcome.winnerId || ""))
    : null;

  return {
    plays,
    outcome,
    winnerPlay,
    leadSuit: String(outcome?.leadSuit || ""),
    leadSuitLabel: SUIT_NAMES_KO[String(outcome?.leadSuit || "").toLowerCase()] || "",
    ruleLabel: outcome?.pendingMode
      ? "티그리스는 제출 직후 모드를 결정합니다."
      : PREVIEW_RULE_LABELS[String(outcome?.appliedRule || "")] || "현재 제출 카드 기준 우세를 계산했습니다.",
  };
}

function resolveCurrentPlayer(game) {
  const players = Array.isArray(game?.players) ? game.players : [];
  if (!players.length) {
    return null;
  }
  let me = players.find((p) => String(p.id || "") === String(appState.playerId || ""));
  if (!me && appState.discordUserId) {
    const did = String(appState.discordUserId);
    me = players.find(
      (p) =>
        String(p.discord_user_id || "") === did ||
        String(p.discordUserId || "") === did,
    );
  }
  if (!me && game.viewer_player_id) {
    me = players.find((p) => String(p.id || "") === String(game.viewer_player_id || ""));
  }
  if (me && String(me.id || "") && String(me.id) !== String(appState.playerId || "")) {
    appState.playerId = String(me.id);
    try {
      localStorage.setItem("skullking-player-id", appState.playerId);
    } catch (_) {}
  }
  return me || null;
}

// NOTE: renderLobbySeats는 React 마이그레이션(2026-05) 이후 제거됨.
// 로비 좌석 렌더링은 App.jsx의 LobbyPortals(React 포탈)이 담당한다.
// legacyBridge는 raw snapshot을 React에 넘기는 임시 계층이며, 동시에
// normalized client-state/selectors 계약도 함께 유지한다.

function maybeAutoStartNextRound(game) {
  const liveGame = game && typeof game === "object" ? game : appState.game;
  const uiModel = appState.uiModel || deriveUiModel(liveGame);
  const maxRounds = Number(liveGame?.settings?.max_rounds || 10);
  const reachedMaxRound = Number(liveGame?.round_number || 0) >= maxRounds;
  const waitingRound = String(liveGame?.status || "").toLowerCase() === ROOM_STATUS.WAITING_ROUND;
  const me = uiModel?.me || resolveCurrentPlayer(liveGame);
  const isHost =
    (me && String(me.id || "") === String(liveGame?.host_id || "")) ||
    (!liveGame?.host_id && me && liveGame?.players?.[0]?.id === me.id);
  const canAutoAdvance =
    Boolean(liveGame?.session_id) &&
    waitingRound &&
    !reachedMaxRound &&
    !uiModel?.isReadOnly &&
    !uiModel?.interactionLocked &&
    Boolean(isHost);

  if (!canAutoAdvance) {
    appState.autoRound.pending = false;
    appState.autoRound.lastTriggeredRound = -1;
    appState.autoRound.retryCount = 0;
    appState.autoRound.lastAttemptAt = 0;
    return;
  }

  const roundKey = `${liveGame.session_id}:${liveGame.round_number}:${liveGame.status}`;
  if (appState.autoRound.pending) {
    return;
  }
  if (String(appState.autoRound.lastTriggeredRound || "") === roundKey && Number(appState.autoRound.retryCount || 0) <= 0) {
    return;
  }
  if (Date.now() - Number(appState.autoRound.lastAttemptAt || 0) < 1200) {
    return;
  }

  appState.autoRound.pending = true;
  appState.autoRound.lastTriggeredRound = roundKey;
  appState.autoRound.lastAttemptAt = Date.now();

  setTimeout(async () => {
    const activeRoundKey = roundKey;
    let started = false;
    try {
      started = await onStartRound({ auto: true });
    } finally {
      appState.autoRound.pending = false;
      if (started) {
        appState.autoRound.retryCount = 0;
        return;
      }
      const stillWaiting =
        String(appState.game?.status || "").toLowerCase() === ROOM_STATUS.WAITING_ROUND &&
        `${appState.game?.session_id}:${appState.game?.round_number}:${appState.game?.status}` === activeRoundKey;
      if (!stillWaiting) {
        appState.autoRound.retryCount = 0;
        return;
      }
      appState.autoRound.retryCount = Number(appState.autoRound.retryCount || 0) + 1;
      if (appState.autoRound.retryCount >= 3) {
        return;
      }
      appState.autoRound.lastTriggeredRound = "";
      maybeAutoStartNextRound(appState.game);
    }
  }, 1200);
}

function renderBidPanel(game, me, currentTurnPlayer) {
  const uiModel = appState.uiModel || deriveUiModel(game);
  const resolvedMe = me || resolveCurrentPlayer(game) || null;
  const myBid = resolvedMe?.bid;
  const preBidDelayActive = isPreBidDelayActive(game);
  const bidSubmitPending = isPendingAction(PENDING_ACTION_KIND.SUBMIT_BID);
  const stillAwaitingBid =
    String(game.status || "") === "bidding" &&
    Boolean(resolvedMe) &&
    !bidSubmitPending &&
    (myBid === null || myBid === undefined);
  const shouldShowBidDialog = stillAwaitingBid && !preBidDelayActive;
  const canBid = shouldShowBidDialog && !uiModel.interactionLocked;
  if (bidDialogInput) {
    bidDialogInput.max = String(game.cards_dealt || 0);
    bidDialogInput.disabled = !canBid || isPendingAction(PENDING_ACTION_KIND.SUBMIT_BID);
  }
  if (bidDialogSubmitBtn) {
    bidDialogSubmitBtn.disabled = !canBid || isPendingAction(PENDING_ACTION_KIND.SUBMIT_BID);
  }
  if (bidMinusBtn) {
    bidMinusBtn.disabled = !canBid || Number(bidDialogInput?.value || 0) <= 0;
    bidMinusBtn.classList.toggle("is-disabled", bidMinusBtn.disabled);
  }
  if (bidPlusBtn) {
    const maxBid = Number(game.cards_dealt || 0);
    bidPlusBtn.disabled = !canBid || Number(bidDialogInput?.value || 0) >= maxBid;
    bidPlusBtn.classList.toggle("is-disabled", bidPlusBtn.disabled);
  }
  if (shouldShowBidDialog && bidDialogInput && !bidDialogInput.value) {
    bidDialogInput.value = "0";
  }
  if (!stillAwaitingBid) {
    appState.bidPrompt.key = "";
    appState.bidPrompt.startedAtMs = 0;
    closeBidDialog();
    return;
  }
  if (!shouldShowBidDialog) {
    closeBidDialog();
    return;
  }
  const promptKey = `${game.session_id}:${game.round_number}:${resolvedMe?.id || appState.playerId}:bid`;
  if (appState.bidPrompt.key !== promptKey) {
    appState.bidPrompt.key = promptKey;
    if (bidDialogInput) {
      bidDialogInput.value = "0";
    }
  }
  openBidDialog(Number(game.cards_dealt || 0));
}

function setHandInspectState(nextInspect) {
  appState.handInspect = nextInspect && typeof nextInspect === "object"
    ? {
        index: Number.isInteger(nextInspect.index) ? Number(nextInspect.index) : null,
        card: nextInspect.card || null,
        clickable: Boolean(nextInspect.clickable),
        legal: Boolean(nextInspect.legal),
        origin: String(nextInspect.origin || "hover"),
      }
    : null;
  renderInteractionHud(appState.game, appState.uiModel || deriveUiModel(appState.game));
}

function clearHandInspectState(match = {}) {
  const current = appState.handInspect;
  if (!current) {
    return;
  }
  if (Number.isInteger(match.index) && Number(current.index) !== Number(match.index)) {
    return;
  }
  if (match.origin && String(current.origin || "") !== String(match.origin)) {
    return;
  }
  appState.handInspect = null;
  renderInteractionHud(appState.game, appState.uiModel || deriveUiModel(appState.game));
}

function buildInteractionHudState(game, uiModel) {
  const safeGame = game && typeof game === "object" ? game : null;
  const safeUiModel = uiModel && typeof uiModel === "object"
    ? uiModel
    : (safeGame ? deriveUiModel(safeGame) : null);
  if (!safeGame || !safeUiModel) {
    return {
      tone: "neutral",
      kicker: "Play Window",
      title: "카드를 끌어 중앙으로 올리면 제출됩니다.",
      body: "턴이 오면 합법 카드만 살아나고, 중앙 트릭 존에서 현재 우세를 확인할 수 있습니다.",
    };
  }

  const me = safeUiModel.me || resolveCurrentPlayer(safeGame);
  const currentTurnId = String(safeUiModel.currentTurnPlayer?.id || safeGame.current_turn_player_id || "");
  const myId = String(me?.id || appState.playerId || "");
  const isMyTurn = String(safeGame.status || "").toLowerCase() === ROOM_STATUS.PLAYING && myId && currentTurnId === myId;
  const legalMoves = Array.isArray(me?.legal_indexes) ? me.legal_indexes : [];
  const inspect = appState.handInspect;
  const basePreview = buildTrickPreview(safeGame);
  const baseLeadText = basePreview.leadSuitLabel
    ? `리드 슈트는 ${basePreview.leadSuitLabel}`
    : "아직 리드 슈트가 정해지지 않았습니다";

  if (safeUiModel.trickHoldSeconds > 0) {
    return {
      tone: "warn",
      kicker: "Trick Resolve",
      title: `지난 트릭 결과를 ${safeUiModel.trickHoldSeconds}초 더 보여주는 중입니다.`,
      body: "특수 카드 이펙트와 승패를 확인한 뒤 다음 트릭이 열립니다.",
    };
  }

  if (safeUiModel.interactionLocked) {
    return {
      tone: "locked",
      kicker: "Input Locked",
      title: safeUiModel.interactionLockReason || "서버와 다시 동기화되는 동안 입력을 잠시 막고 있습니다.",
      body: safeUiModel.syncSummary || "최신 authoritative 상태를 다시 받는 중입니다.",
    };
  }

  if (inspect?.card) {
    const extraPlay = myId
      ? { playerId: myId, playerName: me?.name || "You", card: inspect.card }
      : null;
    const preview = extraPlay ? buildTrickPreview(safeGame, extraPlay) : basePreview;
    const winnerName = preview.winnerPlay?.playerName || "";
    const cardName = cardDisplayName(inspect.card);
    const leadLine = preview.leadSuitLabel
      ? `리드 슈트 ${preview.leadSuitLabel}`
      : "선행 숫자 카드가 없어 아무 카드나 시작할 수 있습니다.";

    if (normalizedCardType(inspect.card) === "tigress" && inspect.card?.needs_mode) {
      return {
        tone: inspect.clickable ? "ready" : "neutral",
        kicker: inspect.clickable ? "Mode Choice" : "Card Inspect",
        title: `${cardName} · 제출 후 모드 선택`,
        body: `${leadLine} · 제출 직후 Pirate 또는 Escape로 사용할 방식을 고릅니다.`,
      };
    }

    if (!inspect.clickable) {
      return {
        tone: "blocked",
        kicker: inspect.legal ? "Wait Turn" : "Hold Suit",
        title: `${cardName} · 지금은 낼 수 없습니다`,
        body: inspect.legal
          ? "내 턴이 오면 즉시 낼 수 있는 카드입니다."
          : `${baseLeadText}. 같은 슈트가 손에 남아 있어 이 카드는 잠시 잠겨 있습니다.`,
      };
    }

    if (preview.outcome?.discarded) {
      return {
        tone: "warn",
        kicker: "Projected Result",
        title: `${cardName} · 이번 트릭은 버려집니다`,
        body: `${preview.ruleLabel} · ${leadLine}`,
      };
    }

    if (preview.outcome?.pendingMode) {
      return {
        tone: "neutral",
        kicker: "Projected Result",
        title: `${cardName} · 모드 선택 후 판정`,
        body: `${preview.ruleLabel} · ${leadLine}`,
      };
    }

    const iLead = winnerName && String(preview.outcome?.winnerId || "") === myId;
    return {
      tone: iLead ? "ready" : "warn",
      kicker: iLead ? "Projected Lead" : "Projected Clash",
      title: iLead
        ? `${cardName} · 현재 트릭 선두 예상`
        : `${cardName} · 현재는 ${winnerName || "다른 플레이어"} 우세`,
      body: `${preview.ruleLabel} · ${leadLine}`,
    };
  }

  if (String(safeGame.status || "").toLowerCase() === ROOM_STATUS.BIDDING) {
    const bidLimitSeconds = resolvedTurnLimitSeconds(safeGame);
    const inspectSeconds = preBidDelayRemainingSeconds(safeGame);
    return {
      tone: "neutral",
      kicker: "Bid Phase",
      title: "손패를 읽고 가져갈 트릭 수를 예측하세요.",
      body: inspectSeconds > 0
        ? `손패 확인 ${inspectSeconds}초 후 동시 비딩이 시작되고, 비딩 제한 시간은 ${bidLimitSeconds}초입니다.`
        : (safeUiModel.predictionSummary || `동시 비딩 진행 중 · 제한 시간 ${bidLimitSeconds}초`),
    };
  }

  if (!isMyTurn) {
    return {
      tone: "neutral",
      kicker: "Observe",
      title: safeUiModel.roundInfoSummary || "상대 턴 진행 중",
      body: `${safeUiModel.ruleSummary || ""} ${basePreview.winnerPlay?.playerName ? `현재 우세: ${basePreview.winnerPlay.playerName}.` : ""}`.trim(),
    };
  }

  return {
    tone: legalMoves.length ? "ready" : "neutral",
    kicker: legalMoves.length ? "My Turn" : "My Turn",
    title: legalMoves.length
      ? `합법 카드 ${legalMoves.length}장 · 드래그해 중앙으로 제출`
      : "낼 수 있는 카드를 확인 중입니다.",
    body: `${baseLeadText}. ${basePreview.winnerPlay?.playerName ? `현재 우세: ${basePreview.winnerPlay.playerName}.` : "선행 카드가 없으면 아무 카드나 시작할 수 있습니다."}`,
  };
}

function renderInteractionHud(game, uiModel) {
  if (!interactionHud || !interactionHudKicker || !interactionHudTitle || !interactionHudBody) {
    return;
  }
  const state = buildInteractionHudState(game, uiModel);
  interactionHud.classList.remove("tone-ready", "tone-warn", "tone-blocked", "tone-locked");
  interactionHud.classList.add(`tone-${state.tone || "neutral"}`);
  interactionHudKicker.textContent = state.kicker || "Play Window";
  interactionHudTitle.textContent = state.title || "";
  interactionHudBody.textContent = state.body || "";
}

function renderTrickCenter(game, timeLeft) {
  let source = Array.isArray(game.current_trick) ? [...game.current_trick] : [];
  const trickHoldLeft = trickHoldRemainingSeconds(game);
  const heldTrickReveal = getHeldTrickReveal(game);
  const playPreview = resolvePlaySubmitPreview(game);
  if (
    playPreview?.card &&
    playPreview?.playerId &&
    !source.some((play) => String(play?.player_id || "") === String(playPreview.playerId || ""))
  ) {
    const previewPlayer =
      (Array.isArray(game.players) ? game.players : []).find(
        (player) => String(player?.id || "") === String(playPreview.playerId || ""),
      ) || null;
    source.push({
      player_id: playPreview.playerId,
      player_name: previewPlayer?.name || "You",
      card: playPreview.card,
      pending_preview: true,
      animation_key: playPreview.animationKey || "",
    });
  }
  const preBidDelaySeconds = preBidDelayRemainingSeconds(game);
  const previewOutcome = buildTrickPreview(
    game,
    playPreview?.card && playPreview?.playerId
      ? {
          playerId: playPreview.playerId,
          playerName: playerNameById(game, playPreview.playerId) || "You",
          card: playPreview.card,
        }
      : null,
  );
  const centerTimerSecond =
    source.length === 0 && !heldTrickReveal && String(game.status || "").toLowerCase() === ROOM_STATUS.PLAYING
      ? Number(timeLeft || 0)
      : -1;
  const trickKey = [
    String(game.status || ""),
    String(source.length || 0),
    String(heldTrickReveal?.key || ""),
    String(trickHoldLeft),
    String(game.cards_dealt || 0),
    String(game.tricks_completed || 0),
    String(centerTimerSecond),
    String(preBidDelaySeconds),
    String(previewOutcome?.outcome?.winnerId || ""),
    String(previewOutcome?.outcome?.appliedRule || ""),
    source.map((play) => `${play.player_id}:${cardStateSignature(play.card)}:${play.pending_preview ? 1 : 0}`).join("|"),
  ].join("~");
  if (appState.uiCache.trickKey === trickKey) {
    return;
  }
  appState.uiCache.trickKey = trickKey;
  trickCenter.innerHTML = "";
  const currentTurnId = String(game.current_turn_player_id || game.players?.[game.turn_index]?.id || "");
  const myId = String(appState.uiModel?.me?.id || appState.playerId || "");
  const showTimer = String(game.status || "").toLowerCase() === ROOM_STATUS.PLAYING && Boolean(myId) && currentTurnId === myId;
  const timerHtml = showTimer ? `<div class="turn-timer">${timeLeft}초</div>` : "";

  if (String(game.status || "").toLowerCase() === ROOM_STATUS.BIDDING && preBidDelaySeconds > 0) {
    appState.uiCache.trickAnimationStageKey = "";
    appState.uiCache.trickAnimatedCardsByPlayer = {};
    const prep = document.createElement("div");
    prep.className = "trick-card pre-bid-inspect";
    prep.innerHTML = `
      <div class="trick-card-kicker">Pre-Bid Inspect</div>
      <div>핸드 확인</div>
      <div>${preBidDelaySeconds}초 후 동시 비딩</div>
      <div class="trick-card-meta">비딩 제한 ${resolvedTurnLimitSeconds(game)}초</div>
    `;
    trickCenter.appendChild(prep);
    return;
  }

  let heldStatus = null;
  if (source.length === 0 && heldTrickReveal) {
    source = [...heldTrickReveal.trick];
    heldStatus = heldTrickReveal;
  } else if (source.length === 0 && trickHoldLeft > 0 && Array.isArray(game?.last_trick) && game.last_trick.length > 0) {
    source = game.last_trick.map((play) => ({ ...play }));
    heldStatus = {
      trick: source,
      winnerId: String(game?.last_winner_id || ""),
      appliedRule: String(latestFlowEventFromState(game)?.applied_rule || ""),
      discarded: Boolean(latestFlowEventFromState(game)?.discarded),
    };
  }

  if (source.length === 0) {
    appState.uiCache.trickAnimationStageKey = "";
    appState.uiCache.trickAnimatedCardsByPlayer = {};
    const empty = document.createElement("div");
    empty.className = "trick-card";
    empty.innerHTML = `<div>트릭 대기</div><div>카드 제출 전</div>${timerHtml}`;
    trickCenter.appendChild(empty);
    return;
  }

  const trickAnimationStageKey = [
    String(game.status || ""),
    String(game.round_number || 0),
    String(game.tricks_completed || 0),
    heldStatus ? "held" : "live",
  ].join(":");
  const previousAnimatedCards =
    appState.uiCache.trickAnimationStageKey === trickAnimationStageKey
      ? { ...(appState.uiCache.trickAnimatedCardsByPlayer || {}) }
      : {};
  const nextAnimatedCards = {};

  const cardRow = document.createElement("div");
  cardRow.className = "trick-zone-cards";
  const projectedWinnerId = String(previewOutcome?.outcome?.winnerId || "");
  let resolvedWinnerCard = null;
  let resolvedWinnerNode = null;
  let resolvedWinnerFxType = "";
  source.forEach((play) => {
    const playerKey = String(play?.player_id || "");
    const cardKey = `${playerKey}:${cardStateSignature(play.card)}`;
    const animationKey =
      String(play?.animation_key || "")
      || (
        playMatchesPreview(play, playPreview)
          ? String(playPreview?.animationKey || "")
          : buildPlayedCardAnimationKey({
              sessionId: game?.session_id || appState.sessionId || "",
              roundNumber: game?.round_number || 0,
              tricksCompleted: game?.tricks_completed || 0,
              playerId: playerKey,
              card: play?.card,
            })
      );
    const isPendingPreview = Boolean(play.pending_preview);
    const shouldAnimateEntry = isPendingPreview ? false : markAnimatedTrickCard(animationKey);
    nextAnimatedCards[playerKey] = cardKey;
    const cardWrap = document.createElement("div");
    cardWrap.className = "trick-zone-card-wrap";
    const card = renderCard(play.card, { className: "trick-zone-card", compact: true });
    const cardType = normalizedCardType(play.card);
    const fxType = normalizedCardFxType(play.card);
    const isLeadingPlay = Boolean(projectedWinnerId) && String(play?.player_id || "") === projectedWinnerId;
    const cinematicFxType = isSpecialCardType(cardType) ? cardType : isLeadingPlay ? "lead" : "";
    cardWrap.classList.add(`fx-${fxType}`);
    card.classList.add(`fx-${fxType}`);
    if (isLeadingPlay) {
      cardWrap.classList.add("is-leading");
      card.classList.add("is-leading", "hs-winning");
      if (isSpecialCardType(cardType)) {
        cardWrap.classList.add("is-leading-special");
        card.classList.add("is-leading-special");
      }
    }
    if (shouldAnimateEntry) {
      card.classList.add("hs-landing");
      card.addEventListener("animationend", () => card.classList.remove("hs-landing"), { once: true });
      triggerBoardCinematicFx(cinematicFxType, `${animationKey}:${cinematicFxType}`);
    }
    if (shouldAnimateEntry && normalizedCardType(play.card) !== "suit") {
      cardWrap.classList.add("hs-special-entry");
      const handleSpecialEntryEnd = (event) => {
        if (event.target === cardWrap) {
          cardWrap.classList.remove("hs-special-entry");
          cardWrap.removeEventListener("animationend", handleSpecialEntryEnd);
        }
      };
      cardWrap.addEventListener("animationend", handleSpecialEntryEnd);
    }
    if (shouldAnimateEntry) {
      const impact = document.createElement("div");
      impact.className = `trick-impact fx-${fxType}`;
      impact.setAttribute("aria-hidden", "true");
      impact.addEventListener("animationend", () => impact.remove(), { once: true });
      cardWrap.appendChild(impact);
    }
    if (play.pending_preview) {
      card.classList.add("pending-preview");
    }
    if (heldStatus && String(play?.player_id || "") === String(heldStatus?.winnerId || "") && isSpecialCardType(cardType)) {
      resolvedWinnerCard = play.card;
      resolvedWinnerNode = card;
      resolvedWinnerFxType = cardType;
    }
    const label = document.createElement("div");
    label.className = "trick-zone-player";
    label.textContent = String(play.player_name || play.player_id || "Player");
    cardWrap.appendChild(card);
    cardWrap.appendChild(label);
    cardRow.appendChild(cardWrap);
  });
  trickCenter.appendChild(cardRow);
  appState.uiCache.trickAnimationStageKey = trickAnimationStageKey;
  appState.uiCache.trickAnimatedCardsByPlayer = nextAnimatedCards;
  if (heldStatus && resolvedWinnerCard && resolvedWinnerNode) {
    const resolvedFxKey = [
      String(game?.session_id || ""),
      String(game?.round_number || 0),
      String(game?.tricks_completed || 0),
      String(heldStatus?.winnerId || ""),
      cardStateSignature(resolvedWinnerCard),
      String(heldStatus?.appliedRule || ""),
      "winner",
    ].join(":");
    if (!appState.uiCache.cinematicFxKeys?.[resolvedFxKey]) {
      appState.uiCache.cinematicFxKeys[resolvedFxKey] = true;
      window.SkullKingFX?.playCardEvent?.({
        card: resolvedWinnerCard,
        effectType: resolvedWinnerFxType,
        sourceElement: resolvedWinnerNode,
        targetElement: resolvedWinnerNode,
        highlightElement: resolvedWinnerNode,
        sourcePlayerId: heldStatus?.winnerId || null,
        targetPlayerId: heldStatus?.winnerId || null,
        boardSelector: "#gamePanel .table-wrap",
        result: "win",
      });
    }
  }

  const status = document.createElement("div");
  status.className = "trick-zone-status";
  if (heldStatus) {
    const winnerName = playerNameById(game, heldStatus.winnerId) || "";
    const holdSuffix = trickHoldLeft > 0 ? ` · ${trickHoldLeft}초 후 다음 트릭` : "";
    if (heldStatus.discarded) {
      status.innerHTML = `
        <strong>방금 끝난 트릭 · 승자 없음</strong>
        <span>${escapeHtml(heldStatus.appliedRule || "특수 규칙으로 트릭이 버려졌습니다.")}${holdSuffix}</span>
      `;
    } else if (winnerName) {
      status.innerHTML = `
        <strong>방금 끝난 트릭 승자 · ${escapeHtml(winnerName)}</strong>
        <span>${escapeHtml(heldStatus.appliedRule || "판정 완료")}${holdSuffix}</span>
      `;
    } else {
      status.innerHTML = `
        <strong>방금 끝난 트릭 정산 완료</strong>
        <span>${escapeHtml(heldStatus.appliedRule || "판정 완료")}${holdSuffix}</span>
      `;
    }
  } else if (previewOutcome?.outcome?.discarded) {
    status.innerHTML = `
      <strong>트릭 버려짐 예상</strong>
      <span>${previewOutcome.ruleLabel}</span>
    `;
  } else if (previewOutcome?.outcome?.pendingMode) {
    status.innerHTML = `
      <strong>티그리스 모드 대기</strong>
      <span>${previewOutcome.ruleLabel}</span>
    `;
  } else if (previewOutcome?.winnerPlay?.playerName) {
    status.innerHTML = `
      <strong>현재 우세 · ${escapeHtml(previewOutcome.winnerPlay.playerName)}</strong>
      <span>${escapeHtml(previewOutcome.ruleLabel)}</span>
    `;
  } else if (previewOutcome?.leadSuitLabel) {
    status.innerHTML = `
      <strong>리드 슈트 · ${escapeHtml(previewOutcome.leadSuitLabel)}</strong>
      <span>${escapeHtml(previewOutcome.ruleLabel)}</span>
    `;
  }
  if (status.innerHTML) {
    trickCenter.appendChild(status);
  }
}

function clearTrickReveal(options = {}) {
  if (appState.trickReveal?.timer) {
    clearTimeout(appState.trickReveal.timer);
  }
  appState.trickReveal.key = "";
  appState.trickReveal.timer = null;
  appState.trickReveal.expiresAtMs = 0;
  appState.trickReveal.trick = [];
  appState.trickReveal.winnerId = "";
  appState.trickReveal.appliedRule = "";
  appState.trickReveal.discarded = false;
  if (!options.skipRender) {
    requestRender();
  }
}

function armTrickRevealTimer(expiresAtMs) {
  if (appState.trickReveal?.timer) {
    clearTimeout(appState.trickReveal.timer);
  }
  const delayMs = Math.max(80, Number(expiresAtMs || 0) - serverNowMs());
  appState.trickReveal.timer = setTimeout(() => {
    clearTrickReveal();
  }, delayMs);
}

function markAnimatedTrickCard(animationKey) {
  if (!animationKey) {
    return false;
  }
  if (appState.uiCache.animatedTrickCardKeys?.[animationKey]) {
    return false;
  }
  appState.uiCache.animatedTrickCardKeys[animationKey] = true;
  return true;
}

function unmarkAnimatedTrickCard(animationKey) {
  if (!animationKey || !appState.uiCache.animatedTrickCardKeys?.[animationKey]) {
    return;
  }
  delete appState.uiCache.animatedTrickCardKeys[animationKey];
}

function boardShakeStrengthForEffectType(effectType) {
  const safe = String(effectType || "");
  if (safe === "skull_king" || safe === "kraken" || safe === "white_whale") {
    return "heavy";
  }
  if (safe === "pirate" || safe === "mermaid" || safe === "tigress") {
    return "medium";
  }
  return "none";
}

function applyBoardShake(strength = "none") {
  const tableWrap = gamePanel?.querySelector?.(".table-wrap");
  const reactiveNodes = [
    tableWrap,
    playerRing,
    trickCenter,
    ...Array.from(gamePanel?.querySelectorAll?.(".trick-zone-card-wrap, .trick-zone-card") || []),
  ].filter(Boolean);

  reactiveNodes.forEach((node) => {
    node.classList.remove(
      "fx-board-shake",
      "fx-board-shake-light",
      "fx-board-shake-medium",
      "fx-board-shake-heavy",
    );
  });

  if (strength === "none") {
    return;
  }

  window.requestAnimationFrame(() => {
    reactiveNodes.forEach((node) => {
      node.classList.add("fx-board-shake", `fx-board-shake-${strength}`);
    });
  });
}

function cinematicGlyphForType(effectType) {
  const glyphs = {
    lead: "✨",
    skull_king: "🏴‍☠️",
    pirate: "🗡️",
    mermaid: "🌊",
    tigress: "🐯",
    kraken: "🐙",
    white_whale: "🐋",
  };
  return glyphs[String(effectType || "")] || "✦";
}

function triggerBoardCinematicFx(effectType, animationKey) {
  if (!effectType || !animationKey || appState.uiCache.cinematicFxKeys?.[animationKey]) {
    return;
  }
  appState.uiCache.cinematicFxKeys[animationKey] = true;
  const shakeStrength = boardShakeStrengthForEffectType(effectType);
  if (appState.tableFxTimer) {
    clearTimeout(appState.tableFxTimer);
    appState.tableFxTimer = null;
  }
  applyBoardShake(shakeStrength);
  appState.tableFxTimer = window.setTimeout(() => {
    applyBoardShake("none");
    appState.tableFxTimer = null;
  }, 700);
  if (!tableCinematicFx) {
    return;
  }
  const burst = document.createElement("div");
  burst.className = `table-cinematic-fx-burst fx-${effectType}`;
  const glyph = document.createElement("span");
  glyph.className = "cinematic-glyph";
  glyph.textContent = cinematicGlyphForType(effectType);
  burst.appendChild(glyph);
  burst.addEventListener("animationend", () => burst.remove(), { once: true });
  tableCinematicFx.appendChild(burst);
}

function holdResolvedTrick(game, flowEvent) {
  const lastTrick = Array.isArray(game?.last_trick) ? game.last_trick : [];
  if (!lastTrick.length) {
    clearTrickReveal();
    return;
  }
  const key = buildTrickRevealKey(game, flowEvent);
  const serverExpiresAtMs = Number(game?.trick_hold_until || 0) > 0 ? Number(game.trick_hold_until) * 1000 : 0;
  const expiresAtMs = serverExpiresAtMs > 0 ? serverExpiresAtMs : serverNowMs() + 5000;
  if (String(appState.trickReveal.key || "") === key) {
    const currentExpiresAtMs = Number(appState.trickReveal.expiresAtMs || 0);
    if (!currentExpiresAtMs || (expiresAtMs > 0 && expiresAtMs < currentExpiresAtMs)) {
      appState.trickReveal.expiresAtMs = expiresAtMs;
      armTrickRevealTimer(expiresAtMs);
    }
    return;
  }
  appState.trickReveal.key = key;
  appState.trickReveal.expiresAtMs = expiresAtMs;
  appState.trickReveal.trick = lastTrick.map((play) => ({ ...play }));
  appState.trickReveal.winnerId = String(flowEvent?.winner_id || game?.last_winner_id || "");
  appState.trickReveal.appliedRule = String(flowEvent?.applied_rule || "");
  appState.trickReveal.discarded = Boolean(flowEvent?.discarded);
  armTrickRevealTimer(expiresAtMs);
  requestRender();
}

function getHeldTrickReveal(game) {
  const reveal = appState.trickReveal;
  if (!reveal || !String(reveal.key || "")) {
    return null;
  }
  if (Number(reveal.expiresAtMs || 0) > 0 && Number(reveal.expiresAtMs || 0) <= serverNowMs()) {
    clearTrickReveal({ skipRender: true });
    return null;
  }
  if (Array.isArray(game?.current_trick) && game.current_trick.length > 0) {
    return null;
  }
  const expectedKey = buildTrickRevealKey(game);
  if (expectedKey && String(reveal.key || "") !== expectedKey && Array.isArray(game?.last_trick) && game.last_trick.length > 0) {
    clearTrickReveal({ skipRender: true });
    return null;
  }
  return reveal;
}

const ROPE_SHOW_THRESHOLD = 15; // seconds remaining before rope appears

function renderTurnProgress(game, clock) {
  if (!turnProgress || !turnProgressFill) {
    return;
  }
  const status = String(game.status || "").toLowerCase();
  const preBidActive = Boolean(clock?.preBidActive);
  const holdActive = Boolean(clock?.holdActive);
  const myId = String(appState.uiModel?.me?.id || appState.playerId || "");
  const currentTurnId = String(game.current_turn_player_id || game.players?.[game.turn_index]?.id || "");
  const isMyTurn = status === "playing" && !preBidActive && !holdActive && Boolean(myId) && currentTurnId === myId;

  const total = Math.max(1, Number(appState.turnClock?.limitSeconds || TURN_LIMIT_SECONDS));
  const safeLeft = Math.max(0, Math.min(total, Number(clock?.secondsLeft ?? 0)));

  // Rope only appears when ≤ ROPE_SHOW_THRESHOLD seconds remain
  const ropeVisible = isMyTurn && safeLeft <= ROPE_SHOW_THRESHOLD;
  turnProgress.classList.toggle("hidden", !ropeVisible);
  if (!ropeVisible) {
    return;
  }

  // rope fills from left→right as time burns (burned = elapsed portion)
  const ropeTotal = ROPE_SHOW_THRESHOLD;
  const ropeFraction = Math.max(0, Math.min(1, (ropeTotal - safeLeft) / ropeTotal));
  const remainFraction = 1 - ropeFraction;
  const burnedPct = `${(ropeFraction * 100).toFixed(1)}%`;

  turnProgressFill.style.width = `${(remainFraction * 100).toFixed(1)}%`;
  turnProgressFill.style.setProperty("--burned-pct", "0%"); // fire is always at the tip
  turnProgressFill.style.left = burnedPct; // remaining rope starts after burned section

  turnProgress.classList.toggle("danger", safeLeft <= 5);
  turnProgress.classList.remove("warn");
}

function renderPlayerRing(game, currentTurnPlayer) {
  if (!playerRing) {
    return;
  }
  const ringKey = [
    (game.players || []).map((p) => `${p.id}:${p.name}:${p.bid ?? ""}:${p.tricks_won ?? 0}`).join("|"),
    String(currentTurnPlayer?.id || ""),
    (game.current_trick || []).map((play) => `${play.player_id}:${cardStateSignature(play.card)}`).join("|"),
    String(game.last_winner_id || ""),
    String(shouldShowBidWonBadges(game)),
  ].join("~");
  if (appState.uiCache.ringKey === ringKey) {
    return;
  }
  appState.uiCache.ringKey = ringKey;
  playerRing.innerHTML = "";

  const players = game.players || [];
  if (!players.length) {
    return;
  }

  const myId = String(appState.playerId || "");
  const count = players.length;
  const showBidWonBadges = shouldShowBidWonBadges(game);
  const angleStep = (Math.PI * 2) / count;
  const ringLayoutByCount = {
    2: { rx: 37, ry: 31, scale: 1.0, cardInward: 0.64 },
    3: { rx: 40, ry: 32, scale: 0.98, cardInward: 0.66 },
    4: { rx: 43, ry: 34, scale: 0.96, cardInward: 0.68 },
    5: { rx: 45, ry: 35, scale: 0.93, cardInward: 0.7 },
    6: { rx: 47, ry: 36, scale: 0.9, cardInward: 0.72 },
    7: { rx: 48, ry: 37, scale: 0.87, cardInward: 0.74 },
    8: { rx: 49, ry: 38, scale: 0.84, cardInward: 0.76 },
  };
  const layout = ringLayoutByCount[Math.min(8, Math.max(2, count))] || ringLayoutByCount[6];
  const meIndex = players.findIndex((p) => p.id === appState.playerId);
  const anchorAngle = Math.PI / 2; // bottom (closest to local player)

  players.forEach((player, idx) => {
    const rotatedIndex = meIndex >= 0 ? idx - meIndex : idx;
    const angle = (meIndex >= 0 ? anchorAngle : -Math.PI / 2) + angleStep * rotatedIndex;
    const xPct = Math.cos(angle) * layout.rx;
    const yPct = Math.sin(angle) * layout.ry;
    const avatarUrl = player.avatar_url || resolvePlayerAvatarUrl(player);

    const currentTurnId = String(game.current_turn_player_id || currentTurnPlayer?.id || "");
    const biddingPhase = String(game.status || "").toLowerCase() === ROOM_STATUS.BIDDING;
    const isCurrentTurn = !biddingPhase && currentTurnId && String(player.id || "") === currentTurnId;
    const isSelf = String(player.id || "") === myId;
    const seat = renderPlayerSeat(player, {
      avatarUrl,
      showFan: true,
      isSelf,
      isCurrentTurn,
      isWinner: game.last_winner_id && game.last_winner_id === player.id,
      left: `calc(50% + ${xPct}%)`,
      top: `calc(50% + ${yPct}%)`,
      rotation: `${Math.round((angle * 180) / Math.PI + 90)}deg`,
      turnBadge: "",
      nameClass: isSelf ? "seat-name seat-name-hidden" : "seat-name",
      metaHtml: !isSelf && showBidWonBadges
        ? `
          <div class="seat-stats">
            <div class="seat-bid">BID ${player.bid === null || player.bid === undefined ? "?" : player.bid}</div>
            <div class="seat-won">WON ${Number(player.tricks_won ?? 0)}</div>
          </div>
        `
        : "",
    });
    seat.style.setProperty("--seat-scale", String(layout.scale));
    playerRing.appendChild(seat);

  });
}

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cardStateSignature(card) {
  if (!card || typeof card !== "object") {
    return "none";
  }
  return [
    String(card.id || ""),
    String(card.type || ""),
    String(card.suit || ""),
    String(card.value ?? ""),
    String(card.mode || ""),
    String(card.label || ""),
  ].join(":");
}

function resolvePlayerAvatarUrl(player) {
  const pid = String(player?.id || "");
  const cachedMeta = appState.playerMetaById?.[pid] || {};
  const cachedAvatar = String(cachedMeta.avatar_url || "");
  if (cachedAvatar) {
    return cachedAvatar;
  }
  const directDiscordId = pid.startsWith("discord-") ? pid.slice("discord-".length) : "";
  if (directDiscordId) {
    const direct = appState.discordProfilesByUserId[directDiscordId]?.avatarUrl || "";
    if (direct) {
      return direct;
    }
  }

  // If this seat is me but player id is not discord-prefixed, still bind my Discord avatar.
  if (pid && pid === String(appState.playerId || "") && appState.discordUserId) {
    const mine = appState.discordProfilesByUserId[String(appState.discordUserId)]?.avatarUrl || "";
    if (mine) {
      return mine;
    }
  }

  // Name-based fallback for participants whose player id is local/random.
  const targetName = normalizeName(player?.name);
  if (targetName) {
    const byName = Object.values(appState.discordProfilesByUserId).find(
      (p) => normalizeName(p?.displayName) === targetName,
    );
    if (byName?.avatarUrl) {
      return byName.avatarUrl;
    }
  }
  return "";
}

function resolvePlayerDisplayName(player) {
  const pid = String(player?.id || "");
  const directName = String(player?.name || "").trim();
  if (directName) {
    return directName;
  }
  const cachedMeta = appState.playerMetaById?.[pid] || {};
  const cachedName = String(cachedMeta.name || "").trim();
  if (cachedName) {
    return cachedName;
  }
  const discordId = String(
    player?.discord_user_id ||
    player?.discordUserId ||
    cachedMeta.discord_user_id ||
    "",
  ).trim();
  if (discordId) {
    const profileName = String(appState.discordProfilesByUserId[discordId]?.displayName || "").trim();
    if (profileName) {
      return profileName;
    }
  }
  return "";
}

function buildReactGameState(state) {
  if (!state || typeof state !== "object") {
    return state;
  }
  const players = Array.isArray(state.players) ? state.players : [];
  return {
    ...state,
    players: players.map((player) => {
      const safePlayer = player && typeof player === "object" ? player : {};
      const resolvedName = resolvePlayerDisplayName(safePlayer);
      const resolvedAvatarUrl = String(safePlayer.avatar_url || resolvePlayerAvatarUrl(safePlayer) || "");
      if (
        resolvedName === String(safePlayer.name || "") &&
        resolvedAvatarUrl === String(safePlayer.avatar_url || "")
      ) {
        return safePlayer;
      }
      return {
        ...safePlayer,
        name: resolvedName || safePlayer.name || "Player",
        avatar_url: resolvedAvatarUrl || null,
      };
    }),
  };
}

function getSelfAvatarUrl() {
  const discordId = String(appState.discordUserId || "").trim();
  if (discordId) {
    const direct = appState.discordProfilesByUserId[discordId]?.avatarUrl || "";
    if (direct) {
      return direct;
    }
    return discordDefaultAvatarUrl(discordId);
  }
  const ownMeta = appState.playerMetaById?.[String(appState.playerId || "")] || {};
  return String(ownMeta.avatar_url || "");
}

function applyAvatarToElement(element, avatarUrl) {
  if (!element) {
    return;
  }
  if (!avatarUrl) {
    element.classList.remove("has-discord-avatar");
    element.style.backgroundImage = "";
    return;
  }
  element.classList.add("has-discord-avatar");
  element.style.backgroundImage = `url("${avatarUrl}")`;
}

function applyAvatarConnectionState(element) {
  if (!element) {
    return;
  }
  const isConnected = appState.discordSdkStatus === "connected";
  element.classList.toggle("sdk-connected", isConnected);
  element.classList.toggle("sdk-disconnected", !isConnected);
}

function playerInitial(name) {
  const safe = String(name || "").trim();
  return safe ? safe.slice(0, 1).toUpperCase() : "?";
}

function avatarColor(seed) {
  let hash = 0;
  const safe = String(seed || "p");
  for (let i = 0; i < safe.length; i += 1) {
    hash = (hash << 5) - hash + safe.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(160deg, hsl(${hue} 76% 72%), hsl(${(hue + 38) % 360} 74% 58%))`;
}

function renderScoreboard(game) {
  if (!scoreRows) {
    return;
  }
  const breakdownByPlayer = Object.fromEntries(
    (Array.isArray(game.score_breakdown) ? game.score_breakdown : []).map((row) => [String(row.player_id || ""), row]),
  );
  const scoreKey = JSON.stringify(
    (game.players || []).map((p) => ({
      id: p.id,
      name: p.name,
      bid: p.bid,
      won: p.tricks_won,
      score: p.score,
      afk: Boolean(p.afk),
      connection_state: p.connection_state,
      round_bonus: breakdownByPlayer[String(p.id || "")]?.round_bonus ?? p.round_bonus,
      success: breakdownByPlayer[String(p.id || "")]?.success,
    })),
  );
  if (appState.uiCache.scoreKey === scoreKey) {
    return;
  }
  appState.uiCache.scoreKey = scoreKey;
  scoreRows.innerHTML = "";

  game.players.forEach((player) => {
    const rowData = breakdownByPlayer[String(player.id || "")] || null;
    const bidText = player.bid === null || player.bid === undefined ? "-" : String(player.bid);
    const wonText = String(Number(player.tricks_won || 0));
    const scoreStatus = scoreStatusLabel(player, rowData);
    const connText = connectionStateLabel(player.connection_state);
    const afkText = player.afk ? " · AFK" : "";
    const bonusText = formatRoundBonusText(player, rowData);
    const row = document.createElement("div");
    row.className = "score-row";
    row.innerHTML = `
      <div>
        <div class="score-name">${escapeHtml(player.name)}</div>
        <div class="score-meta">Bid ${bidText} · Won ${wonText} · ${bonusText} · ${scoreStatus} · ${connText}${afkText}</div>
      </div>
      <div class="chip">${player.score}</div>
    `;
    scoreRows.appendChild(row);
  });
}

function renderLogs(logs) {
  const list = Array.isArray(logs) ? logs : [];
  const logKey = list.join("\n");
  if (appState.uiCache.logKey === logKey) {
    return;
  }
  appState.uiCache.logKey = logKey;
  if (scoreHistoryRows) {
    scoreHistoryRows.innerHTML = "";
    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "log-item";
      empty.textContent = "기록이 아직 없어.";
      scoreHistoryRows.appendChild(empty);
    } else {
      list.forEach((line) => {
        const row = document.createElement("div");
        row.className = "log-item";
        row.textContent = line;
        scoreHistoryRows.appendChild(row);
      });
    }
  }
  if (logArea) {
    logArea.innerHTML = "";
    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "log-item";
      empty.textContent = "로그가 없어.";
      logArea.appendChild(empty);
    } else {
      list.forEach((line) => {
        const row = document.createElement("div");
        row.className = "log-item";
        row.textContent = line;
        logArea.appendChild(row);
      });
    }
  }
}

function openLogDialog() {
  safeOpenDialog(logDialog);
}

function setScoreDrawerTab(tab) {
  const safe = tab === "history" || tab === "guide" ? tab : "scores";
  appState.scoreDrawerTab = safe;
  scoreTabScores?.classList.toggle("active", safe === "scores");
  scoreTabHistory?.classList.toggle("active", safe === "history");
  scoreTabGuide?.classList.toggle("active", safe === "guide");
  scoreScoresPanel?.classList.toggle("hidden", safe !== "scores");
  scoreHistoryPanel?.classList.toggle("hidden", safe !== "history");
  scoreGuidePanel?.classList.toggle("hidden", safe !== "guide");
}

function shouldUseDragPlayUi() {
  return true;
}

function resetHandDragVisual() {
  const drag = appState.handDrag;
  trickCenter?.classList.remove("drag-target-active", "drag-target-ready");
  if (!drag?.element) {
    appState.handDrag = null;
    return;
  }
  drag.element.classList.remove("dragging", "drag-commit");
  drag.element.style.removeProperty("transform");
  drag.element.style.removeProperty("transition");
  drag.element.style.removeProperty("z-index");
  appState.handDrag = null;
  clearHandInspectState({ origin: "drag" });
}

function updateHandDragVisual(event) {
  const drag = appState.handDrag;
  if (!drag?.element || event.pointerId !== drag.pointerId) {
    return;
  }
  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;
  drag.lastDx = dx;
  drag.lastDy = dy;

  const desktopPointer = window.matchMedia?.("(pointer: fine)")?.matches;
  const commitDistance = desktopPointer
    ? Math.max(110, Math.min(220, window.innerHeight * 0.2))
    : Math.max(90, Math.min(180, window.innerHeight * 0.18));
  const lift = Math.min(170, Math.max(0, -dy));
  const pullX = dx * (desktopPointer ? 0.38 : 0.48);
  const pullY = Math.min(16, dy * 0.15) - lift;
  const tilt = Math.max(-18, Math.min(18, dx * (desktopPointer ? 0.06 : 0.08)));

  drag.element.classList.add("dragging");
  drag.element.classList.toggle("drag-commit", lift >= commitDistance);
  trickCenter?.classList.add("drag-target-active");
  trickCenter?.classList.toggle("drag-target-ready", lift >= commitDistance);
  drag.element.style.transition = "none";
  drag.element.style.zIndex = "140";
  drag.element.style.transform =
    `translate(calc(-50% + ${drag.baseX}px + ${pullX}px), calc(${drag.baseY}px + ${pullY}px)) rotate(${drag.baseRot + tilt}deg) scale(${desktopPointer ? 1.18 : 1.16})`;
}

function endHandCardDrag(event) {
  const drag = appState.handDrag;
  if (!drag || event.pointerId !== drag.pointerId) {
    return;
  }
  const lifted = Math.max(0, -(Number(drag.lastDy || 0)));
  const desktopPointer = window.matchMedia?.("(pointer: fine)")?.matches;
  const commitDistance = desktopPointer
    ? Math.max(110, Math.min(220, window.innerHeight * 0.2))
    : Math.max(90, Math.min(180, window.innerHeight * 0.18));
  const shouldCommit = lifted >= commitDistance && drag.clickable;
  appState.handDragSuppressUntil = Date.now() + 280;
  window.removeEventListener("pointermove", updateHandDragVisual);
  window.removeEventListener("pointerup", endHandCardDrag);
  window.removeEventListener("pointercancel", endHandCardDrag);
  resetHandDragVisual();
  if (shouldCommit) {
    playFromHand(drag.index, drag.card).catch(() => {});
    return;
  }
}

function startHandCardDrag(event, options) {
  if (!shouldUseDragPlayUi() || !options?.clickable) {
    return false;
  }
  event.preventDefault();
  setHandInspectState({
    index: options.index,
    card: options.card,
    clickable: options.clickable,
    legal: options.clickable,
    origin: "drag",
  });
  appState.handDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    lastDx: 0,
    lastDy: 0,
    index: options.index,
    card: options.card,
    clickable: Boolean(options.clickable),
    baseX: Number(options.baseX || 0),
    baseY: Number(options.baseY || 0),
    baseRot: Number(options.baseRot || 0),
    element: options.element || null,
  };
  options.element?.setPointerCapture?.(event.pointerId);
  window.addEventListener("pointermove", updateHandDragVisual);
  window.addEventListener("pointerup", endHandCardDrag);
  window.addEventListener("pointercancel", endHandCardDrag);
  return true;
}

function renderHand(game, me) {
  const uiModel = appState.uiModel || deriveUiModel(game);
  const playPreview = resolvePlaySubmitPreview(game);
  const dealKey = `${game.round_number}:${me?.id}:${me?.hand?.length}`;
  const isDeal = dealKey !== appState.uiCache.dealKey;
  const handKey = [
    String(game.status || ""),
    String(game.turn_index || 0),
    String(trickHoldRemainingSeconds(game) > 0),
    String(appState.selectedCardIndex ?? ""),
    String(appState.pendingAction.kind || ""),
    String(playPreview?.index ?? ""),
    String(Boolean(uiModel?.interactionLocked)),
    String(me?.id || ""),
    Array.isArray(me?.legal_indexes) ? me.legal_indexes.join(",") : "",
    Array.isArray(me?.hand) ? me.hand.map((card) => cardStateSignature(card)).join("|") : "",
  ].join("~");
  if (appState.uiCache.handKey === handKey) {
    return;
  }
  appState.uiCache.handKey = handKey;
  if (isDeal) appState.uiCache.dealKey = dealKey;
  handArea.innerHTML = "";
  if (!me) {
    return;
  }

  if (!me.hand.length) {
    const empty = document.createElement("div");
    empty.className = "log-item";
    empty.textContent = "손패 없음";
    handArea.appendChild(empty);
    return;
  }

  const pendingCardIndex =
    String(playPreview?.playerId || "") === String(me?.id || appState.playerId || "")
      ? Number(playPreview?.index)
      : null;
  const visibleHand = me.hand
    .map((card, idx) => ({ card, idx }))
    .filter((entry) => entry.idx !== pendingCardIndex);
  const n = visibleHand.length;
  const center = (n - 1) / 2;
  const viewportWidth = Math.max(320, window.innerWidth || 0);
  const compactViewport = viewportWidth < 760;
  const tabletViewport = viewportWidth < 1100;
  const handWidth = Math.max(compactViewport ? 260 : 520, handArea?.clientWidth || viewportWidth || 640);
  const minCardWidth = compactViewport ? 50 : tabletViewport ? 64 : 76;
  const maxCardWidth = compactViewport ? 66 : tabletViewport ? 82 : 92;
  const cardWidth = Math.min(
    maxCardWidth,
    Math.max(minCardWidth, handWidth * (compactViewport ? 0.122 : tabletViewport ? 0.096 : 0.078)),
  );
  const edgePadding = compactViewport ? 10 : tabletViewport ? 18 : 28;
  const desiredOverlap = compactViewport ? 0.62 : tabletViewport ? 0.52 : 0.44;
  const spreadByCard = Math.max(cardWidth * (1 - desiredOverlap), compactViewport ? 20 : tabletViewport ? 30 : 40);
  const maxReach = Math.max(0, (handWidth - cardWidth - edgePadding * 2) / 2);
  const maxSpreadByWidth = center > 0 ? maxReach / center : spreadByCard;
  const spread = Math.max(
    compactViewport ? 18 : tabletViewport ? 26 : 34,
    Math.min(spreadByCard, maxSpreadByWidth || spreadByCard),
  );
  const liftFactor = compactViewport ? 0.9 : tabletViewport ? 0.72 : 0.54;
  const rotationFactor = compactViewport ? 7 : tabletViewport ? 5.5 : 4.2;
  const currentTurnId = String(game.current_turn_player_id || game.players?.[game.turn_index]?.id || "");
  const viewerPlayerId = String(me?.id || appState.playerId || "");
  const canPlay = game.status === "playing" && currentTurnId === viewerPlayerId && trickHoldRemainingSeconds(game) <= 0;
  const legalIndexes = Array.isArray(me.legal_indexes) ? me.legal_indexes : [];
  handArea.classList.toggle("is-turn", canPlay);
  handArea.classList.toggle("is-waiting-turn", !canPlay);
  handArea.classList.toggle("has-legal-moves", canPlay && legalIndexes.length > 0);
  handArea.classList.toggle("is-locked", Boolean(uiModel?.interactionLocked));

  visibleHand.forEach(({ card, idx }, visibleIdx) => {
    const offset = visibleIdx - center;
    const x = offset * spread;
    const y = Math.pow(Math.abs(offset), 1.72) * liftFactor;
    const rot = offset * rotationFactor;
    const legal = legalIndexes.includes(idx);
    const clickable = canPlay && legal && !uiModel?.interactionLocked && !isPendingAction(PENDING_ACTION_KIND.SUBMIT_CARD);
    const isBlocked = canPlay && !legal;
    const wrapper = renderCard(card, {
      className: "hand-card",
      cardIndex: idx,
      x,
      y,
      rot,
      zIndex: 400 + idx,
      playable: clickable,
      legal: canPlay && legal,
      blocked: isBlocked,
    });
    wrapper.dataset.baseX = String(x);
    wrapper.dataset.baseY = String(y);
    wrapper.dataset.baseRot = String(rot);
    wrapper.setAttribute("role", "button");
    wrapper.setAttribute("tabindex", clickable ? "0" : "-1");
    wrapper.setAttribute("aria-label", `${cardDisplayName(card)} · ${clickable ? "제출 가능" : legal ? "턴 대기" : "지금은 불가"}`);
    wrapper.title = canPlay ? (legal ? "선택 가능한 카드" : "지금은 낼 수 없는 카드") : cardDisplayName(card);
    wrapper.addEventListener("pointerenter", () => {
      setHandInspectState({
        index: idx,
        card,
        clickable,
        legal,
        origin: "hover",
      });
    });
    wrapper.addEventListener("pointerleave", () => {
      clearHandInspectState({ index: idx, origin: "hover" });
    });
    wrapper.addEventListener("focus", () => {
      setHandInspectState({
        index: idx,
        card,
        clickable,
        legal,
        origin: "focus",
      });
    });
    wrapper.addEventListener("blur", () => {
      clearHandInspectState({ index: idx, origin: "focus" });
    });
    if (clickable) {
      wrapper.addEventListener("pointerdown", (event) => {
        startHandCardDrag(event, {
          index: idx,
          card,
          clickable,
          baseX: x,
          baseY: y,
          baseRot: rot,
          element: wrapper,
        });
      });
      wrapper.addEventListener("click", (event) => {
        if (Date.now() < Number(appState.handDragSuppressUntil || 0)) {
          return;
        }
        event.preventDefault();
        playFromHand(idx, card).catch(() => {});
      });
      wrapper.addEventListener("keydown", (event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          playFromHand(idx, card).catch(() => {});
        }
      });
    }
    // deal animation: stagger each card by 60ms
    if (isDeal) {
      const delay = visibleIdx * 60;
      wrapper.style.setProperty("--deal-delay", `${delay}ms`);
      wrapper.style.setProperty("--deal-duration", "420ms");
      wrapper.classList.add("hs-dealing");
      wrapper.addEventListener("animationend", () => wrapper.classList.remove("hs-dealing"), { once: true });
    }

    handArea.appendChild(wrapper);
  });
}

function buildCardVisualClass(card) {
  const safeType = String(card?.type || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const safeSuit = String(card?.suit || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return `type-${safeType}${safeSuit ? ` suit-${safeSuit}` : ""}`;
}

// ── Hearthstone 3D tilt ──────────────────────────────────────────────────

function attachCardTilt(cardEl) {
  function onMove(e) {
    if (appState.handDrag) return;
    const rect = cardEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);   // -1 … 1
    const dy = (e.clientY - cy) / (rect.height / 2);  // -1 … 1
    const tiltY = (dx * 14).toFixed(1);   // left/right tilt
    const tiltX = (-dy * 9).toFixed(1);  // up/down tilt
    cardEl.style.setProperty("--tilt-x", `${tiltX}deg`);
    cardEl.style.setProperty("--tilt-y", `${tiltY}deg`);
  }
  function onLeave() {
    cardEl.style.setProperty("--tilt-x", "0deg");
    cardEl.style.setProperty("--tilt-y", "0deg");
  }
  cardEl.addEventListener("mousemove", onMove);
  cardEl.addEventListener("mouseleave", onLeave);
}

function cardMetaText(card) {
  if (card?.type === "suit") {
    return Number.isFinite(card?.value) ? `숫자 ${card.value}` : "숫자 카드";
  }
  const specialLabels = {
    pirate: "해적",
    mermaid: "인어",
    skull_king: "해골왕",
    escape: "탈출",
    tigress: "타이그레스",
    kraken: "크라켄",
    white_whale: "백경",
  };
  return specialLabels[card?.type] || "스페셜";
}

function selectCardFromHand(index, card) {
  if (!Number.isInteger(index)) {
    return;
  }
  playFromHand(index, card).catch(() => {});
}

async function playFromHand(index, card) {
  if (!appState.sessionId || isPendingAction()) {
    return;
  }
  const liveGame = appState.game;
  if (!liveGame || String(liveGame.status || "").toLowerCase() !== ROOM_STATUS.PLAYING) {
    return;
  }
  const uiModel = appState.uiModel || deriveUiModel(liveGame);
  const viewerPlayerId = String(uiModel?.me?.id || appState.playerId || "");
  if (uiModel.interactionLocked) {
    showToast(uiModel.interactionLockReason || "지금은 조작할 수 없어.");
    return;
  }
  const liveTurnPlayer = uiModel.currentTurnPlayer || liveGame.players?.[liveGame.turn_index];
  if (!liveTurnPlayer || String(liveTurnPlayer.id || "") !== viewerPlayerId) {
    clearSelectedCard();
    await refreshState({ longPoll: false, full: true }).catch(() => {});
    return;
  }
  const liveMe = uiModel.me || liveGame.players?.find((player) => String(player?.id || "") === viewerPlayerId);
  if (!liveMe) {
    return;
  }
  const liveCard = liveMe.hand?.[index] || card;
  const legalIndexes = Array.isArray(liveMe.legal_indexes) ? liveMe.legal_indexes : [];
  if (!legalIndexes.includes(index)) {
    clearSelectedCard();
    await refreshState({ longPoll: false, full: true }).catch(() => {});
    return;
  }
  if (String(liveGame.phase || "").toLowerCase() !== GAME_PHASE.PLAYING) {
    clearSelectedCard();
    await refreshState({ longPoll: false, full: true }).catch(() => {});
    return;
  }

  let tigressMode = null;
  if (liveCard?.needs_mode) {
    tigressMode = await pickTigressMode();
    if (!tigressMode) {
      return;
    }
  }
  const previewCard =
    tigressMode && liveCard
      ? {
          ...liveCard,
          mode: tigressMode,
        }
      : liveCard;
  const animationKey = buildPlayedCardAnimationKey({
    sessionId: appState.sessionId,
    roundNumber: liveGame.round_number || 0,
    tricksCompleted: liveGame.tricks_completed || 0,
    playerId: viewerPlayerId,
    card: previewCard,
  });
  const requestId = crypto.randomUUID();

  setPendingAction(PENDING_ACTION_KIND.SUBMIT_CARD, {
    key: `${appState.sessionId}:${liveGame.round_number || 0}:${index}`,
    cardIndex: index,
  });
  let releasePendingOnExit = true;

  try {
    clearHandInspectState();
    markAnimatedTrickCard(animationKey);
    setPlaySubmitPreview({
      sessionId: appState.sessionId,
      playerId: viewerPlayerId,
      index,
      card: previewCard,
      animationKey,
      requestId,
    });
    window.SkullKingFX?.playCardEvent?.({
      card: previewCard,
      effectType: previewCard?.type || previewCard?.kind || "",
      sourceElement: handArea?.querySelector?.(`.hand-card[data-card-index="${index}"]`),
      sourcePlayerId: viewerPlayerId,
      boardSelector: "#gamePanel .table-wrap",
      result: "pending",
    });
    clearSelectedCard({ skipRender: true });
    requestRender();
    await post(`/activity/sessions/${appState.sessionId}/play?compact=true`, {
      player_id: viewerPlayerId,
      card_index: index,
      tigress_mode: tigressMode,
      request_id: requestId,
    });
    releasePendingOnExit = false;
    schedulePlaySubmitSync();
  } catch (error) {
    unmarkAnimatedTrickCard(animationKey);
    clearPlaySubmitSyncTimer();
    clearPlaySubmitPreview({ skipRender: true });
    if (error?.status === 400 || error?.status === 409) {
      clearSelectedCard({ skipRender: true });
      requestRender();
      await refreshState({ longPoll: false, full: true }).catch(() => {});
      showToast(error?.message || "턴이 변경되어 상태를 다시 동기화했어.");
      return;
    }
    showToast(error.message || "카드 플레이 실패");
  } finally {
    if (releasePendingOnExit) {
      clearPendingAction(PENDING_ACTION_KIND.SUBMIT_CARD);
    }
  }
}

function pickTigressMode() {
  return new Promise((resolve) => {
    if (!tigressDialog?.showModal) {
      resolve("pirate");
      return;
    }

    const buttons = tigressDialog.querySelectorAll("button[data-mode]");
    const onClick = (event) => {
      const mode = event.currentTarget.getAttribute("data-mode");
      cleanup();
      tigressDialog.close();
      resolve(mode);
    };
    const onCancel = (event) => {
      event.preventDefault();
      cleanup();
      forceCloseDialog(tigressDialog);
      resolve(null);
    };
    const onClose = () => {
      cleanup();
      resolve(null);
    };

    const cleanup = () => {
      buttons.forEach((btn) => btn.removeEventListener("click", onClick));
      tigressDialog.removeEventListener("cancel", onCancel);
      tigressDialog.removeEventListener("close", onClose);
    };

    buttons.forEach((btn) => btn.addEventListener("click", onClick));
    tigressDialog.addEventListener("cancel", onCancel, { once: true });
    tigressDialog.addEventListener("close", onClose, { once: true });
    safeOpenDialog(tigressDialog);
    buttons[0]?.focus?.();
  });
}

function pingToneClass(valueMs) {
  const safe = Math.max(0, Math.round(Number(valueMs || 0)));
  if (!safe) {
    return "";
  }
  if (safe >= 220) {
    return "ping-bad";
  }
  if (safe >= 120) {
    return "ping-warn";
  }
  return "ping-good";
}

function renderPingDisplays() {
  const pingMs = Number(appState.ping?.valueMs || 0);
  const lastUpdatedAt = Number(appState.ping?.lastUpdatedAt || 0);
  const isFresh = Boolean(lastUpdatedAt) && (Date.now() - lastUpdatedAt) <= PING_STALE_AFTER_MS;
  const label = isFresh && pingMs > 0 ? `${pingMs} ms` : "-- ms";
  const tone = isFresh ? pingToneClass(pingMs) : "";
  const pingDisplays = getPingDisplayNodes();
  pingDisplays.forEach((el) => {
    if (!el) {
      return;
    }
    el.textContent = label;
    el.setAttribute("aria-label", isFresh && pingMs > 0 ? `Ping ${pingMs} milliseconds` : "Ping unavailable");
    el.classList.remove("ping-good", "ping-warn", "ping-bad");
    if (tone) {
      el.classList.add(tone);
    }
  });
}

function medianOfSamples(values = []) {
  const numbers = values
    .map((value) => Math.max(0, Math.round(Number(value || 0))))
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  if (!numbers.length) {
    return 0;
  }
  const mid = Math.floor(numbers.length / 2);
  if (numbers.length % 2 === 1) {
    return numbers[mid];
  }
  return Math.round((numbers[mid - 1] + numbers[mid]) / 2);
}

function computePingJitter(values = []) {
  const numbers = values
    .map((value) => Math.max(0, Math.round(Number(value || 0))))
    .filter((value) => value > 0);
  if (numbers.length < 2) {
    return 0;
  }
  let totalDelta = 0;
  for (let index = 1; index < numbers.length; index += 1) {
    totalDelta += Math.abs(numbers[index] - numbers[index - 1]);
  }
  return Math.round(totalDelta / Math.max(1, numbers.length - 1));
}

function updateMeasuredPing(durationMs, source = "") {
  const safe = Math.max(0, Math.round(Number(durationMs || 0)));
  if (!safe) {
    return;
  }
  const samples = Array.isArray(appState.ping?.samples) ? [...appState.ping.samples, safe] : [safe];
  appState.ping.samples = samples.slice(-7);
  appState.ping.valueMs = medianOfSamples(appState.ping.samples);
  appState.ping.jitterMs = computePingJitter(appState.ping.samples);
  appState.ping.lastSource = String(source || appState.ping.lastSource || "");
  appState.ping.lastUpdatedAt = Date.now();
  renderPingDisplays();
}

function clearPendingPingProbe() {
  if (appState.ping.timeout) {
    clearTimeout(appState.ping.timeout);
    appState.ping.timeout = null;
  }
  appState.ping.pendingToken = "";
  appState.ping.startedAtPerf = 0;
  appState.ping.inFlight = false;
}

async function probeHttpPing() {
  const startedAt = performance.now();
  const response = await fetch(`${appState.apiBase}/ping?ts=${Date.now()}`, {
    method: "HEAD",
    headers: {
      ...buildIdentityHeaders(appState.sessionId),
    },
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    return;
  }
  const serverTimeHeader = Number(response.headers.get("x-server-time-ms") || 0);
  syncServerClock(serverTimeHeader);
  updateMeasuredPing(performance.now() - startedAt, "http-head");
}

function tryProbeWsPing() {
  const ws = appState.ws;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return false;
  }
  const token = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  try {
    appState.ping.startedAtPerf = performance.now();
    ws.send(JSON.stringify({ type: "ping", token, client_time_ms: Date.now() }));
    appState.ping.pendingToken = token;
    appState.ping.timeout = setTimeout(() => {
      clearPendingPingProbe();
    }, WS_PING_TIMEOUT_MS);
    return true;
  } catch (_) {
    clearPendingPingProbe();
    return false;
  }
}

function handleWsPong(payload) {
  const token = String(payload?.token || "");
  if (!token || token !== String(appState.ping.pendingToken || "")) {
    return;
  }
  syncServerClock(payload?.server_time_ms);
  updateMeasuredPing(performance.now() - Number(appState.ping.startedAtPerf || 0), "ws");
  clearPendingPingProbe();
}

async function probePing() {
  if (appState.ping.inFlight) {
    return;
  }
  appState.ping.inFlight = true;
  try {
    if (tryProbeWsPing()) {
      return;
    }
    await probeHttpPing();
  } catch (_) {
    // Ignore ping probe failures and keep the last good sample.
  } finally {
    if (!appState.ping.pendingToken) {
      appState.ping.inFlight = false;
    }
  }
}

function startPingProbeLoop() {
  if (appState.ping.timer) {
    clearInterval(appState.ping.timer);
  }
  appState.ping.timer = setInterval(() => {
    probePing().catch(() => {});
  }, PING_PROBE_INTERVAL_MS);
  probePing().catch(() => {});
}

async function get(path, options = {}) {
  const measurePing = options.measurePing === true;
  const startedAt = measurePing ? performance.now() : 0;
  const response = await fetch(`${appState.apiBase}${path}`, {
    headers: {
      ...buildIdentityHeaders(appState.sessionId),
    },
    credentials: "include",
  });
  if (!response.ok) {
    throw await buildHttpError(response);
  }
  const payload = await response.json();
  if (measurePing) {
    updateMeasuredPing(performance.now() - startedAt, "http-api");
  }
  rememberIdentityTokenFromPayload(payload, appState.sessionId);
  return payload;
}

async function post(path, body, options = {}) {
  const measurePing = options.measurePing === true;
  const startedAt = measurePing ? performance.now() : 0;
  const response = await fetch(`${appState.apiBase}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildIdentityHeaders(appState.sessionId),
    },
    credentials: "include",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await buildHttpError(response);
  }

  const payload = await response.json();
  if (measurePing) {
    updateMeasuredPing(performance.now() - startedAt, "http-api");
  }
  rememberIdentityTokenFromPayload(payload, body?.session_id || appState.sessionId);
  return payload;
}

async function buildHttpError(response) {
  const error = new Error();
  error.status = response.status;
  try {
    const payload = await response.json();
    error.detail = payload.detail;
    if (typeof payload.detail === "string" && payload.detail.startsWith("already_joined_session:")) {
      const sessionId = payload.detail.split(":").slice(1).join(":") || "-";
      error.message = `이미 다른 방(${sessionId})에 참가 중이야. 먼저 그 방에서 나와줘.`;
    } else {
      error.message = payload.detail || `HTTP ${response.status}`;
    }
  } catch {
    error.message = `HTTP ${response.status}`;
  }
  return error;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 1400);
}

function maybeToast(message) {
  if (maybeToast.last === message) {
    return;
  }
  maybeToast.last = message;
  showToast(message);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function syncServerClock(serverTimeMs) {
  const safe = Number(serverTimeMs || 0);
  if (!Number.isFinite(safe) || safe <= 0) {
    return;
  }
  appState.latestServerTimeMs = safe;
  appState.serverClockOffsetMs = safe - Date.now();
}

function serverNowMs() {
  return Date.now() + Number(appState.serverClockOffsetMs || 0);
}

function resetRenderCache() {
  clearPlaySubmitSyncTimer();
  if (appState.tableFxTimer) {
    clearTimeout(appState.tableFxTimer);
    appState.tableFxTimer = null;
  }
  appState.uiCache.trickKey = "";
  appState.uiCache.trickAnimationStageKey = "";
  appState.uiCache.trickAnimatedCardsByPlayer = {};
  appState.uiCache.animatedTrickCardKeys = {};
  appState.uiCache.cinematicFxKeys = {};
  appState.uiCache.handKey = "";
  appState.uiCache.ringKey = "";
  appState.uiCache.lobbyKey = "";
  appState.uiCache.scoreKey = "";
  appState.uiCache.logKey = "";
  if (tableCinematicFx) {
    tableCinematicFx.innerHTML = "";
  }
  applyBoardShake("none");
}

function requestRender() {
  if (appState.renderPending) {
    return;
  }
  appState.renderPending = true;
  requestAnimationFrame(() => {
    appState.renderPending = false;
    render();
  });
}

function turnClockKey(game) {
  if (!game) {
    return "none";
  }
  const turnLimit = resolvedTurnLimitSeconds(game);
  if (game.status === "bidding") {
    const pending = (game.players || [])
      .filter((p) => p.bid === null)
      .map((p) => p.id)
      .join(",");
    return `bidding:${game.round_number}:${pending}:${turnLimit}`;
  }
  if (game.status === "playing") {
    return `playing:${game.round_number}:${game.tricks_completed}:${game.turn_index}:${(game.current_trick || []).length}:${Number(game.trick_hold_until || 0)}:${turnLimit}`;
  }
  return `idle:${game.status}:${game.round_number}:${game.tricks_completed}:${turnLimit}`;
}

function updateTurnClock(game, me, currentTurnPlayer) {
  const key = turnClockKey(game);
  const nowMs = serverNowMs();
  if (appState.turnClock.key !== key) {
    appState.turnClock.key = key;
    appState.turnClock.startedAtMs = nowMs;
    appState.turnClock.limitSeconds = Math.max(
      1,
      resolvedTurnLimitSeconds(game),
    );
    appState.turnClock.serverStartedAtSec = Number(game?.turn_started_at || 0);
    appState.turnClock.serverDeadlineAtSec = Number(game?.turn_deadline_at || 0);
    appState.turnClock.lastRenderedSecond = -1;
    appState.turnClock.lastRenderedPreBidSecond = -1;
    appState.turnClock.lastRenderedRoundText = "";
  }

  const deadlineSec = Number(game?.turn_deadline_at || appState.turnClock.serverDeadlineAtSec || 0);
  const startSec = Number(game?.turn_started_at || appState.turnClock.serverStartedAtSec || 0);
  const limitSec = Math.max(1, resolvedTurnLimitSeconds(game) || appState.turnClock.limitSeconds || TURN_LIMIT_SECONDS);
  const holdSecondsLeft = trickHoldRemainingSeconds(game);

  appState.turnClock.serverStartedAtSec = startSec;
  appState.turnClock.serverDeadlineAtSec = deadlineSec;
  appState.turnClock.limitSeconds = limitSec;

  const totalMs = limitSec * 1000;
  let remainingMs = 0;
  if (startSec > 0 && startSec * 1000 > nowMs) {
    remainingMs = totalMs;
  } else if (deadlineSec > 0) {
    remainingMs = Math.max(0, deadlineSec * 1000 - nowMs);
  } else if (startSec > 0) {
    const elapsedMs = Math.max(0, nowMs - startSec * 1000);
    remainingMs = Math.max(0, totalMs - elapsedMs);
  } else {
    const elapsedMs = Math.max(0, nowMs - Number(appState.turnClock.startedAtMs || nowMs));
    remainingMs = Math.max(0, totalMs - elapsedMs);
  }

  const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
  const preBidSecondsLeft = preBidDelayRemainingSeconds(game);
  return {
    key,
    totalMs,
    remainingMs,
    secondsLeft: remaining,
    preBidActive: preBidSecondsLeft > 0,
    preBidSecondsLeft,
    preBidRemainingMs: Math.max(0, preBidSecondsLeft * 1000),
    holdActive: holdSecondsLeft > 0,
    holdSecondsLeft,
    active: String(game?.status || "").toLowerCase() === "bidding" || String(game?.status || "").toLowerCase() === "playing",
  };
}

function startTurnClockAnimator() {
  if (appState.turnClock.rafId) {
    return;
  }
  const tick = () => {
    appState.turnClock.rafId = window.setTimeout(tick, 125);
    paintTurnClockFrame();
  };
  appState.turnClock.rafId = window.setTimeout(tick, 125);
}

function paintTurnClockFrame() {
  const game = appState.game;
  if (!game) {
    return;
  }
  if (document.hidden) {
    return;
  }
  if (gamePanel?.classList.contains("hidden")) {
    return;
  }
  const me = resolveCurrentPlayer(game);
  const currentTurnPlayer = game.players?.[game.turn_index];
  const clock = updateTurnClock(game, me, currentTurnPlayer);
  const preBidWasActive = Boolean(appState.turnClock.lastPreBidActive);
  appState.turnClock.lastPreBidActive = Boolean(clock.preBidActive);
  if (preBidWasActive && !clock.preBidActive && String(game.status || "").toLowerCase() === ROOM_STATUS.BIDDING) {
    requestRender();
  }
  if (!clock.active) {
    return;
  }

  if (clock.preBidActive) {
    const sec = Number(clock.preBidSecondsLeft || 0);
    if (appState.turnClock.lastRenderedPreBidSecond !== sec) {
      appState.turnClock.lastRenderedPreBidSecond = sec;
      requestRender();
    }
    return;
  }

  if (clock.holdActive) {
    const sec = Number(clock.holdSecondsLeft || 0);
    if (appState.turnClock.lastRenderedSecond !== sec) {
      appState.turnClock.lastRenderedSecond = sec;
      requestRender();
    }
    return;
  }

  const sec = Number(clock.secondsLeft || 0);
  if (appState.turnClock.lastRenderedSecond !== sec) {
    appState.turnClock.lastRenderedSecond = sec;
    renderTurnProgress(game, clock);
    const centerTimer = trickCenter?.querySelector(".turn-timer");
    if (centerTimer) {
      const nextTimerText = `${sec}초`;
      if (centerTimer.textContent !== nextTimerText) {
        centerTimer.textContent = nextTimerText;
      }
    }
  }
}

function openBidDialog(maxBid) {
  if (!bidDialog) {
    return;
  }
  if (isPreBidDelayActive(appState.game)) {
    return;
  }
  if (bidDialog.open) {
    return;
  }
  // Prevent dialog-stack conflicts from blocking bid prompt.
  closeEventDialog();
  finishDialog?.close?.();
  tigressDialog?.close?.();
  createRoomDialog?.close?.();
  findRoomDialog?.close?.();
  if (bidDialogInput) {
    bidDialogInput.max = String(maxBid);
  }
  if (bidDialogHint) {
    const round = Number(appState.game?.round_number || 0);
    bidDialogHint.textContent = `Round ${round > 0 ? round : "-"} · Limit ${resolvedTurnLimitSeconds(appState.game)}s`;
  }
  if (bidDialogMeta) {
    bidDialogMeta.textContent = `손패 확인 ${PRE_BID_DELAY_SECONDS}초 후 동시 비딩 · 제한 시간 ${resolvedTurnLimitSeconds(appState.game)}초`;
  }
  updateBidStepButtons();
  safeOpenDialog(bidDialog);
}

function closeBidDialog() {
  forceCloseDialog(bidDialog);
}

function preferredBootFallbackView() {
  if (appState.game && String(appState.game?.session_id || "") === String(appState.sessionId || "")) {
    return deriveViewFromState(appState.game);
  }
  if (appState.currentView === "lobby" || appState.currentView === "game") {
    return appState.currentView;
  }
  return "home";
}

async function settleBootToLaunchSessionOrFallback(defaultView = "home") {
  const resumed = await tryAutoResume();
  if (resumed) {
    const resumedView = preferredBootFallbackView();
    updateViewportMode();
    return resumedView;
  }

  const autoJoined = await tryAutoJoinLaunchSession();
  if (autoJoined) {
    const joinedView = preferredBootFallbackView();
    updateViewportMode();
    return joinedView;
  }

  if (defaultView === "home") {
    setView("home");
    await loadRooms(false).catch(() => {});
  }
  return defaultView;
}

function safeOpenDialog(dialog) {
  if (!dialog || dialog.open) {
    return;
  }
  closeOtherDialogs(dialog);
  try {
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
      return;
    }
  } catch (_) {
    // Another modal may already be open. Fall back to non-modal open.
  }
  try {
    if (typeof dialog.show === "function") {
      dialog.show();
      return;
    }
  } catch (_) {}
  dialog.setAttribute("open", "");
}

function forceCloseDialog(dialog) {
  if (!dialog) {
    return;
  }
  try {
    if (typeof dialog.close === "function") {
      dialog.close();
    }
  } catch (_) {}
  try {
    dialog.removeAttribute("open");
  } catch (_) {}
}

function closeOtherDialogs(exceptDialog) {
  const dialogs = getManagedDialogs();
  dialogs.forEach((dialog) => {
    if (!dialog || dialog === exceptDialog) {
      return;
    }
    forceCloseDialog(dialog);
  });
}

function stepBidDialogValue(delta) {
  if (!bidDialogInput) {
    return;
  }
  const max = Number(bidDialogInput.max || 0);
  const current = Number(bidDialogInput.value || 0);
  const next = Math.max(0, Math.min(max, current + delta));
  if (next === current) {
    updateBidStepButtons();
    return;
  }
  bidDialogInput.value = String(next);
  pulseBidValue();
  updateBidStepButtons();
}

function normalizeBidDialogValue() {
  if (!bidDialogInput) {
    return;
  }
  const text = String(bidDialogInput.value ?? "").trim();
  if (text === "") {
    return;
  }
  const max = Number(bidDialogInput.max || 0);
  const raw = Number(bidDialogInput.value || 0);
  const safe = Math.max(0, Math.min(max, Number.isFinite(raw) ? raw : 0));
  bidDialogInput.value = String(Math.trunc(safe));
}

function pulseBidValue() {
  if (!bidDialogInput) {
    return;
  }
  bidDialogInput.classList.remove("value-pop");
  void bidDialogInput.offsetWidth;
  bidDialogInput.classList.add("value-pop");
  window.setTimeout(() => {
    bidDialogInput?.classList.remove("value-pop");
  }, 170);
}

function updateBidStepButtons() {
  if (!bidDialogInput) {
    return;
  }
  const max = Number(bidDialogInput.max || 0);
  const current = Number(bidDialogInput.value || 0);
  if (bidMinusBtn) {
    const disabled = current <= 0;
    bidMinusBtn.disabled = disabled;
    bidMinusBtn.classList.toggle("is-disabled", disabled);
  }
  if (bidPlusBtn) {
    const disabled = current >= max;
    bidPlusBtn.disabled = disabled;
    bidPlusBtn.classList.toggle("is-disabled", disabled);
  }
}

function snapshotFromGame(game) {
  const scores = {};
  (game.players || []).forEach((p) => {
    scores[p.id] = Number(p.score || 0);
  });
  return {
    status: game.status,
    round: Number(game.round_number || 0),
    tricks: Number(game.tricks_completed || 0),
    scores,
  };
}

function applyLatestFlowEventUi(game, flowEvent) {
  if (!flowEvent || typeof flowEvent !== "object") {
    return;
  }
  const kind = String(flowEvent.kind || "");
  if (kind === "trick_resolved") {
    holdResolvedTrick(game, flowEvent);
    closeEventDialog();
    return;
  }
  if (kind === "round_scored") {
    showScoreDialogTemporarily(5000);
    closeBidDialog();
    return;
  }
  if (kind === "game_started" || kind === "round_started") {
    closeEventDialog();
    closeBidDialog();
  }
}

function handleGameTransitions(game) {
  const prev = appState.lastSnapshot;
  const next = snapshotFromGame(game);
  const flowSignature = flowEventsSignature(game?.flow_events);
  const latestFlowEvent = latestFlowEventFromState(game);
  if (!prev) {
    appState.lastHandledFlowSignature = flowSignature;
    appState.lastSnapshot = next;
    return;
  }
  if (flowSignature && flowSignature !== String(appState.lastHandledFlowSignature || "")) {
    appState.lastHandledFlowSignature = flowSignature;
    applyLatestFlowEventUi(game, latestFlowEvent);
  }

  if (!flowSignature && next.tricks > prev.tricks) {
    holdResolvedTrick(game, {
      at: `${game?.session_id || ""}:${next.round}:${next.tricks}`,
      winner_id: game.last_winner_id,
      discarded: false,
      applied_rule: "",
    });
    closeEventDialog();
  }

  if (!flowSignature && next.status === "waiting_round" && prev.status !== "waiting_round") {
    showScoreDialogTemporarily(5000);
    closeBidDialog();
  }

  appState.lastSnapshot = next;
}

function showEventDialog(title, lines) {
  if (!eventDialog) {
    return;
  }
  eventDialogTitle.textContent = title;
  eventDialogBody.innerHTML = "";
  (lines || []).forEach((line) => {
    const div = document.createElement("div");
    div.className = "event-line";
    div.textContent = line;
    eventDialogBody.appendChild(div);
  });
  safeOpenDialog(eventDialog);
  if (appState.eventAutoCloseTimer) {
    clearTimeout(appState.eventAutoCloseTimer);
  }
  appState.eventAutoCloseTimer = setTimeout(() => {
    closeEventDialog();
  }, 3000);
}

function closeEventDialog() {
  if (appState.eventAutoCloseTimer) {
    clearTimeout(appState.eventAutoCloseTimer);
    appState.eventAutoCloseTimer = null;
  }
  forceCloseDialog(eventDialog);
}

function showScoreDialogTemporarily(ms = 5000) {
  if (!scoreDialog) {
    return;
  }
  openScoreDrawer();
  appState.scoreAutoDismissArmed = true;
  if (appState.scoreAutoCloseTimer) {
    clearTimeout(appState.scoreAutoCloseTimer);
  }
  appState.scoreAutoCloseTimer = setTimeout(() => {
    closeAutoScoreDialog();
  }, ms);
}

function closeAutoScoreDialog() {
  if (appState.scoreAutoCloseTimer) {
    clearTimeout(appState.scoreAutoCloseTimer);
    appState.scoreAutoCloseTimer = null;
  }
  appState.scoreAutoDismissArmed = false;
  closeScoreDrawer();
}

function maybeShowFinishedUi(game) {
  if (game.status !== "finished") {
    return;
  }
  const homeView = appState.currentView === "home";
  const homeVisible = homePanel ? !homePanel.classList.contains("hidden") : false;
  const blockingModalOpen = Boolean(createRoomDialog?.open || findRoomDialog?.open || logDialog?.open);
  if (homeView || homeVisible || blockingModalOpen) {
    forceCloseDialog(finishDialog);
    return;
  }
  const key = `${game.session_id}:${game.round_number}:${game.players?.map((p) => `${p.id}:${p.score}`).join("|")}`;
  if (appState.finishUI.shownKey === key) {
    return;
  }
  appState.finishUI.shownKey = key;
  appState.finishedLobbyMode = false;
  closeEventDialog();
  renderFinishDialog(game);
  safeOpenDialog(finishDialog);
  if (appState.finishAutoReturnTimer) {
    clearTimeout(appState.finishAutoReturnTimer);
    appState.finishAutoReturnTimer = null;
  }
}

function renderFinishDialog(game) {
  if (!finishResultRows) {
    return;
  }
  const players = [...(game.players || [])].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  const winner = players[0];
  const me = resolveCurrentPlayer(game);
  const myIndex = players.findIndex((player) => String(player.id || "") === String(me?.id || ""));
  const myRank = myIndex >= 0 ? myIndex + 1 : Math.max(1, players.length);
  const iWon = Boolean(me && winner && String(me.id || "") === String(winner.id || ""));
  const breakdownByPlayer = Object.fromEntries(
    (Array.isArray(game.score_breakdown) ? game.score_breakdown : []).map((row) => [String(row.player_id || ""), row]),
  );
  const myScore = Number(me?.score || 0);
  const totalRounds = Number(game.round_number || 0);
  const settings = game.settings || {};
  const forfeitTone = Boolean(
    game?.ended_reason === "forfeit" ||
    game?.ended_reason === "surrender" ||
    game?.result_tone === "forfeit" ||
    me?.forfeited === true ||
    me?.surrendered === true ||
    me?.status === "forfeit" ||
    me?.status === "surrendered" ||
    me?.left === true,
  );
  const firstPlaceTone = !forfeitTone && myRank === 1;
  const resultTone = forfeitTone
    ? "forfeit"
    : firstPlaceTone
      ? "firstPlace"
      : myScore >= 0
        ? "victory"
        : "defeat";
  const resultTitleByTone = {
    firstPlace: "1등 달성",
    victory: "승리하였습니다",
    defeat: "패배하였습니다",
    forfeit: "기권하였습니다",
  };
  const resultSubByTone = {
    firstPlace: `총 ${totalRounds}라운드 항해 끝에 가장 먼저 보물을 차지했습니다.`,
    victory: `총 ${totalRounds}라운드 항해를 무사히 마쳤습니다. 보상과 점수를 확인하세요.`,
    defeat: `총 ${totalRounds}라운드 항해가 종료되었습니다. 점수를 확인하고 다시 도전하세요.`,
    forfeit: `이번 항해에서는 물러났습니다. 정비를 마치고 다시 도전하세요.`,
  };
  const resultSummaryByTone = {
    firstPlace: "Treasure Crown",
    victory: "Voyage Cleared",
    defeat: `Winner · ${winner?.name || "-"}`,
    forfeit: "Retreated",
  };
  const resultPillByTone = {
    firstPlace: `${winner?.score ?? 0} pts`,
    victory: `내 순위 ${myRank}위`,
    defeat: `내 순위 ${myRank}위`,
    forfeit: "기권 처리",
  };
  const resultCoinByTone = {
    firstPlace: "1위",
    victory: `${myRank}위`,
    defeat: `${myRank}위`,
    forfeit: "기권",
  };
  const resultEventLabelByTone = {
    firstPlace: "First Place",
    victory: "Victory",
    defeat: "Defeat",
    forfeit: "Forfeit",
  };

  if (finishDialog) {
    finishDialog.dataset.tone = resultTone;
  }
  if (finishResultTitle) {
    finishResultTitle.textContent = resultTitleByTone[resultTone];
  }
  if (finishResultSub) {
    finishResultSub.textContent = resultSubByTone[resultTone];
  }
  if (finishSummaryText) {
    finishSummaryText.textContent = resultSummaryByTone[resultTone];
  }
  if (finishSummaryPill) {
    finishSummaryPill.textContent = resultPillByTone[resultTone];
  }

  const myRow = me ? (breakdownByPlayer[String(me.id || "")] || {}) : {};
  if (finishResultCoin) {
    finishResultCoin.textContent = me ? resultCoinByTone[resultTone] : `${winner?.score ?? 0} pts`;
  }
  if (finishEventChips) {
    finishEventChips.innerHTML = `
      <div class="pill">${resultEventLabelByTone[resultTone]}</div>
      <div class="pill">Leaderboard</div>
      <div class="pill">${totalRounds} Rounds</div>
      <div class="pill">Bonus ${Boolean(settings.bonus_enabled) ? "On" : "Off"}</div>
      <div class="pill">Advanced ${Boolean(settings.advanced_rules_enabled) ? "On" : "Off"}</div>
      <div class="pill">내 점수 ${myScore} pts</div>
    `;
  }

  finishResultRows.innerHTML = "";
  players.forEach((p, index) => {
    const rowData = breakdownByPlayer[String(p.id || "")] || {};
    const bid = p.bid === null || p.bid === undefined ? "-" : String(p.bid);
    const won = Number(p.tricks_won || 0);
    const hit = scoreStatusLabel(p, rowData) === "Success";
    const delta = scoreDeltaFromSnapshots(p);
    const bonusText = formatRoundBonusText(p, rowData);
    const deltaText = formatScoreDelta(delta);
    const isWinner = index === 0;
    const isMe = String(p.id || "") === String(me?.id || "");
    const row = document.createElement("div");
    row.className = "result-row";
    if (isWinner) {
      row.classList.add("winner");
    }
    if (isMe) {
      row.classList.add("is-me");
    }
    const avatarUrl = p.avatar_url || resolvePlayerAvatarUrl(p);
    row.innerHTML = `
      <div class="placement-pill ${isWinner ? "champion" : ""}">${index + 1}</div>
      <div class="result-player">
        <div class="result-avatar">${avatarUrl ? `<img src="${avatarUrl}" alt="${escapeHtml(p.name || "Player")}" loading="lazy" />` : ""}</div>
        <div><strong>${escapeHtml(p.name || "Player")}${isMe ? ' <span class="me-tag">YOU</span>' : ""}</strong><div class="tt2">${String(p.id) === String(game.host_id || "") ? "Host" : "Crew"} · ${bonusText}${p.afk ? " · AFK" : ""}</div></div>
      </div>
      <div class="pill">${bid}</div>
      <div class="pill">${won}</div>
      <div class="pill">${deltaText}</div>
      <div class="pill">${Number(p.score || 0)}</div>
      <div class="state-pill ${isWinner ? "champion" : hit ? "hit" : "miss"}">${isWinner ? "Winner" : hit ? "Bid Hit" : "Missed"}</div>
    `;
    finishResultRows.appendChild(row);
  });
}

async function onFinishToLobby() {
  if (appState.finishAutoReturnTimer) {
    clearTimeout(appState.finishAutoReturnTimer);
    appState.finishAutoReturnTimer = null;
  }
  finishDialog?.close?.();
  closeScoreDrawer();
  if (!appState.sessionId || !appState.playerId) {
    appState.finishedLobbyMode = false;
    setView("lobby");
    return;
  }
  if (isPendingAction()) {
    return;
  }

  setPendingAction(PENDING_ACTION_KIND.RETURN_LOBBY, { key: String(appState.sessionId || "") });
  try {
    const state = await post(`/activity/sessions/${appState.sessionId}/return-lobby`, {
      player_id: appState.playerId,
    });
    appState.finishedLobbyMode = false;
    applyServerState(state, { replaceLogs: true });
    setView("lobby");
    showToast("새 항해를 준비했어. 다시 시작할 수 있어.");
  } catch (error) {
    appState.finishedLobbyMode = true;
    showToast(error.message || "로비로 돌아가기 실패");
    await refreshState({ longPoll: false, full: true }).catch(() => {});
  } finally {
    clearPendingAction(PENDING_ACTION_KIND.RETURN_LOBBY);
  }
}

async function onFinishToHome() {
  await clearViewerActivitySession();
  onLeaveToHome();
}

function onLeaveToHome() {
  if (appState.finishAutoReturnTimer) {
    clearTimeout(appState.finishAutoReturnTimer);
    appState.finishAutoReturnTimer = null;
  }
  finishDialog?.close?.();
  forceCloseDialog(roundResultDialog);
  closeScoreDrawer();
  closeEventDialog();
  stopStateWebSocket();
  stopPolling();
  resetTransportSessionState();
  setReactUiState({
    currentView: "home",
    gameState: null,
    viewerId: "",
    lobbyModel: null,
    interactionState: {
      selectedCardIndex: null,
      pendingActionKind: PENDING_ACTION_KIND.NONE,
      pendingActionKey: "",
      pendingActionActive: false,
    },
    transportState: {
      protocolVersion: "",
      snapshotRevision: 0,
      payloadMode: "full",
      websocketActive: false,
      pollingActive: false,
      lastSuccessfulSyncAt: 0,
      lastServerUpdatedAt: 0,
      sessionConnectionState: CONNECTION_STATUS.CONNECTED,
    },
  });
  appState.sessionId = null;
  appState.lastServerUpdatedAt = 0;
  appState.lastSuccessfulSyncAt = 0;
  appState.latestAppliedUpdatedAt = 0;
  appState.statePayloadMode = "full";
  appState.game = null;
  appState.uiModel = null;
  appState.selectedCardIndex = null;
  clearPendingAction();
  appState.logLines = [];
  appState.lastSnapshot = null;
  appState.transitionSnapshot = null;
  appState.lastTransitionSignature = "";
  appState.lastHandledFlowSignature = "";
  clearPlaySubmitSyncTimer();
  clearTrickReveal({ skipRender: true });
  if (appState.uiEffectTimer) {
    clearTimeout(appState.uiEffectTimer);
    appState.uiEffectTimer = null;
  }
  appState.finishedLobbyMode = false;
  appState.roundResultModal.key = "";
  appState.roundResultModal.title = "";
  appState.roundResultModal.lines = [];
  appState.roundResultModal.dismissedKey = "";
  if (appState.forfeitConfirm?.timer) {
    clearTimeout(appState.forfeitConfirm.timer);
    appState.forfeitConfirm.timer = null;
  }
  appState.forfeitConfirm.armedUntil = 0;
  resetRenderCache();
  setView("home");
  loadRooms(false).catch(() => {});
}

async function clearViewerActivitySession(playerId = appState.playerId || "", discordUserId = appState.discordUserId || "") {
  try {
    await post("/activity/presence/clear", {
      player_id: playerId,
      discord_user_id: discordUserId,
    });
  } catch (_) {
    // best effort
  }
}

function isScoreDrawerOpen() {
  return Boolean(scoreDialog) && !scoreDialog.classList.contains("hidden");
}

function openScoreDrawer() {
  scoreDialog?.classList.remove("hidden");
  setScoreDrawerTab(appState.scoreDrawerTab || "scores");
}

function closeScoreDrawer() {
  scoreDialog?.classList.add("hidden");
}

function toggleScoreDrawer() {
  if (!scoreDialog) {
    return;
  }
  scoreDialog.classList.toggle("hidden");
}

function onScoreDrawerDragStart(event) {
  if (!scoreDialog || !gamePanel || scoreDialog.classList.contains("hidden")) {
    return;
  }
  const target = event.target;
  if (target instanceof HTMLElement && target.closest("button")) {
    return;
  }
  const panelRect = gamePanel.getBoundingClientRect();
  const dialogRect = scoreDialog.getBoundingClientRect();
  appState.scoreDrawerDrag = {
    pointerId: event.pointerId,
    offsetX: event.clientX - dialogRect.left,
    offsetY: event.clientY - dialogRect.top,
    panelRect,
  };
  scoreDrawerHeader?.setPointerCapture?.(event.pointerId);
  window.addEventListener("pointermove", onScoreDrawerDragMove);
  window.addEventListener("pointerup", onScoreDrawerDragEnd);
  window.addEventListener("pointercancel", onScoreDrawerDragEnd);
}

function onScoreDrawerDragMove(event) {
  const drag = appState.scoreDrawerDrag;
  if (!drag || !scoreDialog || !gamePanel) {
    return;
  }
  if (event.pointerId !== drag.pointerId) {
    return;
  }
  const panelRect = drag.panelRect;
  const width = scoreDialog.offsetWidth || 320;
  const height = scoreDialog.offsetHeight || 420;

  let left = event.clientX - panelRect.left - drag.offsetX;
  let top = event.clientY - panelRect.top - drag.offsetY;

  left = Math.max(8, Math.min(left, panelRect.width - width - 8));
  top = Math.max(8, Math.min(top, panelRect.height - height - 8));

  scoreDialog.style.right = "auto";
  scoreDialog.style.left = `${left}px`;
  scoreDialog.style.top = `${top}px`;
}

function onScoreDrawerDragEnd(event) {
  const drag = appState.scoreDrawerDrag;
  if (!drag || event.pointerId !== drag.pointerId) {
    return;
  }
  appState.scoreDrawerDrag = null;
  scoreDrawerHeader?.releasePointerCapture?.(event.pointerId);
  window.removeEventListener("pointermove", onScoreDrawerDragMove);
  window.removeEventListener("pointerup", onScoreDrawerDragEnd);
  window.removeEventListener("pointercancel", onScoreDrawerDragEnd);
}
