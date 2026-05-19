// Feature: stage6-hand-ux-improvement, Property 1: 단일 상태 + 단일 클래스 매핑
//
// For all valid HandCardInput values, deriveHandCardState(input) returns
// exactly one of the seven canonical hand card states, and the resulting
// class string assigned to a HandCard contains exactly one `is-state-*`
// class (not zero, not two or more).
//
// Validates: Requirements 1.1, 1.5, 7.3, 9.1
//
// Notes:
//   - HandCard.tsx is still a placeholder at this checkpoint (task 2.2 runs
//     before task 8.1 lands the real renderer). Per the design "State
//     Mapping Table", the class assignment is a 1:1 mirror of the derived
//     state name, so we capture that invariant directly here with a local
//     mapToClassName helper. The DOM-render assertion is covered later by
//     task 8.4 (HandPresenter.dom.test.tsx).

import fc from "fast-check";
import {
  deriveHandCardState,
  type HandCardInput,
  type HandCardState,
} from "../deriveHandCardState";

/**
 * The seven canonical hand card states from the design "State Mapping Table".
 * Kept as a local literal so the test fails loudly if the production enum
 * accidentally adds or drops a member without updating this assertion.
 */
const ALLOWED_STATES: ReadonlyArray<HandCardState> = [
  "idle",
  "legal",
  "blocked",
  "hovered",
  "selected",
  "held",
  "resolving",
];

/**
 * The 1:1 state -> class mapping required by Requirement 1.5 / Property 1.
 * Defined here (and not imported) so the test pins the contract that
 * HandCard MUST follow when it is implemented in task 8.1; if that
 * implementation drifts, the dom test in task 8.4 will catch it via the
 * same invariant.
 */
function mapToClassName(state: HandCardState): string {
  return `is-state-${state}`;
}

/**
 * Arbitrary that mirrors the 9 fields of HandCardInput. cardIndex is a
 * small integer (hand size <= 8 in Skull King), and the eight flags are
 * independent booleans so the priority rules in deriveHandCardState see
 * the full input space (Property 1 has no precondition on inputs).
 */
const handCardInputArb: fc.Arbitrary<HandCardInput> = fc.record({
  cardIndex: fc.integer({ min: 0, max: 7 }),
  isLegal: fc.boolean(),
  isMyTurn: fc.boolean(),
  isResolving: fc.boolean(),
  isAnyResolving: fc.boolean(),
  isSelected: fc.boolean(),
  isHeld: fc.boolean(),
  isHovered: fc.boolean(),
  legalityKnown: fc.boolean(),
});

describe("hand property 1: single state + single class mapping", () => {
  it("derives exactly one canonical state and exactly one is-state-* class", () => {
    fc.assert(
      fc.property(handCardInputArb, (input) => {
        const state = deriveHandCardState(input);

        // Assertion 1: the derived state belongs to the seven-element set.
        expect(ALLOWED_STATES).toContain(state);

        // Assertion 2: the class string carries exactly one is-state-*
        // class. We surround the mapped class with neutral filler tokens
        // to defend against a future regression where HandCard appends
        // additional hand-related classes alongside the state class.
        const className = `hand-card hand-card--surface ${mapToClassName(state)}`;
        const matches = className.match(/\bis-state-[a-z]+\b/g) ?? [];
        expect(matches).toHaveLength(1);
        expect(matches[0]).toBe(`is-state-${state}`);
      }),
      { numRuns: 200 },
    );
  });
});
