import React, { forwardRef, useMemo } from "react";
import { Group } from "three";

interface GameBoardProps {
  /** Number of seat anchors to lay out around the table. */
  seatCount?: number;
}

/**
 * Trick center anchor — the world-space spot where played cards will land.
 * Stage 5 only defines the anchor; nothing is rendered into it yet.
 */
export const TRICK_CENTER_ANCHOR = "trickCenter" as const;

/**
 * GameBoard
 *
 * Stage 5 scope:
 *   - render a flat circular table surface as a real Object3D
 *   - declare a `trickCenter` group at the visual middle
 *   - declare seat anchor groups around the table ring
 *
 * Out of scope:
 *   - card actors (Stage 6+)
 *   - reactive surfaces (board ripple/crack — Stage 7+)
 *   - texture / material polish (Stage 7+)
 *
 * The anchors are real `<group>` nodes so future stages can attach
 * cards, particles, or world effects without re-laying out the board.
 */
export const GameBoard = forwardRef<Group, GameBoardProps>(function GameBoard(
  { seatCount = 6 },
  ref,
) {
  const seatPositions = useMemo(() => {
    // Place seats on an ellipse around the table center.
    // The local player's seat is biased toward the camera (positive Z).
    const safeCount = Math.max(2, Math.min(8, seatCount));
    const rx = 2.6;
    const rz = 1.7;
    return Array.from({ length: safeCount }, (_, index) => {
      const angle = (-Math.PI / 2) + (Math.PI * 2 * index) / safeCount;
      return {
        index,
        x: Math.cos(angle) * rx,
        z: Math.sin(angle) * rz + 0.5,
      };
    });
  }, [seatCount]);

  return (
    <group ref={ref} name="GameBoard">
      {/* Table surface. Flat plane on the XZ axis. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} name="TableSurface">
        <planeGeometry args={[6.4, 4.2]} />
        <meshStandardMaterial color="#1d474e" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Subtle inner ring to mirror the legacy table-ring glow. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} name="TableRing">
        <ringGeometry args={[2.1, 2.18, 64]} />
        <meshBasicMaterial color="#7ec7b8" transparent opacity={0.32} />
      </mesh>

      {/* Trick center anchor. Empty group; future stages mount cards here. */}
      <group name={TRICK_CENTER_ANCHOR} position={[0, 0.01, 0]} />

      {/* Seat anchors around the ring. Empty groups for now. */}
      <group name="SeatAnchors">
        {seatPositions.map((seat) => (
          <group
            key={seat.index}
            name={`SeatAnchor-${seat.index}`}
            position={[seat.x, 0.01, seat.z]}
          />
        ))}
      </group>
    </group>
  );
});
