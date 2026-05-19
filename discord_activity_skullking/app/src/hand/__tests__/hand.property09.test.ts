// Feature: stage6-hand-ux-improvement, Property 9: selected toggle invariant (start in {null, i})
// 본 PBT 는 realistic controller entry state (start ∈ {null, i}) 에 한정하여
// design Property 9 의 단순 형태 ("짝수 → start, 홀수 → i") 를 검증한다.
// start ∉ {null, i} 케이스에서는 toggle helper 가 첫 호출 시 selectedIndex
// 를 i 로 set 하면서 원래 start 값이 store 에서 사라지므로 단순 형태가
// 깨진다 — 따라서 본 property 의 적용 도메인에서 명시적으로 제외한다.
//
// Validates: Requirements 4.8

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  handInteractionActions,
  _handInteractionStoreInternals,
} from "../handInteractionStore";

/**
 * Controller-level toggle 합성. store 의 setSelected 는 단순 set 이므로
 * toggle 의미는 "현재 값이 i 면 null 로 클리어, 아니면 i 로 set" 으로
 * 호출 측에서 합성한다.
 */
function toggleSelected(i: number): void {
  const cur = _handInteractionStoreInternals.getSnapshot().selectedIndex;
  if (cur === i) {
    handInteractionActions.setSelected(null);
  } else {
    handInteractionActions.setSelected(i);
  }
}

describe("Property 9: selected toggle invariant (start ∈ {null, i})", () => {
  it("동일 인덱스 i 에 대한 toggleSelected n 회 호출 후 selectedIndex 는 짝수면 start, 홀수면 i 이다", () => {
    fc.assert(
      fc.property(
        fc.record({
          i: fc.integer({ min: 0, max: 7 }),
          n: fc.integer({ min: 0, max: 20 }),
          // start ∈ {null, i} — controller realistic entry state 로만 제한.
          startsAtI: fc.boolean(),
        }),
        ({ i, n, startsAtI }) => {
          // 1. 매 iteration 시작 시 store 를 초기 상태로 되돌려 이전 시도의
          //    잔여 상태가 다음 시도를 오염시키지 않게 한다.
          _handInteractionStoreInternals.reset();

          // 2. start 를 {null, i} 두 값 중 하나로 도출하여 시작값을 set 한다.
          const start: number | null = startsAtI ? i : null;
          handInteractionActions.setSelected(start);
          expect(_handInteractionStoreInternals.getSnapshot().selectedIndex).toBe(
            start,
          );

          // 3. 동일 인덱스 i 에 대해 toggleSelected 를 n 회 적용한다.
          for (let k = 0; k < n; k += 1) {
            toggleSelected(i);
          }

          // 4. n 회 toggle 적용 후 selectedIndex 를 읽어들인다.
          const afterIndex =
            _handInteractionStoreInternals.getSnapshot().selectedIndex;

          // 5. 단정: 두 분기 모두 design Property 9 단순 형태 ("짝수 → start,
          //    홀수 → i") 와 정합한다.
          const isEven = n % 2 === 0;
          if (startsAtI) {
            // start === i 분기: 짝수 → i (== start), 홀수 → null.
            if (isEven) {
              expect(afterIndex).toBe(i);
            } else {
              expect(afterIndex).toBeNull();
            }
          } else {
            // start === null 분기: 짝수 → null (== start), 홀수 → i.
            if (isEven) {
              expect(afterIndex).toBeNull();
            } else {
              expect(afterIndex).toBe(i);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
