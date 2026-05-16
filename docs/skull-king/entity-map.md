# Skull King Entity Map

작성일: 2026-04-06

## 설계 원칙
- 새 도메인 모델은 가능하면 기존 런타임 타입과 session snapshot 위에 매핑한다.
- 지금 단계에서는 `Round`, `Trick`, `TurnState`, `ScoreBoard`를 별도 영속 엔티티로 만들지 않는다.
- 도메인 모델과 UI 모델은 분리한다.

## 엔티티 관계 개요
- `GameSession`
- contains `Player[]`
- contains current `Round`
- contains current `TurnState`
- contains current `Trick`
- exposes derived `ScoreBoard`
- `Round`
- contains `Prediction` by player
- accumulates `Trick` results
- `Trick`
- contains ordered `CardPlay[]`
- resolves winner and next leader

## 1. Player

### 개념 책임
- 플레이어 식별
- 라운드별 예측 저장
- 손패 보유
- 트릭 획득과 점수 추적
- 연결 상태 추적

### 현재 코드 매핑
- 런타임: `discord_activity_skullking/core/game_engine.py`의 `PlayerState`
- 저장/전송: `api_server.py`의 session document `players[]`

### 핵심 필드
- 도메인:
- `id`
- `name`
- `hand`
- `bid`
- `tricks_won`
- `round_bonus`
- `score`
- 운영 메타:
- `discord_user_id`
- `avatar_url`
- `state`
- `connection_state`
- `afk`
- `consecutive_timeout_count`

### 재사용 지점
- `game_engine.PlayerState`
- `api_server.room_to_session_doc()`
- `api_server.session_public_state()`

### 설계 메모
- `Player`는 그대로 재사용 가능하다.
- 별도 `UserProfile` 엔티티는 지금 단계에서 추가하지 않고 `Users` 저장소 메타를 참조하는 수준으로 둔다.

## 2. Room / GameSession

### 개념 책임
- 게임의 최상위 aggregate root
- 플레이어 목록, 설정, 현재 라운드/턴/트릭 상태 보유
- lifecycle 전이 관리

### 현재 코드 매핑
- 런타임: `game_engine.RoomState`
- 저장: activity session document
- 외부 표시: `session_public_state()` snapshot

### 핵심 필드
- `id`
- `name`
- `host_id`
- `status`
- `phase`
- `settings`
- `players`
- `round_number`
- `leader_index`
- `current_turn_index`
- `tricks_completed`
- `current_trick`
- `last_trick`
- `last_winner_id`

### 재사용 지점
- `game_engine.RoomState`
- `api_server.session_doc_to_room()`
- `api_server.room_to_session_doc()`
- `api_server.session_public_state()`

### 설계 메모
- `GameSession`은 새 엔티티를 만들 필요가 없다.
- 지금 있는 session snapshot이 이미 aggregate persistence 역할을 한다.

## 3. Round

### 개념 책임
- 현재 라운드 번호
- 카드 배분 수
- 플레이어별 예측/획득 트릭/보너스 추적
- 라운드 종료 여부 판단

### 현재 코드 매핑
- 독립 엔티티 없음
- `RoomState`와 `PlayerState`의 필드 조합으로 표현

### 핵심 필드 매핑
- `round_number`
- `cards_dealt`
- `phase`
- `players[*].bid`
- `players[*].tricks_won`
- `players[*].round_bonus`

### 재사용 지점
- `game_engine.start_round()`
- `game_engine.score_round()`
- `api_server.session_public_state().score_breakdown`

### 설계 메모
- `Round`는 개념 모델로만 두고, 구현 시에도 별도 DB 엔티티를 만들지 않는 것이 자연스럽다.

## 4. Trick

### 개념 책임
- 한 번의 카드 제출 묶음
- 리드 슈트 결정
- 승자 결정
- 다음 리더 계산

### 현재 코드 매핑
- 진행 중 트릭:
- `RoomState.current_trick`
- 직전 완료 트릭:
- session document `last_trick`
- 승자:
- `last_winner_id`

### 핵심 필드
- ordered `plays`
- `winner_id`
- `lead_suit`
- `next_leader_index`

### 재사용 지점
- `game_engine.TrickPlay`
- `game_engine.determine_lead_suit()`
- `card_rules.evaluate_trick_base()`
- `card_rules.evaluate_trick_advanced()`
- `api_server.build_next_session_doc_after_play()`

### 설계 메모
- `Trick`도 별도 영속 엔티티보다 현재/직전 트릭 snapshot 방식이 기존 구조에 맞다.

## 5. Bid / Prediction

### 개념 책임
- 각 플레이어가 해당 라운드에서 예상한 트릭 수

### 현재 코드 매핑
- `PlayerState.bid`

### 재사용 지점
- `game_engine.set_bid()`
- `api_server.submit_bid()`

### 설계 메모
- 별도 `Prediction` 컬렉션을 만들 필요가 없다.

## 6. Card

### 개념 책임
- 숫자 카드와 특수 카드의 공통 표현
- 트릭 판정에 필요한 속성 보유

### 현재 코드 매핑
- 도메인 타입: `card_rules.Card`
- 저장 payload: `engine_card_to_session_card()`
- 클라이언트 payload: `client_card_payload_from_engine_card()`

### 핵심 필드
- `suit`
- `number`
- `kind`
- `tigress_as`
- transport:
- `type`
- `value`
- `mode`
- `label`
- `needs_mode`

### 재사용 지점
- `core/card_rules.py`의 `Card`
- `api_server.engine_card_to_session_card()`
- `api_server.session_card_to_engine_card()`
- `api_server.client_card_payload_from_engine_card()`

### 설계 메모
- transport payload 변경은 프론트와 직접 결합돼 있으므로 기존 포맷을 유지해야 한다.

## 7. TurnState

### 개념 책임
- 현재 누구 차례인지
- 턴 제한 시간이 언제 시작/종료되는지
- 다음 제출자가 누구인지

### 현재 코드 매핑
- `leader_index`
- `current_turn_index`
- `current_turn_player_id`
- `turn_started_at`
- `turn_deadline_at`
- `turn_limit_seconds`

### 재사용 지점
- `game_engine.RoomState`
- `api_server.sync_turn_timer_for_room_doc()`
- `api_server.maybe_apply_server_timeouts_locked()`

### 설계 메모
- `TurnState`는 별도 클래스를 새로 만들지 않고 snapshot projection으로 유지하는 편이 맞다.

## 8. ScoreBoard

### 개념 책임
- 누적 점수와 라운드별 정산 결과 제공
- 최종 승리자 산정에 필요한 순위 정보 제공

### 현재 코드 매핑
- 누적 점수:
- `players[*].score`
- 라운드 정산:
- `score_breakdown`
- 종료 화면:
- `players` 정렬 결과

### 재사용 지점
- `game_engine.score_round()`
- `api_server.session_public_state()`
- `app/app.js`의 `renderScoreboard()`, `renderFinishDialog()`

### 설계 메모
- `ScoreBoard`는 현재도 projection으로 충분하다.

## 9. UI 모델과 도메인 모델 분리

### 도메인 모델
- `RoomState`
- `PlayerState`
- `Card`
- 규칙 함수
- session snapshot

### UI 모델
- `app/app.js`의 `appState`
- `deriveUiModel()` 결과
- 선택 카드, pending action, reconnect overlay, modal open state

### 분리 원칙
- `legal_card_indexes`, 트릭 승자, 점수 계산은 도메인 모델이 계산한다.
- 선택된 카드 인덱스, dialog open 여부, toast 메시지는 UI 모델이 계산한다.

### 재사용 지점
- `app/app.js`의 `deriveUiModel()`
- `core/game_engine.py`
- `core/card_rules.py`

## 10. 파일별 책임 맵
- `discord_activity_skullking/core/card_rules.py`
- 카드 타입, 판정 규칙, 순수 함수
- `discord_activity_skullking/core/game_engine.py`
- 상태 전이, 라운드/트릭/점수 적용
- `discord_activity_skullking/api_server.py`
- session aggregate 입출력, 인증, API, websocket, timeout
- `discord_activity_skullking/app/app.js`
- UI 상태와 렌더링
- `discord_activity_skullking/core/firebase_store.py`
- 저장 추상화

## 구현 전에 반드시 결정해야 할 불확실한 부분
- `Round`, `Trick` 이력을 장기 저장할지, 현재처럼 현재/직전 상태만 유지할지
- 최종 결과를 별도 `GameResult`로 영속화할지
- advanced rule이 늘어날 경우 `card_rules.py` 내부 함수 분리를 어디까지 할지
- host/player/spectator 권한 경계를 더 세분화할지
