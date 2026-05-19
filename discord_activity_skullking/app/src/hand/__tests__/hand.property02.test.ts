// Feature: stage6-hand-ux-improvement, Property 2: 우선순위 규칙 (priority oracle equivalence)
//
// Validates: Requirements 1.4, 3.2
//
// 임의의 HandCardInput에 대해, deriveHandCardState 의 결과가 design.md
// "State Mapping Table" 그대로 정의된 reference oracle 함수와 정확히 동치임을
// 단정한다. 200회 이상 무작위 입력으로 priority rule
//   blocked(legalityKnown=false | isMyTurn=false | isLegal=false)
//     > resolving(self)
//     > blocked(any other resolving)
//     > selected > held > hovered > legal > idle
// 가 항상 준수됨을 검증한다.

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  deriveHandCardState,
  type HandCardInput,
  type HandCardState,
} from "../deriveHandCardState";

/**
 * Reference oracle for the priority rules in design.md "State Mapping Table".
 * Intentionally written as a flat if-chain so its correctness is obvious by
 * inspection and independent of the implementation under test.
 */
function priorityOracle(input: HandCardInput): HandCardState {
  if (input.legalityKnown !== true) return "blocked";
  if (input.isMyTurn !== true) return "blocked";
  if (input.isLegal !== true) return "blocked";
  if (input.isResolving === true) return "resolving";
  if (input.isAnyResolving === true) return "blocked";
  if (input.isSelected === true) return "selected";
  if (input.isHeld === true) return "held";
  if (input.isHovered === true) return "hovered";
  if (input.isLegal === true) return "legal";
  return "idle";
}

/**
 * Smart generator for HandCardInput: 8 independent boolean fields plus a
 * non-negative integer cardIndex. The full 2^8 = 256 boolean combination
 * space is small enough that fast-check easily covers every priority branch
 * in 200+ runs.
 */
const handCardInputArb: fc.Arbitrary<HandCardInput> = fc.record({
  cardIndex: fc.integer({ min: 0, max: 9 }),
  isLegal: fc.boolean(),
  isMyTurn: fc.boolean(),
  isResolving: fc.boolean(),
  isAnyResolving: fc.boolean(),
  isSelected: fc.boolean(),
  isHeld: fc.boolean(),
  isHovered: fc.boolean(),
  legalityKnown: fc.boolean(),
});

describe("Property 2: 우선순위 규칙 (priority oracle equivalence)", () => {
  it("deriveHandCardState 결과가 reference oracle 과 모든 입력에 대해 동치이다", () => {
    fc.assert(
      fc.property(handCardInputArb, (input) => {
        expect(deriveHandCardState(input)).toBe(priorityOracle(input));
      }),
      { numRuns: 200 },
    );
  });
});
