// Stage 6 hand UX module - HandCard renderer (task 8.1).
//
// HandCard is a thin DOM-only React leaf that takes the upstream-derived
// HandCardModel + HandCardState and renders a single card node with:
//
//   - exactly one `is-state-<state>` class (Property 1 / R1.5 / R7.3)
//   - a `data-state-channels` mirror attribute sourced from
//     `formatHandStateChannels(state)` (single source of truth for non-color
//     channel tokens, defined in handStateChannels.ts at task 7.2)
//   - a `data-card-index` attribute echoing model.cardIndex
//   - a `data-state` mirror so DOM tests can assert the derived state
//     without reparsing the className string (hand.css itself only keys off
//     the class — design "State Mapping Table")
//
// The component is *not* responsible for state derivation, store access,
// or backend communication. It strictly delegates pointer/touch input to
// the supplied HandInputController so that HandPresenter (task 8.2) can
// own the wiring between selectHandViewModel + useHandInteractionStore +
// useEnvironmentFlags + createHandInputController in a single place.
//
// Constraints satisfied:
//   - No imperative DOM access (no document.querySelector/getElementById):
//     every input flows through React event handlers and props (R6-2).
//   - No legacyBridge truth-surface change: HandCard reads model + state
//     props only (R6-7).
//   - No new hand selectors in global styles.css: layout uses only the
//     two pre-existing class names (`hand-card`, `is-state-*`) defined in
//     hand.css per task 7.1 (R7-1, R7-4).
//
// Design references: design.md "Hand_Presenter / HandCard.tsx",
// requirements.md sections 1.5, 3.6, 8.1, 8.2, 8.3.

import * as React from "react";

import { formatHandStateChannels } from "./handStateChannels";

import type { HandCardModel } from "../selectors/clientState";
import type { HandCardState } from "./deriveHandCardState";
import type {
  HandCardContext,
  HandInputController,
} from "./handInputController";

/**
 * Props consumed by {@link HandCard}. The component does not derive its
 * own state — `state` is computed upstream by HandPresenter using
 * deriveHandCardState. This keeps the renderer free of business logic
 * and trivially testable.
 */
export interface HandCardProps {
  /**
   * Per-card data slice from selectHandViewModel. Owns the canonical
   * `cardIndex` and the underlying GameCardLike payload.
   */
  model: HandCardModel;
  /**
   * The single derived state token for this render pass. Maps 1:1 to the
   * `is-state-<state>` class name (Property 1).
   */
  state: HandCardState;
  /**
   * Pointer/touch event sink, wired by HandPresenter (task 8.2). Tests
   * can pass a mock conforming to the {@link HandInputController}
   * surface without reaching into the real store.
   */
  controller: HandInputController;
  /**
   * Per-event context (legality / turn / hand-wide resolving flag /
   * derived state) computed in one place by HandPresenter so individual
   * cards do not redo the work on every event.
   */
  context: HandCardContext;
}

/**
 * Renders the visible label/value/type for a card without reaching into
 * the (potentially rich) GameCardLike shape. Falls back through label →
 * value → type → empty string so any combination from backend produces
 * a non-throwing result. Layout is deliberately minimal — the visual
 * card body is handled by hand.css selectors targeting `.hand-card`
 * (task 7.1); this function only returns a plain string.
 */
function describeCard(model: HandCardModel): string {
  const card = model.card;
  if (typeof card.label === "string" && card.label.length > 0) {
    return card.label;
  }
  if (typeof card.value === "number") {
    return String(card.value);
  }
  if (typeof card.type === "string" && card.type.length > 0) {
    return card.type;
  }
  return "";
}

/**
 * Single hand-card DOM node. Pure presentation: every state transition
 * lives in `controller` + the upstream HandInteractionStore, so HandCard
 * itself stays trivially memoizable should HandPresenter wrap it later.
 */
export function HandCard(props: HandCardProps): React.JSX.Element {
  const { model, state, controller, context } = props;

  // Exactly one `is-state-*` class (Property 1 / R1.5). The base
  // `hand-card` class supplies geometry + base palette from hand.css and
  // is invariant across the seven derived states.
  const className = `hand-card is-state-${state}`;

  // Single source of truth for the non-color channel tokens (task 7.2).
  // Mirrored onto the DOM as a `data-*` attribute so the property /
  // tokens test (task 7.2 unit + Property 1) can assert membership
  // without parsing CSS.
  const stateChannels = formatHandStateChannels(state);

  // blocked → aria-disabled="true" so AT users get the same affordance
  // the visual blocked treatment expresses (R8.3 / Requirement 2.3).
  // Not all blocked branches are "user error" — legalityKnown=false and
  // isMyTurn=false also resolve to blocked — but in every case the card
  // is non-interactive at the affordance layer, which is what
  // aria-disabled communicates.
  const ariaDisabled = state === "blocked" ? true : undefined;

  const cardIndex = model.cardIndex;

  return (
    <div
      className={className}
      data-state={state}
      data-state-channels={stateChannels}
      data-card-index={cardIndex}
      role="button"
      tabIndex={ariaDisabled ? -1 : 0}
      aria-disabled={ariaDisabled}
      onPointerEnter={(): void => controller.onPointerEnter(cardIndex, context)}
      onPointerLeave={(): void => controller.onPointerLeave(cardIndex)}
      onPointerDown={(): void => controller.onPointerDown(cardIndex, context)}
      onPointerUp={(): void => controller.onPointerUp(cardIndex, context)}
      onPointerCancel={(): void => controller.onPointerCancel(cardIndex)}
      onClick={(): void => controller.onClick(cardIndex, context)}
      // NOTE: HTML5 drag (`onDragStart` / `onDragEnd`) is intentionally
      // not bound here. The pointer-based drag flow on
      // HandInputController (`onDragStart` / `onDragCommit` /
      // `onDragCancel`) is wired up by HandPresenter in a follow-up
      // task once mouse-drag affordances are designed end-to-end. Until
      // then click + pointer events cover desktop commit and mobile tap
      // / long-press flows (R3.4, R4.1, R4.2).
    >
      {describeCard(model)}
    </div>
  );
}
