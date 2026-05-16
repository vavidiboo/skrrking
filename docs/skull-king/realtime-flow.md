# Skull King Realtime Flow

작성일: 2026-04-06

## 현재 실시간 구조 분석
- 현재 구조는 별도 command websocket 버스가 아니라 `HTTP command -> session snapshot 갱신 -> websocket broadcast` 패턴이다.
- websocket endpoint:
  - `discord_activity_skullking/api_server.py`의 `ws_session_state()`
- 브로드캐스트 스케줄링:
  - `schedule_session_broadcast()`
  - `ws_broadcast_session_state()`
- 폴백:
  - websocket 연결 실패 시 `GET /activity/sessions/{session_id}/state` long-poll
  - 클라이언트 구현은 `discord_activity_skullking/app/app.js`의 `startStateWebSocket()`와 `startPolling()`

## 기존 구조에서 재사용한 지점
- authoritative session snapshot:
  - `session_public_state()`
- 턴/트릭/라운드 상태:
  - `game_engine.RoomState`
  - `current_turn_player_id`
  - `current_trick`
  - `last_trick`
  - `score_breakdown`
- 브로드캐스트:
  - `schedule_session_broadcast(session_id, force=True)`

## 이번에 구현한 최소 이벤트 세트
- transport는 그대로 유지하고, snapshot 안에 `flow_events`를 추가했다.
- `flow_events`는 “이번 상태 갱신에서 실제로 발생한 최소 도메인 이벤트 목록”이다.
- 현재 사용 이벤트:
  - `game_started`
  - `round_started`
  - `bid_submitted`
  - `card_played`
  - `turn_changed`
  - `trick_resolved`
  - `round_scored`
  - `game_finished`

## 이벤트 흐름
### 게임 시작
1. 클라이언트가 `POST /activity/sessions/{session_id}/start`
2. 서버가 `engine.start_round()` 호출
3. 서버가 새 snapshot 생성
4. snapshot에 `flow_events = [game_started|round_started, turn_changed]`
5. 서버가 `schedule_session_broadcast(..., force=True)` 호출
6. 모든 websocket 구독자에게 최신 state 전송

### 배팅 제출
1. 클라이언트가 `POST /activity/sessions/{session_id}/bid`
2. 서버가 `engine.set_bid()` 호출
3. snapshot에 `flow_events = [bid_submitted]`
4. 마지막 배팅이면 `turn_changed`를 추가하고 phase를 `playing`으로 전환
5. 서버가 전체 state 브로드캐스트

### 카드 제출
1. 클라이언트가 `POST /activity/sessions/{session_id}/play`
2. 서버가 현재 턴 플레이어인지 검증
3. 서버가 hand index 범위와 follow-suit 가능 여부 검증
4. 서버가 `engine.play_card()` 호출
5. snapshot에 최소 `card_played` 추가
6. 트릭이 안 닫혔으면 `turn_changed` 추가
7. 트릭이 닫혔으면 `last_trick`, `last_winner_id`, `trick_resolved` 추가
8. 라운드가 끝났으면 `round_scored` 추가
9. 마지막 라운드면 `game_finished` 추가
10. 서버가 최신 snapshot을 전체 브로드캐스트

## 실패 케이스와 에러 응답
- `409 not your turn`
  - stale client 또는 잘못된 턴 제출
- `409 player already played in this trick`
  - 중복 제출 방지
- `409 trick already closed; refresh state`
  - 이미 종료된 트릭에 대한 늦은 제출 방지
- `400 must follow lead suit`
  - 합법 수 위반
- `400 card index out of range`
  - 손패 범위 밖 인덱스
- `400 not in playing phase`
  - bidding/lobby/waiting_round 상태에서 play 시도

## 서버 authoritative 원칙
- 클라이언트는 버튼 클릭 직후 로컬 선택 상태를 유지할 수 있지만, 실제 게임 상태는 항상 서버 snapshot 기준이다.
- 클라이언트는 websocket 또는 long-poll로 받은 최신 state를 `applyServerState()`에 그대로 반영한다.
- 잘못된 낙관적 상태는 서버 응답 수신 후 폐기된다.

## 이번 구현 파일
- 서버:
  - `discord_activity_skullking/api_server.py`
- 규칙 코어:
  - `discord_activity_skullking/core/skull_king_rules.py`
  - `discord_activity_skullking/core/game_engine.py`
- 테스트:
  - `tests/test_activity_api.py`

## 수동 테스트 시나리오
### 시나리오 1. 정상 턴 진행
1. 방 생성
2. 플레이어 2명 입장
3. 둘 다 Ready
4. Start
5. 둘 다 bid 제출
6. 현재 턴 플레이어가 카드 제출
7. 다른 클라이언트에서 `current_trick`, `current_turn_player_id`, `flow_events`가 즉시 갱신되는지 확인

### 시나리오 2. 중복 제출 방지
1. 플레이어 A가 카드 제출
2. 같은 플레이어 A가 다시 같은 트릭에 play 요청
3. `409 player already played in this trick` 확인
4. 브라우저는 refresh 없이도 이후 websocket state 기준으로 정상 복구되는지 확인

### 시나리오 3. 잘못된 턴 제출 방지
1. 플레이어 B 차례가 아닌 상태에서 B가 play 요청
2. `409 not your turn` 확인
3. 서버 snapshot의 `current_turn_player_id`가 변하지 않는지 확인

### 시나리오 4. 트릭 종료와 라운드 종료
1. 마지막 플레이어가 카드 제출
2. `last_trick`, `last_winner_id`, `tricks_completed` 증가 확인
3. 손패가 비면 `score_breakdown`, `phase=waiting_next_round`, `flow_events`의 `round_scored` 확인

## 남은 주의점
- 현재 transport는 snapshot 중심이라, 한 번의 상태 갱신에서 여러 이벤트가 동시에 `flow_events`에 담길 수 있다.
- 프론트는 아직 `flow_events`에 강하게 의존하지 않고, 기존 `last_event`, `last_trick`, `score_breakdown`, `current_turn_player_id`도 계속 사용한다.
- timeout 자동 행동 경로도 같은 snapshot broadcast를 재사용하지만, 현재 문서의 중심 시나리오는 수동 제출 기준이다.
