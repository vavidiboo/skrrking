import assert from "node:assert/strict";
import { decideBoardRipple } from "../discord_activity_skullking/app/src/rendering/effectChannels/boardChannel";
import { resolveGameCameraFraming } from "../discord_activity_skullking/app/src/rendering/GameCamera";
import {
  cancelWorldEffectEvent,
  createWorldEffectQueueState,
  enqueueWorldEffectEvent,
  finishActiveWorldEffect,
  takeNextWorldEffectEvent,
} from "../discord_activity_skullking/app/src/rendering/worldEffectQueue";
import type { CardEffectEvent } from "../discord_activity_skullking/app/src/types";

function createEvent(id: string, channels: CardEffectEvent["channels"]): CardEffectEvent {
  return {
    id,
    type: "card.special.skullKing",
    effectType: "skull_king",
    priority: "high",
    channels,
    qualityTier: "high",
    createdAt: 1000,
    card: { id: `card-${id}`, type: "skull_king", label: "Skull King" },
    source: {},
    target: {},
    payload: {
      id,
      card: { id: `card-${id}`, type: "skull_king", label: "Skull King" },
      label: "Skull King",
      effectType: "skull_king",
      preset: {
        themeClass: "skull-king",
        flashColor: "#ffffff",
        auraColors: ["#12aaee", "#334455", "#ffffff"],
        dimBackground: true,
        shakeStrength: "heavy",
        particleStyle: "royal",
        particleCount: 12,
        particleSpread: 36,
        travelScale: 1.05,
        arrivalScale: 1.1,
        rotation: 0,
        moveDuration: 0.4,
        resolveDelay: 0.2,
        totalDuration: 0.8,
        moveEase: [0.2, 0.8, 0.2, 1],
        impactRing: true,
        resultGlow: "legendary",
        emblem: "crown",
        arcLift: 36,
      },
      sourceRect: { left: 0, top: 0, width: 100, height: 150 },
      targetRect: { left: 50, top: 60, width: 100, height: 150 },
      highlightRect: { left: 50, top: 60, width: 100, height: 150 },
      cardAspectRatio: 0.64,
      sourceMarkup: "",
      sourceInnerHtml: "",
      sourceClassName: "",
      result: "win",
      boardSelector: "#board",
      highlightSelector: null,
    },
    cancel: { mode: "replace", replaceKey: null },
    throttle: { mode: "dedupe", dedupeKey: null, windowMs: 0 },
    fallback: { mode: "render", reason: null },
  };
}

function testWorldEffectQueue(): void {
  const state = createWorldEffectQueueState();
  const first = createEvent("first", ["camera"]);
  const second = createEvent("second", ["board", "particles"]);

  enqueueWorldEffectEvent(state, first);
  enqueueWorldEffectEvent(state, second);

  const startedFirst = takeNextWorldEffectEvent(state);
  assert.equal(startedFirst?.id, "first");
  assert.equal(state.activeEventId, "first");

  assert.equal(takeNextWorldEffectEvent(state), null);

  finishActiveWorldEffect(state, "first");
  assert.equal(state.activeEventId, null);

  const startedSecond = takeNextWorldEffectEvent(state);
  assert.equal(startedSecond?.id, "second");

  const wasActiveCancelled = cancelWorldEffectEvent(state, "second");
  assert.equal(wasActiveCancelled, true);
  assert.equal(state.activeEventId, null);
}

function testBoardRippleColorAndTierScaling(): void {
  const event = createEvent("ripple", ["board"]);
  const high = decideBoardRipple(event, "high");
  const low = decideBoardRipple(event, "low");

  assert.ok(high);
  assert.ok(low);
  assert.equal(high?.color, "#12aaee");
  assert.equal(low?.color, "#12aaee");
  assert.ok((high?.radius || 0) > (low?.radius || 0));
}

function testCameraFramingChangesAcrossAspectRatios(): void {
  const desktop = resolveGameCameraFraming(16 / 9);
  const compact = resolveGameCameraFraming(0.8);

  assert.equal(desktop.fov, 42);
  assert.equal(compact.fov, 48);
  assert.notDeepEqual(desktop.position, compact.position);
}

function main(): void {
  testWorldEffectQueue();
  testBoardRippleColorAndTierScaling();
  testCameraFramingChangesAcrossAspectRatios();
  console.log("Stage 7 checks passed");
}

main();
