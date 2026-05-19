// Feature: stage6-hand-ux-improvement, Property 10: resolving reject/timeout round-trip restores prior store
// Note: hand 카드 보유 배열 보존은 store 외부(selectHandViewModel) invariant 이므로 task 4.3 / 5.x checkpoint 에서 다룬다.
//
// Validates: Requirements 4.9
//
// `beginResolving(i, t)` 는 hovered / selected / held 를 모두 null 로 자동
// 클리어하므로, 호출 직전 상태가 모두 null (reset 직후) 인 경우
// `endResolving("reject" | "timeout")` 까지 거친 뒤 store 는 다시 모든 필드가
// null 인 상태로 복원되어야 한다. 본 PBT 는 이 round-trip 불변식을 200회
// 무작위 입력으로 검증한다 (selected / hovered / held 가 비-null 이었던
// 경우의 복원은 design 의도상 store 가 아닌 controller 책임이라 본 단계의
// 단정 범위에서 제외).

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  handInteractionActions,
  _handInteractionStoreInternals,
} from "../handInteractionStore";

describe("Property 10: resolving reject/timeout round-trip 복원", () => {
  it("reset 상태에서 beginResolving(i, t) → endResolving(reject|timeout) 후 store 는 다시 모두 null 이다", () => {
    fc.assert(
      fc.property(
        fc.record({
          i: fc.integer({ min: 0, max: 7 }),
          t: fc.integer({ min: 0, max: 100000 }),
          reason: fc.constantFrom<"reject" | "timeout">("reject", "timeout"),
        }),
        ({ i, t, reason }) => {
          // 1. 매 iteration 시작 시 reset — 이전 케이스가 store 에 남긴
          //    상태가 새 round-trip 에 누설되지 않게 한다.
          _handInteractionStoreInternals.reset();

          // 2. 진입 직전 snapshot 을 캡처. reset 직후이므로 모든 필드는
          //    null 이며, 이후 store 변경이 alias 되지 않도록 deep copy.
          const priorSnapshot = {
            ..._handInteractionStoreInternals.getSnapshot(),
          };

          // 3-4. resolving round-trip 적용.
          handInteractionActions.beginResolving(i, t);
          handInteractionActions.endResolving(reason);

          // 5. 종료 후 snapshot 읽기.
          const afterSnapshot = _handInteractionStoreInternals.getSnapshot();

          // selected / hovered / held 는 begin 직전 (= reset = null) 상태와
          // 동일해야 한다.
          expect(afterSnapshot.selectedIndex).toBe(priorSnapshot.selectedIndex);
          expect(afterSnapshot.hoveredIndex).toBe(priorSnapshot.hoveredIndex);
          expect(afterSnapshot.heldIndex).toBe(priorSnapshot.heldIndex);
          // resolving 필드는 endResolving 이 명시적으로 null 로 클리어한다.
          expect(afterSnapshot.resolvingIndex).toBeNull();
          expect(afterSnapshot.resolvingStartedAt).toBeNull();
        },
      ),
      { numRuns: 200 },
    );
  });
});
