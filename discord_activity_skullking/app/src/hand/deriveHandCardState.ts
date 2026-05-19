// Stage 6 hand UX module - pure state derivation surface.
//
// This file owns the single source of truth for mapping a HandCardInput to
// one of the seven normalized hand card states. The priority rules and the
// unknown-token fallback are defined in design.md "State Mapping Table" and
// requirements.md sections 1.1, 1.4, 1.5, 1.6, 2.3, 2.6, 3.2, 4.3.
//
// The function MUST stay pure: the only allowed side effect is a single
// `console.warn` call in the runtime-guard branch (Requirement 1.6 /
// Property 12). No DOM access, no store mutation, no I/O.

/**
 * Single normalized state language for a hand card. Exactly one of these
 * states is assigned to a card per render pass (Property 1).
 */
export type HandCardState =
  | "idle"
  | "legal"
  | "blocked"
  | "hovered"
  | "selected"
  | "held"
  | "resolving";

/**
 * Pure-function input shape for {@link deriveHandCardState}. All fields are
 * derived upstream from the backend-authoritative ClientStoreSnapshot
 * (legality / turn) and the client-only HandInteractionStore
 * (hover / selected / held / resolving).
 */
export interface HandCardInput {
  cardIndex: number;
  /** Mirrors backend Card_Legality (`legal_indexes`). */
  isLegal: boolean;
  /** Mirrors backend turn authority. */
  isMyTurn: boolean;
  /** This particular card has an in-flight play request. */
  isResolving: boolean;
  /** Some card in the hand is currently resolving. */
  isAnyResolving: boolean;
  /** Client interaction: card is currently selected. */
  isSelected: boolean;
  /** Client interaction: pointer-down / long-press in progress. */
  isHeld: boolean;
  /** Client interaction: desktop hover dwell satisfied. */
  isHovered: boolean;
  /** Backend legality payload has been received and is structurally valid. */
  legalityKnown: boolean;
}

/**
 * Runtime guard: returns true when every boolean field on `input` is an
 * actual boolean. The TypeScript signature of {@link deriveHandCardState}
 * forbids non-boolean values, but legacyBridge / JS callers can still pass
 * malformed objects, so we defend at the boundary (Requirement 1.6).
 */
function hasValidBooleanFields(input: HandCardInput): boolean {
  return (
    typeof input.isLegal === "boolean" &&
    typeof input.isMyTurn === "boolean" &&
    typeof input.isResolving === "boolean" &&
    typeof input.isAnyResolving === "boolean" &&
    typeof input.isSelected === "boolean" &&
    typeof input.isHeld === "boolean" &&
    typeof input.isHovered === "boolean" &&
    typeof input.legalityKnown === "boolean"
  );
}

/**
 * Map a {@link HandCardInput} to exactly one {@link HandCardState} using the
 * priority rules from design.md "State Mapping Table":
 *
 *   1. `legalityKnown=false`           -> "blocked"   (R2.6)
 *   2. `isMyTurn=false`                -> "blocked"   (R3.2 variant, R4.3)
 *   3. `isLegal=false`                 -> "blocked"   (R2.3, R3.2, R4.3)
 *   4. `isResolving=true`              -> "resolving" (R1.4 top priority)
 *   5. `isAnyResolving=true` (other)   -> "blocked"   (R3.4 / R4.5 normalize)
 *   6. `isSelected=true`               -> "selected"  (R1.4)
 *   7. `isHeld=true`                   -> "held"      (R1.4)
 *   8. `isHovered=true`                -> "hovered"   (R1.4)
 *   9. `isLegal=true`                  -> "legal"     (R2.1 default)
 *  10. otherwise                       -> "idle"      (R1.6 / R1.1)
 *
 * Unknown / non-boolean field values fall through to "idle" with a single
 * `console.warn` call (Requirement 1.6, Property 12).
 */
export function deriveHandCardState(input: HandCardInput): HandCardState {
  // Runtime guard for malformed inputs from JS callers (Requirement 1.6).
  // The TS signature already constrains this for typed call sites; this
  // branch defends the legacyBridge / smoke-test boundary.
  if (input == null || !hasValidBooleanFields(input)) {
    // Single side effect allowed by the spec: surface the bad input so the
    // caller can identify the regression. Keeps function otherwise pure.
    console.warn("[hand] unknown state token", input);
    return "idle";
  }

  // 1. Backend legality payload missing/invalid -> blocked (R2.6).
  if (input.legalityKnown !== true) {
    return "blocked";
  }

  // 2. Not viewer's turn -> blocked (R3.2 variant, R4.3).
  if (input.isMyTurn !== true) {
    return "blocked";
  }

  // 3. Backend says illegal -> blocked (R2.3, R3.2, R4.3).
  if (input.isLegal !== true) {
    return "blocked";
  }

  // 4. This card is the in-flight resolver -> resolving (R1.4 top, R3.4).
  if (input.isResolving === true) {
    return "resolving";
  }

  // 5. Some other card is resolving -> normalize to blocked (R4.5).
  if (input.isAnyResolving === true) {
    return "blocked";
  }

  // 6-8. Client interaction priority: selected > held > hovered (R1.4).
  if (input.isSelected === true) {
    return "selected";
  }
  if (input.isHeld === true) {
    return "held";
  }
  if (input.isHovered === true) {
    return "hovered";
  }

  // 9. Default for legal card with no interaction (R2.1).
  // At this point `isLegal === true` (rule 3 already returned otherwise),
  // but we keep the explicit check for readability and forward-compat.
  if (input.isLegal === true) {
    return "legal";
  }

  // 10. Final fallback (defensive; unreachable under valid input).
  return "idle";
}
