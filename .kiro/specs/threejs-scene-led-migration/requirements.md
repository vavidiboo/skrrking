# Requirements Document

## Introduction

This feature defines the requirements baseline for migrating the Skull King Discord Activity from its current DOM-first / image-led layout into a scene-led structure where React Three Fiber (Three.js) owns game space and the HTML overlay is reduced to a readable control layer. The migration covers both the lobby and game screens, treats `shell.html`, `legacy-app.js`, and `legacyBridge.ts` as live migration surfaces, and is delivered as a sequence of small, independently playable steps rather than a single rewrite.

This document only defines what must be true. Concrete component layout, scene composition, asset choices, and step-by-step task ordering are out of scope here and belong to the design and tasks phases.

The authoritative references for this feature are:

- `docs/codex.md`
- `docs/threejs-migration-visual-guidelines.md`
- `docs/rendering-pipeline.md`
- `docs/uiux-direction.md`
- `docs/roadmap.md`

If any clause in this document conflicts with those documents, those documents win and this document is updated to match. See "Notes / Conflicts" at the end for any flagged items.

## Glossary

- **Skull_King_Activity**: The Discord Activity client built from `discord_activity_skullking/app/src/*` plus its DOM shell, including React shell, R3F renderer, legacy DOM controller, and CSS.
- **R3F_Scene**: The React Three Fiber world-space scene. Concretely realized today as `GameCanvas` / `GameScene` / `GameBoard` / `EffectScene` under `discord_activity_skullking/app/src/rendering/`. Acts as the umbrella term for any R3F-owned scene in this feature, including the future `LobbyCanvas`.
- **GameCanvas**: The R3F root component that owns the game-screen world space. Already present at `discord_activity_skullking/app/src/rendering/GameCanvas.tsx`.
- **LobbyCanvas**: The R3F root component that owns the lobby-screen world space. Does not yet exist and is introduced by this feature, mirroring the role `GameCanvas` plays for the game screen, as called out in `docs/threejs-migration-visual-guidelines.md`.
- **HUD_Overlay**: The HTML/CSS overlay layer rendered above the R3F scene. Carries HUD chips, hand interaction surface, dialogs, score drawer, system messages, and reconnect messaging. Sourced today from `shell.html` fragments mounted by `App.tsx` and driven by `legacy-app.js`.
- **Dialog_Layer**: The subset of the HUD_Overlay that contains modal dialogs (`<dialog>` elements such as bid, round result, finish, find room, create room).
- **Game_State_Visual**: A visual element that primarily expresses authoritative game state. Includes: current turn indicator, current trick area, seat layout / seat ring, lobby table, played cards in the trick, current-turn focus emphasis, bid phase staging, and result phase staging.
- **Primary_Visual**: The first-rank visual element a player reads to understand a given Game_State_Visual. There is exactly one Primary_Visual per Game_State_Visual at any given migration step.
- **Secondary_Visual**: A non-primary visual element that complements a Primary_Visual, such as a numeric chip, label, or text summary in the HUD_Overlay.
- **Background_Image**: A raster image (e.g. `app/assets/Background/*`, `app/assets/images/*`) used as a backdrop. In this feature Background_Image is reserved for atmosphere only and is not allowed to carry hierarchy.
- **Slim_Combat_HUD**: The HUD style described in `docs/uiux-direction.md` and `docs/threejs-migration-visual-guidelines.md`: anchor-based, compact, non-page-like, never a permanent center-screen panel, and always subordinate to the battle space.
- **Information_Hierarchy**: The ordering of on-screen information defined in `docs/uiux-direction.md`. For the game screen the top three priorities are current turn, current trick, and legal vs illegal cards.
- **Migration_Surface**: The set of files that are under active rewrite and may temporarily hold both DOM and R3F representations of the same concept: `discord_activity_skullking/app/src/App.tsx`, `discord_activity_skullking/app/src/shell.html`, `discord_activity_skullking/app/styles.css`, `discord_activity_skullking/app/src/legacyBridge.ts`, and (where present) `discord_activity_skullking/app/legacy-app.js`.
- **Migration_Step**: One delivered increment of the migration. Each Migration_Step ends in a state where the Skull_King_Activity is playable end-to-end and is testable per the rules in `docs/roadmap.md`.
- **End_State**: The state of the Skull_King_Activity after the final Migration_Step of this feature has shipped.
- **Authoritative_Docs**: The five reference documents listed in the Introduction.

## Requirements

### Requirement 1: Scene Ownership Of Game-State Visuals

**User Story:** As a player in an active match, I want the visual representation of game state to live in the Three.js scene, so that the center of the screen reads as a battle space rather than a styled web page.

#### Acceptance Criteria

1. THE Skull_King_Activity SHALL place the Primary_Visual for each Game_State_Visual inside an R3F_Scene, and SHALL NOT require Secondary_Visuals to live inside an R3F_Scene.
2. WHILE the player is on the game screen, THE GameCanvas SHALL own the Primary_Visual for the board surface, the trick center (including when the trick center is empty), the seat ring, the played cards in the current trick, and the current-turn focus emphasis.
3. WHILE the Skull_King_Activity is in the End_State, THE HUD_Overlay SHALL only carry Secondary_Visual representations of Game_State_Visuals (such as numeric chips, labels, and text summaries) and SHALL NOT carry the Primary_Visual for any Game_State_Visual.
4. WHILE a Migration_Step has not yet moved a specific Game_State_Visual into the R3F_Scene, THE Skull_King_Activity SHALL keep that visual visible and updated in the HUD_Overlay so that the current value of the underlying game state remains readable to the local player, until the corresponding Migration_Step lands.
5. IF the same Game_State_Visual is rendered by both the R3F_Scene and the HUD_Overlay during a transitional Migration_Step, THEN THE Skull_King_Activity SHALL designate exactly one of them as the Primary_Visual in the Migration_Step's documented notes, treat the other as a Secondary_Visual for that step, and schedule removal of the Secondary_Visual duplicate in a specific later Migration_Step recorded in the migration tasks document, consistent with Requirement 7 clause 3.

### Requirement 2: HUD Overlay Role And Slim Combat HUD Tone

**User Story:** As a player, I want the HTML overlay to feel like a slim combat HUD instead of a stack of web panels, so that my attention stays on the battle table.

#### Acceptance Criteria

1. THE HUD_Overlay SHALL only contain HUD chips, the hand interaction surface, dialogs, the score drawer, system messages, and reconnect messaging.
2. THE HUD_Overlay SHALL follow the Slim_Combat_HUD tone defined in `docs/uiux-direction.md` and `docs/threejs-migration-visual-guidelines.md`, presenting anchor-based placement, framed HUD bar or inset metallic surface treatment, and restrained glow accents, and SHALL NOT present generic dashboard cards, soft website glass panels, floating rounded blocks with no role distinction, oversized profile cards, or stacked page-section layouts.
3. WHILE the player is on the game screen, THE HUD_Overlay SHALL NOT mount any element that both persists for the entire game-screen lifetime AND overlaps the central 60% × 60% region of the viewport.
4. THE HUD_Overlay SHALL anchor each repeated information element (turn, timer, bid, score) to a single fixed anchor that does not move across viewport resizes, orientation changes, or bid, play, or score phase transitions within the same match.
5. WHEN a contextual blocker is required (reconnect, bid window, round result, tigress mode choice), THE Dialog_Layer SHALL present it as a contextual surface that is dismissible by the player or auto-resolves when its trigger condition clears, rather than as part of the persistent HUD.
6. THE HUD_Overlay SHALL NOT exceed the screen-space footprint, the foreground contrast, or the motion energy of the R3F_Scene Primary_Visuals for current turn, current trick, or legal-move readability.

### Requirement 3: Lobby Adopts The Same Layer Structure As The Game

**User Story:** As a player moving from the lobby to a match, I want both screens to share the same visual grammar, so that they feel like one game rather than two different pages.

#### Acceptance Criteria

1. WHEN the player navigates to the lobby screen, THE Skull_King_Activity SHALL mount a LobbyCanvas as the lobby world-space owner, mirroring the role GameCanvas plays for the game screen.
2. WHILE the player is on the lobby screen, THE LobbyCanvas SHALL own the Primary_Visual for the lobby table, the seat ring, the seat anchors, the lobby lighting, fog, vignette, and any geometry-driven or material-driven backdrop, consistent with `docs/threejs-migration-visual-guidelines.md`.
3. THE lobby screen and the game screen SHALL both expose the same three layers in the same z-order: an R3F canvas layer at the bottom, a HUD_Overlay layer in the middle, and a Dialog_Layer at the top.
4. THE HUD_Overlay on the lobby screen SHALL only carry room status (room code, player count), room setup controls, host actions (start, invite, back), system messages, and dialogs.
5. THE Skull_King_Activity SHALL apply the same material language, surface language, typography roles, and motion language to the lobby screen and the game screen as defined in `docs/threejs-migration-visual-guidelines.md`.
6. IF a HUD_Overlay element or a `shell.html` DOM element is acting as the Primary_Visual for the lobby table, the seat ring, or the seat anchors WHILE the LobbyCanvas is mounted, THEN the LobbyCanvas SHALL take over as the Primary_Visual within the same Migration_Step.
7. WHILE a Dialog_Layer surface is open on either screen, THE Dialog_Layer SHALL capture pointer and keyboard input first and SHALL prevent the underlying HUD_Overlay layer and R3F canvas layer from receiving input until the dialog is dismissed.

### Requirement 4: Information Hierarchy Guarantees

**User Story:** As a player making a decision under a turn timer, I want current turn, current trick, and legal moves to be readable at a glance, so that no decoration costs me a play.

#### Acceptance Criteria

1. THE Skull_King_Activity SHALL preserve the information priority ordering defined in `docs/uiux-direction.md`, with current turn, current trick, and legal vs illegal cards occupying the top three priorities on the game screen, such that the local player can identify each of these three states within 1 second per the Definition of Done in `docs/uiux-direction.md`.
2. THE Skull_King_Activity SHALL NOT allow any Background_Image, avatar, profile block, or decorative panel on the game screen to occlude the screen-space region of the current-turn indicator, the current-trick area, or the local player's hand, exceed those regions in foreground contrast against the screen background, or reduce the local player's identification time for current turn, current trick, or legal-move state beyond 1 second.
3. WHEN the active turn changes, THE Skull_King_Activity SHALL update the Primary_Visual for current-turn focus inside the R3F_Scene within 1 second of the turn change and before the local player can submit a card for that turn.
4. WHEN a card is played into the current trick, THE GameCanvas SHALL render that card as the Primary_Visual for the current trick within 1 second of the play being acknowledged by the gameplay authority.
5. WHILE it is the local player's turn, THE HUD_Overlay SHALL distinguish legal cards from illegal cards in the hand using at least one non-color-only signal (such as scale, lift, outline, or glow), and the local player SHALL be able to identify each card's legal or illegal state within 1 second regardless of any active world effect, atmosphere layer, or Background_Image.
6. THE Skull_King_Activity SHALL keep the lobby Information_Hierarchy ordered as room readiness and player occupancy first, central table identity second, room controls third, and decorative environment last, as defined in `docs/threejs-migration-visual-guidelines.md`, such that a player on the lobby screen can identify room readiness and player occupancy within 1 second.
7. IF the R3F_Scene cannot present the Primary_Visual for current-turn focus or for the current trick at runtime, including while the performance-lite fallback path of Requirement 6 is active, THEN THE HUD_Overlay SHALL surface a Secondary_Visual for that state that the local player can identify within 1 second, until the R3F_Scene Primary_Visual is restored.

### Requirement 5: Background Imagery And Avatar Visuals Are Atmosphere Only

**User Story:** As a player, I want backgrounds and avatars to support atmosphere without competing with the board, so that the game space stays dominant.

#### Acceptance Criteria

1. THE Skull_King_Activity SHALL use Background_Image only for distant atmosphere, match-end scenic moments, event-specific backplates, or texture reference baked into world materials.
2. THE Skull_King_Activity SHALL NOT use Background_Image to define the Information_Hierarchy of the lobby screen or the game screen as defined in Requirement 4 and `docs/uiux-direction.md`.
3. THE Skull_King_Activity SHALL produce every Primary_Visual on the lobby screen and the game screen from R3F_Scene geometry, lighting, materials, fog, or vignette, and a Background_Image SHALL NOT carry any Primary_Visual.
4. THE Skull_King_Activity SHALL render player avatars as identity tokens (small ring or badge form) anchored to seats, and SHALL NOT render hero portraits, full-body avatar images, or center-stage avatar image blocks that outrank the table or trick zone on the lobby screen or the game screen.
5. THE HUD_Overlay text and current-turn focus indicators SHALL satisfy the Visibility and Readability rules in `docs/uiux-direction.md`, regardless of whether a Background_Image is present.
6. WHEN a Background_Image is present on the lobby screen or the game screen, THE Skull_King_Activity SHALL constrain that Background_Image's contrast and luminance such that the Visibility and Readability rules in `docs/uiux-direction.md` continue to hold against that image.
7. IF the local player can identify current turn, current trick, or legal-move state more easily after a Background_Image is removed, per the Information_Hierarchy P0 ordering defined in Requirement 4 and `docs/uiux-direction.md`, THEN THE Skull_King_Activity SHALL reduce that Background_Image's visual authority via size, opacity, contrast, or removal in the next Migration_Step that touches it.

### Requirement 6: Migration Is Incremental And Always Playable

**User Story:** As a player and as a maintainer, I want the migration to land in small steps that never break the game, so that we can ship continuously instead of betting on one large rewrite.

#### Acceptance Criteria

1. THE Skull_King_Activity SHALL deliver this migration as a sequence of Migration_Steps, where each Migration_Step corresponds to exactly one stage rule from `docs/roadmap.md`, contains exactly one stage scope (no combining of multiple major stages into one Migration_Step), is testable per the documented test method for that stage, and ends with a recommended commit message containing a title and description as specified in `docs/roadmap.md`.
2. WHEN a Migration_Step lands on the main branch, THE Skull_King_Activity SHALL allow at least one full game round to be completed end-to-end, consisting of the bid phase, the play phase, and the score phase, without any error that blocks progression from one phase to the next.
3. WHEN a Migration_Step lands on the main branch, THE Skull_King_Activity SHALL preserve the room creation flow, the room join flow, the lobby readiness flow, the match start flow, the reconnect flow, and the finish flow, such that each flow can be exercised by the player without an error that prevents the flow from reaching its documented completion state.
4. IF a Migration_Step would, on its own, prevent any of the bid, play, score, room creation, room join, lobby readiness, match start, reconnect, or finish flows from reaching its documented completion state, THEN THE Skull_King_Activity SHALL split that Migration_Step into smaller Migration_Steps where each resulting Migration_Step independently satisfies acceptance criteria 2 and 3 of this requirement.
5. THE Skull_King_Activity SHALL document, for each Migration_Step, a test method consistent with `docs/roadmap.md` that covers at least one full game round consisting of the bid phase, the play phase, and the score phase, where the test method is recorded either in the Migration_Step's commit description or in the corresponding stage section of `docs/roadmap.md`.
6. THE Skull_King_Activity SHALL keep a performance-lite fallback path selectable at runtime on every Migration_Step, consistent with the lite quality tier defined in `docs/rendering-pipeline.md`, such that selecting the lite tier preserves end-to-end playability per acceptance criteria 2 and 3 of this requirement.

### Requirement 7: Single Owner Of Game State Visuals At End State

**User Story:** As a maintainer, I want exactly one owner per game-state visual at the end of the migration, so that DOM and R3F do not permanently duplicate the same concept.

#### Acceptance Criteria

1. WHILE the Skull_King_Activity is in the End_State, THE Skull_King_Activity SHALL have exactly one Primary_Visual owner, the R3F_Scene, for each Game_State_Visual.
2. WHILE the Skull_King_Activity is in the End_State, THE HUD_Overlay SHALL NOT render any element acting as the Primary_Visual for a Game_State_Visual already owned by the R3F_Scene, and SHALL only render Secondary_Visual forms (numeric chips, labels, text summaries) for those Game_State_Visuals.
3. WHILE migration is in progress, THE Skull_King_Activity SHALL allow transitional duplicate ownership of a Game_State_Visual only IF Requirement 1 clause 5 is honored AND the duplicate's removal is recorded as a deliverable of a specific later Migration_Step in the migration tasks document.
4. WHILE the Skull_King_Activity is in the End_State, THE Skull_King_Activity SHALL have removed the DOM table styling, the DOM trick center, and the DOM player ring on the lobby screen and the game screen, consistent with `docs/threejs-migration-visual-guidelines.md` Phase 4, and SHALL NOT permit any other DOM element to act as a Primary_Visual on the lobby screen or the game screen.
5. WHILE the Skull_King_Activity is in the End_State, THE files `shell.html`, `legacy-app.js`, and `legacyBridge.ts` SHALL NOT own any Primary_Visual, and their remaining responsibilities SHALL be bounded to HUD_Overlay markup, dialog scaffolding, and event bridging.

### Requirement 8: Migration Surface Discipline

**User Story:** As a maintainer working in `shell.html`, `legacy-app.js`, or `legacyBridge.ts`, I want clear rules about what may live there during the migration, so that those files shrink instead of growing.

#### Acceptance Criteria

1. THE Skull_King_Activity SHALL treat `discord_activity_skullking/app/src/App.tsx`, `discord_activity_skullking/app/src/shell.html`, `discord_activity_skullking/app/styles.css`, `discord_activity_skullking/app/src/legacyBridge.ts`, and (where present) `discord_activity_skullking/app/legacy-app.js` as the Migration_Surface, governed by the discipline rules in clauses 2 through 6 of this requirement.
2. WHEN a Migration_Step adds a new Primary_Visual for a Game_State_Visual, THE Skull_King_Activity SHALL place it inside the R3F_Scene rather than inside the Migration_Surface, and SHALL NOT introduce a parallel new Primary_Visual for the same Game_State_Visual into the Migration_Surface.
3. WHEN a Migration_Step moves a Game_State_Visual into the R3F_Scene, THE Skull_King_Activity SHALL remove or disable, within the same Migration_Step, the corresponding markup in `shell.html`, the corresponding layout CSS rules in `styles.css`, and the corresponding imperative DOM logic in `legacy-app.js`, and WHERE such code is intentionally retained as a transitional duplicate per Requirement 7 clause 3, THE Skull_King_Activity SHALL mark it with a code comment that references the Migration_Step that will remove it.
4. WHILE the migration is in progress, THE Migration_Surface SHALL NOT gain a new permanent center-screen panel, defined as a Migration_Surface element that is mounted for the full screen lifetime AND overlaps the central 60% × 60% region of the viewport, and SHALL NOT gain a new image-led layout block, defined as a layout block whose largest contiguous visual area is a Background_Image.
5. THE Python backend SHALL be the sole authority for legal-move validation, trick winner determination, bid validation, turn order, round scoring, and match scoring, consistent with `docs/codex.md`.
6. IF gameplay rule code is found in the Migration_Surface or in the R3F_Scene, THEN THE Skull_King_Activity SHALL relocate that code to the Python backend in the next Migration_Step that touches the affected file.

### Requirement 9: Alignment With Authoritative Docs

**User Story:** As a maintainer reading both this spec and the project docs, I want the spec to defer to the docs, so that there is one source of truth.

#### Acceptance Criteria

1. THE Skull_King_Activity SHALL treat the Authoritative_Docs as the source of truth governing decisions on product direction, scene ownership, HUD rules, performance budget, and migration phasing.
2. IF a clause in this requirements document conflicts with an Authoritative_Doc, THEN THE Skull_King_Activity SHALL follow the Authoritative_Doc, SHALL update this requirements document to remove the conflict no later than the Migration_Step in which the conflict is acted upon, and SHALL record the conflict and its resolution in the "Notes / Conflicts" section of this requirements document.
3. WHEN a Migration_Step requires changing direction in a way that conflicts with an Authoritative_Doc, THE Skull_King_Activity SHALL land the Authoritative_Doc update commit either before the delivery commit that introduces the conflicting change, or directly after that delivery commit with no other commit between them, consistent with `docs/codex.md` section 7.
4. THE Skull_King_Activity SHALL keep `docs/threejs-migration-visual-guidelines.md` as the primary visual rule set governing material, layer composition, HUD tone, and surface language for this feature, and SHALL keep `docs/rendering-pipeline.md` as the primary scene-topology and performance rule set governing scene graph, render targets, instancing, draw call budget, and the quality tier ladder for this feature, with conflicts handled per clause 2.
5. WHEN a maintainer observes a conflict between this requirements document and an Authoritative_Doc that is not yet resolved, THE Skull_King_Activity SHALL log the conflict in the "Notes / Conflicts" section and SHALL schedule its resolution in a specific Migration_Step.

## Notes / Conflicts

No real conflicts between this prompt and the Authoritative_Docs were identified at the time of writing. The user prompt and the docs agree on:

- R3F owns game space, HUD owns readable controls.
- Lobby and game must share visual grammar, with a `LobbyCanvas` introduced for the lobby.
- Background images must drop from hierarchy-defining to atmosphere-only.
- Avatars are identity tokens, not hero cards.
- The migration is incremental and the game stays playable each step.
- `shell.html`, `legacy-app.js`, and `legacyBridge.ts` are live migration surfaces and should shrink as the R3F_Scene grows.

Two minor naming alignments to note for design and tasks phases:

1. `docs/codex.md` section 9 lists `legacyBridge.js`, while the current repository ships `legacyBridge.ts`. This requirements document follows the actual file (`legacyBridge.ts`). This is a doc freshness gap, not a direction conflict, and may be reconciled by a doc update during a later Migration_Step.
2. `docs/codex.md` section 9 also lists `App.jsx` / `main.jsx`, while the current repository ships `App.tsx` / `main.tsx`. Same treatment as above.

Both items are flagged here so the design phase can decide whether to refresh `docs/codex.md` as part of this feature or as a separate small doc step.
