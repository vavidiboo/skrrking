# Three.js Migration And Visual Guidelines

## Purpose

This document defines how the project should move from a DOM-first, web-leaning presentation into a clear game-space client led by React Three Fiber and a consistent HUD system.

It also defines the visual rules needed to stop lobby and game screens from feeling image-led, page-like, or structurally inconsistent.

## Problem Statement

The current project has made real progress toward R3F, but the product still does not feel fully committed to Three.js as the main game-space renderer.

Current issues:

- the canvas still behaves more like a background layer than the primary battle space
- lobby and game screens still rely too heavily on large background images
- DOM layout and image composition still compete with gameplay hierarchy
- some UI blocks still read like web panels instead of game HUD surfaces
- player imagery and decorative visuals sometimes overpower turn, trick, or room-state clarity

## Product Direction

The target is not:

- a responsive web page with game styling
- a decorative 3D background behind HTML
- a layered image composition with HUD on top

The target is:

- a game client with a real world-space scene
- a HUD that supports the world instead of replacing it
- a consistent visual language across home, lobby, and game

In short:

- Three.js owns game space
- HTML owns controls and readable information
- images support atmosphere, not hierarchy

## Structural Diagnosis

### Current Directional Strengths

- `GameCanvas` already exists
- `GameScene`, `GameBoard`, and `EffectScene` already exist
- world-side effect channels already started
- the docs already prefer canvas as world and overlay as interface

### Current Directional Weaknesses

- `GameCanvas` is mounted only for the game screen
- canvas interaction is still mostly disabled
- lobby remains a DOM-first scene with decorative table styling
- game table, trick center, and player ring are still primarily DOM-owned
- large background images still define the visual composition of the lobby and match views
- some HUD surfaces are too large or too panel-like for a combat-first screen

## Required Ownership Model

The migration must follow this ownership split.

### World Space

Three.js should own:

- board surface
- seat anchors
- trick center anchor
- played-card actors
- camera movement
- lighting and atmosphere
- world effects
- board reactions
- match-end scenic staging when useful

### Overlay Space

HTML should own:

- top HUD
- hand interaction
- dialogs
- room controls
- score drawer
- reconnect messaging
- text-heavy explanation and system prompts

### Forbidden Hybrid Pattern

Avoid these patterns:

- full visual table in DOM while canvas paints behind it
- image-heavy backgrounds that visually outrank the board
- duplicating the same gameplay object in both DOM and world space without a clear reason
- using the overlay to fake world composition permanently

## Migration Goals

The migration is successful when:

- the lobby feels like a real staging table, not a settings page
- the game center feels like battle space, not a decorated layout container
- the most important visual structure comes from world-space composition
- the HUD reads as a support layer, not the main scene
- background images no longer control the hierarchy

## Migration Plan

## Phase 1. Promote The Canvas From Background To Scene

Goal:

- stop treating R3F as decorative support

Actions:

- keep `GameCanvas` as the single world root for the game screen
- introduce a `LobbyCanvas` for the lobby screen
- define stable scene framing rules for lobby and game separately
- begin enabling selected world interactions where they do not conflict with the hand

Done when:

- lobby and game both have real scene ownership
- canvas no longer feels optional in the overall experience

## Phase 2. Move Lobby Composition Into World Space

Goal:

- make the lobby feel like players gathering around a table

Move into Three.js:

- central table
- seat ring
- seat anchor positions
- subtle environmental mood
- room-stage framing

Keep in HTML:

- room setup controls
- invite and start actions
- room code and compact room status

Rules:

- the right setup panel should feel like equipment or table controls, not a website sidebar
- player identity should orbit the table instead of floating as large disconnected cards
- avatars must act as identity tokens, not hero images

## Phase 3. Move Match Battle Structure Into World Space

Goal:

- make the actual match board read as a battle scene

Move into Three.js:

- table surface
- trick center placement
- played cards
- seat-relative card placement
- current-turn emphasis
- board pulses, ripples, and camera responses

Keep in HTML:

- hand
- bid and score numbers
- timer and compact match HUD
- system actions

Rules:

- the center of the screen is battle space
- permanent DOM panels must not sit in the center
- if a card is considered "in play," prefer world ownership

## Phase 4. Reduce DOM Fake-World Surfaces

Goal:

- remove transitional DOM structures that pretend to be scene objects

Target reductions:

- DOM table styling as the main stage
- DOM trick center as the long-term primary trick surface
- DOM player ring as the long-term primary spatial layout
- large floating identity cards that visually compete with the table

Direction:

- transitional DOM anchors are allowed
- permanent DOM world simulation is not

## Phase 5. Rebalance Interaction Ownership

Goal:

- keep interaction clear while increasing world ownership

Rules:

- hand interaction may remain screen-space first
- inspect, hover emphasis, and seat focus can move into world-space
- committed card travel should migrate into world-space
- world picking must never break hand reliability

Recommended sequence:

1. lobby seat hover and focus
2. trick-center card inspect
3. committed card travel
4. selective board-space interactions

## Phase 6. Replace Image-Led Layout With Material-Led Layout

Goal:

- stop using large images as the main composition tool

Direction:

- use board materials, lighting, fog, gradients, glow, and vignette first
- use images only as distant atmosphere or event-specific scenic support
- let composition come from geometry and light, not page backgrounds

## Screen-Specific Guidelines

## Home

Home may be the most presentation-heavy screen, but it still must not feel like a landing page.

Rules:

- use a strong identity focal point
- avoid stacked website sections
- keep CTA flow fast
- use motion and lighting more than image blocks

## Lobby

The lobby should feel like a live table before the battle starts.

Required structure:

- center world table
- seat ring around the table
- compact top room status
- side or edge control panel

Avoid:

- large hero-card feeling in the middle
- wallpaper-like backgrounds dominating the screen
- player blocks that feel detached from the table

Avatar rules:

- avatars are tokens, not content panels
- names and readiness are more important than portrait size
- connection and host state should be expressed by rings, badges, and markers

## Game

The game screen must be the most disciplined screen in the project.

Required structure:

- top compact state HUD
- center battle zone
- bottom hand zone
- contextual side or drawer surfaces only when needed

Avoid:

- center-screen permanent panels
- oversized profile cards
- layered backgrounds fighting the trick center
- decorative elements that outrank legal-move clarity

Mini-profile rules:

- compress identity and stats into a slim combat HUD
- do not let the profile block become a second focal point
- keep turn emphasis but reduce panel mass

## Results

Results can use stronger scenic imagery than active gameplay, but still must stay inside the same visual language.

Rules:

- reward state can be more theatrical
- scenic backplates are allowed
- typography and framing must still match the game HUD family

## Image Usage Rules

Images are not banned. Their role must change.

### Images May Be Used For

- distant atmosphere
- match-end scenes
- event-specific backdrop moments
- texture reference baked into world materials
- low-frequency environmental flavor

### Images Must Not Be Used For

- defining the main screen hierarchy
- replacing board composition
- carrying gameplay meaning by themselves
- creating a page-like hero section in lobby or game

### Priority Rule

If removing a background image improves clarity, the image was too important.

## Consistency System

The project needs one visual system across all views.

### Material Language

Use one shared material family:

- storm navy
- aged brass
- sea teal
- ember red
- bone or parchment neutrals in controlled amounts

This means:

- home, lobby, and game may differ in mood
- they must not differ in fundamental visual grammar

### Surface Language

Use surfaces that feel like game hardware, table fixtures, or nautical instruments.

Prefer:

- framed HUD bars
- inset metallic edges
- low-gloss dark surfaces
- restrained glow accents

Avoid:

- generic dashboard cards
- soft website glass panels everywhere
- floating rounded blocks with no role distinction

### Typography Roles

Use three clear roles:

- display for major battle-state headings
- readable body for system and support text
- dense numeric style for score, bid, timer, and turn information

Avoid:

- landing-page hero typography inside match flow
- too many text scales on one screen

### Motion Language

Motion must confirm state, not decorate empty space.

Prioritize motion for:

- turn start
- card commit
- trick resolve
- score delta
- reconnect transition

Reduce motion for:

- passive idle surfaces
- dense HUD blocks
- any screen already carrying effect load

## Hierarchy Rules

The hierarchy must be readable without relying on explanatory text.

### Lobby Priority

1. room readiness and player occupancy
2. central table identity
3. room controls
4. decorative environment

### Game Priority

1. current turn
2. current trick
3. legal hand readability
4. bid and won context
5. score and secondary status
6. atmosphere and spectacle

### Hard Rule

No decorative image, profile block, or panel should outrank:

- current turn
- current trick
- legal move readability

## Implementation Guidelines

When editing code, follow these rules.

### Scene Construction

- prefer real meshes and lighting over large page backgrounds
- keep board composition stable across aspect ratios
- use camera framing as part of information hierarchy

### Overlay Construction

- treat the overlay like a HUD, not a page
- anchor repeated information in stable locations
- use drawers instead of persistent large panels when possible

### Transitional Code

- transitional DOM anchors are acceptable
- transitional image backgrounds are acceptable only if they are visibly being reduced in responsibility
- every migration step should shrink the authority of `shell.html` for spatial composition

## Recommended Delivery Order

1. add `LobbyCanvas`
2. move lobby table and seat composition into world space
3. simplify lobby background images and DOM table styling
4. promote game trick center and played cards into scene ownership
5. slim the game mini-profile into a real combat HUD
6. reduce game background image authority
7. enable selective world interaction
8. remove redundant DOM fake-world structures

## Definition Of Done

This direction is complete when:

- the lobby and game both feel scene-led rather than page-led
- Three.js clearly owns the game space
- the overlay clearly owns readable controls and text
- images support the mood but do not control the hierarchy
- the HUD feels consistent across home, lobby, game, and results
- the product no longer reads as a web layout with decorative 3D support
