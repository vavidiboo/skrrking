// Stage 6 hand UX module - HandPresenter (task 8.2).
//
// Hand_Presenter is a DOM-only React component (no R3F per R10-5) that
// owns the wiring between:
//
//   - selectHandViewModel  (backend-authoritative card list / legality)
//   - useHandInteractionStore (client-only hovered/selected/held/resolving)
//   - useEnvironmentFlags  (compactViewport / performanceLite)
//   - createHandInputController (pointer/touch -> store action mapping)
//
// For each card it calls `deriveHandCardState` once per render pass and
// hands the result to <HandCard/> so the renderer never re-derives state
// (Property 1 / R1.5). The whole tree is portaled into the legacy
// `#handArea` slot so existing layout coordinates and z-index ordering
// stay unchanged (R6-1, R6-4).
//
// While mounted, the presenter advertises itself to legacy code so that
// `legacy-app.js::renderHand` short-circuits and the two implementations
// do not fight over the same DOM (R6-5):
//
//   - sets `#handArea[data-hand-presenter="active"]`
//   - sets `window.__skullKingHandPresenterActive__ = true`
//
// Both flags are cleared on unmount.
//
// Constraints satisfied:
//   - No `document.querySelector` / `getElementById` / equivalents inside
//     `src/hand/`. The single portal-target lookup is delegated to the
//     shared `useDomTarget` hook in `src/hooks/` (task 8.2 guidance).
//   - No legacyBridge truth-surface change: the presenter only consumes
//     `getReactUiSnapshot` + `selectHandViewModel`. It never writes back
//     to legacyBridge.
//   - `hand.css` is imported as a side effect so esbuild bundles the
//     feature-scoped stylesheet without expanding global `styles.css`
//     (R7-1, R7-4).
//
// Design references: design.md "Hand_Presenter / HandPresenter.tsx",
// requirements.md sections 1.1, 1.2, 6.1, 6.2, 6.4, 6.5.

import * as React from "react";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { getReactUiSnapshot, subscribeReactUi } from "../legacyBridge";
import { selectHandViewModel } from "../selectors/clientState";
import { useDomTarget } from "../hooks/useDomTarget";
import { useEnvironmentFlags } from "./useEnvironmentFlags";
import { useHandInteractionStore } from "./handInteractionStore";
import {
  deriveHandCardState,
  type HandCardInput,
} from "./deriveHandCardState";
import {
  createHandInputController,
  type HandCardContext,
  type HandInputController,
} from "./handInputController";
import { HandCard } from "./HandCard";

// Side-effect: bundles the feature-scoped stylesheet via esbuild so the
// global styles.css does not need to learn any hand selectors (R7-1,
// R7-4).
import "./hand.css";

/**
 * Shape of the `window` augmentation that `legacy-app.js::renderHand`
 * watches. Local typing keeps the declaration scoped to this file so we
 * do not pollute `global.d.ts` with a presenter-internal detail.
 */
type WindowWithHandPresenterFlag = Window & {
  __skullKingHandPresenterActive__?: boolean;
};

/**
 * Inline subscription helper. Mirrors the pattern used in `App.tsx`'s
 * `useReactUiState` so the two callers stay independent. We do not
 * import `App.tsx`'s helper because `App.tsx` lives outside `src/hand/`
 * and re-exporting it would create an unnecessary cross-feature edge.
 */
function useReactUiState() {
  return useSyncExternalStore(
    subscribeReactUi,
    getReactUiSnapshot,
    getReactUiSnapshot,
  );
}

/**
 * Renders the seven-state hand UI into the legacy `#handArea` slot via a
 * portal. Returns `null` until the portal target is mounted in the DOM
 * (the shell fragment that owns `#handArea` is dropped in via
 * `dangerouslySetInnerHTML` in App.tsx, so it can be unavailable for one
 * commit phase after view transitions).
 */
export function HandPresenter(): React.JSX.Element | null {
  const reactUi = useReactUiState();
  const viewModel = useMemo(
    () => selectHandViewModel(reactUi.clientState),
    [reactUi.clientState],
  );
  const interaction = useHandInteractionStore();
  const env = useEnvironmentFlags();
  const portalTarget = useDomTarget("handArea");

  // The controller owns timers (hover dwell, long-press, blocked toast,
  // 5s play timeout) and survives re-renders. Lazy-construct on first
  // render and dispose on unmount so the timers are always cleaned up.
  // `requestPlay` is wired to a no-op for now; subsequent tasks attach
  // the legacy runtime's send function once the egress surface is
  // finalized. Keeping it as a placeholder here lets task 8.2 land
  // without coupling to the legacy bridge's play API.
  const controllerRef = useRef<HandInputController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createHandInputController({
      requestPlay: () => {
        // TODO(task 9.1+): wire to legacyBridge / legacy runtime send.
      },
    });
  }

  // Toggle the legacy-coexistence guard while mounted (R6-5). The
  // dataset attribute lets `legacy-app.js::renderHand` early-return when
  // the presenter owns the slot; the window flag handles the case where
  // the dataset has not yet been written (e.g. very first commit).
  useEffect(() => {
    if (!portalTarget) return;
    portalTarget.dataset.handPresenter = "active";
    const w = window as WindowWithHandPresenterFlag;
    w.__skullKingHandPresenterActive__ = true;
    return () => {
      delete portalTarget.dataset.handPresenter;
      delete w.__skullKingHandPresenterActive__;
    };
  }, [portalTarget]);

  // Tear the controller down on unmount so any pending timers (hover
  // dwell, long-press, 5s play timeout) do not leak into a re-mount.
  useEffect(() => {
    return () => {
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, []);

  if (!portalTarget) return null;
  if (controllerRef.current === null) return null;
  const controller = controllerRef.current;

  const isAnyResolving = interaction.resolvingIndex !== null;

  const cards = viewModel.cards.map((card) => {
    const isResolving = interaction.resolvingIndex === card.cardIndex;
    const isSelected = interaction.selectedIndex === card.cardIndex;
    const isHeld = interaction.heldIndex === card.cardIndex;
    const isHovered = interaction.hoveredIndex === card.cardIndex;
    const input: HandCardInput = {
      cardIndex: card.cardIndex,
      isLegal: card.isLegal,
      isMyTurn: viewModel.isMyTurn,
      isResolving,
      isAnyResolving,
      isSelected,
      isHeld,
      isHovered,
      legalityKnown: card.legalityKnown,
    };
    const state = deriveHandCardState(input);
    const context: HandCardContext = {
      isLegal: card.isLegal,
      isMyTurn: viewModel.isMyTurn,
      legalityKnown: card.legalityKnown,
      state,
      isAnyResolving,
    };
    return (
      <HandCard
        key={card.cardIndex}
        model={card}
        state={state}
        controller={controller}
        context={context}
      />
    );
  });

  // Environment flags are surfaced as data-* mirror attributes so
  // hand.css's compact / performance-lite branches can key off the
  // wrapper without the presenter touching the global <body> class
  // directly. The actual CSS branching uses media queries +
  // `body.performance-lite`; these mirrors exist so DOM tests and
  // future scoped selectors have a deterministic hook.
  return createPortal(
    <div
      data-hand-presenter-root="true"
      data-compact-viewport={env.compactViewport ? "true" : "false"}
      data-performance-lite={env.performanceLite ? "true" : "false"}
    >
      {cards}
    </div>,
    portalTarget,
  );
}
