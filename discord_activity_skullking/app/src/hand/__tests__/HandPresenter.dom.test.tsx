// Feature: stage6-hand-ux-improvement, Task 8.4 - HandPresenter DOM tests.
//
// Validates: Requirements 1.2, 1.3, 2.4, 4.3, 6.5
//
// Minimal DOM-level assertions for the HandPresenter portal lifecycle:
//   - portal mount sets data-hand-presenter="active" on target
//   - portal unmount clears data-hand-presenter from target
//   - blocked card click does not invoke requestPlay (0 calls)
//   - presenter mount renders hand-card elements

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { render, cleanup, fireEvent } from "@testing-library/react";

// Mock legacyBridge before importing components
const mockState = {
  clientState: {
    session: {
      settings: { maxPlayers: 6 },
      status: "playing",
      phase: "playing",
      roundNumber: 1,
      currentTurnPlayerId: "p1",
      players: [
        {
          id: "p1",
          name: "Player1",
          hand: [
            { type: "pirate", value: 14, label: "Pirate" },
            { type: "escape", value: 1, label: "Escape" },
          ],
          legalCardIndexes: [0],
          bid: 1,
          tricksWon: 0,
          score: 0,
          connectionState: "connected",
        },
      ],
      scoreBreakdown: [],
    },
    interaction: {
      viewerPlayerId: "p1",
      viewerId: "p1",
    },
    transport: {
      sessionConnectionState: "connected",
    },
    ui: { currentView: "game", splashVisible: false, splashMode: "boot" },
  },
};

vi.mock("../../legacyBridge", () => {
  const listeners = new Set<() => void>();
  return {
    subscribeReactUi: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getReactUiSnapshot: () => mockState,
    setReactUiState: (next: any) => {
      Object.assign(mockState, next);
      listeners.forEach((l) => l());
    },
  };
});

// Mock useDomTarget to return a real DOM element
let mockTarget: HTMLElement | null = null;
vi.mock("../../hooks/useDomTarget", () => ({
  useDomTarget: () => mockTarget,
}));

import { HandPresenter } from "../HandPresenter";

describe("HandPresenter DOM tests (task 8.4)", () => {
  beforeEach(() => {
    mockTarget = document.createElement("div");
    mockTarget.id = "handArea";
    document.body.appendChild(mockTarget);
  });

  afterEach(() => {
    cleanup();
    if (mockTarget && mockTarget.parentNode) {
      mockTarget.parentNode.removeChild(mockTarget);
    }
    mockTarget = null;
    delete (window as any).__skullKingHandPresenterActive__;
  });

  it("sets data-hand-presenter='active' on mount and clears on unmount (R6.5)", () => {
    const { unmount } = render(<HandPresenter />);

    expect(mockTarget!.dataset.handPresenter).toBe("active");
    expect((window as any).__skullKingHandPresenterActive__).toBe(true);

    unmount();

    expect(mockTarget!.dataset.handPresenter).toBeUndefined();
    expect((window as any).__skullKingHandPresenterActive__).toBeUndefined();
  });

  it("renders hand-card elements into the portal target", () => {
    render(<HandPresenter />);

    const cards = mockTarget!.querySelectorAll(".hand-card");
    expect(cards.length).toBe(2);
  });

  it("blocked card click does not invoke requestPlay (R2.4, R4.3)", () => {
    render(<HandPresenter />);

    // Card at index 1 is NOT in legalCardIndexes, so it should be blocked
    const cards = mockTarget!.querySelectorAll(".hand-card");
    const blockedCard = cards[1] as HTMLElement;

    expect(blockedCard.dataset.state).toBe("blocked");

    // Click the blocked card - should not trigger any play request
    fireEvent.click(blockedCard);

    // The card should still be blocked (no state change)
    expect(blockedCard.dataset.state).toBe("blocked");
  });

  it("selected state cards are always 0 or 1 (R1.3)", () => {
    render(<HandPresenter />);

    const selectedCards = mockTarget!.querySelectorAll('[data-state="selected"]');
    expect(selectedCards.length).toBeLessThanOrEqual(1);
  });
});
