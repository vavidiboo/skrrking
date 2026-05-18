# Asset Pipeline

## Purpose

This document defines how the project should inventory, organize, reuse, and expand visual and audio assets in support of a premium game-client presentation.

## Current Asset Baseline

Observed asset groups:

- `app/assets/images/splash`
  - splash backgrounds
- `app/assets/images/lobby`
  - lobby backgrounds
- `app/assets/images/game`
  - table and game backgrounds
- `app/assets/images/results`
  - result backgrounds
- `app/assets/icons`
  - core icon set
- `app/assets/icons/pirate`
  - pirate-themed UI icon set
- `app/assets/Background`
  - stray background file that is not yet normalized

Not currently observed as clean systems:

- formal card frame sets
- particle texture directories
- effect sprite sheets
- audio or SFX directories
- texture atlas manifests

## Asset Strategy Principles

- Audit existing assets before replacing them
- Organize by role, not by ad hoc dumping
- Separate UI assets from world assets
- Prefer atlas-ready asset thinking for repeated small textures
- Preserve a low-end fallback path for costly visuals

## Asset Categories

### World Assets

- board textures
- table detail textures
- emissive masks
- environment backdrops
- world materials

### UI Assets

- buttons
- badges
- dialog trims
- tabs
- drawer surfaces
- icons

### Card Assets

- card frames
- suit symbols
- special card crests
- card art
- impact overlays

### Effect Assets

- particle sprites
- slash strips
- smoke masks
- water ribbons
- rune or glow textures
- shockwave rings

### Audio Assets

- card play cues
- special-card impact cues
- score delta cues
- timer warnings
- reconnect and error cues

## Asset Inventory Process

Before visual implementation work:

1. list currently used assets
2. identify unused assets
3. mark naming outliers
4. identify atlas candidates
5. list missing production assets

## Naming Rules

Recommended prefixes:

- `bg_*` for backgrounds
- `ui_*` for interface assets
- `card_*` for card surfaces
- `fx_*` for effect assets
- `sfx_*` for sounds
- `atlas_*` for packed textures

## Texture Atlas Strategy

Prioritize atlases for:

1. small HUD icons
2. repeated trims and badges
3. particle sprites
4. card symbol overlays

Goals:

- reduce texture swaps
- reduce draw cost
- improve consistency

## Card Frame Strategy

Card frames should communicate both rules and emotional class.

Required frame families:

- normal suit frame
- pirate frame
- mermaid frame
- Skull King or legendary frame
- escape frame

Rules:

- card identity should be readable from silhouette and color, not only text
- important card classes must feel stronger the moment they appear

## UI Frame Strategy

UI frames should support the world fantasy without burying information.

Use cases:

- modal shells
- drawers
- top HUD plates
- badge holders
- action buttons

Rules:

- avoid too many unrelated ornament languages
- never let decoration weaken readability

## Particle Texture Strategy

Needed effect texture families:

- ember spark
- sea mote
- mist puff
- curse dust
- slash streak
- shockwave ring

Rules:

- group particles by effect family
- prefer tintable grayscale bases when possible
- ensure performance-lite can remove them cleanly

## Background Strategy

The current backgrounds already imply mood stages.

- splash: dramatic launch
- lobby: gathering and preparation
- game: battle table focus
- result: payoff and closure

Rules:

- do not rely only on one flat image
- combine art with gradients, vignette, and subtle motion when budget allows

## Sound Strategy

The current project does not appear to have a structured sound pipeline yet.

Required starter sound set:

- button confirm
- card lift
- card cast
- special impact
- trick resolve
- score up and down
- timer warning
- reconnect or disconnect

## Existing Asset Reuse Strategy

- keep current backgrounds as mood anchors unless clearly replaced
- evaluate current icons as real UI language candidates, not just placeholders
- treat `icons/pirate` as the base of a themed UI kit
- normalize stray assets after inventory instead of deleting them blindly

## Missing Asset List

High-priority missing asset groups:

- formal card frame set
- particle texture set
- slash, shockwave, rune, and smoke effect textures
- winner crown and score badges
- sound effects
- atlas metadata

## Definition of Done

- assets are grouped by role
- atlas candidates are explicit
- reuse and gap-filling plans are documented
- UI, world, effect, and sound asset boundaries are clear
