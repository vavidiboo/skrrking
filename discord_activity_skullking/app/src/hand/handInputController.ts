// Stage 6 hand UX module - Hand Input Controller (task 6.1).
//
// Maps pointer/touch events to HandInteractionStore actions per the
// threshold table in design.md "Hand Input Controller":
//
//   - hover dwell:                    50ms enter, immediate apply (≤100ms)
//   - mobile tap vs long-press:       350ms boundary
//   - blocked feedback auto-dismiss:  500ms (within 300-1000ms window)
//   - play request timeout:           5000ms
//
// The controller is a pure orchestration surface: it never touches the
// DOM (no `document.querySelector`, no inline style mutation, no class
// toggling). All visible behaviour flows through the
// `handInteractionActions` exported by `handInteractionStore.ts`. The
// `requestPlay` callback is the single egress point that talks to the
// legacy runtime / backend.
//
// Design references:
//   - requirements.md sections 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.7,
//     3.8, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
//   - design.md "Hand Input Controller", "Components and Interfaces"
//   - design.md Properties 4, 5, 6 (validated by tasks 6.2, 6.3, 6.4)

import {
  handInteractionActions,
  _handInteractionStoreInternals,
} from "./handInteractionStore";
import type { HandCardState } from "./deriveHandCardState";

/**
 * Threshold constants from design.md "Hand Input Controller". Centralized
 * so unit / property tests can re-import them via the controller surface
 * without re-hardcoding the values.
 */
export const HOVER_DWELL_MS = 50;
export const TAP_LONG_PRESS_THRESHOLD_MS = 350;
export const BLOCKED_FEEDBACK_DISMISS_MS = 500;
export const PLAY_REQUEST_TIMEOUT_MS = 5000;

/**
 * Per-event context derived upstream by the Hand_Presenter from the
 * backend-authoritative ClientStoreSnapshot plus the result of
 * `deriveHandCardState`. The controller never re-derives this; it only
 * inspects the supplied context to decide whether an input should be
 * accepted.
 */
export interface HandCardContext {
  /** Backend Card_Legality says this index is legal in the current trick. */
  isLegal: boolean;
  /** Backend says it is the viewer's turn. */
  isMyTurn: boolean;
  /** Backend legality payload has been received and is structurally valid. */
  legalityKnown: boolean;
  /** State previously derived for this card by deriveHandCardState. */
  state: HandCardState;
  /** Some card in the hand area is currently resolving. */
  isAnyResolving: boolean;
}

/**
 * Construction-time dependencies. `now`, `setTimeoutFn`, and
 * `clearTimeoutFn` exist so unit tests can drive the controller with
 * `vi.useFakeTimers()` without monkey-patching globals.
 */
export interface HandInputControllerOptions {
  /**
   * Single egress point that the controller calls (exactly once per
   * commit-dedup window) when a legal commit input is accepted. The
   * caller is responsible for translating this into a backend play
   * request and for invoking `notifyResult` once the backend acks.
   */
  requestPlay: (cardIndex: number) => void;
  /**
   * Optional notification used to surface a non-intrusive "blocked"
   * toast (Requirement 2.4 / 4.3). Phase `"show"` fires immediately on a
   * blocked commit input; phase `"hide"` fires
   * {@link BLOCKED_FEEDBACK_DISMISS_MS} later so the host can auto-clear
   * the visual signal without a modal or audio.
   */
  onBlockedFeedback?: (cardIndex: number, phase: "show" | "hide") => void;
  /** Defaults to `() => Date.now()`. */
  now?: () => number;
  /** Defaults to the global `setTimeout`. */
  setTimeoutFn?: typeof setTimeout;
  /** Defaults to the global `clearTimeout`. */
  clearTimeoutFn?: typeof clearTimeout;
}

/**
 * Public input surface consumed by HandCard / HandPresenter. Every method
 * is idempotent against unrelated state so callers can wire the same
 * handler set to pointer, touch, and keyboard event sources.
 */
export interface HandInputController {
  /** Pointer entered card hit-area; arms the hover dwell timer. */
  onPointerEnter(cardIndex: number, ctx: HandCardContext): void;
  /** Pointer left card hit-area; cancels hover dwell and any held state. */
  onPointerLeave(cardIndex: number): void;
  /** Mouse / touch began on a card; arms the long-press timer. */
  onPointerDown(cardIndex: number, ctx: HandCardContext): void;
  /** Mouse / touch released; tap (<350ms) toggles selected, long-press ends held. */
  onPointerUp(cardIndex: number, ctx: HandCardContext): void;
  /** System cancelled the pointer stream; clears any held state. */
  onPointerCancel(cardIndex: number): void;
  /** Desktop click commit (R3.4). */
  onClick(cardIndex: number, ctx: HandCardContext): void;
  /** Drag operation began; snapshots interaction state for drag-cancel restore. */
  onDragStart(cardIndex: number, ctx: HandCardContext): void;
  /** Drag operation committed onto the play target; same dedupe as click. */
  onDragCommit(cardIndex: number, ctx: HandCardContext): void;
  /** Drag operation cancelled; restores the snapshot from `onDragStart`. */
  onDragCancel(cardIndex: number): void;
  /** Mobile thumb-reachable confirm action (R4.4). */
  onConfirm(cardIndex: number, ctx: HandCardContext): void;
  /**
   * Backend response or local timeout reached for an in-flight play
   * request. Cancels the 5s timeout and ends resolving with the supplied
   * reason (Requirement 3.5 / 4.9).
   */
  notifyResult(result: "success" | "reject" | "timeout"): void;
  /**
   * Tear down: cancel every outstanding timer and clear internal state.
   * Safe to call multiple times.
   */
  dispose(): void;
}

/** Snapshot of controller-tracked store fields, captured at drag-start. */
interface DragSnapshot {
  selectedIndex: number | null;
  heldIndex: number | null;
  hoveredIndex: number | null;
}

type TimerHandle = ReturnType<typeof setTimeout>;

/**
 * Returns true when `ctx` describes a card that must reject every commit
 * input. The four checks line up with the priority guards in
 * `deriveHandCardState`:
 *   - legalityKnown=false              (R2.6)
 *   - isMyTurn=false                   (R3.2 variant, R4.3)
 *   - isLegal=false                    (R2.3, R3.2, R4.3)
 *   - state already normalized blocked (R3.4 / R4.5 — e.g. another card
 *     is resolving, so this card's derived state is "blocked")
 */
function isBlockedContext(ctx: HandCardContext): boolean {
  return (
    !ctx.legalityKnown ||
    !ctx.isMyTurn ||
    !ctx.isLegal ||
    ctx.state === "blocked"
  );
}

/**
 * Build a fresh controller instance. The factory keeps every piece of
 * state captured in closure scope so multiple presenters / tests can run
 * side by side without sharing a module-level singleton.
 */
export function createHandInputController(
  options: HandInputControllerOptions,
): HandInputController {
  const now = options.now ?? ((): number => Date.now());
  const setTimeoutFn: typeof setTimeout = options.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn: typeof clearTimeout =
    options.clearTimeoutFn ?? clearTimeout;

  // ---------------------------------------------------------------------
  // Controller-tracked store mirror.
  //
  // The Hand_Presenter design treats this controller as the sole writer
  // to HandInteractionStore. We mirror what we have set so drag-cancel
  // can restore the pre-drag snapshot without reaching into the store's
  // test-only `_handInteractionStoreInternals.getSnapshot` escape hatch.
  // ---------------------------------------------------------------------
  let trackedSelected: number | null = null;
  let trackedHeld: number | null = null;
  let trackedHovered: number | null = null;

  // Hover dwell timer (single in-flight; dwell is per-pointer not per-card).
  let hoverTimer: TimerHandle | null = null;
  let pendingHoverIndex: number | null = null;

  // Press timer for tap vs long-press detection.
  let pressTimer: TimerHandle | null = null;
  let pressIndex: number | null = null;
  let pressLongPressFired = false;

  // Resolving / play-request timeout.
  let isResolving = false;
  let resolveTimer: TimerHandle | null = null;

  // Blocked feedback auto-dismiss timer.
  let blockedHideTimer: TimerHandle | null = null;
  let blockedShownIndex: number | null = null;

  // Drag-cancel restoration snapshot.
  let dragPreSnapshot: DragSnapshot | null = null;

  // ---------------------------------------------------------------------
  // Timer helpers — every cancellation routes through here so dispose()
  // can null-out a single field per timer kind without leaking handles.
  // ---------------------------------------------------------------------

  function clearTimer(handle: TimerHandle | null): void {
    if (handle !== null) {
      clearTimeoutFn(handle);
    }
  }

  function cancelHoverTimer(): void {
    if (hoverTimer !== null) {
      clearTimer(hoverTimer);
      hoverTimer = null;
    }
    pendingHoverIndex = null;
  }

  function cancelPressTimer(): void {
    if (pressTimer !== null) {
      clearTimer(pressTimer);
      pressTimer = null;
    }
    pressIndex = null;
    pressLongPressFired = false;
  }

  function cancelResolveTimer(): void {
    if (resolveTimer !== null) {
      clearTimer(resolveTimer);
      resolveTimer = null;
    }
  }

  function cancelBlockedHideTimer(): void {
    if (blockedHideTimer !== null) {
      clearTimer(blockedHideTimer);
      blockedHideTimer = null;
    }
    blockedShownIndex = null;
  }

  // ---------------------------------------------------------------------
  // Store action wrappers — every store mutation goes through these so
  // `tracked*` mirrors stay in sync with the actual store snapshot.
  // ---------------------------------------------------------------------

  function setHovered(index: number | null): void {
    trackedHovered = index;
    handInteractionActions.setHovered(index);
  }

  function setSelected(index: number | null): void {
    trackedSelected = index;
    handInteractionActions.setSelected(index);
  }

  function setHeld(index: number | null): void {
    trackedHeld = index;
    handInteractionActions.setHeld(index);
  }

  function beginResolving(index: number): void {
    // beginResolving auto-clears hovered/held/selected in the store
    // (handInteractionStore Property 10 contract). Mirror that here.
    trackedSelected = null;
    trackedHeld = null;
    trackedHovered = null;
    handInteractionActions.beginResolving(index, now());
  }

  // ---------------------------------------------------------------------
  // Blocked feedback — non-intrusive show/hide pair (R2.4, R4.3).
  // ---------------------------------------------------------------------

  function fireBlockedFeedback(cardIndex: number): void {
    const callback = options.onBlockedFeedback;
    if (!callback) {
      return;
    }
    // Reset any pending hide so the new toast gets the full window.
    cancelBlockedHideTimer();
    blockedShownIndex = cardIndex;
    try {
      callback(cardIndex, "show");
    } catch {
      // A consumer-side feedback handler must never break the input
      // controller's state machine.
    }
    blockedHideTimer = setTimeoutFn(() => {
      blockedHideTimer = null;
      const idx = blockedShownIndex;
      blockedShownIndex = null;
      if (idx === null) return;
      try {
        callback(idx, "hide");
      } catch {
        // swallow — see above
      }
    }, BLOCKED_FEEDBACK_DISMISS_MS);
  }

  // ---------------------------------------------------------------------
  // Commit pipeline shared by onClick / onConfirm / onDragCommit.
  //
  // Returns true iff a play request was emitted (i.e. the controller
  // transitioned into the resolving phase). Callers use the boolean to
  // know whether to clear ancillary state such as `dragPreSnapshot`.
  // ---------------------------------------------------------------------

  function commitPlay(cardIndex: number, ctx: HandCardContext): boolean {
    // Blocked guard (R2.3, R3.3, R4.3) — early return + zero play
    // requests + non-intrusive feedback.
    if (isBlockedContext(ctx)) {
      fireBlockedFeedback(cardIndex);
      return false;
    }
    // Dedupe (R3.4, R4.4, R4.5) — once a commit is in flight, ignore
    // every additional commit until notifyResult() or the 5s timeout
    // clears the resolving flag.
    if (isResolving) {
      return false;
    }

    isResolving = true;
    cancelHoverTimer();
    cancelPressTimer();
    beginResolving(cardIndex);

    // Schedule the 5-second client-side timeout (R3.5). If the backend
    // never acks via notifyResult, we end resolving with reason
    // "timeout" so the host can revert visuals + show a toast.
    cancelResolveTimer();
    resolveTimer = setTimeoutFn(() => {
      resolveTimer = null;
      if (!isResolving) return;
      isResolving = false;
      try {
        handInteractionActions.endResolving("timeout");
      } catch {
        // swallow store errors — the next snapshot will reconverge.
      }
    }, PLAY_REQUEST_TIMEOUT_MS);

    try {
      options.requestPlay(cardIndex);
    } catch {
      // Even if the host throws synchronously, the store is already in
      // resolving state. The 5s timer or notifyResult() will eventually
      // clear it; we deliberately do not roll back here so a thrown
      // requestPlay still benefits from the dedupe window.
    }
    return true;
  }

  // ---------------------------------------------------------------------
  // Public surface.
  // ---------------------------------------------------------------------

  return {
    onPointerEnter(cardIndex, ctx) {
      if (isResolving || ctx.isAnyResolving) return;
      // Blocked cards have no hover affordance (R3.2): do not even arm
      // the dwell timer, so `setHovered` cannot fire later either.
      if (isBlockedContext(ctx)) return;
      cancelHoverTimer();
      pendingHoverIndex = cardIndex;
      hoverTimer = setTimeoutFn(() => {
        hoverTimer = null;
        // Only commit hover if the same card is still pending — pointer
        // may have left during the 50ms dwell.
        if (pendingHoverIndex === cardIndex) {
          pendingHoverIndex = null;
          if (!isResolving) {
            setHovered(cardIndex);
          }
        }
      }, HOVER_DWELL_MS);
    },

    onPointerLeave(cardIndex) {
      // Cancel an in-flight dwell that targeted this card.
      if (pendingHoverIndex === cardIndex) {
        cancelHoverTimer();
      }
      // If hover was already committed for this card, clear it.
      if (trackedHovered === cardIndex) {
        setHovered(null);
      }
      // Held card losing pointer aborts the held state (R4.6 — held
      // round-trip when pointer leaves the hit-area).
      if (pressIndex === cardIndex) {
        if (pressLongPressFired && trackedHeld === cardIndex) {
          setHeld(null);
        }
        cancelPressTimer();
      }
    },

    onPointerDown(cardIndex, ctx) {
      if (isResolving || ctx.isAnyResolving) return;
      // Blocked cards never enter the press / long-press flow at all so
      // `setHeld` cannot fire (R2.3, R4.3).
      if (isBlockedContext(ctx)) return;
      cancelPressTimer();
      pressIndex = cardIndex;
      pressLongPressFired = false;
      pressTimer = setTimeoutFn(() => {
        pressTimer = null;
        // Re-check resolving at fire time — a commit may have started
        // while the press timer was scheduled.
        if (isResolving) {
          pressIndex = null;
          return;
        }
        pressLongPressFired = true;
        setHeld(cardIndex);
      }, TAP_LONG_PRESS_THRESHOLD_MS);
    },

    onPointerUp(cardIndex, ctx) {
      // Distinguish tap vs long-press purely from controller-tracked
      // press state. `pressTimer !== null` means the long-press timer
      // has not yet fired (so this is a tap). `pressLongPressFired`
      // means the long-press transitioned the card into held state.
      const matchesPress = pressIndex === cardIndex;
      const wasLongPress =
        matchesPress && pressLongPressFired && pressTimer === null;
      const wasTap = matchesPress && !pressLongPressFired && pressTimer !== null;

      cancelPressTimer();

      if (wasLongPress) {
        // Long-press end (R4.6): clear held but preserve any selected
        // state from before the press. trackedSelected is untouched by
        // setHeld, matching `handInteractionActions.setHeld(null)`.
        if (trackedHeld === cardIndex) {
          setHeld(null);
        }
        return;
      }

      if (!wasTap) return;

      // Tap path (R4.1). Blocked tap → no transition + non-intrusive
      // feedback only. Resolving tap → ignored entirely.
      if (isBlockedContext(ctx)) {
        fireBlockedFeedback(cardIndex);
        return;
      }
      if (isResolving || ctx.isAnyResolving) return;

      // Toggle behaviour (R4.7, R4.8): tapping the already-selected card
      // de-selects; tapping a different card replaces the selection
      // (single-selected store invariant, Property 3).
      if (trackedSelected === cardIndex) {
        setSelected(null);
      } else {
        setSelected(cardIndex);
      }
    },

    onPointerCancel(cardIndex) {
      // System-level cancel (e.g. notification interrupt) — treat the
      // same as pointer leaving the held card.
      if (pressIndex === cardIndex) {
        if (pressLongPressFired && trackedHeld === cardIndex) {
          setHeld(null);
        }
        cancelPressTimer();
      }
    },

    onClick(cardIndex, ctx) {
      // Desktop click commit (R3.4). Single play request guard lives in
      // commitPlay.
      commitPlay(cardIndex, ctx);
    },

    onDragStart(cardIndex, ctx) {
      // Blocked cards: no drag flow, no snapshot capture. The host UI
      // should also reject HTML5 dragstart for blocked cards via the
      // derived state class, but we defend the boundary anyway.
      if (isBlockedContext(ctx)) return;
      if (isResolving || ctx.isAnyResolving) return;
      // Snapshot is captured from the live store (not from the closure
      // mirror) so external mutations between renders are also restored
      // on drag-cancel; matches Requirement 3.7 store-equivalence
      // semantics and Property 6 invariant.
      //
      // Note: `_handInteractionStoreInternals` was originally documented
      // as a test-only escape hatch, but for this read path it is the
      // only stable synchronous accessor the controller has. The store
      // may expose a public `getSnapshot()` (or equivalent) later; this
      // controller can switch to that surface without behavioural change.
      const live = _handInteractionStoreInternals.getSnapshot();
      dragPreSnapshot = {
        selectedIndex: live.selectedIndex,
        heldIndex: live.heldIndex,
        hoveredIndex: live.hoveredIndex,
      };
      // Reference cardIndex so unused-param lint stays quiet without
      // dropping the parameter from the public signature.
      void cardIndex;
    },

    onDragCommit(cardIndex, ctx) {
      const accepted = commitPlay(cardIndex, ctx);
      if (accepted) {
        // commitPlay → beginResolving has already cleared interaction
        // state; we do not want drag-cancel to roll back into a
        // resolving snapshot.
        dragPreSnapshot = null;
      }
    },

    onDragCancel(cardIndex) {
      // No play request, no resolving transition (R3.7). Restore the
      // pre-drag snapshot if we recorded one; otherwise leave the store
      // untouched (drag-start may have been rejected by the blocked
      // guard).
      if (dragPreSnapshot === null) return;
      const snap = dragPreSnapshot;
      dragPreSnapshot = null;
      setSelected(snap.selectedIndex);
      setHeld(snap.heldIndex);
      setHovered(snap.hoveredIndex);
      void cardIndex;
    },

    onConfirm(cardIndex, ctx) {
      // Mobile thumb-reachable confirm (R4.4). Same dedupe pathway as
      // onClick / onDragCommit.
      commitPlay(cardIndex, ctx);
    },

    notifyResult(result) {
      // Backend ack / reject / external timeout (R3.5, R4.9). We cancel
      // the local 5s timer and end resolving with the supplied reason.
      // The store's beginResolving auto-cleared other interaction state
      // already, so endResolving leaves a clean snapshot from which the
      // next backend snapshot can drive the UI.
      cancelResolveTimer();
      if (!isResolving) {
        return;
      }
      isResolving = false;
      try {
        handInteractionActions.endResolving(result);
      } catch {
        // swallow — see commitPlay
      }
    },

    dispose() {
      cancelHoverTimer();
      cancelPressTimer();
      cancelResolveTimer();
      cancelBlockedHideTimer();
      isResolving = false;
      pressIndex = null;
      pressLongPressFired = false;
      pendingHoverIndex = null;
      dragPreSnapshot = null;
      trackedSelected = null;
      trackedHeld = null;
      trackedHovered = null;
    },
  };
}
