# Deployment Checklist: Skull King Activity

Date: 2026-05-10
Audience: engineering, release owner, ops
Use: mark each item as `PASS`, `FAIL`, `WAIVED`, or `N/A` before deployment

## Release Gate

| Priority | Item | Pass Criteria |
|---|---|---|
| P0 | Release owner assigned | One person owns deploy, rollback, and user comms |
| P0 | Scope frozen | Release commit/tag and change summary are fixed before deploy |
| P0 | Rollback path defined | Previous artifact/config can be restored within target recovery time |
| P0 | Deployment target defined | Single-instance vs multi-instance strategy is explicitly decided |

## Build And Runtime

| Priority | Item | Pass Criteria |
|---|---|---|
| P0 | Dependency versions pinned | Runtime dependencies are version-pinned and reproducible |
| P0 | Production launch command defined | Production startup does not use dev reload mode |
| P0 | Python/runtime version pinned | Target Python version is documented and reproducible |
| P1 | Static asset cache strategy verified | HTML, JS, CSS use cache-busting and correct cache headers |
| P1 | Health check contract verified | `/health` returns machine-readable readiness metadata |

## Config And Secrets

| Priority | Item | Pass Criteria |
|---|---|---|
| P0 | Secret source is production-safe | Client IDs, secrets, and Firebase credentials are injected securely, not manually copied local files |
| P0 | Environment variable contract documented | Required env vars, defaults, and production recommendations are listed |
| P1 | Cookie policy verified | Secure, SameSite, and domain policy are correct for Discord Activity embedding |
| P1 | Spectator and room policy reviewed | Production values for spectator access, timeouts, and cleanup windows are approved |

## Data And Persistence

| Priority | Item | Pass Criteria |
|---|---|---|
| P0 | Persistence backend confirmed | Firebase availability, credentials, and permissions are validated in the target environment |
| P0 | Backup and restore path documented | There is a documented way to restore critical production data |
| P1 | Session cleanup policy approved | Empty-room and solo-lobby expiration windows are intentional and documented |
| P1 | Data loss behavior understood | Team accepts what is lost if process exits during in-flight async persistence |

## Realtime Architecture

| Priority | Item | Pass Criteria |
|---|---|---|
| P0 | Horizontal scaling safety reviewed | If more than one app instance is used, websocket/session coordination is safe |
| P0 | Sticky-session strategy defined | If app is single-instance only, that is enforced; otherwise routing guarantees are documented |
| P1 | Websocket fallback tested | WS to polling fallback and reconnect behavior are validated in the target network |
| P1 | Duplicate-join policy tested | Same user cannot join multiple active rooms unintentionally |

## Security

| Priority | Item | Pass Criteria |
|---|---|---|
| P0 | Auth boundary reviewed | Identity token issuance, validation, and cookie/header transport are production-reviewed |
| P0 | Abuse protection exists | Basic rate limiting or upstream abuse controls are in place |
| P1 | Input validation reviewed | Room names, passwords, and player-provided fields are validated and bounded |
| P1 | Transport security enforced | HTTPS/WSS only in production |

## Performance And Capacity

| Priority | Item | Pass Criteria |
|---|---|---|
| P0 | Load profile defined | Expected concurrent sessions, players, and update rates are documented |
| P0 | Performance smoke test completed | Create/join/start/bid/play flow is measured in a production-like environment |
| P1 | Lock contention reviewed | Global lock behavior under concurrency is understood and accepted |
| P1 | Polling and health probe overhead reviewed | Long-poll, websocket, and ping traffic are acceptable at expected scale |

## Observability

| Priority | Item | Pass Criteria |
|---|---|---|
| P0 | Error logs are accessible | Runtime logs can be collected and searched during incidents |
| P0 | Alerting exists | Crashes, health-check failures, and abnormal error rate trigger alerts |
| P1 | Core metrics exist | Request latency, websocket count, room count, error rate, and persistence failures are visible |
| P1 | User-visible diagnostics exist | Operators can quickly confirm session status, ping, and backend health |

## QA

| Priority | Item | Pass Criteria |
|---|---|---|
| P0 | Backend automated tests pass | Unit/integration tests pass on the release candidate |
| P0 | Syntax/build checks pass | Python compile checks and asset-serving sanity checks pass |
| P1 | Frontend manual smoke test complete | Home, lobby, game, reconnect, leave, and finish flows are manually verified |
| P1 | Discord Activity smoke test complete | Real embed environment validation is done, not just localhost |

## Operations

| Priority | Item | Pass Criteria |
|---|---|---|
| P0 | Runbook exists | Start, stop, restart, rollback, and incident contacts are documented |
| P1 | Release notes prepared | User-facing changes and known issues are summarized |
| P1 | Post-deploy verification checklist ready | Immediate verification steps are written before deployment starts |

## Recommended Post-Deploy Verification

1. Confirm `/health` returns `ok: true` and current `server_time_ms`.
2. Open the Activity and verify home screen assets are current.
3. Create a room, join from a second client, and verify lobby sync.
4. Start a round, submit bids, and play at least one full trick.
5. Verify websocket updates arrive without polling-only fallback.
6. Confirm ping badge updates on home, lobby, and game screens.
7. Leave one lobby idle long enough to confirm cleanup policy works.
8. Check logs for persistence failures, reconnect churn, or repeated 4xx/5xx responses.
