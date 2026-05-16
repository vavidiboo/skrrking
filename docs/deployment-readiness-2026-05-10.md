# Deployment Readiness Audit: Skull King Activity

Date: 2026-05-10
Checklist Source: `docs/deployment-checklist.md`
Evaluator: Codex static review + local verification

## Verdict

Current verdict: `NO-GO for general production`, `Conditional GO for single-instance closed beta after operational fixes`.

The codebase is functionally much healthier than before: duplicate active-room participation is blocked, idle room cleanup exists, ping is surfaced in the UI, and the backend test suite passes locally. The remaining blockers are operational and architectural, not gameplay completeness.

## Executive Summary

| Area | Status | Notes |
|---|---|---|
| Core gameplay path | PASS | Create, join, ready, start, bid, play, finish flows are implemented and tested |
| Duplicate room participation | PASS | Active-session conflict enforcement added on create/join |
| Idle room cleanup | PASS | Solo-lobby and empty-session expiration logic added |
| Client/server latency visibility | PASS | Ping chip/badge added in home, lobby, and game |
| Automated backend verification | PASS | `python -m unittest tests.test_activity_api -v` passed |
| Reproducible build | FAIL | `requirements.txt` is not version-pinned |
| Production runtime definition | FAIL | Built-in `run()` still uses `reload=True` |
| Multi-instance deployment safety | FAIL | In-memory session/websocket coordination is process-local |
| Observability and alerting | FAIL | No metrics, alerts, or structured monitoring config found |
| Secret management maturity | FAIL | Local JSON config pattern exists, but production secret handling is not documented in-repo |

## What Was Verified

### Passed

1. Backend compile check passed.
   Evidence: `python -m py_compile discord_activity_skullking/api_server.py discord_activity_skullking/activity_service.py`

2. Backend automated tests passed.
   Evidence: `python -m unittest tests.test_activity_api -v`
   Result: 31 tests passed.

3. Duplicate active-session protection exists.
   Evidence:
   - `discord_activity_skullking/api_server.py` `find_active_session_conflict()`
   - `create_session()` rejects `already_joined_session:*`
   - `join_session()` rejects `already_joined_session:*`

4. Room lifecycle management improved.
   Evidence:
   - `maybe_expire_idle_session_locked()` deletes empty sessions and stale solo lobbies
   - timeout watcher invokes cleanup continuously

5. Client ping indicator exists and uses real probes.
   Evidence:
   - `homePingChip`, `lobbyPingChip`, `gamePingBadge` in `app/index.html`
   - `probePing()` and `startPingProbeLoop()` in `app/app.js`

6. Static asset refresh protection exists.
   Evidence:
   - cache-busted asset versions in `app/index.html`
   - `NO_CACHE_HEADERS` for HTML/JS/CSS in `api_server.py`

7. Health endpoint now returns machine-usable time metadata.
   Evidence:
   - `/health` returns `ok` and `server_time_ms`

## Blockers

### 1. Multi-instance deployment is unsafe

Status: `FAIL`

Why this blocks production:
- Session state and websocket subscribers are stored in-process.
- Broadcast coordination is local to one Python process.
- A load balancer across multiple app instances can split REST and websocket traffic, causing stale sessions or missing realtime updates.

Evidence:
- `LOCK = threading.Lock()`
- `SESSIONS` in-memory cache
- `WS_SUBSCRIBERS` in-memory websocket registry
- local `schedule_session_broadcast()` queue in `api_server.py`

Required action before broad production:
1. Enforce a single-instance deployment with sticky routing, or
2. Move session broadcast coordination to shared infrastructure such as Redis/pubsub.

### 2. Dependencies are not pinned

Status: `FAIL`

Why this blocks production:
- `requirements.txt` contains package names only.
- Fresh installs can drift over time and produce non-reproducible deploys.

Evidence:
- `fastapi`
- `uvicorn`
- `pydantic`
- `pyngrok`

Required action:
- Pin exact versions or use a lockfile-based workflow.

### 3. Production startup path is not separated from dev mode

Status: `FAIL`

Why this blocks production:
- The in-repo `run()` helper uses `uvicorn.run(..., reload=True)`.
- Auto-reload is a dev-only mode and should not be the production reference path.

Evidence:
- `discord_activity_skullking/api_server.py: run()`

Required action:
- Document and use a production command without reload, ideally under a real process manager.

### 4. Observability is below production minimum

Status: `FAIL`

Why this blocks production:
- No metrics endpoint.
- No alerting config.
- No structured logging setup or log shipping config found.
- No deployment manifests for log collection or dashboards.

Evidence:
- No Docker/K8s/Procfile/monitoring manifests found in workspace.
- Logging exists, but only as application logs and prints.

Required action:
- Define logs, alerts, and at minimum request/error visibility before live release.

### 5. Secret handling is not production-hardened in the repo

Status: `FAIL`

Why this blocks production:
- Documentation promotes local JSON secret files.
- There is no production secret-injection runbook in repo.

Evidence:
- `discord_activity_skullking/README.md`
- `discord_activity_skullking/config/discord_config.local.json`

Required action:
- Switch production deployment to managed secrets and document the source of truth.

## Major Risks

### 1. No rate limiting or abuse guardrails

Status: `FAIL`

Impact:
- Public endpoints such as create/join/state can be spammed.
- Room churn and polling traffic can become an operational problem quickly.

### 2. Async persistence still has crash windows

Status: `RISK ACCEPTANCE NEEDED`

Impact:
- Several mutation paths intentionally broadcast first and persist asynchronously for responsiveness.
- A process crash at the wrong time can lose the most recent state update.

Evidence:
- `save_session_to_store_async(...)` usage across action endpoints

### 3. Performance baseline is still not measured in a production-like environment

Status: `FAIL`

Impact:
- The code now avoids some redundant requests, but there is no measured concurrency envelope in repo.
- Global lock behavior remains a scale constraint even for a single instance.

### 4. Frontend smoke coverage is still manual

Status: `FAIL`

Impact:
- No browser E2E suite found.
- Discord embedded-webview behavior is materially different from localhost testing.

## Checklist Assessment

| Checklist Item | Status | Comment |
|---|---|---|
| Release owner assigned | MANUAL | Not verifiable from repo |
| Scope frozen | MANUAL | Process item |
| Rollback path defined | FAIL | No rollback runbook in repo |
| Deployment target defined | FAIL | Single-instance requirement is implicit, not documented |
| Dependency versions pinned | FAIL | `requirements.txt` unpinned |
| Production launch command defined | FAIL | Only dev-style launch instructions found |
| Python/runtime version pinned | FAIL | No `.python-version`, lockfile, or image found |
| Static asset cache strategy verified | PASS | no-cache headers + cache-busted JS/CSS |
| Health check contract verified | PASS | `/health` returns `ok` and `server_time_ms` |
| Secret source is production-safe | FAIL | Local-file guidance only |
| Environment variable contract documented | FAIL | Some env vars exist in code, but no deployment contract doc |
| Cookie policy verified | PARTIAL | Configurable, but production values not documented |
| Persistence backend confirmed | MANUAL | Depends on deployed Firebase/project wiring |
| Backup and restore path documented | FAIL | Not found |
| Session cleanup policy approved | PARTIAL | Logic exists; product decision/runtimes need explicit signoff |
| Data loss behavior understood | FAIL | Async persistence tradeoff not documented |
| Horizontal scaling safety reviewed | FAIL | Not safe by default |
| Sticky-session strategy defined | FAIL | Not documented |
| Websocket fallback tested | PARTIAL | Code path exists; no production-like validation evidence |
| Duplicate-join policy tested | PASS | Automated tests added |
| Auth boundary reviewed | PARTIAL | Mechanism exists; no security review artifact found |
| Abuse protection exists | FAIL | No rate limiting found |
| Input validation reviewed | PASS | Pydantic constraints present on key payloads |
| Transport security enforced | MANUAL | Depends on deployment edge |
| Load profile defined | FAIL | Not found |
| Performance smoke test completed | FAIL | Not found |
| Lock contention reviewed | FAIL | No benchmark or capacity note found |
| Polling and health probe overhead reviewed | FAIL | No sizing note found |
| Error logs are accessible | MANUAL | Depends on runtime platform |
| Alerting exists | FAIL | Not found |
| Core metrics exist | FAIL | Not found |
| User-visible diagnostics exist | PASS | Ping visible in UI, reconnect indicators exist |
| Backend automated tests pass | PASS | 31 tests passing locally |
| Syntax/build checks pass | PASS | Python compile checks passed |
| Frontend manual smoke test complete | MANUAL | Not documented in repo |
| Discord Activity smoke test complete | MANUAL | Must be validated in embed environment |
| Runbook exists | FAIL | Not found |
| Release notes prepared | MANUAL | Process item |
| Post-deploy verification checklist ready | PASS | Included in deployment checklist |

## Recommended Release Position

### Acceptable Now

- Single-instance internal testing
- Closed beta with low concurrency
- Controlled release where restarts and manual ops are acceptable

### Not Acceptable Yet

- General public production launch
- Multi-instance autoscaling deployment
- High-concurrency launch without ops visibility

## Required Actions Before Production Go-Live

1. Pin dependencies and define a reproducible runtime.
2. Publish a production run command without `reload=True`.
3. Decide and document single-instance enforcement or implement shared realtime coordination.
4. Add at least basic rate limiting or upstream abuse controls.
5. Define production secret management and remove reliance on local secret files.
6. Add deployment/runbook docs for restart, rollback, incident response, and Firebase outage handling.
7. Add operational visibility: log aggregation, alerting, and a minimal metrics story.
8. Run a production-like smoke test with two or more real Discord Activity clients and record the result.

## Useful Evidence Collected

- Runtime dependencies: `requirements.txt`
- Production risk points: `discord_activity_skullking/api_server.py`
- Frontend ping UX: `discord_activity_skullking/app/index.html`, `discord_activity_skullking/app/app.js`
- Automated verification: `tests/test_activity_api.py`
