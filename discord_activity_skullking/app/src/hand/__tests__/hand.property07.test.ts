// Feature: stage6-hand-ux-improvement, Property 7: derive independence between cards
//
// *For all* HandViewModel 과 임의 인덱스 i (자기 카드) 에 대해, 자기 카드의
// client-only interaction 입력 (`isSelected` / `isHeld` / `isHovered`) 을
// 임의로 변화시켜도 다른 모든 인덱스 j ≠ i 에서 도출된 `deriveHandCardState`
// 결과는 변하지 않는다. 즉 다른 카드의 derive 결과는 자기 카드 입력에
// 의존하지 않는다 (각 카드의 결과는 그 카드 자신의 HandCardInput 에만
// 의존하는 stateless invariant).
//
// 본 property 는 결국 "deriveHandCardState 는 자기 input 만 보고, 호출 간에
// 어떤 숨은 공유 상태(메모이제이션·외부 캐시·전역 변수 등)도 가지지 않는다"
// 는 사실을 무작위 입력 200회 이상으로 검증한다. 만약 implementation 에
// 우연히 shared 캐시가 도입되면 i 의 입력 변경 후 j 를 다시 derive 했을 때
// 캐시 오염으로 결과가 바뀔 수 있는데, 본 property 가 그 회귀를 즉시 잡는다.
//
// 주의: `legalityKnown` / `isMyTurn` / `isAnyResolving` 는 hand viewModel 의
// "shared" 필드 — 한 카드의 변경이 같은 viewModel 의 다른 카드에도 동일하게
// 반영된다. 본 property 의 범위는 self-card 의 **client-only** interaction
// 필드(`isSelected`/`isHeld`/`isHovered`) 변경에 한하므로, shared 필드는
// 두 카드(i, j) 입력 간에 동일 값을 사용한다. 또한 i 의 perturbation 시에도
// shared 필드는 그대로 유지하여 j 가 영향을 받지 않게 보장한다.
//
// Validates: Requirements 3.8

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  deriveHandCardState,
  type HandCardInput,
} from "../deriveHandCardState";

/**
 * Hand size N ∈ [2, 8] (Skull King 의 라운드별 손패 상한 이내) 와 그 안에서
 * 서로 다른 두 인덱스 (i, j) 를 생성한다. j ≠ i 가 본 property 의 전제.
 */
const handIndicesArb: fc.Arbitrary<{ N: number; i: number; j: number }> = fc
  .integer({ min: 2, max: 8 })
  .chain((N) =>
    fc
      .tuple(
        fc.integer({ min: 0, max: N - 1 }),
        fc.integer({ min: 0, max: N - 1 }),
      )
      .filter(([i, j]) => i !== j)
      .map(([i, j]) => ({ N, i, j })),
  );

/**
 * 두 카드(i, j) 가 공유하는 viewModel-level 필드. 본 property 의 가정대로
 * i 와 j 는 같은 hand viewModel 안의 카드이므로 이 세 필드는 동일 값.
 */
const sharedFieldsArb = fc.record({
  legalityKnown: fc.boolean(),
  isMyTurn: fc.boolean(),
  isAnyResolving: fc.boolean(),
});

/**
 * 카드별 per-card 필드. 자기 카드 input 에만 속하는 부분으로, i 와 j 는
 * 독립적으로 생성된다. `isLegal` / `isResolving` 은 design 상 backend 에서
 * 카드별로 도출되는 값이므로 client-only 가 아니지만, "다른 카드의 결과는
 * 자기 카드 입력에 의존하지 않는다" 라는 더 강한 invariant 를 함께 검증하기
 * 위해 두 카드 모두 자유롭게 변동시킨다 (단, perturbation 단계에서는
 * client-only 3개 필드만 뒤집어 design 의 property 7 진술과 정합).
 */
const perCardFieldsArb = fc.record({
  isLegal: fc.boolean(),
  isResolving: fc.boolean(),
  isSelected: fc.boolean(),
  isHeld: fc.boolean(),
  isHovered: fc.boolean(),
});

/** i 의 client-only interaction 필드 중 어느 것을 뒤집어 perturb 할지. */
const perturbationArb = fc.record({
  flipSelected: fc.boolean(),
  flipHeld: fc.boolean(),
  flipHovered: fc.boolean(),
});

/** 공유 + per-card 필드를 합쳐 완전한 HandCardInput 한 건을 조립한다. */
function assembleInput(
  cardIndex: number,
  shared: { legalityKnown: boolean; isMyTurn: boolean; isAnyResolving: boolean },
  perCard: {
    isLegal: boolean;
    isResolving: boolean;
    isSelected: boolean;
    isHeld: boolean;
    isHovered: boolean;
  },
): HandCardInput {
  return {
    cardIndex,
    isLegal: perCard.isLegal,
    isMyTurn: shared.isMyTurn,
    isResolving: perCard.isResolving,
    isAnyResolving: shared.isAnyResolving,
    isSelected: perCard.isSelected,
    isHeld: perCard.isHeld,
    isHovered: perCard.isHovered,
    legalityKnown: shared.legalityKnown,
  };
}

describe("Property 7: derive independence between cards", () => {
  it("자기 카드 i 의 client-only interaction 입력을 임의로 변화시켜도 카드 j(j≠i) 의 derive 결과는 변하지 않는다", () => {
    fc.assert(
      fc.property(
        handIndicesArb,
        sharedFieldsArb,
        perCardFieldsArb,
        perCardFieldsArb,
        perturbationArb,
        (indices, shared, perCardI, perCardJ, perturb) => {
          const { i, j } = indices;

          // (1) 두 카드의 baseline HandCardInput 을 조립한다. shared 필드는
          //     두 입력에 동일 값으로 들어간다 (같은 viewModel 가정).
          const cardInputI = assembleInput(i, shared, perCardI);
          const cardInputJ = assembleInput(j, shared, perCardJ);

          // (2) 자기 카드 i 의 client-only interaction 필드만 perturb 한다.
          //     shared 필드 (legalityKnown / isMyTurn / isAnyResolving) 와
          //     per-card backend 필드 (isLegal / isResolving) 는 그대로 두어
          //     j 의 입력에 어떤 shared 경로로도 영향이 가지 않게 한다.
          const cardInputIPrime: HandCardInput = {
            ...cardInputI,
            isSelected: perturb.flipSelected
              ? !cardInputI.isSelected
              : cardInputI.isSelected,
            isHeld: perturb.flipHeld ? !cardInputI.isHeld : cardInputI.isHeld,
            isHovered: perturb.flipHovered
              ? !cardInputI.isHovered
              : cardInputI.isHovered,
          };

          // (3) j 의 derive 결과를 perturbation 전후로 측정한다. cardInputJ
          //     객체는 두 호출 사이에 어떤 변경도 가하지 않으므로, 만약
          //     deriveHandCardState 가 자기 input 외의 숨은 공유 상태에
          //     의존한다면 이 두 값은 달라질 수 있다.
          const deriveJBefore = deriveHandCardState(cardInputJ);

          // i 의 perturbed input 을 derive 호출에 던져 시스템에 "노출" 한다.
          // 결과 자체는 본 property 의 단정에 직접 사용하지 않지만, hidden
          // memoization / 외부 캐시 같은 회귀가 있을 때 부수효과를 강제로
          // 트리거하기 위함이다.
          deriveHandCardState(cardInputIPrime);

          const deriveJAfter = deriveHandCardState(cardInputJ);

          // (4) 핵심 단정: j 의 derive 결과는 i 의 입력 변경 전후로 동일.
          expect(deriveJAfter).toBe(deriveJBefore);

          // (5) 보강 단정: cardInputJ 한 건만으로 derive 를 다시 호출해도
          //     항상 같은 값이 나온다 (referentially transparent / idempotent).
          //     이로써 derive 가 호출 횟수나 외부 시간에 의존하지 않음을
          //     함께 검증한다.
          expect(deriveHandCardState(cardInputJ)).toBe(deriveJBefore);
        },
      ),
      { numRuns: 200 },
    );
  });
});
