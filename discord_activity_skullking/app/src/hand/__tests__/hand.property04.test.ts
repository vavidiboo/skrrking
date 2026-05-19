// Feature: stage6-hand-ux-improvement, Property 4: blocked card input is fully ignored and produces zero play requests
//
// 백엔드가 blocked 로 평가한 단일 카드에 대해 임의의 입력 이벤트
// 시퀀스(클릭/탭/포인터/드래그/confirm)를 던졌을 때 다음 두 가지를
// 동시에 단정한다:
//   1) HandInteractionStore 의 selectedIndex / heldIndex / hoveredIndex /
//      resolvingIndex 어디에도 blocked 카드 인덱스가 들어가지 않는다.
//   2) requestPlay mock 의 호출 횟수가 0 이다.
//
// blocked context 도 arbitrary 로 4 가지 변형 중 1개를 무작위로 선택해
// (legalityKnown=false / isMyTurn=false / isLegal=false / state==="blocked")
// 입력 영역의 폭을 보장한다. 추가로 vi.useFakeTimers() + runAllTimers()
// 를 통해 controller 가 어쩌다 armed 한 어떤 타이머가 만료되더라도
// blocked 인덱스가 store 로 누설되지 않음을 확인한다.
//
// Validates: Requirements 2.3, 3.2, 3.3, 4.3, 9.3

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import {
  createHandInputController,
  type HandCardContext,
} from "../handInputController";
import { _handInteractionStoreInternals } from "../handInteractionStore";

/** 테스트가 사용할 단일 blocked 카드 인덱스. */
const BLOCKED_CARD_INDEX = 0;

/**
 * controller 에 주입할 입력 이벤트 종류. 실제 controller 의 public surface
 * 와 1:1 로 대응한다.
 */
type InputEventKind =
  | "click"
  | "pointerEnter"
  | "pointerLeave"
  | "pointerDown"
  | "pointerUp"
  | "pointerCancel"
  | "dragStart"
  | "dragCommit"
  | "dragCancel"
  | "confirm";

interface InputEvent {
  kind: InputEventKind;
  cardIndex: number;
}

/**
 * blocked context 4가지 변형:
 *   - "legalityUnknown": legalityKnown=false
 *   - "notMyTurn":       isMyTurn=false
 *   - "notLegal":        isLegal=false
 *   - "stateBlocked":    state="blocked" (그 외 모든 legality flag 는 정상)
 * 모든 변형은 controller 의 isBlockedContext() 가 true 를 반환하도록 설계되어
 * 있다.
 */
type BlockedVariant =
  | "legalityUnknown"
  | "notMyTurn"
  | "notLegal"
  | "stateBlocked";

function makeBlockedContext(variant: BlockedVariant): HandCardContext {
  // "정상" 기본값. 각 변형은 자기 필드만 비활성으로 뒤집는다.
  const base: HandCardContext = {
    isLegal: true,
    isMyTurn: true,
    legalityKnown: true,
    state: "legal",
    isAnyResolving: false,
  };
  switch (variant) {
    case "legalityUnknown":
      return { ...base, legalityKnown: false, state: "blocked" };
    case "notMyTurn":
      return { ...base, isMyTurn: false, state: "blocked" };
    case "notLegal":
      return { ...base, isLegal: false, state: "blocked" };
    case "stateBlocked":
      // state="blocked" 만 켜고 다른 flag 는 정상. 이 경우 controller 는
      // ctx.state === "blocked" 분기로 차단한다.
      return { ...base, state: "blocked" };
  }
}

/** 단일 입력 이벤트 arbitrary — kind 는 10가지 중 하나, cardIndex 는 항상 BLOCKED_CARD_INDEX. */
const inputEventArb: fc.Arbitrary<InputEvent> = fc
  .constantFrom<InputEventKind>(
    "click",
    "pointerEnter",
    "pointerLeave",
    "pointerDown",
    "pointerUp",
    "pointerCancel",
    "dragStart",
    "dragCommit",
    "dragCancel",
    "confirm",
  )
  .map((kind) => ({ kind, cardIndex: BLOCKED_CARD_INDEX }));

/** 길이 1~30 의 임의 입력 시퀀스. */
const inputSequenceArb: fc.Arbitrary<ReadonlyArray<InputEvent>> = fc.array(
  inputEventArb,
  { minLength: 1, maxLength: 30 },
);

/** blocked context 4가지 변형 arbitrary. */
const blockedVariantArb: fc.Arbitrary<BlockedVariant> = fc.constantFrom(
  "legalityUnknown",
  "notMyTurn",
  "notLegal",
  "stateBlocked",
);

describe("Property 4: blocked card input is fully ignored and produces zero play requests", () => {
  beforeEach(() => {
    // 각 it 블록 진입 시 fake timer 활성화. 매 iteration 간 타이머 큐는
    // runAllTimers() 로 비우고, 마지막에 useRealTimers() 로 복원한다.
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    "임의 blocked context 변형 + 임의 입력 시퀀스 후 store 에 blocked 인덱스가 들어가지 않으며 requestPlay 호출 횟수는 0이다",
    () => {
      fc.assert(
        fc.property(
          blockedVariantArb,
          inputSequenceArb,
          (variant, sequence) => {
            // (1) 각 iteration 시작 시 store 를 초기 상태로 reset.
            _handInteractionStoreInternals.reset();

            // (2) requestPlay mock — 시퀀스 종료 후 호출 횟수가 0 임을 단정한다.
            const requestPlay = vi.fn<(cardIndex: number) => void>();

            // (3) controller 를 새로 생성. setTimeout 등은 vi.useFakeTimers
            //     로 이미 글로벌이 모킹된 상태이므로 별도 주입 없이 default
            //     globalThis.setTimeout 을 사용해도 fake timer 로 동작한다.
            const controller = createHandInputController({
              requestPlay,
            });

            try {
              const blockedCtx = makeBlockedContext(variant);

              // (4) 시퀀스 적용 — 모든 이벤트는 단일 blocked 카드 인덱스에
              //     대해 호출.
              for (const ev of sequence) {
                switch (ev.kind) {
                  case "click":
                    controller.onClick(ev.cardIndex, blockedCtx);
                    break;
                  case "pointerEnter":
                    controller.onPointerEnter(ev.cardIndex, blockedCtx);
                    break;
                  case "pointerLeave":
                    controller.onPointerLeave(ev.cardIndex);
                    break;
                  case "pointerDown":
                    controller.onPointerDown(ev.cardIndex, blockedCtx);
                    break;
                  case "pointerUp":
                    controller.onPointerUp(ev.cardIndex, blockedCtx);
                    break;
                  case "pointerCancel":
                    controller.onPointerCancel(ev.cardIndex);
                    break;
                  case "dragStart":
                    controller.onDragStart(ev.cardIndex, blockedCtx);
                    break;
                  case "dragCommit":
                    controller.onDragCommit(ev.cardIndex, blockedCtx);
                    break;
                  case "dragCancel":
                    controller.onDragCancel(ev.cardIndex);
                    break;
                  case "confirm":
                    controller.onConfirm(ev.cardIndex, blockedCtx);
                    break;
                }
              }

              // (5) 어떤 unintended 타이머라도 만료시켜 본다. 정상 구현에서는
              //     blocked 분기로 인해 어떤 타이머도 store 를 mutating 하지
              //     않아야 한다.
              vi.runAllTimers();

              // ---- Assertion 1: store 어디에도 blocked 인덱스가 없다. ----
              const snap = _handInteractionStoreInternals.getSnapshot();
              expect(snap.selectedIndex).not.toBe(BLOCKED_CARD_INDEX);
              expect(snap.heldIndex).not.toBe(BLOCKED_CARD_INDEX);
              expect(snap.hoveredIndex).not.toBe(BLOCKED_CARD_INDEX);
              expect(snap.resolvingIndex).not.toBe(BLOCKED_CARD_INDEX);

              // ---- Assertion 2: requestPlay 호출 횟수 = 0. ----
              expect(requestPlay).toHaveBeenCalledTimes(0);
            } finally {
              // controller 가 보유한 모든 타이머/상태를 정리해 다음 iteration
              // 에 누설되지 않도록 한다.
              controller.dispose();
            }
          },
        ),
        { numRuns: 200 },
      );
    },
  );
});
