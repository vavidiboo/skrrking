// Feature: stage6-hand-ux-improvement, Property 5: legal commit single play + resolving blocks further input
//
// 단일 legal Hand_Card 에 대해 임의의 commit 액션 시퀀스(클릭 / drag-commit /
// confirm 의 혼합, 길이 ≥ 1) 와, 첫 commit 이후 임의로 발생하는 추가 입력
// 시퀀스(다른 카드 또는 동일 카드에 대한 click / dragCommit / confirm /
// pointerDown / pointerUp / pointerEnter / pointerLeave) 모두를 controller 에
// 적용했을 때 다음 두 가지를 동시에 단정한다:
//
//   1) requestPlay mock 의 총 호출 횟수가 정확히 1 이다 (단일 commit 만
//      backend 로 전송된다).
//   2) 첫 commit 직후 controller 가 isResolving=true 로 들어간 이후의
//      어떤 추가 입력(다른 카드 commit 시도 포함)도 추가 play 요청을
//      유발하지 않는다 (앞 단계와 결합해 1번 단정으로 충분히 검증된다).
//
// extra 시퀀스에서 "다른 카드의 commit 시도" 도 backend 관점에서는 hand
// 영역 어딘가에서 resolving 이 진행 중이므로, design 의 state mapping 과
// 정합되도록 ctx 에 `isAnyResolving=true` 를 실어 보낸다. controller 는
// isResolving 플래그로 자체 dedupe 하므로 isAnyResolving 여부와 무관하게
// requestPlay 횟수 1 단정은 그대로 성립한다.
//
// Validates: Requirements 3.4, 4.4, 4.5, 9.2

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import {
  createHandInputController,
  type HandCardContext,
} from "../handInputController";
import { _handInteractionStoreInternals } from "../handInteractionStore";

/** commit 시퀀스를 구성하는 commit 액션 종류. */
type CommitKind = "click" | "dragCommit" | "confirm";

/** 첫 commit 이후 임의 추가 입력 종류 (commit + pointer 계열). */
type ExtraKind =
  | "click"
  | "dragCommit"
  | "confirm"
  | "pointerDown"
  | "pointerUp"
  | "pointerEnter"
  | "pointerLeave";

interface ExtraInput {
  kind: ExtraKind;
  /** 동일 카드 또는 다른 카드 어디든 가능. */
  cardIndex: number;
}

/** 단일 legal 카드용 base ctx — controller 가 commit 을 수락할 모든 조건을 만족한다. */
function makeLegalCtx(): HandCardContext {
  return {
    isLegal: true,
    isMyTurn: true,
    legalityKnown: true,
    state: "legal",
    isAnyResolving: false,
  };
}

/**
 * 첫 commit 이후 추가 입력에 적용할 ctx. 첫 commit 으로 hand 영역 어딘가에서
 * resolving 이 진행 중이므로 design state mapping 상 `isAnyResolving=true`.
 * 다른 클라이언트 입력 채널(state) 는 그대로 "legal" 로 두어 controller 가
 * 추가 입력을 isBlockedContext 가 아닌 isResolving 분기로 차단함을 검증한다.
 */
function makeExtraCtx(): HandCardContext {
  return {
    isLegal: true,
    isMyTurn: true,
    legalityKnown: true,
    state: "legal",
    isAnyResolving: true,
  };
}

/**
 * 첫 commit 시퀀스 arbitrary — 길이 1..10 의 click / dragCommit / confirm
 * 액션 배열. 모든 액션은 동일한 legal cardIndex 를 대상으로 한다.
 */
const commitSequenceArb: fc.Arbitrary<ReadonlyArray<CommitKind>> = fc.array(
  fc.constantFrom<CommitKind>("click", "dragCommit", "confirm"),
  { minLength: 1, maxLength: 10 },
);

/**
 * 추가 입력 한 건 arbitrary. cardIndex 는 0..7 (legal 손패 상한) 에서 임의로
 * 선택되어 동일 카드 / 다른 카드 시나리오를 모두 탐색한다.
 */
function makeExtraInputArb(legalCardIndex: number): fc.Arbitrary<ExtraInput> {
  return fc.record({
    kind: fc.constantFrom<ExtraKind>(
      "click",
      "dragCommit",
      "confirm",
      "pointerDown",
      "pointerUp",
      "pointerEnter",
      "pointerLeave",
    ),
    cardIndex: fc.integer({ min: 0, max: 7 }),
  }).map((e) => {
    // legalCardIndex 와 동일/다른 인덱스를 모두 허용 — fc 가 양쪽을 자연스럽게
    // 탐색하므로 별도 transform 은 불필요하다. (참조만 보존)
    void legalCardIndex;
    return e;
  });
}

describe("Property 5: legal commit single play + resolving blocks further input", () => {
  beforeEach(() => {
    // controller 가 setTimeout (5초 timeout / 50ms hover dwell / 350ms long-press
    // / 500ms blocked toast hide) 을 사용하므로 매 it 진입 시 fake timer 를
    // 활성화해 결정론적 환경에서 단정한다.
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("legal 카드에 commit N≥1회 + resolving 동안 추가 입력 시 requestPlay 는 정확히 1회 호출된다", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 7 }),
        commitSequenceArb,
        // extraSeq 는 minLength 0 — 추가 입력이 전혀 없는 경우(첫 commit
        // 이후 즉시 종료) 에도 requestPlay 가 1회임을 함께 검증한다.
        fc.array(makeExtraInputArb(0), { minLength: 0, maxLength: 20 }),
        (cardIndex, commitSeq, extraSeq) => {
          // (1) 매 iteration 시작 시 store reset — 이전 케이스 잔재 차단.
          _handInteractionStoreInternals.reset();

          // (2) requestPlay mock — 총 호출 횟수를 1로 단정할 대상.
          const requestPlay = vi.fn<(cardIndex: number) => void>();

          // (3) controller 생성. fake timer 가 활성화된 상태이므로 default
          //     globalThis.setTimeout 이 자동으로 mock 된다.
          const controller = createHandInputController({
            requestPlay,
          });

          try {
            const legalCtx = makeLegalCtx();

            // (4) 첫 commit 시퀀스 — 모두 legal cardIndex 에 legalCtx 로 적용.
            //     첫 호출만 실제로 requestPlay 를 호출하고, 나머지는
            //     controller 의 isResolving dedupe 가 차단해야 한다.
            for (const kind of commitSeq) {
              switch (kind) {
                case "click":
                  controller.onClick(cardIndex, legalCtx);
                  break;
                case "dragCommit":
                  controller.onDragCommit(cardIndex, legalCtx);
                  break;
                case "confirm":
                  controller.onConfirm(cardIndex, legalCtx);
                  break;
              }
            }

            // (5) 추가 입력 시퀀스 — 이미 isResolving=true 상태이므로
            //     ctx.isAnyResolving=true 로 들어와도 / 들어오지 않아도
            //     controller 는 추가 commit 을 차단해야 한다. 다양한 입력
            //     종류로 부수효과 누적 가능성을 함께 탐색한다.
            const extraCtx = makeExtraCtx();
            for (const ev of extraSeq) {
              switch (ev.kind) {
                case "click":
                  controller.onClick(ev.cardIndex, extraCtx);
                  break;
                case "dragCommit":
                  controller.onDragCommit(ev.cardIndex, extraCtx);
                  break;
                case "confirm":
                  controller.onConfirm(ev.cardIndex, extraCtx);
                  break;
                case "pointerDown":
                  controller.onPointerDown(ev.cardIndex, extraCtx);
                  break;
                case "pointerUp":
                  controller.onPointerUp(ev.cardIndex, extraCtx);
                  break;
                case "pointerEnter":
                  controller.onPointerEnter(ev.cardIndex, extraCtx);
                  break;
                case "pointerLeave":
                  controller.onPointerLeave(ev.cardIndex);
                  break;
              }
            }

            // (6) 단정: requestPlay 호출 횟수가 정확히 1.
            //     controller 의 5초 timeout 은 의도적으로 만료시키지 않는다
            //     (만료시 isResolving=false 로 풀려 추가 commit 이 통과할 수
            //     있으므로). 실제 시나리오와 동일한 "resolving 진행 중"
            //     상태에서 추가 입력이 차단됨을 검증한다.
            expect(requestPlay).toHaveBeenCalledTimes(1);

            // 보강: 첫 호출 인자가 commit 대상 인덱스와 일치한다 (다른 카드의
            //       extra commit 이 누설되지 않았음을 함께 단정).
            expect(requestPlay).toHaveBeenNthCalledWith(1, cardIndex);
          } finally {
            // controller 가 armed 한 모든 timer / 상태를 정리.
            controller.dispose();
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
