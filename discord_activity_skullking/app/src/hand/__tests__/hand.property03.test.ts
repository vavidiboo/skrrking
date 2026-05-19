// Feature: stage6-hand-ux-improvement, Property 3: single-selected store invariant
//
// 임의의 setSelected 호출 시퀀스를 적용한 뒤, HandInteractionStore의
// selectedIndex가 항상 단일 정수(number) 또는 null 값임을 단정한다.
// 자료구조상 selectedIndex는 number | null 단일 슬롯이므로 두 개 이상의
// 카드가 동시에 selected 상태가 되는 것은 원천적으로 불가능하며, 본
// property는 그 불변식이 setSelected 액션 시퀀스 어디에서도 깨지지
// 않음을 검증한다 (toggle 동작은 Property 9의 책임이며 본 property는
// 단일성에만 집중한다).
//
// Validates: Requirements 1.3, 4.7

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  handInteractionActions,
  _handInteractionStoreInternals,
} from "../handInteractionStore";

/**
 * setSelected 호출 시퀀스 arbitrary.
 *
 * 각 원소는 number(0..7, 손패 크기 상한) 또는 null이며 시퀀스 길이는
 * 0..50 사이를 균등 탐색한다. fast-check 의 fc.option은 두 번째 인자의
 * `nil` 옵션을 통해 "null" 가지를 명시적으로 표현하므로 setSelected의
 * `index | null` 입력 도메인을 그대로 모사한다.
 */
const setSelectedSequenceArb: fc.Arbitrary<ReadonlyArray<number | null>> =
  fc.array(fc.option(fc.integer({ min: 0, max: 7 }), { nil: null }), {
    minLength: 0,
    maxLength: 50,
  });

describe("Property 3: single-selected store invariant", () => {
  it("임의 setSelected 시퀀스 후 selectedIndex 는 항상 number 또는 null 단일 값이다", () => {
    fc.assert(
      fc.property(setSelectedSequenceArb, (sequence) => {
        // 각 iteration 시작 시 store 를 초기 상태로 되돌려 이전 시도의
        // 잔여 상태가 다음 시도의 결과를 오염시키지 않도록 한다.
        _handInteractionStoreInternals.reset();

        // 시퀀스 내부 매 호출 직후 단일성 + 최신 인자 일치를 단정.
        for (const arg of sequence) {
          handInteractionActions.setSelected(arg);
          const snap = _handInteractionStoreInternals.getSnapshot();

          // Invariant 1: selectedIndex 는 number 또는 null 한 값. 배열,
          // 객체, undefined 등 다른 형태가 들어갈 수 없다.
          expect(
            typeof snap.selectedIndex === "number" ||
              snap.selectedIndex === null,
          ).toBe(true);

          // Invariant 2: 가장 최근 setSelected 인자와 selectedIndex 가
          // 일치한다 (단일 슬롯이므로 후행 호출이 선행 호출을 덮어쓴다).
          expect(snap.selectedIndex).toBe(arg);
        }

        // 시퀀스 종료 후 최종 스냅샷도 동일한 단일성 불변식을 만족.
        const finalSnap = _handInteractionStoreInternals.getSnapshot();
        expect(
          typeof finalSnap.selectedIndex === "number" ||
            finalSnap.selectedIndex === null,
        ).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
