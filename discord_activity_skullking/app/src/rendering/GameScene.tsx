import React, { useMemo } from "react";
import type { EffectQualityTier } from "../types";
import { EffectScene } from "./EffectScene";
import { GameBoard } from "./GameBoard";
import { GameCamera, resolveGameCameraFraming } from "./GameCamera";
import { SceneLighting } from "./SceneLighting";

interface GameSceneProps {
  qualityTier: EffectQualityTier;
  aspect: number;
  seatCount?: number;
}

/**
 * GameScene
 *
 * Stage 5 scope: just compose the scene graph.
 *   - camera ownership lives in GameCamera
 *   - lighting lives in SceneLighting
 *   - board / anchors live in GameBoard
 *
 * Stage 7 addition:
 *   - EffectScene subscribes to effectBus and drives the world-side
 *     reactions (camera shake, board ripple, world particles). It mounts
 *     AFTER GameBoard so its effects render on top of the table surface
 *     in declared order.
 *
 * Future responsibilities (intentionally not added now):
 *   - translate game state into world state (card actors, seat occupancy)
 *   - host PostFx (Stage 7+)
 *
 * The scene reads no store state directly. Everything comes through props
 * so the rendering layer stays a pure presenter of the world.
 */
export function GameScene({ qualityTier, aspect, seatCount }: GameSceneProps) {
  const cameraFraming = useMemo(() => resolveGameCameraFraming(aspect), [aspect]);

  return (
    <>
      <GameCamera framing={cameraFraming} />
      <SceneLighting qualityTier={qualityTier} />
      <GameBoard seatCount={seatCount} />
      <EffectScene qualityTier={qualityTier} cameraFraming={cameraFraming} />
    </>
  );
}
