# Vision

## Product Statement

This project reimagines Skull King as a dramatic battle-first digital card game that runs inside Discord Activity but feels like a standalone game client.

The goal is not only to preserve the rules. The goal is to redesign the emotional experience of play.

## Vision Pillars

### 1. Not a Web Page

The player should not feel like they are using:

- a mini website
- an embedded utility
- an iframe page

The player should feel like they launched a real game app.

### 2. Combat-First Card UX

Playing a card should feel like using an attack, skill, or counterplay action.

- The hand is a tactical control surface
- The trick center is the battle outcome zone
- Score changes are combat consequences

### 3. Independent App Feeling Inside Discord

Discord is the runtime container, not the product identity.

The product promise is:

- fast session entry
- strong visual identity
- reliable reconnect handling
- fast rematch and invite loops
- a clear game-specific interaction language

### 4. Visual Quality Is a Feature

Visual quality is not polish at the end. It is part of the product.

Important quality drivers:

- card presentation
- board atmosphere
- lighting and glow
- score resolution cues
- particles, shockwaves, and impact feedback

## Product Goals

- Support stable 2-8 player Skull King matches in Discord Activity
- Deliver strong mobile and desktop play quality
- Make turn, trick, bid, and hand state easy to understand
- Evolve the client toward an R3F battle board without breaking the current backend model
- Preserve the Python backend as the authoritative gameplay source

## UX Goals

### Session Start

- Reach room creation or joining quickly
- Use splash as emotional boot-up, not only as loading filler
- Make create, join, and invite choices obvious

### Lobby

- Show room status, player readiness, host control, and seat occupancy clearly
- Make the lobby feel like players gathering around a table, not a web list

### Match

- Make turn state and current trick the visual center of gravity
- Make legal versus illegal card choices obvious
- Make the hand feel satisfying and decisive to use
- Make trick resolution and score change emotionally meaningful

### Match End

- Present results as a strong end-state, not as a plain table
- Make rematch, lobby return, and home return fast

## What Success Looks Like

The direction is working when:

- players forget they are inside Discord Activity
- the battle flow is felt before the rules are consciously parsed
- the important information is readable at a glance
- the game feels good on mobile, not only on desktop
- low-end devices still preserve clarity and flow
- the interface feels like a HUD, not a page layout

## Failure Modes

The direction is failing when players say:

- "this feels like a web game"
- "this looks like a small embedded app"
- "I do not know where to look"
- "playing a card feels flat"
- "the effects are flashy but make the result harder to read"
- "mobile controls feel awkward"

## Experience Rules

- The most important information must be the fastest to read
- The center battle space must stay as clear as possible
- Contextual UI should appear when needed instead of staying on screen forever
- Sound, glow, shake, and particles should reinforce meaning, not distract from it
- All core interactions must still work without hover

## Product Boundaries

This project is not trying to be:

- a general web dashboard
- a quiet board-game replica
- a full progression-heavy live service on day one
- a "put everything in Three.js" experiment
- a desktop-only browser toy

## Reference Blend

- Skull King: rule structure
- Hearthstone: dramatic card combat feeling
- Legends of Runeterra: balance of clarity and presentation
- Marvel Snap: compact and high-tempo interaction flow

The output should be inspired by these references, not imitate them directly.
