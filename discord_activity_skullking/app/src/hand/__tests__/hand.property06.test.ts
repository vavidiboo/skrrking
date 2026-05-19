// Feature: stage6-hand-ux-improvement, Property 6: drag-cancel round-trip preserves store and emits zero play requests
//
// 임의의 진입 직전 store 상태(임의 selected / hovered)에서 legal Hand_Card 에
// 대해 `onDragStart(i, legalCtx)` → 임의 횟수의 pointermove noise →
// `onDragCancel(i)` 시퀀스를 적용했을 때 다음 세 가지를 동시에 단정한다:
//
//   1) requestPlay mock 의 호출 횟수가 0 이다 (drag-cancel 은 backend 로
//      어떤 play 요청도 전송하지 않는다).
//   2) 시퀀스 종료 후 store snapshot 이 drag-start 직전 snapshot 과
//      등가이다 (`selectedIndex`, `heldIndex`, `hoveredIndex`,
//      `resolvingIndex`, `resolvingStartedAt` 모두 보존).
//   3) 시퀀스 종료 후 derive 결과가 `"resolving"` 인 카드 수가 0 이다
//      (즉 `afterSnap.resolvingIndex === null`).
//
// pointermove 는 design 상 controller surface 에 매핑되지 않는 입력이므로
// noise 는 controller 의 store 에 영향을 주지 않는 횟수만큼의 비-commit
// iteration 으로 모사한다 (실제 브라우저에서는 native pointermove 가
// 발생해도 controller 가 보지 못하는 것과 동치).
//
// Validates: Requirements 3.7

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import {
  createHandInputController,
  type HandCardContext,
} from "../handInputController";
import {
  _handInteractionStoreInternals,
  handInteractionActions,
} from "../handInteractionStore";

/** legal Hand_Card 용 base ctx — controller 가 drag flow 를 수락할 모든 조건. */
function makeLegalCtx(): HandCardContext {
  return {
    isLegal: true,
    isMyTurn: true,
    legalityKnown: true,
    state: "legal",
    isAnyResolving: false,
  };
}

describe("Property 6: drag-cancel round-trip preserves store and emits zero play requests", () => {
  beforeEach(() => {
    // controller 가 hover dwell / long-press / blocked toast / 5초 timeout
    // 등 setTimeout 을 사용하므로 매 it 진입 시 fake timer 활성화로
    // 결정론적 환경을 보장한다.
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    "임의 prior store 상태 + drag-start → pointermove noise → drag-cancel 후 store 가 prior 와 등가이고 requestPlay 0회 호출이며 resolving 카드 수 0 이다",
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 7 }),
          fc.option(fc.integer({ min: 0, max: 7 }), { nil: null }),
          fc.option(fc.integer({ min: 0, max: 7 }), { nil: null }),
          fc.integer({ min: 0, max: 10 }),
          (cardIndex, priorSelected, priorHovered, pointerMoveCount) => {
            // (1) 매 iteration 시작 시 store reset — 이전 케이스 잔재 차단.
            _handInteractionStoreInternals.reset();

            // (2) requestPlay mock — 시퀀스 종료 후 호출 횟수 0 단정 대상.
            const requestPlay = vi.fn<(cardIndex: number) => void>();

            // (3) controller 생성 — fake timer 가 활성화된 상태이므로 default
            //     globalThis.setTimeout 이 자동 mock 되어 controller 의
            //     timer 도 결정론적으로 동작한다.
            const controller = createHandInputController({
              requestPlay,
            });

            try {
              // (4) 사전 store 셋업: 임의 selected / hovered 진입 직전 상태
              //     으로 store 를 driving. controller 의 tracked mirror 와
              //     store snapshot 이 어긋나는 boundary 까지 함께 검증한다.
              handInteractionActions.setSelected(priorSelected);
              handInteractionActions.setHovered(priorHovered);

              // (5) priorSnap — drag-start 직전 store snapshot 의 deep copy.
              //     이후 어떤 mutation 도 priorSnap 에 alias 되지 않도록 spread.
              const priorSnap = {
                ..._handInteractionStoreInternals.getSnapshot(),
              };

              // (6) drag-start — legal ctx 로 controller 에 전달.
              const legalCtx = makeLegalCtx();
              controller.onDragStart(cardIndex, legalCtx);

              // (7) pointermove noise — design 상 controller 는 native
              //     pointermove 를 핸들링하지 않으므로 noise 는 controller
              //     surface 에 닿지 않는 비-commit iteration 으로 모사한다.
              //     (실제 브라우저에서 drag 동안 발생하는 pointermove 가
              //      controller store 에 영향을 주지 않는 것과 동치이다.)
              for (let i = 0; i < pointerMoveCount; i += 1) {
                // intentional no-op — pointermove 는 controller 의 입력
                // 표면이 아니므로 어떤 controller 메서드도 호출하지 않는다.
              }

              // (8) drag-cancel — backend 로 play 요청을 보내지 않고 store 를
              //     drag-start 직전 상태로 복원해야 한다 (R3.7).
              controller.onDragCancel(cardIndex);

              // (9) afterSnap — drag-cancel 직후 store snapshot.
              const afterSnap = _handInteractionStoreInternals.getSnapshot();

              // ---- Assertion 1: requestPlay 호출 횟수 = 0 (R3.7). ----
              expect(requestPlay).toHaveBeenCalledTimes(0);

              // ---- Assertion 2: store 가 drag-start 직전과 등가. ----
              expect(afterSnap.selectedIndex).toBe(priorSnap.selectedIndex);
              expect(afterSnap.heldIndex).toBe(priorSnap.heldIndex);
              expect(afterSnap.hoveredIndex).toBe(priorSnap.hoveredIndex);
              expect(afterSnap.resolvingIndex).toBe(priorSnap.resolvingIndex);
              expect(afterSnap.resolvingStartedAt).toBe(
                priorSnap.resolvingStartedAt,
              );

              // ---- Assertion 3: derive 결과가 resolving 인 카드 수 = 0
              //     (즉 resolvingIndex === null). drag-cancel 은 어떤 카드도
              //     resolving 상태로 전이시키지 않아야 한다. ----
              expect(afterSnap.resolvingIndex).toBeNull();
            } finally {
              // controller 가 armed 한 모든 timer / 상태를 정리해 다음
              // iteration 에 누설되지 않도록 한다.
              controller.dispose();
            }
          },
        ),
        { numRuns: 200 },
      );
    },
  );
});
