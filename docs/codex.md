# Codex Project Guide

## 1. Always Read This First

Every Codex task must start by reading this file first.

Before changing code, follow this order:

1. Read `docs/codex.md`
2. Read the relevant `docs/*.md` files
3. Confirm the task scope
4. Check for conflicts between the task and the docs
5. Update docs first when the docs are outdated
6. Propose an implementation plan
7. Make small code changes
8. Explain how to test the change
9. Write a recommended commit message

This file is the top-level project guide and the context hub for future Codex sessions.

## 2. Project Vision

This project runs inside Discord Activity, but players must experience it as a standalone AAA card battle app.

If it feels like a website, an iframe tool, or a tiny embedded page, the product direction has failed.

## 3. Core Product Direction

- Skull King rule base
- Hearthstone-like dramatic card combat presentation
- Discord Activity execution environment
- Independent game app experience
- React + TypeScript + React Three Fiber client
- Python backend retained
- Asset-driven visual quality
- Mobile and Desktop Discord interaction support

## 4. Must-Read Documents

Read the following documents based on the task:

- `docs/vision.md`
  - Product vision, success criteria, anti-goals
- `docs/architecture.md`
  - Client structure, module boundaries, state flow, legacy strategy
- `docs/uiux-direction.md`
  - HUD rules, information hierarchy, interaction patterns, readability
- `docs/typescript-migration.md`
  - Type migration strategy, domain types, store typing, interop rules
- `docs/effect-system.md`
  - Effect bus evolution, event schema, priority, cancel, fallback rules
- `docs/rendering-pipeline.md`
  - R3F scene ownership, canvas boundary, performance budget
- `docs/discord-activity-ux.md`
  - Embedded environment constraints, viewport rules, invite/join/reconnect UX
- `docs/asset-pipeline.md`
  - Asset inventory, atlas strategy, frame strategy, missing assets
- `docs/roadmap.md`
  - Delivery phases, completion criteria, tests, recommended commits
- `docs/tech-debt.md`
  - Current risks and debt removal order

## 5. Non-Negotiable Rules

- Do not make the game feel like a website
- Do not jump into code before checking the docs
- Do not make large changes in one pass
- Do not implement behavior that conflicts with the docs
- Do not discard the current effect structure without analysis
- Do not ignore existing assets before judging reuse potential
- Standardize the frontend on TypeScript
- Use R3F to create game space, not decoration only
- Split work into small, testable commits
- Treat `shell.html`, `legacy-app.js`, and `legacyBridge.js` as live migration surfaces
- Keep the Python backend as the gameplay authority

## 6. Commit Rules

After each task, always provide:

- Recommended commit title
- Commit description
- Reason for change
- Files changed
- Test method
- Impact scope

Commit title examples:

- `feat(r3f): create game canvas and effect scene boundary`
- `refactor(ts): migrate effectBus to typed event pipeline`
- `ux(hand): redesign card hand interaction flow`
- `perf(render): reduce postprocessing cost for Discord mobile`

Commit rules:

- One commit should have one clear responsibility
- Separate docs work from runtime work when practical
- Include a test method for every change
- Split effect, render, input, and HUD work into narrow slices

## 7. How To Handle New Tasks

When a new task arrives:

1. Find the relevant docs
2. Read them first
3. Check whether the task conflicts with the current direction
4. If it conflicts, update the docs first
5. If it does not conflict, write a small implementation plan
6. Make the change in small steps
7. End with tests and a recommended commit message

Extra operating rules:

- If code and docs disagree, do not assume code should win
- Identify whether the docs are outdated or the code is transitional
- Prefer fixing the source of truth before adding new implementation layers

## 8. Reference Links / External References

Keep these references in mind. Replace placeholders with real links when implementation depends on them.

- Hearthstone UI/FX reference: [placeholder](https://example.com/hearthstone-ui-fx)
- Legends of Runeterra UI/FX reference: [placeholder](https://example.com/lor-ui-fx)
- Marvel Snap interaction reference: [placeholder](https://example.com/marvel-snap-interaction)
- Discord Activity / Embedded App documentation: [placeholder](https://example.com/discord-activity-docs)
- React Three Fiber documentation: [placeholder](https://example.com/r3f-docs)
- Three.js documentation: [placeholder](https://example.com/threejs-docs)
- Zustand documentation: [placeholder](https://example.com/zustand-docs)
- Framer Motion documentation: [placeholder](https://example.com/framer-motion-docs)
- Discord SDK documentation: [placeholder](https://example.com/discord-sdk-docs)

## 9. Current Project Entry Points

Important files in the current codebase:

- `discord_activity_skullking/app/src/App.jsx`
- `discord_activity_skullking/app/src/main.jsx`
- `discord_activity_skullking/app/src/shell.html`
- `discord_activity_skullking/app/src/legacyBridge.js`
- `discord_activity_skullking/app/src/cardEffects/CardEffectLayer.jsx`
- `discord_activity_skullking/app/src/cardEffects/effectBus.js`
- `discord_activity_skullking/app/src/cardEffects/effectPresets.js`
- `discord_activity_skullking/app/legacy-app.js`
- `discord_activity_skullking/app/styles.css`
- `discord_activity_skullking/api_server.py`
- `discord_activity_skullking/core/game_engine.py`

These files are the first analysis targets for future migration work.

## 10. Current Baseline Summary

The current app is not a pure React client.

It is best described as:

`React shell + HTML fragments + legacy DOM controller + CSS/Framer Motion effects + Python authoritative backend`

Current reality:

- React hosts the shell and portals
- `shell.html` is still the markup source for major screens
- `legacy-app.js` controls networking, DOM state, dialogs, timers, and much of the game UI
- `legacyBridge.js` exposes a minimal React-facing snapshot store
- `CardEffectLayer` is a DOM overlay effect renderer
- The Python backend owns rules, session state, and transport authority

All future implementation must start from this baseline instead of pretending the rewrite is already finished.

## 11. UI/UX Summary

- The center of the screen is the battle table, not a dashboard
- HUD must inform without covering the battle space
- The hand must feel like a tactical interaction space, not a button list
- Turn state, trick state, bid state, and legal moves must be readable immediately
- Playing a card should feel like casting an action, not submitting a form
- Mobile and desktop may differ in input behavior, but not in quality standards

## 12. Rendering / Effect / Asset Summary

- R3F is for game space, card actors, camera motion, lighting, and world effects
- HTML/CSS overlay is for HUD, dialogs, menus, text, and result screens
- The current `effectBus` should evolve into a typed event pipeline
- Existing assets must be inventoried before replacement
- Discord mobile performance must always have a fallback path

## 13. Documentation Precedence

Use this precedence order:

1. `docs/codex.md`
2. Task-specific design docs
3. The real constraints of the current code
4. Temporary habits or convenience code

If code and docs disagree:

- Do not rewrite blindly
- Confirm why they differ
- Decide whether the docs are wrong or the implementation is transitional
- Update the docs first when they are stale

## 14. Definition of Done For Codex Tasks

A Codex task is only done when:

- The relevant docs were read
- The change does not conflict with the project direction
- The scope is small and testable
- A test method is provided
- A recommended commit message is provided
- The next logical step is clear
