import type { CardEffectEvent } from "../types";

export interface WorldEffectQueueState {
  activeEventId: string | null;
  pending: CardEffectEvent[];
}

export function createWorldEffectQueueState(): WorldEffectQueueState {
  return {
    activeEventId: null,
    pending: [],
  };
}

export function enqueueWorldEffectEvent(
  state: WorldEffectQueueState,
  event: CardEffectEvent,
): void {
  state.pending.push(event);
}

export function cancelWorldEffectEvent(
  state: WorldEffectQueueState,
  eventId: string,
): boolean {
  state.pending = state.pending.filter((event) => event.id !== eventId);
  if (state.activeEventId !== eventId) {
    return false;
  }
  state.activeEventId = null;
  return true;
}

export function takeNextWorldEffectEvent(
  state: WorldEffectQueueState,
): CardEffectEvent | null {
  if (state.activeEventId) {
    return null;
  }
  const next = state.pending.shift() || null;
  if (!next) {
    return null;
  }
  state.activeEventId = next.id;
  return next;
}

export function finishActiveWorldEffect(
  state: WorldEffectQueueState,
  eventId: string,
): void {
  if (state.activeEventId === eventId) {
    state.activeEventId = null;
  }
}
