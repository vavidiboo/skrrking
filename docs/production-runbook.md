# Production Runbook

Date: 2026-05-10
Service: Skull King Activity

## Deployment Model

- Current supported topology: `single_instance`
- Reason: session state, websocket subscribers, and broadcasts are process-local
- Do not place multiple app instances behind a load balancer unless shared realtime coordination is added

## Start

1. Install dependencies:
   `python -m pip install -r requirements.txt`
2. Inject required secrets:
   `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `ACTIVITY_IDENTITY_SIGNING_KEY`
3. Inject persistence credentials:
   `FIREBASE_CREDENTIALS_PATH`
4. Start the service:
   `.\run_activity.ps1`

## Stop

1. Drain traffic at the edge if possible.
2. Stop the single application process.
3. Confirm the process is no longer listening on `ACTIVITY_PORT`.

## Restart

1. Capture current `/health` and `/metrics`.
2. Restart with the same environment contract.
3. Verify `/health` returns:
   - `ok: true`
   - `ready: true`
   - `deployment_mode: "single_instance"`
4. Verify `/metrics` is reachable and request counters are incrementing.

## Rollback

1. Re-deploy the previous known-good code artifact.
2. Reuse the previous dependency lock (`requirements.txt`) and same Python `3.11.0` runtime.
3. Keep the same production secrets.
4. Re-run post-deploy verification.

## Incident Checks

### Health degraded or not ready

Check:
- Discord OAuth secrets are present
- `ACTIVITY_IDENTITY_SIGNING_KEY` is present
- Firebase credentials are mounted correctly
- Deployment mode is still `single_instance`

### Elevated 4xx/429 or 5xx

Check:
- App logs for `request_id`
- `/metrics` for `rate_limited_total`, `errors_total`, `persistence_failures_total`
- Client IP patterns causing abuse or accidental polling spikes

### Firebase persistence failures

Check:
- `FIREBASE_CREDENTIALS_PATH`
- Firebase service account validity
- Realtime Database availability and permissions

Risk:
- The app can continue in a degraded in-memory mode, but process restarts may lose active session state

## Post-Deploy Verification

1. `GET /health`
2. `GET /metrics`
3. Open the activity shell and verify static assets load
4. Create a room and join from a second client
5. Start a round, submit bids, and play at least one trick
6. Confirm realtime updates arrive over websocket
7. Confirm logs show request completion lines with request ids
