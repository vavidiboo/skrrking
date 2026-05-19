#!/usr/bin/env node
// Stage 6 Hand UX Smoke Test (task 11.1)
//
// Single-run smoke test that validates core hand UX invariants without
// requiring a browser or full React render. Exercises:
//   (a) 7 state mapping cycle via deriveHandCardState
//   (b) legal commit → requestPlay 1 call
//   (c) blocked input → requestPlay 0 calls
//   (d) mobile <350ms tap → selected transition + requestPlay 0 calls
//
// This script is bundled by esbuild before execution (see package.json
// test:hand:smoke script). It mocks React's useSyncExternalStore so the
// handInteractionStore module can load in Node without a React runtime.
//
// Exit code 0 = all pass, non-zero = failure (stderr has details).

// ─── React mock (store module imports useSyncExternalStore) ───────────────
// We provide a minimal shim so the module loads without error.
import { createRequire } from "node:module";

let failures = 0;

function assert(condition, id, reason) {
  if (!condition) {
    failures++;
    process.stderr.write(`FAIL [${id}]: ${reason}\n`);
  }
}

// ─── Import the modules under test ───────────────────────────────────────
// These are bundled by esbuild so TS imports resolve correctly.

import { deriveHandCardState } from "../discord_activity_skullking/app/src/hand/deriveHandCardState.ts";
import {
  createHandInputController,
  TAP_LONG_PRESS_THRESHOLD_MS,
} from "../discord_activity_skullking/app/src/hand/handInputController.ts";
import {
  handInteractionActions,
  _handInteractionStoreInternals,
} from "../discord_activity_skullking/app/src/hand/handInteractionStore.ts";

// ─── (a) 7 state mapping basic cycle ──────────────────────────────────────

const STATE_INPUTS = [
  { state: "blocked", input: { cardIndex: 0, isLegal: true, isMyTurn: true, isResolving: false, isAnyResolving: false, isSelected: false, isHeld: false, isHovered: false, legalityKnown: false } },
  { state: "legal", input: { cardIndex: 0, isLegal: true, isMyTurn: true, isResolving: false, isAnyResolving: false, isSelected: false, isHeld: false, isHovered: false, legalityKnown: true } },
  { state: "blocked", input: { cardIndex: 0, isLegal: false, isMyTurn: true, isResolving: false, isAnyResolving: false, isSelected: false, isHeld: false, isHovered: false, legalityKnown: true } },
  { state: "hovered", input: { cardIndex: 0, isLegal: true, isMyTurn: true, isResolving: false, isAnyResolving: false, isSelected: false, isHeld: false, isHovered: true, legalityKnown: true } },
  { state: "selected", input: { cardIndex: 0, isLegal: true, isMyTurn: true, isResolving: false, isAnyResolving: false, isSelected: true, isHeld: false, isHovered: false, legalityKnown: true } },
  { state: "held", input: { cardIndex: 0, isLegal: true, isMyTurn: true, isResolving: false, isAnyResolving: false, isSelected: false, isHeld: true, isHovered: false, legalityKnown: true } },
  { state: "resolving", input: { cardIndex: 0, isLegal: true, isMyTurn: true, isResolving: true, isAnyResolving: true, isSelected: false, isHeld: false, isHovered: false, legalityKnown: true } },
];

const ALL_STATES = new Set(["idle", "legal", "blocked", "hovered", "selected", "held", "resolving"]);

for (const { state, input } of STATE_INPUTS) {
  const result = deriveHandCardState(input);
  assert(ALL_STATES.has(result), `state-cycle-valid-${state}`, `expected valid state, got '${result}'`);
  assert(result === state, `state-cycle-${state}`, `expected '${state}', got '${result}'`);
}

// ─── (b) legal commit → requestPlay 1 call ───────────────────────────────

let playCallCount = 0;
let playCalledWith = null;

_handInteractionStoreInternals.reset();

const controllerB = createHandInputController({
  requestPlay: (cardIndex) => {
    playCallCount++;
    playCalledWith = cardIndex;
  },
});

const legalCtx = {
  isLegal: true,
  isMyTurn: true,
  legalityKnown: true,
  state: "legal",
  isAnyResolving: false,
};

controllerB.onClick(2, legalCtx);
assert(playCallCount === 1, "legal-commit-single", `expected requestPlay 1 call, got ${playCallCount}`);
assert(playCalledWith === 2, "legal-commit-index", `expected cardIndex 2, got ${playCalledWith}`);

// Additional clicks during resolving should NOT trigger more calls
controllerB.onClick(2, { ...legalCtx, state: "resolving", isAnyResolving: true });
controllerB.onClick(3, legalCtx);
assert(playCallCount === 1, "legal-commit-dedup", `expected requestPlay still 1 after resolving clicks, got ${playCallCount}`);

controllerB.dispose();

// ─── (c) blocked input → requestPlay 0 calls ─────────────────────────────

playCallCount = 0;
_handInteractionStoreInternals.reset();

const controllerC = createHandInputController({
  requestPlay: () => { playCallCount++; },
});

const blockedCtx = {
  isLegal: false,
  isMyTurn: true,
  legalityKnown: true,
  state: "blocked",
  isAnyResolving: false,
};

controllerC.onClick(0, blockedCtx);
controllerC.onClick(1, blockedCtx);
controllerC.onConfirm(0, blockedCtx);
controllerC.onDragCommit(0, blockedCtx);

assert(playCallCount === 0, "blocked-zero-play", `expected requestPlay 0 calls for blocked, got ${playCallCount}`);

controllerC.dispose();

// ─── (d) mobile <350ms tap → selected + requestPlay 0 ────────────────────

playCallCount = 0;
_handInteractionStoreInternals.reset();

let fakeTime = 1000;
const timers = [];

const controllerD = createHandInputController({
  requestPlay: () => { playCallCount++; },
  now: () => fakeTime,
  setTimeoutFn: (fn, ms) => {
    const id = { fn, ms, fireAt: fakeTime + ms, cleared: false };
    timers.push(id);
    return id;
  },
  clearTimeoutFn: (id) => { if (id) id.cleared = true; },
});

function advanceTimers(ms) {
  fakeTime += ms;
  for (const t of timers) {
    if (!t.cleared && fakeTime >= t.fireAt) {
      t.cleared = true;
      t.fn();
    }
  }
}

const tapCtx = {
  isLegal: true,
  isMyTurn: true,
  legalityKnown: true,
  state: "legal",
  isAnyResolving: false,
};

// Simulate a quick tap: pointerDown then pointerUp within 200ms (< 350ms threshold)
controllerD.onPointerDown(0, tapCtx);
advanceTimers(200); // < TAP_LONG_PRESS_THRESHOLD_MS
controllerD.onPointerUp(0, tapCtx);

// After a tap, the card should be selected (store check)
const storeAfterTap = _handInteractionStoreInternals.getSnapshot();
assert(storeAfterTap.selectedIndex === 0, "mobile-tap-selected", `expected selectedIndex=0 after tap, got ${storeAfterTap.selectedIndex}`);
assert(playCallCount === 0, "mobile-tap-no-play", `expected requestPlay 0 after tap (not commit), got ${playCallCount}`);

controllerD.dispose();

// ─── Summary ──────────────────────────────────────────────────────────────

if (failures > 0) {
  process.stderr.write(`\n${failures} smoke test(s) FAILED\n`);
  process.exit(1);
} else {
  process.stdout.write("All hand smoke tests passed ✓\n");
  process.exit(0);
}
