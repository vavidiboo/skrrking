import React from "react";
import type { EffectQualityTier } from "../types";
import { GameBoard } from "./GameBoard";
import { GameCamera } from "./GameCamera";
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
 * Future responsibilities (intentionally not added now):
 *   - translate game state into world state (card actors, seat occupancy)
 *   - host EffectScene (Stage 7)
 *   - host PostFx (Stage 7+)
 *
 * The scene reads no store state directly. Everything comes through props
 * so the rendering layer stays a pure presenter of the world.
 */
export function GameScene({ qualityTier, aspect, seatCount }: GameSceneProps) {
  return (
    <>
      <GameCamera aspect={aspect} />
      <SceneLighting qualityTier={qualityTier} />
      <GameBoard seatCount={seatCount} />
    </>
  );
}
