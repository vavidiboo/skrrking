// Feature: stage6-hand-ux-improvement, Property 8: held round-trip preserves prior store state
//
// Validates: Requirements 4.6
//
// 임의의 진입 직전 store 상태(임의 hovered / selected) 에서 임의 카드 인덱스
// `i` 에 대해 `setHeld(i)` 후 `setHeld(null)` 을 적용했을 때, store 가
// `setHeld(i)` 호출 직전 상태와 등가임을 단정한다 (`selectedIndex`,
// `hoveredIndex`, `resolvingIndex`, `resolvingStartedAt` 모두 보존, heldIndex
// 는 null 로 복귀). 200회 무작위 입력으로 round-trip 불변식을 검증한다.

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  handInteractionActions,
  _handInteractionStoreInternals,
} from "../handInteractionStore";

describe("Property 8: held round-trip 복원", () => {
  it("setHeld(i) → setHeld(null) 후 store 는 setHeld(i) 직전과 등가이다", () => {
    fc.assert(
      fc.property(
        fc.record({
          priorSelected: fc.option(fc.integer({ min: 0, max: 7 }), {
            nil: null,
          }),
          priorHovered: fc.option(fc.integer({ min: 0, max: 7 }), {
            nil: null,
          }),
          i: fc.integer({ min: 0, max: 7 }),
        }),
        ({ priorSelected, priorHovered, i }) => {
          // 1. reset to a known initial snapshot every iteration so prior
          //    cases cannot leak state across runs.
          _handInteractionStoreInternals.reset();

          // 2-3. Drive the store to an arbitrary "진입 직전" snapshot.
          handInteractionActions.setHovered(priorHovered);
          handInteractionActions.setSelected(priorSelected);

          // 4. Capture a deep copy so subsequent mutations cannot alias the
          //    snapshot we are comparing against.
          const priorSnapshot = {
            ..._handInteractionStoreInternals.getSnapshot(),
          };

          // 5-6. Apply the held round-trip.
          handInteractionActions.setHeld(i);
          handInteractionActions.setHeld(null);

          // 7. Read the post round-trip snapshot.
          const afterSnapshot = _handInteractionStoreInternals.getSnapshot();

          // Round-trip preserves every non-held field.
          expect(afterSnapshot.selectedIndex).toBe(priorSnapshot.selectedIndex);
          expect(afterSnapshot.hoveredIndex).toBe(priorSnapshot.hoveredIndex);
          expect(afterSnapshot.resolvingIndex).toBe(
            priorSnapshot.resolvingIndex,
          );
          expect(afterSnapshot.resolvingStartedAt).toBe(
            priorSnapshot.resolvingStartedAt,
          );
          // heldIndex must end up null after the round-trip.
          expect(afterSnapshot.heldIndex).toBeNull();
        },
      ),
      { numRuns: 200 },
    );
  });
});
