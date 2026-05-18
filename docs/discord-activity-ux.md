# Discord Activity UX

## Purpose

This document explains how to design for Discord Activity constraints without making the product feel like an embedded web page.

## Platform Reality

The app runs inside:

- an embedded environment
- a dynamic viewport
- a mobile and desktop Discord shell
- a session-based social flow with invite, join, reconnect, and return loops

## Product Promise

Players should feel:

- "this is a real game app"
- not "this is a tiny web tool inside Discord"

## Core Constraints

### 1. Remove the Iframe Feeling

Use:

- full-screen app framing
- strong scene identity
- anchored HUD
- game-state transitions instead of page-like navigation

Avoid:

- browser-like gutters
- website section stacking
- tiny utility-style controls

### 2. Handle Dynamic Viewports

Plan for:

- desktop panel resizing
- mobile safe areas
- virtual keyboard and system UI changes
- compact view modes

### 3. Respect the Session Loop

Invite, join, rematch, and reconnect are core product flows, not side features.

## Viewport Rules

- use dynamic viewport units
- account for safe-area insets
- anchor HUD to edges instead of absolute page composition
- keep canvas and overlay on the same viewport truth
- reduce information density in extremely small viewports

## Safe Area Rules

- bottom actions and the hand must respect bottom insets
- top HUD must avoid colliding with Discord chrome
- corner buttons should not sit directly on the edge

## Desktop Discord UX

Allowed:

- hover affordances
- slightly denser HUD
- floating drawers
- drag-driven card interaction

Watch-outs:

- panel size can change often
- the client must still work in smaller windows

## Mobile Discord UX

Required:

- hover-free interaction
- long-press inspect
- thumb-friendly confirm flow
- compact HUD
- stronger performance discipline

Watch-outs:

- effect cost must drop faster than on desktop
- drag is not always the safest primary action

## Invite / Join UX

Invite is part of the game loop.

Requirements:

- invite access must stay fast in the lobby
- room code and participant state must read clearly
- private room and password flow must stay short
- rematch must not trap players away from inviting again

## Reconnect UX

Connection state must be visible without creating panic.

State groups:

- `connected`
- `reconnecting`
- `disconnected`

Rules:

- reconnecting uses a contextual blocker
- disconnected uses explicit copy and recovery guidance
- ping is secondary information, not a primary HUD feature

## Compact HUD Strategy

In compact mode, keep:

- current turn
- timer
- my bid, won, and score
- trick center clarity
- legal hand readability

Collapse first:

- history
- guide copy
- decorative badges
- nonessential meta

## Embedded Interaction Rules

- back and close behavior should be predictable
- modal stacking should stay shallow
- loading and reconnecting should never look frozen
- players should be able to recover quickly from interruptions

## Avoiding Discord UI Collision

Avoid:

- surfaces that look like Discord settings or browser chrome
- tiny top-edge controls
- generic web headers and footers

Prefer:

- strong game-specific visual language
- high-contrast battle framing
- a clear internal HUD grammar

## Performance Policy for Activity

- scale down heavy effects on mobile
- preserve a performance-lite path
- reduce background cost during reconnect or blocked states
- keep startup cinematic but short and stable

## Definition of Done

- the product no longer feels like a mini web page
- mobile and desktop both support the core interaction loop
- invite, join, and reconnect are smooth
- viewport changes do not break the hand or HUD
