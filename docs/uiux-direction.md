# UI/UX Direction

## Core UX Statement

The UI is not a collection of pretty panels. It is a system for reading battle state, making decisions, and feeling impact.

The target is not "responsive web." The target is:

`an independent-feeling battle card game running inside Discord Activity`

## Experience Principles

### 1. Information First

The most important state must be the easiest state to read.

### 2. Combat Over Calm

Card play, trick resolution, and score changes should feel dramatic.

### 3. Minimal Center Interference

The center of the screen is battle space. Permanent clutter in the middle is a mistake.

### 4. Mobile-Ready by Default

All core interactions must still work without hover.

### 5. Readability Before Decoration

If the UI looks good but reads badly, it fails.

## Information Priority

| Priority | Information | Reason | Treatment |
| --- | --- | --- | --- |
| P0 | Current turn | The player must know who acts now | Highest contrast, tied to timer |
| P0 | Current trick | It is the center of battle resolution | Centered, visually framed |
| P0 | Legal vs illegal cards | Prevents mistakes and speeds decisions | Immediate hand-state feedback |
| P1 | Bid state | Core strategic context for the round | Top HUD and seat badges |
| P1 | Expected outcome | Helps planning and risk reading | Contextual summary |
| P1 | Hand state | The player's tactical space | Rich fan layout |
| P1 | Player state | Ready, disconnected, AFK, host | Compact seat indicators |
| P2 | Score delta | Emotional payoff and outcome clarity | Round and result FX |
| P2 | Round progress | Match pacing awareness | Round header and progress |
| P2 | Time limit | Urgency and pressure | Timer bar and urgent styling |

## Screen Structure

### Home

Goals:

- fast entry
- strong game identity
- clear create, join, and invite choices

Structure:

- identity at the top
- strong central hero and main CTA
- side cards for secondary information
- bottom tray only if it adds game-app flavor without slowing entry

### Lobby

Goals:

- feel like players gathering around a table
- make host controls and readiness obvious

Structure:

- center table
- seat ring
- right-side setup panel
- top room code, player count, invite action

### Game

Goals:

- preserve the central board as the battle zone
- make the hand satisfying and fast to use

Structure:

- top: round, timer, compact actions
- center: trick zone and board reaction space
- bottom: hand area
- floating contextual HUD only where needed

## HUD Rules

- Use anchor-based layout
- Keep the same feature in the same place
- Avoid permanent center-screen panels
- Use drawers or contextual overlays for score and guide content
- Treat reconnect and turn urgency as contextual blockers, not random popups

## Hand UX

The hand is the main interaction surface.

Required behaviors:

- fan layout
- immediate playable versus blocked distinction
- hover lift, tilt, and glow on desktop
- tap focus, hold inspect, or drag confirm on touch
- strong selected-state feedback

### Desktop Hand Pattern

- hover preview
- drag or click commit
- shortcut hints when useful

### Mobile Hand Pattern

- larger hit targets
- long press inspect
- one-hand reachable confirm path
- drag protection against accidental play

## Card Interaction Language

Every button and card must share a consistent state language:

- `idle`
- `hovered`
- `pressed`
- `held`
- `selected`
- `playable`
- `disabled`
- `focused`
- `resolving`

Feedback channels:

- scale
- lift
- outline
- glow
- shadow
- shake
- pulse
- sound

## Visibility and Readability

- Maintain strong foreground/background contrast
- Avoid tiny text
- Use outline or shadow when text sits over bright effects
- Reduce eye fatigue during long sessions
- Never rely on color alone to explain state

## Color Direction

The color language should feel like a fantasy pirate battle table, not a dashboard.

- base: navy, storm, brass, sea glow
- victory: gold and sunburst
- danger: ember and crimson
- cursed special states: violet and toxic green accents
- mermaid and water states: aqua, seafoam, pearl

Rules:

- avoid flat page-like backgrounds
- use a clear mood for each screen
- do not flood the entire app with gold

## Typography Direction

- display type may be expressive
- body text must stay highly readable
- numbers should prioritize fast scanning
- keep title, body, and numeric roles visually distinct

## Platform-Specific UX

### Discord Desktop

- use hover affordances
- allow higher information density
- allow floating drawers and richer hand spread

### Discord Mobile

- never depend on hover
- keep touch targets large
- make confirm paths thumb-friendly
- keep HUD compact
- reduce effect cost more aggressively

## UX Flow Design

- minimize clicks to start a game
- minimize modal depth
- make back and cancel flows predictable
- keep rematch and invite fast
- avoid breaking play flow with unnecessary overlays

## Common Mistakes To Avoid

- leaving every piece of information on screen at all times
- blocking the board with large popups
- designing hand interactions around hover only
- using flashy effects that weaken legal-move clarity
- letting cards and HUD use different interaction grammar

## Practical Patterns

- communicate urgency with color, motion, and sound together
- use contextual assistant text instead of permanent explanation blocks
- let disabled states imply why they are disabled
- use motion to confirm intent, not only to decorate

## Definition of Done

- players can identify turn state and legal moves within about one second
- the hand feels good on both desktop and mobile
- the HUD supports the board instead of fighting it
- modal use does not constantly interrupt play
- card play feels like an action event, not a form submission
