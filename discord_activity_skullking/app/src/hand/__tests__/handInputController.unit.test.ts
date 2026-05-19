// Feature: stage6-hand-ux-improvement, handInputController fake-timer unit assertions
//
// 본 unit test 는 design.md "Hand Input Controller" 의 4 가지 임계값에 대한
// 결정적 (`vi.useFakeTimers`) 시간 기반 단정을 모은다:
//
//   - 50ms hover dwell                       (R3.1)
//   - 350ms mobile tap / long-press 경계    (R4.1, R4.2)
//   - 300~1000ms blocked 토스트 자동 소실    (R2.4, R4.3)
//   - 5초 play request timeout 복원          (R3.5, R4.9)
//
// 각 example 은 단일 controller 인스턴스를 새로 만들고, store 는 매 it 진입
// 시 `_handInteractionStoreInternals.reset()` 으로 초기화한다. afterEach 에서
// `vi.useRealTimers()` + `controller.dispose()` 로 누설을 차단한다.
//
// _Requirements: 2.4, 3.1, 3.5, 4.1, 4.2, 4.3, 9.4

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createHandInputController,
  HOVER_DWELL_MS,
  TAP_LONG_PRESS_THRESHOLD_MS,
  BLOCKED_FEEDBACK_DISMISS_MS,
  PLAY_REQUEST_TIMEOUT_MS,
  type HandCardContext,
} from "../handInputController";
import {
  handInteractionActions,
  _handInteractionStoreInternals,
} from "../handInteractionStore";

// ---------------------------------------------------------------------
// Context fixtures — design 의 "정상 legal" / "blocked" 변형 두 가지만
// 필요하므로 helper 로 캡슐화. 매 호출마다 새 객체를 반환하여 controller
// 가 incidental aliasing 에 의존하지 않음을 함께 검증한다.
// ---------------------------------------------------------------------

function legalCtx(): HandCardContext {
  return {
    isLegal: true,
    isMyTurn: true,
    legalityKnown: true,
    state: "legal",
    isAnyResolving: false,
  };
}

function blockedCtx(): HandCardContext {
  return {
    isLegal: false,
    isMyTurn: true,
    legalityKnown: true,
    state: "blocked",
    isAnyResolving: false,
  };
}

describe("handInputController fake-timer unit assertions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _handInteractionStoreInternals.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("Hover dwell 50ms 진입 (R3.1) — 49ms 미달성 → null, 50ms 도달 → hoveredIndex=0, leave → null", () => {
    const controller = createHandInputController({
      requestPlay: vi.fn(),
    });
    try {
      // dwell 시간 자체가 50ms 임을 import surface 단정으로 함께 검증.
      expect(HOVER_DWELL_MS).toBe(50);

      controller.onPointerEnter(0, legalCtx());

      // 49ms 까지는 dwell 미달성 — hoveredIndex 는 여전히 null.
      vi.advanceTimersByTime(49);
      expect(_handInteractionStoreInternals.getSnapshot().hoveredIndex).toBeNull();

      // 1ms 추가 → 누적 50ms 로 dwell timer 발화.
      vi.advanceTimersByTime(1);
      expect(_handInteractionStoreInternals.getSnapshot().hoveredIndex).toBe(0);

      // 포인터가 떠나면 hovered 상태가 즉시 클리어.
      controller.onPointerLeave(0);
      expect(_handInteractionStoreInternals.getSnapshot().hoveredIndex).toBeNull();
    } finally {
      controller.dispose();
    }
  });

  it("350ms 미만 tap → selected (R4.1) — onPointerUp 시 selectedIndex=0, requestPlay 0회", () => {
    const requestPlay = vi.fn<(cardIndex: number) => void>();
    const controller = createHandInputController({ requestPlay });
    try {
      expect(TAP_LONG_PRESS_THRESHOLD_MS).toBe(350);

      controller.onPointerDown(0, legalCtx());
      // 350ms 미만 — long-press 타이머가 아직 발화하지 않은 구간.
      vi.advanceTimersByTime(200);
      controller.onPointerUp(0, legalCtx());

      const snap = _handInteractionStoreInternals.getSnapshot();
      // 단일-selected invariant: selectedIndex 는 정확히 0.
      expect(snap.selectedIndex).toBe(0);
      // tap 은 commit 이 아니므로 requestPlay 호출 0회 (R4.1).
      expect(requestPlay).toHaveBeenCalledTimes(0);
      // held / resolving 부수효과 없음.
      expect(snap.heldIndex).toBeNull();
      expect(snap.resolvingIndex).toBeNull();
    } finally {
      controller.dispose();
    }
  });

  it("350ms 이상 long-press → held (R4.2) — 350ms 도달 시 heldIndex=0, onPointerUp → heldIndex null, selectedIndex 보존", () => {
    const requestPlay = vi.fn<(cardIndex: number) => void>();
    const controller = createHandInputController({ requestPlay });
    try {
      controller.onPointerDown(0, legalCtx());

      // 350ms 정확히 도달 — long-press 타이머 발화로 heldIndex=0.
      vi.advanceTimersByTime(TAP_LONG_PRESS_THRESHOLD_MS);
      const heldSnap = _handInteractionStoreInternals.getSnapshot();
      expect(heldSnap.heldIndex).toBe(0);
      // long-press 동안 selected 는 변하지 않음 (R4.6 round-trip 전제).
      expect(heldSnap.selectedIndex).toBeNull();

      // 포인터를 떼면 held 가 해제되지만, 직전 selectedIndex 는 그대로 보존.
      controller.onPointerUp(0, legalCtx());
      const upSnap = _handInteractionStoreInternals.getSnapshot();
      expect(upSnap.heldIndex).toBeNull();
      expect(upSnap.selectedIndex).toBeNull();
      // long-press 는 commit 이 아니므로 requestPlay 0회.
      expect(requestPlay).toHaveBeenCalledTimes(0);
    } finally {
      controller.dispose();
    }
  });

  it("Blocked 카드 click → play 0회 + onBlockedFeedback show 즉시 + hide 자동 소실 (R2.4, R4.3)", () => {
    // BLOCKED_FEEDBACK_DISMISS_MS 가 design 에서 명시한 300~1000ms 범위 안인지
    // 별도로 단정한다 (task 6.6 의 명시 요구).
    expect(BLOCKED_FEEDBACK_DISMISS_MS).toBeGreaterThanOrEqual(300);
    expect(BLOCKED_FEEDBACK_DISMISS_MS).toBeLessThanOrEqual(1000);

    const requestPlay = vi.fn<(cardIndex: number) => void>();
    const onBlockedFeedback =
      vi.fn<(cardIndex: number, phase: "show" | "hide") => void>();
    const controller = createHandInputController({
      requestPlay,
      onBlockedFeedback,
    });
    try {
      controller.onClick(0, blockedCtx());

      // 즉시 "show" phase 가 동기 호출되고 requestPlay 는 0회.
      expect(requestPlay).toHaveBeenCalledTimes(0);
      expect(onBlockedFeedback).toHaveBeenCalledTimes(1);
      expect(onBlockedFeedback).toHaveBeenNthCalledWith(1, 0, "show");

      // 자동 소실 시간이 도달하기 직전까지는 "hide" 가 호출되지 않는다.
      vi.advanceTimersByTime(BLOCKED_FEEDBACK_DISMISS_MS - 1);
      expect(onBlockedFeedback).toHaveBeenCalledTimes(1);

      // 1ms 추가 → 누적 BLOCKED_FEEDBACK_DISMISS_MS 도달 → "hide" phase.
      vi.advanceTimersByTime(1);
      expect(onBlockedFeedback).toHaveBeenCalledTimes(2);
      expect(onBlockedFeedback).toHaveBeenNthCalledWith(2, 0, "hide");

      // store 에는 blocked 카드 인덱스가 어디에도 들어가지 않아야 한다.
      const snap = _handInteractionStoreInternals.getSnapshot();
      expect(snap.selectedIndex).toBeNull();
      expect(snap.heldIndex).toBeNull();
      expect(snap.resolvingIndex).toBeNull();
      expect(snap.hoveredIndex).toBeNull();
    } finally {
      controller.dispose();
    }
  });

  it("legal click → 5초 timeout 시 endResolving + 복원 (R3.5)", () => {
    // PLAY_REQUEST_TIMEOUT_MS 가 정확히 5000ms 임을 import surface 단정.
    expect(PLAY_REQUEST_TIMEOUT_MS).toBe(5000);

    const requestPlay = vi.fn<(cardIndex: number) => void>();
    const controller = createHandInputController({ requestPlay });
    try {
      controller.onClick(0, legalCtx());

      // commit 직후: requestPlay 1회, resolvingIndex=0.
      expect(requestPlay).toHaveBeenCalledTimes(1);
      expect(requestPlay).toHaveBeenCalledWith(0);
      const begin = _handInteractionStoreInternals.getSnapshot();
      expect(begin.resolvingIndex).toBe(0);

      // 5초 타이머 만료 — controller 가 endResolving("timeout") 을 호출.
      vi.advanceTimersByTime(PLAY_REQUEST_TIMEOUT_MS);
      const after = _handInteractionStoreInternals.getSnapshot();
      expect(after.resolvingIndex).toBeNull();
      expect(after.resolvingStartedAt).toBeNull();
      // timeout 은 추가 commit 을 발생시키지 않는다.
      expect(requestPlay).toHaveBeenCalledTimes(1);
    } finally {
      controller.dispose();
    }
  });

  it("notifyResult 로 5초 timer 가 cancel 되어 추가 endResolving 호출 없음 (R4.9)", () => {
    // store action endResolving 호출 횟수를 직접 관측하기 위해 spy 부착.
    // 이 controller 는 `handInteractionActions.endResolving(...)` 을 객체
    // 프로퍼티 접근으로 호출하므로, vi.spyOn 으로 method 를 교체하면
    // 호출이 동일하게 가로채진다.
    const endResolvingSpy = vi.spyOn(handInteractionActions, "endResolving");

    const requestPlay = vi.fn<(cardIndex: number) => void>();
    const controller = createHandInputController({ requestPlay });
    try {
      controller.onClick(0, legalCtx());
      expect(requestPlay).toHaveBeenCalledTimes(1);
      expect(_handInteractionStoreInternals.getSnapshot().resolvingIndex).toBe(0);

      // 1초 경과 — 아직 5초 timeout 미만이며 endResolving 미호출.
      vi.advanceTimersByTime(1000);
      expect(endResolvingSpy).toHaveBeenCalledTimes(0);

      // 백엔드 reject 응답 도착 → endResolving("reject") 1회 호출되고
      // resolvingIndex 가 null 로 복원.
      controller.notifyResult("reject");
      expect(endResolvingSpy).toHaveBeenCalledTimes(1);
      expect(endResolvingSpy).toHaveBeenLastCalledWith("reject");
      expect(_handInteractionStoreInternals.getSnapshot().resolvingIndex).toBeNull();

      // 추가로 5초가 흘러도 timeout 분기는 발화하지 않아야 한다 — 5초 타이머가
      // notifyResult 단계에서 이미 cancel 되었기 때문 (R4.9).
      vi.advanceTimersByTime(PLAY_REQUEST_TIMEOUT_MS);
      expect(endResolvingSpy).toHaveBeenCalledTimes(1);
      expect(_handInteractionStoreInternals.getSnapshot().resolvingIndex).toBeNull();
      expect(requestPlay).toHaveBeenCalledTimes(1);
    } finally {
      controller.dispose();
    }
  });
});
