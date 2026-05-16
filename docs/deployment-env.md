# Deployment Environment Contract

Date: 2026-05-10
Scope: `discord_activity_skullking.api_server`

## Runtime Baseline

- Python: `3.11.0`
- Install: `python -m pip install -r requirements.txt`
- Production entrypoint: `.\run_activity.ps1`
- Development entrypoint: `.\run_activity_dev.ps1`
- Deployment mode: `single_instance` only

## Required Secrets

| Variable | Required | Purpose |
|---|---|---|
| `DISCORD_CLIENT_ID` | Yes | Discord OAuth client id |
| `DISCORD_CLIENT_SECRET` | Yes | Discord OAuth client secret |
| `ACTIVITY_IDENTITY_SIGNING_KEY` | Yes | HMAC signing key for activity identity cookies/tokens |

Notes:
- In local development only, `discord_activity_skullking/config/discord_config.local.json` can supply Discord OAuth values.
- In production, prefer secret manager or platform-managed environment injection. Do not copy local JSON secret files into servers manually.

## Persistence

| Variable | Required | Purpose |
|---|---|---|
| `FIREBASE_CREDENTIALS_PATH` | Recommended | Service account JSON path for Firebase |

Notes:
- If Firebase credentials are unavailable, the app can still run in `memory_only` mode, but restarts can lose active session state.
- Production readiness assumes Firebase-backed persistence is available and monitored.

## Networking

| Variable | Default | Purpose |
|---|---|---|
| `ACTIVITY_HOST` | `0.0.0.0` | Bind host |
| `ACTIVITY_PORT` | `8010` | Bind port |
| `ACTIVITY_CORS_ORIGINS` | empty | Comma-separated allowlist for credentialed browser origins |
| `ACTIVITY_DEPLOYMENT_MODE` | `single_instance` | Must remain `single_instance` with current realtime design |

## Security And Cookies

| Variable | Default | Purpose |
|---|---|---|
| `ACTIVITY_IDENTITY_COOKIE_SAMESITE` | `auto` | `auto`, `lax`, `strict`, `none` |
| `ACTIVITY_IDENTITY_COOKIE_SECURE` | `0` | Force secure cookies |
| `ACTIVITY_ENABLE_RATE_LIMIT` | `1` | Enable in-process abuse throttling |
| `ACTIVITY_RATE_LIMIT_WINDOW_SECONDS` | `60` | Shared window size |
| `ACTIVITY_RATE_LIMIT_DEFAULT_MAX_REQUESTS` | `600` | Default request ceiling per IP per window |
| `ACTIVITY_RATE_LIMIT_STATE_MAX_REQUESTS` | `900` | Long-poll state ceiling per IP per window |
| `ACTIVITY_RATE_LIMIT_MUTATION_MAX_REQUESTS` | `240` | Mutation ceiling per IP per window |

## Gameplay And Cleanup Policy

| Variable | Default |
|---|---|
| `ACTIVITY_TURN_LIMIT_SECONDS` | `20` |
| `ACTIVITY_TIMEOUT_WATCH_INTERVAL_SECONDS` | `0.5` |
| `ACTIVITY_STATE_WAIT_POLL_INTERVAL_SECONDS` | `0.10` |
| `ACTIVITY_ALLOW_SPECTATORS` | `0` |
| `ACTIVITY_DISCONNECT_GRACE_SECONDS` | `90` |
| `ACTIVITY_RECONNECT_GRACE_SECONDS` | `60` |
| `ACTIVITY_AFK_TIMEOUT_STREAK_LIMIT` | `3` |
| `ACTIVITY_TRICK_REVEAL_HOLD_SECONDS` | `5` |
| `ACTIVITY_SOLO_LOBBY_EXPIRY_SECONDS` | `300` |
| `ACTIVITY_EMPTY_SESSION_GRACE_SECONDS` | `30` |
| `ACTIVITY_IDENTITY_TOKEN_TTL_SECONDS` | `43200` |
| `ACTIVITY_IDENTITY_TOKEN_SKEW_SECONDS` | `120` |

## Observability

| Variable | Default | Purpose |
|---|---|---|
| `ACTIVITY_LOG_LEVEL` | `INFO` | Application log verbosity |

## Verification

- Health: `GET /health`
- Metrics: `GET /metrics`
- Logs now include `request_id`, method, path, status, duration, and client IP
