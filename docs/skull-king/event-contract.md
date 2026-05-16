# Skull King Event Contract

작성일: 2026-04-06

## 계약 원칙
- 기존 코드베이스에 맞춰 HTTP command + websocket snapshot 구조를 유지한다.
- 서버가 authoritative source of truth다.
- 클라이언트는 command를 보내고, 서버가 반환한 snapshot만 신뢰해 렌더링한다.
- 별도 event bus를 새로 만들기보다 `session_public_state()` snapshot을 기본 계약으로 삼는다.

## 이번 계약 확정
- websocket payload 래퍼는 현재 구현을 유지한다.
- 즉, websocket 메시지는 설계용 단순 예시가 아니라 현재 서버 구현의 envelope을 기준으로 맞춘다.
- bid 값은 제출 즉시 snapshot에 공개한다.
- spectator는 read-only snapshot 소비만 허용한다.
- 게임 종료 결과는 별도 저장 API 없이 현재 snapshot/finish UI 계약만 유지한다.

## 1. 공통 Snapshot 계약

### 기본 응답 형태
- 모든 주요 command 성공 응답은 가능한 한 아래 형태를 유지한다.
- `session_id`
- `updated_at`
- `status`
- `room_status`
- `phase`
- `room_name`
- `settings`
- `host_id`
- `round_number`
- `cards_dealt`
- `leader_index`
- `turn_index`
- `current_turn_player_id`
- `tricks_completed`
- `turn_started_at`
- `turn_deadline_at`
- `turn_limit_seconds`
- `last_event`
- `latest_log`
- `players`
- `current_trick`
- `last_trick`
- `last_winner_id`
- `score_breakdown`
- `viewer_role`
- `viewer_read_only`
- `spectator_policy`
- `identity_token` (player일 때)

### 기존 코드 재사용 지점
- `discord_activity_skullking/api_server.py`의 `session_public_state()`
- `discord_activity_skullking/app/app.js`의 `applyServerState()`, `deriveUiModel()`

## 2. HTTP Command 계약

### 방 생성
- endpoint: `POST /activity/sessions`
- request payload:
```json
{
  "player_id": "string",
  "player_name": "string",
  "discord_user_id": "string | null",
  "avatar_url": "string | null",
  "room_name": "string",
  "max_players": 2,
  "bonus_enabled": false,
  "advanced_rules_enabled": false,
  "room_password": "string | null"
}
```
- success response:
- 생성 정보 + `identity_token`
- 이후 클라이언트는 기존처럼 join을 이어서 호출 가능
- error cases:
- validation error
- 서버 저장 실패
- server authoritative:
- 예
- 기존 코드 재사용 지점:
- `api_server.CreateSessionPayload`
- `api_server.create_session()`

### 방 입장
- endpoint: `POST /activity/sessions/{session_id}/join`
- request payload:
```json
{
  "player_id": "string",
  "player_name": "string",
  "room_password": "string | null",
  "discord_user_id": "string | null",
  "avatar_url": "string | null"
}
```
- success response:
- full session snapshot
- error cases:
- `wrong room password`
- `game already started`
- `room is full`
- `player_forfeited_cannot_rejoin_in_round`
- server authoritative:
- 예
- 기존 코드 재사용 지점:
- `api_server.JoinPayload`
- `api_server.join_session()`

### 준비 상태 변경
- endpoint: `POST /activity/sessions/{session_id}/player-state`
- request payload:
```json
{
  "player_id": "string",
  "state": "ready | not_ready"
}
```
- success response:
- full session snapshot
- error cases:
- `session not found`
- `identity_token_required`
- `identity_token_player_mismatch`
- `state can only be changed in lobby`
- `state must be ready or not_ready`
- server authoritative:
- 예
- 기존 코드 재사용 지점:
- `api_server.PlayerStatePayload`
- `api_server.set_player_state()`

### 게임/라운드 시작
- endpoint: `POST /activity/sessions/{session_id}/start`
- request payload:
```json
{
  "player_id": "string"
}
```
- success response:
- full session snapshot
- error cases:
- `session not found`
- `호스트만 Start를 누를 수 있습니다.`
- `2인 이상이서 Start 할 수 있습니다.`
- `Ready를 하지 않은 플레이어가 있습니다: ...`
- `current round is not finished`
- server authoritative:
- 예
- 기존 코드 재사용 지점:
- `api_server.NextRoundPayload`
- `api_server.start_game()`
- `game_engine.start_round()`

### 예측 제출
- endpoint: `POST /activity/sessions/{session_id}/bid`
- request payload:
```json
{
  "player_id": "string",
  "bid": 0
}
```
- success response:
- full session snapshot
- error cases:
- `not in bidding phase`
- `bid already submitted`
- `invalid bid`
- identity token mismatch 계열
- server authoritative:
- 예
- 기존 코드 재사용 지점:
- `api_server.BidPayload`
- `api_server.submit_bid()`
- `game_engine.set_bid()`

### 카드 제출
- endpoint: `POST /activity/sessions/{session_id}/play`
- request payload:
```json
{
  "player_id": "string",
  "card_index": 0,
  "tigress_mode": "pirate | escape | null"
}
```
- success response:
- full session snapshot
- error cases:
- `not in playing phase`
- `card index out of range`
- `tigress_mode must be pirate or escape`
- `not your turn`
- `must follow lead suit`
- identity token mismatch 계열
- server authoritative:
- 예
- 기존 코드 재사용 지점:
- `api_server.PlayPayload`
- `api_server.play_card()`
- `game_engine.play_card()`

### 방 퇴장 / 기권
- endpoint: `POST /activity/sessions/{session_id}/leave`
- request payload:
```json
{
  "player_id": "string"
}
```
- success response:
- 로비에서는 `left/deleted/player_count`
- 진행 중에는 `forfeit=true` 포함
- error cases:
- identity token mismatch 계열
- server authoritative:
- 예
- 기존 코드 재사용 지점:
- `api_server.LeavePayload`
- `api_server.leave_session()`

### 상태 조회
- endpoint: `GET /activity/sessions/{session_id}/state`
- query:
- `player_id`
- `discord_user_id`
- `since`
- `wait_ms`
- `compact`
- success response:
- session snapshot
- error cases:
- `session not found`
- `spectator_not_allowed`
- identity token mismatch 계열
- server authoritative:
- 예
- 기존 코드 재사용 지점:
- `api_server.get_state()`

## 3. WebSocket 계약

### 연결
- endpoint: `ws /ws/activity/sessions/{session_id}`
- query:
- `player_id`
- `discord_user_id`
- `identity_token`
- `compact`

### 기본 원칙
- 별도 세부 event envelope보다 최신 session snapshot 전송을 우선한다.
- 클라이언트는 snapshot을 그대로 `applyServerState()`에 넣는다.

### 서버가 보내는 메시지
- 정상 상태 갱신:
```json
{
  "session_id": "activity-12345",
  "updated_at": 1712345678,
  "payload": {
    "type": "state",
    "data": { "...session_public_state..." }
  }
}
```
- 세션 종료/삭제:
```json
{
  "session_id": "activity-12345",
  "payload": {
    "type": "session_closed"
  }
}
```
- 접근 거부:
```json
{
  "session_id": "activity-12345",
  "payload": {
    "type": "access_denied",
    "reason": "spectator_not_allowed"
  }
}
```

### error cases
- spectator forbidden
- invalid identity token
- session not found

### server authoritative
- 예

### 기존 코드 재사용 지점
- `api_server.ws_session_state()`
- `api_server.schedule_session_broadcast()`
- `app/app.js`의 `startStateWebSocket()`

## 4. 동기화 이벤트 의미론

아래 이벤트는 새 transport를 강제하지 않고, 기존 snapshot 필드 조합으로 식별하는 도메인 이벤트다.

### `player_joined`
- 감지 조건:
- `players.length` 증가 또는 새 `player_id` 등장
- 관련 필드:
- `players`, `latest_log`, `last_event`
- 기존 코드 재사용 지점:
- `api_server.join_session()`

### `player_left`
- 감지 조건:
- 로비에서 `players.length` 감소 또는 게임 중 `afk/leave_requested_at` 반영
- 관련 필드:
- `players`, `latest_log`, `last_event`
- 기존 코드 재사용 지점:
- `api_server.leave_session()`

### `ready_state_changed`
- 감지 조건:
- `players[*].state` 변화
- 관련 필드:
- `players[*].state`
- 기존 코드 재사용 지점:
- `api_server.set_player_state()`

### `game_started`
- 감지 조건:
- `status: lobby -> bidding`
- 관련 필드:
- `status`, `phase`, `round_number`, `turn_started_at`
- 기존 코드 재사용 지점:
- `api_server.start_game()`

### `hand_dealt`
- 감지 조건:
- `round_number` 증가
- 관련 필드:
- `round_number`, `players[*].hand_count`, `cards_dealt`
- 기존 코드 재사용 지점:
- `game_engine.start_round()`

### `bid_submitted`
- 감지 조건:
- `players[*].bid` 변화
- 관련 필드:
- `players[*].bid`, `phase`, `latest_log`
- 정책:
- 제출 즉시 각 플레이어 bid 값이 snapshot에 노출된다.
- 기존 코드 재사용 지점:
- `api_server.submit_bid()`

### `card_played`
- 감지 조건:
- `current_trick.length` 증가
- 관련 필드:
- `current_trick`, `players[*].hand_count`, `current_turn_player_id`
- 기존 코드 재사용 지점:
- `api_server.play_card()`

### `turn_changed`
- 감지 조건:
- `current_turn_player_id` 또는 `turn_deadline_at` 변화
- 관련 필드:
- `current_turn_player_id`, `turn_started_at`, `turn_deadline_at`
- 기존 코드 재사용 지점:
- `api_server.sync_turn_timer_for_room_doc()`

### `trick_resolved`
- 감지 조건:
- `tricks_completed` 증가 또는 `last_trick` 갱신
- 관련 필드:
- `last_trick`, `last_winner_id`, `tricks_completed`, `latest_log`
- 기존 코드 재사용 지점:
- `api_server.build_next_session_doc_after_play()`

### `round_scored`
- 감지 조건:
- `phase = waiting_next_round`
- 관련 필드:
- `score_breakdown`, `players[*].score`, `latest_log`
- 기존 코드 재사용 지점:
- `game_engine.score_round()`
- `api_server.build_next_session_doc_after_play()`

### `game_finished`
- 감지 조건:
- `status = finished`
- 관련 필드:
- `status`, `players[*].score`, `score_breakdown`, `latest_log`
- 기존 코드 재사용 지점:
- `game_engine.score_round()`
- `app/app.js`의 `renderFinishDialog()`

## 5. 에러 계약

### 원칙
- 에러는 FastAPI `detail` 문자열을 유지한다.
- 프론트는 `buildHttpError()`로 `detail`을 사용자 메시지로 노출한다.

### 주요 에러 범주
- 인증:
- `identity_token_required`
- `identity_token_session_mismatch`
- `identity_token_player_mismatch`
- `identity_token_discord_mismatch`
- spectator:
- `spectator_not_allowed`
- 세션:
- `session not found`
- `game already started`
- `room is full`
- 진행 상태:
- `not in bidding phase`
- `not in playing phase`
- `current round is not finished`
- 게임 규칙:
- `invalid bid`
- `invalid card index`
- `must follow lead suit`
- `not your turn`

### 기존 코드 재사용 지점
- `discord_activity_skullking/api_server.py`
- `discord_activity_skullking/app/app.js`의 `buildHttpError()`

## 구현 전에 반드시 결정해야 할 불확실한 부분
- 이번 태스크에서 확정된 항목:
- websocket payload는 현재 wrapper 형식을 유지
- bid는 제출 즉시 공개
- 게임 종료 후 결과 저장 API는 추가하지 않음

- 아직 남은 불확실한 부분:
- advanced rule 추가 시 새 에러 메시지를 별도 표준 코드 체계로 바꿀지 여부
