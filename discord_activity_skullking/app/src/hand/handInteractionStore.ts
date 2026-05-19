// Stage 6 hand UX module - HandInteractionStore (task 3.1).
//
// Module-level singleton store for client-only hand interaction state
// (hover / selected / held / resolving). Exposed to React via
// useSyncExternalStore so deriveHandCardState can read a deterministic
// snapshot per commit phase. Backend has no awareness of these fields.
//
// Design references: design.md "HandInteractionStore", "State Mapping
// Table", Properties 3, 8, 9, 10.

import { useSyncExternalStore } from "react";

/**
 * UI-only hand interaction state. Backend has no awareness of these fields;
 * they exist purely so the React Hand_Presenter can drive
 * hover / selected / held / resolving transitions deterministically.
 */
export interface HandInteractionState {
  hoveredIndex: number | null;
  selectedIndex: number | null;
  heldIndex: number | null;
  resolvingIndex: number | null;
  resolvingStartedAt: number | null;
}

/**
 * Action surface that mutates {@link HandInteractionState} while preserving
 * the design invariants (single selected, held round-trip, resolving
 * auto-clear of hovered/held/selected, etc.).
 */
export interface HandInteractionActions {
  setHovered(index: number | null): void;
  setSelected(index: number | null): void;
  setHeld(index: number | null): void;
  beginResolving(index: number, now: number): void;
  endResolving(reason: "success" | "reject" | "timeout"): void;
  reset(): void;
}

const INITIAL_STATE: HandInteractionState = Object.freeze({
  hoveredIndex: null,
  selectedIndex: null,
  heldIndex: null,
  resolvingIndex: null,
  resolvingStartedAt: null,
});

let currentState: HandInteractionState = INITIAL_STATE;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): HandInteractionState {
  return currentState;
}

/**
 * Replace the current snapshot with `next`. If every field is `Object.is`
 * equal to the previous snapshot, the call is a no-op (same reference is
 * preserved) so useSyncExternalStore does not trigger an unnecessary
 * re-render.
 */
function commit(next: HandInteractionState): void {
  const prev = currentState;
  if (
    Object.is(prev.hoveredIndex, next.hoveredIndex) &&
    Object.is(prev.selectedIndex, next.selectedIndex) &&
    Object.is(prev.heldIndex, next.heldIndex) &&
    Object.is(prev.resolvingIndex, next.resolvingIndex) &&
    Object.is(prev.resolvingStartedAt, next.resolvingStartedAt)
  ) {
    return;
  }
  currentState = next;
  // Iterate over a snapshot copy so listeners that unsubscribe during
  // notification do not skip siblings.
  for (const listener of Array.from(listeners)) {
    try {
      listener();
    } catch {
      // Listener errors must not break the notification fan-out. Other
      // listeners (and subsequent commits) still proceed.
    }
  }
}

export const handInteractionActions: HandInteractionActions = {
  setHovered(index) {
    // hovered is independent of selected / held / resolving state.
    commit({ ...currentState, hoveredIndex: index });
  },
  setSelected(index) {
    // selectedIndex is a single number | null, so single-selected
    // invariant (Property 3) is satisfied by the data shape itself.
    // Passing null clears the selection (Requirement 4.7).
    commit({ ...currentState, selectedIndex: index });
  },
  setHeld(index) {
    // setHeld(null) must preserve selectedIndex so that the round-trip
    // setHeld(i) -> setHeld(null) restores the prior selection
    // (Requirement 4.6, Property 8).
    commit({ ...currentState, heldIndex: index });
  },
  beginResolving(index, now) {
    // Auto-clear hovered/held/selected so deriveHandCardState's priority
    // rules see a single resolving card and every other card normalises
    // to blocked (Requirement 4.5).
    commit({
      hoveredIndex: null,
      selectedIndex: null,
      heldIndex: null,
      resolvingIndex: index,
      resolvingStartedAt: now,
    });
  },
  endResolving(_reason) {
    // The reason parameter exists for upstream controller branching
    // (success vs reject vs timeout). The store itself only clears the
    // resolving fields; restoration of pre-resolving state is handled by
    // beginResolving's auto-clear leaving an empty interaction snapshot
    // (Requirement 4.9, Property 10).
    commit({
      ...currentState,
      resolvingIndex: null,
      resolvingStartedAt: null,
    });
  },
  reset() {
    commit(INITIAL_STATE);
  },
};

/**
 * React hook that subscribes to the module-level interaction store and
 * returns the current snapshot. Wrapped in useSyncExternalStore so the
 * snapshot is consistent across the React commit phase.
 */
export function useHandInteractionStore(): HandInteractionState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Test-only escape hatch. Not part of the public API consumed by the
 * Hand_Presenter component tree. Kept as a separate named export so it is
 * never accidentally pulled in by feature code (the singular export
 * surface used by HandPresenter is `useHandInteractionStore` +
 * `handInteractionActions`).
 */
export const _handInteractionStoreInternals = {
  /** Synchronous read of the current snapshot for assertions. */
  getSnapshot,
  /** Reset the store to its initial all-null state. */
  reset(): void {
    handInteractionActions.reset();
  },
  /** Subscribe to raw listener notifications (test diagnostics). */
  subscribe,
};
