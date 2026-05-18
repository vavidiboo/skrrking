# Roadmap

## Overview

The roadmap follows this order:

documentation -> type foundation -> state cleanup -> typed effects -> R3F boundary -> hand UX upgrade -> basic 3D effects -> Discord optimization -> advanced effects

Rules:

- do not combine multiple major stages into one change
- every stage must be testable
- every stage must end with a recommended commit message

## MVP Scope

The MVP target includes:

- typed client state contracts
- stable Discord Activity match flow
- clear hand interaction
- basic special-card presentation
- mobile and desktop interaction support
- performance-lite fallback

## Stage 1. Documentation

Goal:

- define the new source-of-truth docs set

Files:

- `docs/codex.md`
- `docs/vision.md`
- `docs/architecture.md`
- `docs/uiux-direction.md`
- `docs/typescript-migration.md`
- `docs/effect-system.md`
- `docs/rendering-pipeline.md`
- `docs/discord-activity-ux.md`
- `docs/asset-pipeline.md`
- `docs/roadmap.md`
- `docs/tech-debt.md`

Done when:

- the docs have clear ownership
- future tasks can use the docs as the main reference

Test method:

- cross-check links, naming, and stage consistency

Recommended commit:

- `docs(core): define source-of-truth guides for skull king activity rewrite`

## Stage 2. TypeScript Migration Foundation

Goal:

- establish the typed frontend foundation

Likely files:

- `package.json`
- `discord_activity_skullking/app/src/main.tsx`
- `discord_activity_skullking/app/src/App.tsx`
- `discord_activity_skullking/app/src/types/*`
- `discord_activity_skullking/app/src/cardEffects/*.ts`

Done when:

- core domain types exist
- the build uses a TypeScript entry
- bridge and effect boundaries have basic typing

Test method:

- build passes
- home, lobby, and game bootstrap still work

Recommended commit:

- `refactor(ts): establish typed domain and frontend entry boundary`

## Stage 3. State Structure Cleanup

Goal:

- normalize distributed UI state into a typed store model

Likely files:

- `discord_activity_skullking/app/src/store/*`
- `discord_activity_skullking/app/src/legacyBridge.*`
- `discord_activity_skullking/app/legacy-app.js`
- `discord_activity_skullking/app/src/App.*`

Done when:

- shared selectors exist
- major derived UI values come from the store
- bridge responsibility shrinks

Test method:

- room join, lobby sync, and game sync work
- reconnect state updates the HUD correctly

Recommended commit:

- `refactor(state): normalize match snapshot into typed client store`

## Stage 4. effectBus Typed Pipeline

Goal:

- evolve the current effect structure into a typed multi-channel pipeline

Likely files:

- `discord_activity_skullking/app/src/cardEffects/effectBus.*`
- `discord_activity_skullking/app/src/cardEffects/effectPresets.*`
- `discord_activity_skullking/app/src/cardEffects/CardEffectLayer.*`
- `discord_activity_skullking/app/styles.css`

Done when:

- effect event types exist
- priority, cancel, and throttle rules are implemented
- low-end fallback is present

Test method:

- verify normal card, Pirate, Mermaid, and Skull King play paths
- verify performance-lite behavior

Recommended commit:

- `refactor(fx): migrate card effects to typed priority pipeline`

## Stage 5. R3F Canvas Boundary

Goal:

- create the first real canvas versus overlay boundary

Likely files:

- `discord_activity_skullking/app/src/rendering/GameCanvas.tsx`
- `discord_activity_skullking/app/src/rendering/GameScene.tsx`
- `discord_activity_skullking/app/src/App.*`
- `discord_activity_skullking/app/styles.css`

Done when:

- a real board scene boundary exists
- overlay and scene layering is stable

Test method:

- viewport resize checks on desktop and mobile-sized layouts
- z-order verification between scene and overlay

Recommended commit:

- `feat(r3f): introduce game canvas and scene boundary for battle board`

## Stage 6. Hand UX Improvement

Goal:

- upgrade the hand into a stronger tactical interaction surface

Likely files:

- `discord_activity_skullking/app/src/ui/hand/*`
- `discord_activity_skullking/app/legacy-app.js`
- `discord_activity_skullking/app/styles.css`

Done when:

- legal versus blocked feedback is stronger
- mobile tap and hold flow is clear
- desktop hover and drag feel better

Test method:

- verify legal move feedback
- verify touch interaction behavior

Recommended commit:

- `ux(hand): redesign hand interaction flow for desktop and mobile`

## Stage 7. Basic 3D Effects

Goal:

- add the first R3F world reactions and camera responses

Likely files:

- `discord_activity_skullking/app/src/rendering/EffectScene.tsx`
- `discord_activity_skullking/app/src/rendering/GameCamera.tsx`
- `discord_activity_skullking/app/src/cardEffects/*`

Done when:

- board ripple, camera nudge, and basic world particles work
- DOM overlay effects and world effects do not duplicate each other badly

Test method:

- special card play verification
- frame pacing observation during trick resolution

Recommended commit:

- `feat(render): add board reaction and camera feedback scene`

## Stage 8. Discord Activity Optimization

Goal:

- harden the game for embedded Discord conditions

Likely files:

- `discord_activity_skullking/app/styles.css`
- `discord_activity_skullking/app/src/rendering/*`
- `discord_activity_skullking/app/src/ui/*`

Done when:

- compact HUD rules are real
- safe-area handling is real
- performance-lite mode is reliable

Test method:

- small viewport verification
- mobile-sized layout verification

Recommended commit:

- `perf(activity): optimize hud and effects for discord embedded viewport`

## Stage 9. Advanced Effects

Goal:

- ship signature effects for legendary and advanced special cards

Likely files:

- `discord_activity_skullking/app/src/rendering/EffectScene.tsx`
- `discord_activity_skullking/app/src/cardEffects/*`
- `discord_activity_skullking/app/styles.css`
- asset additions

Done when:

- Skull King, Kraken, and White Whale each have signature presentation
- result and score feedback feel more premium

Test method:

- manual play-path verification for each special card
- low-end readability checks

Recommended commit:

- `feat(fx): ship signature legendary card presentation set`

## First Recommended Implementation Step

The first implementation step after documentation is Stage 2.

Reason:

- the current project still relies heavily on loose objects and imperative DOM state
- type contracts should exist before major state, effect, and rendering changes

## Delivery Rule Per Stage

After each stage, always provide:

- recommended commit title
- commit description
- reason for change
- files changed
- test method
- impact scope
