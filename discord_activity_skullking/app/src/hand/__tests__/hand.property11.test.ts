// Feature: stage6-hand-ux-improvement, Property 11: legalityKnown=false implies blocked
//
// For all valid HandCardInput values where `legalityKnown=false`,
// deriveHandCardState(input) MUST return "blocked" regardless of every
// other client-side input flag (isLegal / isMyTurn / isResolving /
// isAnyResolving / isSelected / isHeld / isHovered / cardIndex).
//
// This pins the design "State Mapping Table" rule #1
// (`legalityKnown=false` -> blocked) and Requirement 2.6: until the
// backend `legal_indexes` payload is observed, the hand surface is treated
// as unknown legality and the entire hand is normalized to `blocked`.
//
// Validates: Requirements 2.6

import fc from "fast-check";
import { deriveHandCardState, type HandCardInput } from "../deriveHandCardState";

/**
 * Smart generator: 8 independent boolean flags + a small non-negative
 * cardIndex (Skull King hand size is bounded by the round number, max 10).
 * `legalityKnown` is pinned to `false` via `fc.constant(false)` so the
 * arbitrary explores every other dimension freely while keeping the
 * Property 11 precondition satisfied on every run.
 */
const legalityUnknownInputArb: fc.Arbitrary<HandCardInput> = fc.record({
  cardIndex: fc.integer({ min: 0, max: 9 }),
  isLegal: fc.boolean(),
  isMyTurn: fc.boolean(),
  isResolving: fc.boolean(),
  isAnyResolving: fc.boolean(),
  isSelected: fc.boolean(),
  isHeld: fc.boolean(),
  isHovered: fc.boolean(),
  legalityKnown: fc.constant(false),
});

describe("Property 11: legalityKnown=false implies blocked", () => {
  it("returns 'blocked' for every input where legalityKnown=false, regardless of other flags", () => {
    fc.assert(
      fc.property(legalityUnknownInputArb, (input) => {
        expect(deriveHandCardState(input)).toBe("blocked");
      }),
      { numRuns: 200 },
    );
  });
});
