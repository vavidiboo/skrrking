// Feature: stage6-hand-ux-improvement, selectHandViewModel example assertions
//
// 본 unit test는 selectors/clientState.ts 의 selectHandViewModel(state) 가
// design.md 의 "Data Models > HandViewModel" 명세대로 동작하는지 4가지
// 시나리오에 대해 example assertion 으로 검증한다.
//
//   1. state === null              → 빈 결과
//   2. session 있음 + viewer 없음    → 빈 결과
//   3. viewer 있음 + 비-자기 차례     → cards 매핑되되 모든 isLegal=false,
//                                     legalityKnown=false, isMyTurn=false
//   4. viewer 있음 + 자기 차례 +
//      legalCardIndexes 미정의(비-Array)
//                                  → legalityKnown=false,
//                                     모든 isLegal=false
//   5. (정상) viewer 있음 + 자기 차례 +
//      legalCardIndexes=[0,2]      → legalityKnown=true,
//                                     cards[0].isLegal=true,
//                                     cards[1].isLegal=false,
//                                     cards[2].isLegal=true
//
// 정확한 backend Card_Legality 의미를 보존하기 위해 selectHandViewModel 은
// 권위적 출처(legal_indexes / myTurn)에만 의존해야 하며 클라이언트 측 임의
// 판정 로직은 추가하지 않는다. 본 테스트는 그 invariant 를 example 단위로
// 고정한다.
//
// _Requirements: 2.1, 2.6

import { describe, it, expect } from "vitest";
import { selectHandViewModel } from "../../selectors/clientState";
import type {
  ClientPlayerState,
  ClientSessionState,
  ClientStoreSnapshot,
  GameCardLike,
} from "../../types";

/**
 * 최소한의 GameCardLike 카드 3장. selector 는 카드 내부 필드를 들여다보지
 * 않고 그대로 cards[i].card 로 전달하므로, 식별성 확인을 위한 id 만 다르게
 * 채워둔다.
 */
const MOCK_HAND: GameCardLike[] = [
  { id: "c0", type: "suit", suit: "yellow", value: 5 },
  { id: "c1", type: "suit", suit: "green", value: 9 },
  { id: "c2", type: "suit", suit: "purple", value: 12 },
];

/**
 * ClientPlayerState 의 모든 필수 필드를 채운 baseline viewer.
 * legalCardIndexes / hand 는 case 별로 override 한다.
 */
function makeViewer(overrides: Partial<ClientPlayerState> = {}): ClientPlayerState {
  return {
    id: "viewer-1",
    name: "Viewer",
    state: "playing",
    connectionState: "connected",
    avatarUrl: null,
    afk: false,
    bid: 1,
    score: 0,
    tricksWon: 0,
    hand: MOCK_HAND,
    handCount: MOCK_HAND.length,
    legalCardIndexes: [],
    reconnectGraceSeconds: 0,
    isHost: false,
    ...overrides,
  };
}

/**
 * ClientSessionState 의 필수 필드를 채운 baseline session.
 * currentTurnPlayerId / players 는 case 별로 override 한다.
 */
function makeSession(overrides: Partial<ClientSessionState> = {}): ClientSessionState {
  return {
    sessionId: "session-1",
    hostId: "viewer-1",
    status: "playing",
    roomStatus: "playing",
    phase: "playing",
    roundNumber: 1,
    cardsDealt: 1,
    tricksCompleted: 0,
    currentTurnPlayerId: "viewer-1",
    players: [],
    currentTrick: [],
    lastTrick: [],
    scoreBreakdown: [],
    flowEvents: [],
    latestFlowEvent: null,
    logs: [],
    latestLog: "",
    settings: {
      maxPlayers: 6,
      maxRounds: 10,
      bonusEnabled: true,
      advancedRulesEnabled: false,
      allowSpectators: true,
      turnLimitSeconds: 15,
    },
    updatedAt: 0,
    protocolVersion: "1",
    snapshotRevision: 0,
    viewerRole: "player",
    viewerPresence: "active",
    viewerInSession: true,
    viewerIsMember: true,
    spectatorAllowed: true,
    spectatorPolicy: "open",
    reconnectGraceSeconds: 0,
    ...overrides,
  };
}

/**
 * ClientStoreSnapshot 의 베이스를 만들어 주되 session/interaction 만 case
 * 별로 override 한다. selectHandViewModel 은 ui/transport 를 읽지 않으므로
 * 두 영역은 기본 구조만 제공한다.
 */
function makeSnapshot(
  session: ClientSessionState | null,
  viewerId: string,
): ClientStoreSnapshot {
  return {
    session,
    ui: {
      currentView: "game",
      splashVisible: false,
      splashMode: "boot",
      lobbyModel: null,
    },
    interaction: {
      viewerId,
      viewerPlayerId: viewerId,
      viewerRole: "player",
      legalCardIndexes: [],
      selectedCardIndex: null,
      pendingActionKind: "none",
      pendingActionKey: "",
      pendingActionActive: false,
      readOnly: false,
    },
    transport: {
      protocolVersion: "1",
      snapshotRevision: 0,
      payloadMode: "full",
      websocketActive: true,
      pollingActive: false,
      lastSuccessfulSyncAt: 0,
      lastServerUpdatedAt: 0,
      sessionConnectionState: "connected",
    },
  };
}

describe("selectHandViewModel — empty / unknown legality cases", () => {
  // Case 1: state === null → 빈 결과 (R2.1, R2.6)
  it("returns an empty view model when state is null", () => {
    const vm = selectHandViewModel(null);
    expect(vm.cards).toEqual([]);
    expect(vm.isMyTurn).toBe(false);
    expect(vm.legalityKnown).toBe(false);
  });

  // Case 2: session 있음 + viewer 없음 (interaction.viewerId 가 어떤
  // player id 와도 매칭되지 않는 상황) → 빈 결과
  it("returns an empty view model when session has no viewer match", () => {
    const otherPlayer = makeViewer({ id: "other-1", name: "Other" });
    const session = makeSession({
      currentTurnPlayerId: "other-1",
      players: [otherPlayer],
    });
    // viewerId 가 어떤 player id 와도 일치하지 않으므로
    // selectViewerPlayer 가 null 을 반환한다.
    const snapshot = makeSnapshot(session, "ghost-viewer");

    const vm = selectHandViewModel(snapshot);
    expect(vm.cards).toEqual([]);
    expect(vm.isMyTurn).toBe(false);
    expect(vm.legalityKnown).toBe(false);
  });
});

describe("selectHandViewModel — non-self-turn case", () => {
  // Case 3: viewer 있음 + currentTurnPlayerId 가 viewer 와 다름
  //         → cards 는 viewer.hand 에 매핑되되 모든 isLegal=false,
  //           legalityKnown=false, isMyTurn=false (R2.6)
  it("maps viewer hand to cards but marks all illegal when it is not the viewer's turn", () => {
    const viewer = makeViewer({
      id: "viewer-1",
      hand: MOCK_HAND,
      // 자기 차례가 아닌데도 어떤 이유로 legalCardIndexes 값이 와 있는 경우
      // 도 mark all illegal 이 깨지지 않는지 확인하기 위해 일부러 채운다.
      legalCardIndexes: [0, 1, 2],
    });
    const opponent = makeViewer({ id: "opponent-1", name: "Opponent", hand: [] });
    const session = makeSession({
      currentTurnPlayerId: "opponent-1",
      players: [viewer, opponent],
    });
    const snapshot = makeSnapshot(session, "viewer-1");

    const vm = selectHandViewModel(snapshot);

    expect(vm.isMyTurn).toBe(false);
    expect(vm.legalityKnown).toBe(false);
    expect(vm.cards).toHaveLength(MOCK_HAND.length);
    vm.cards.forEach((entry, i) => {
      expect(entry.cardIndex).toBe(i);
      expect(entry.card).toBe(MOCK_HAND[i]);
      expect(entry.isLegal).toBe(false);
      expect(entry.legalityKnown).toBe(false);
    });
  });
});

describe("selectHandViewModel — self-turn cases", () => {
  // Case 4: viewer 있음 + isMyTurn=true 이지만 viewer.legalCardIndexes 가
  //         비-Array (예: undefined) → legalityKnown=false, 모든 isLegal=false
  it("returns legalityKnown=false when legalCardIndexes is not an Array", () => {
    const viewer = makeViewer({
      id: "viewer-1",
      hand: MOCK_HAND,
    });
    // 백엔드에서 legal_indexes payload 가 누락되어 정규화 이후에도 비-Array
    // 로 남는 경우를 모사하기 위해 강제로 undefined 를 주입한다. (정상적인
    // 빌더 경로에서는 발생하기 어렵지만 selectHandViewModel 의 가드가
    // R2.6 fallback 을 정확히 구현했는지 확인하는 negative path 이다.)
    (viewer as unknown as { legalCardIndexes: number[] | undefined }).legalCardIndexes =
      undefined;
    const session = makeSession({
      currentTurnPlayerId: "viewer-1",
      players: [viewer],
    });
    const snapshot = makeSnapshot(session, "viewer-1");

    const vm = selectHandViewModel(snapshot);

    expect(vm.isMyTurn).toBe(true);
    expect(vm.legalityKnown).toBe(false);
    expect(vm.cards).toHaveLength(MOCK_HAND.length);
    vm.cards.forEach((entry, i) => {
      expect(entry.cardIndex).toBe(i);
      expect(entry.card).toBe(MOCK_HAND[i]);
      expect(entry.isLegal).toBe(false);
      expect(entry.legalityKnown).toBe(false);
    });
  });

  // Case 5: 정상 케이스 — viewer 있음 + isMyTurn=true + legalCardIndexes=[0,2]
  //         → legalityKnown=true,
  //           cards[0].isLegal=true,
  //           cards[1].isLegal=false,
  //           cards[2].isLegal=true (R2.1)
  it("marks only indexes contained in legalCardIndexes as legal during the viewer's turn", () => {
    const viewer = makeViewer({
      id: "viewer-1",
      hand: MOCK_HAND,
      legalCardIndexes: [0, 2],
    });
    const session = makeSession({
      currentTurnPlayerId: "viewer-1",
      players: [viewer],
    });
    const snapshot = makeSnapshot(session, "viewer-1");

    const vm = selectHandViewModel(snapshot);

    expect(vm.isMyTurn).toBe(true);
    expect(vm.legalityKnown).toBe(true);
    expect(vm.cards).toHaveLength(MOCK_HAND.length);

    expect(vm.cards[0].isLegal).toBe(true);
    expect(vm.cards[0].legalityKnown).toBe(true);

    expect(vm.cards[1].isLegal).toBe(false);
    expect(vm.cards[1].legalityKnown).toBe(true);

    expect(vm.cards[2].isLegal).toBe(true);
    expect(vm.cards[2].legalityKnown).toBe(true);
  });
});
