# Tech Debt

## Purpose

This document lists the current structural and quality risks in the project and defines the recommended removal order.

## Summary

The project already has working systems, but it also has major migration debt:

- a large imperative runtime
- shell fragment dependency
- weak type safety
- limited effect orchestration
- inconsistent asset structure
- no R3F battle-space boundary yet

## P0: Immediate Structural Risks

### 1. `legacy-app.js` Monolith

Problem:

- networking
- session flow
- dialogs
- drag interaction
- HUD updates
- timers
- reconnect logic
- score and finish UI

all live in one large imperative file.

Impact:

- high regression risk
- difficult ownership boundaries
- difficult test targeting

Direction:

- split transport, interaction, dialog, and presentation responsibilities

### 2. `shell.html` as UI Source

Problem:

- major UI is still sourced from HTML fragments instead of owned components

Impact:

- weak component ownership
- slow migration velocity
- difficult view-level testing

Direction:

- replace fragments incrementally with owned React components

### 3. JS Type Safety Gap

Problem:

- backend payloads, UI models, effect payloads, and DOM datasets are loosely connected

Impact:

- refactors are expensive and risky
- more runtime-only bugs

Direction:

- add domain and transport contracts first

## P1: High-Value Refactor Targets

### 4. Split Truth Across Multiple State Sources

Current truth is distributed across:

- backend snapshot data
- `appState` in legacy runtime
- `reactUiState` in the bridge
- DOM classes and datasets

Impact:

- hard to know what is authoritative
- reconnect, modal, and transition bugs become harder to reason about

Direction:

- normalize client state into a typed store

### 5. `App.jsx` Growth Risk

`App.jsx` is not yet the largest problem, but it is at risk of becoming one.

It already hosts:

- shell parsing
- panel visibility
- portals
- lobby seat composition
- effect bridge setup

Risk:

- future overlay and canvas orchestration may pile into the same file

Direction:

- split root shell, portal host, and view presenters

### 6. `legacyBridge.js` as Temporary Truth

Problem:

- the bridge looks small, but it is still the React shell truth source

Impact:

- a temporary adapter can become a permanent architecture trap

Direction:

- reduce it to a typed adapter as store ownership grows

### 7. Effect System Limits

Problem:

- single-lane active effect model
- no priority
- no cancel or throttle
- no separate camera, score, or audio channels

Impact:

- limited scalability for premium presentation
- weak performance control

Direction:

- build a typed effect pipeline with quality tiers

## P2: Quality and Maintenance Risks

### 8. CSS-Heavy Global Ownership

Problem:

- `styles.css` owns too much at once

Impact:

- visual regressions are easier to trigger
- feature ownership is hard to isolate

Direction:

- move toward feature or system ownership boundaries

### 9. Asset Structure Inconsistency

Problem:

- stray assets exist
- no formal particle or sound structure
- no atlas manifest structure

Impact:

- visual iteration stays slower than it should be
- asset replacement becomes harder to manage

Direction:

- run inventory and normalize naming and ownership

### 10. Encoding and Copy Quality Risk

Problem:

- the current project already shows signs of text encoding issues in runtime files

Impact:

- player-facing quality drops
- localization and branding become harder to trust

Direction:

- centralize player-facing text ownership and normalize encoding-safe sources

## P3: Future Risks

### 11. Missing R3F Scene Boundary

Problem:

- the target product wants a battle-space renderer, but the current game view is still DOM-first

Impact:

- further DOM-heavy features will make later migration harder

Direction:

- introduce a real canvas boundary early

### 12. Frontend Test Coverage Gap

Problem:

- tests are mostly backend-oriented right now

Impact:

- UI regressions in hand interaction, reconnect flow, and overlays are harder to catch

Direction:

- add UI smoke coverage around transport adapters and critical interaction paths

## Performance Risks

Main risks:

- blur and backdrop cost on mobile
- heavy overlay overdraw
- CSS animation overlap
- future double-cost from DOM and R3F effects running together

Immediate policy:

- keep performance-lite mode
- define effect budgets
- control atlas use and particle counts

## Debt Removal Order

1. add type boundaries
2. normalize client state
3. type the effect pipeline
4. replace shell fragments with owned components
5. introduce canvas boundary
6. normalize assets

## Definition of Done

- the debt list is actionable
- each risk has a reason and a direction
- the cleanup order is explicit
