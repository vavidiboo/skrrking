// Feature: stage6-hand-ux-improvement, Property 12: unknown enum input implies idle plus warn
//
// Validates: Requirements 1.6
//
// 임의의 HandCardInput 8개 boolean 필드 중 한 필드를 비-boolean 토큰
// (undefined, 임의 string, 임의 integer, null) 으로 치환했을 때:
//   1) deriveHandCardState 결과가 "idle" 이고
//   2) console.warn 이 해당 호출에서 1회 이상 발생함
// 을 단정한다. 다른 7개 필드는 정상 boolean 으로 채운다.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fc from "fast-check";
import {
  deriveHandCardState,
  type HandCardInput,
} from "../deriveHandCardState";

/**
 * The 8 boolean field names of HandCardInput. cardIndex (number) is excluded
 * because the runtime guard only validates boolean fields.
 */
const BOOLEAN_FIELDS = [
  "isLegal",
  "isMyTurn",
  "isResolving",
  "isAnyResolving",
  "isSelected",
  "isHeld",
  "isHovered",
  "legalityKnown",
] as const;

type BooleanFieldName = (typeof BOOLEAN_FIELDS)[number];

/**
 * Spy on console.warn so the warn calls produced by the runtime guard branch
 * in deriveHandCardState are captured rather than emitted to the test
 * runner's stdout. mockRestore() in afterEach restores the original binding.
 */
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe("Property 12: unknown enum 입력 ⇒ idle + warn", () => {
  it("비-boolean 필드 한 개가 섞이면 derive 결과가 idle 이고 console.warn 이 호출된다", () => {
    fc.assert(
      fc.property(
        // 손상시킬 필드 이름
        fc.constantFrom<BooleanFieldName>(...BOOLEAN_FIELDS),
        // 손상값: undefined / 임의 string / 임의 integer / null
        fc.oneof(
          fc.constant(undefined),
          fc.string(),
          fc.integer(),
          fc.constant(null),
        ),
        // 다른 7개 필드를 채울 정상 boolean 들
        fc.record({
          cardIndex: fc.integer({ min: 0, max: 9 }),
          isLegal: fc.boolean(),
          isMyTurn: fc.boolean(),
          isResolving: fc.boolean(),
          isAnyResolving: fc.boolean(),
          isSelected: fc.boolean(),
          isHeld: fc.boolean(),
          isHovered: fc.boolean(),
          legalityKnown: fc.boolean(),
        }),
        (corruptedField, corruptedValue, base) => {
          // 매 iteration 마다 spy 의 누적 호출을 0 으로 초기화하여
          // 이번 호출에서만 console.warn 이 발생했는지 정확히 단정한다.
          warnSpy.mockClear();

          // base 의 한 필드를 비-boolean 으로 치환하여 손상된 입력을 만든다.
          const corruptedInput = {
            ...base,
            [corruptedField]: corruptedValue,
          };

          // 단정 1: derive 결과는 idle (R1.6 fallback)
          expect(deriveHandCardState(corruptedInput as unknown as HandCardInput)).toBe(
            "idle",
          );

          // 단정 2: console.warn 이 해당 호출에서 1회 이상 발생
          expect(warnSpy).toHaveBeenCalled();
        },
      ),
      { numRuns: 200 },
    );
  });
});
