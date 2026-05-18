# Rendering Pipeline

## Purpose

This document defines how React Three Fiber should be introduced as the battle-space renderer instead of a decorative background layer.

## Rendering Philosophy

- Three.js creates game space
- HTML overlay handles reading and control
- The two layers must collaborate without fighting for ownership

In short:

- Canvas = world
- Overlay = interface

## Current Baseline

The current game view is still DOM-first:

- CSS-driven table layout
- DOM hand cards
- DOM trick center
- DOM overlay card effects

This is the migration starting point, not the final rendering model.

## Target Scene Topology

```tsx
<GameCanvas>
  <GameScene>
    <GameCamera />
    <SceneLighting />
    <GameBoard />
    <SeatAnchors />
    <CardActors />
    <EffectScene />
    <PostFx />
  </GameScene>
</GameCanvas>
<GameOverlay />
```

## Core Components

### GameCanvas

Responsibilities:

- create the R3F root
- apply device-pixel-ratio policy
- apply quality tiers
- respond to resize and safe-area changes

### GameScene

Responsibilities:

- own the scene graph
- translate game state into world state
- coordinate board, cards, camera, and effects

### GameBoard

Responsibilities:

- render the table surface
- define trick center anchors
- define seat anchors
- provide reaction surfaces for world effects

### GameCamera

Responsibilities:

- own default framing
- support turn emphasis
- support trick-resolution shake
- support special-card drift or push

### EffectScene

Responsibilities:

- world-space particles
- shockwaves
- emissive bursts
- board ripples and cracks
- score-adjacent world accents

### GameOverlay

Responsibilities:

- HUD
- hand
- dialogs
- menus
- score drawer
- reconnect copy
- result screen

## World vs Overlay Responsibilities

### World Space

- board
- played-card actors
- lighting
- camera movement
- world particles
- shockwave and impact reactions

### Screen Space Overlay

- text-heavy HUD
- bid controls
- room and session actions
- settings
- result and score surfaces

## Rendering Priority

Use this priority order:

1. gameplay readability
2. card ownership clarity
3. turn and trick emphasis
4. cinematic enhancement
5. decorative polish

If a world effect makes the board harder to read, the effect loses.

## Z-Layer Policy

- layer 0: far environment
- layer 1: board surface
- layer 2: seat anchors and idle world props
- layer 3: active trick cards
- layer 4: world effects
- layer 5: HTML HUD
- layer 6: dialogs and blocking overlays
- layer 7: emergency system overlays

## Performance Budget

### Desktop Target

- aim for stable 60 FPS
- keep trick-resolution frame pacing stable

### Mobile / Embedded Target

- support 30-60 FPS adaptively
- reduce particle counts
- use smaller postprocessing budgets
- avoid blur-heavy layouts

### Budget Rules

- keep draw calls controlled
- minimize layered transparency
- set explicit particle ceilings by quality tier
- prefer atlas-backed UI and effect textures

## Postprocessing Strategy

Postprocessing is allowed only when it survives the performance budget.

Rules:

- use bloom sparingly
- keep blur costs low
- prefer simple emissive tricks over expensive full-screen passes
- color grading should support mood, not obscure readability

Quality tier guidance:

- desktop high: limited bloom and emissive highlights
- mobile medium: reduced bloom or cheaper substitutes
- lite: remove expensive postprocessing entirely

## Resize / Viewport Rules

- react immediately to Discord viewport changes
- let the overlay handle safe-area padding first
- keep board composition stable under aspect changes
- tune camera framing by breakpoint instead of letting it drift randomly

## Interaction Sync

- overlay hand interaction may still begin in screen space
- committed card travel can migrate into world space
- raycast and DOM hit-testing must not conflict

## Recommended Introduction Sequence

1. add `GameCanvas`
2. add `GameBoard`
3. define seat and trick anchors
4. sync overlay layout with scene framing
5. move card actors into the scene
6. add `EffectScene`

## Definition of Done

- canvas and overlay ownership are clear
- the board exists as a real world-space scene object
- the HUD supports the scene instead of covering it
- performance tiers are explicit
