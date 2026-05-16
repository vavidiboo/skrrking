# Skull King Domain Spec

작성일: 2026-04-06

## 설계 원칙
- 기존 프론트엔드 패턴인 `appState -> deriveUiModel() -> render()` 흐름을 유지한다.
- 기존 백엔드 패턴인 `api_server.py`의 서버 authoritative 세션 관리와 `core/` 순수 규칙 로직 분리를 유지한다.
- UI 상태와 게임 판정 로직은 분리한다.
- 게임 규칙 판정은 `discord_activity_skullking/core/` 아래의 테스트 가능한 순수 함수 또는 독립 서비스 수준으로 둔다.
- 새 엔티티를 무리하게 영속화하지 않고, 현재 `RoomState`와 activity session snapshot 안에서 가장 자연스럽게 표현한다.

## 확장 전략
- 물리적 저장 모델의 중심은 계속 `RoomState`와 session document다.
- `Round`, `Trick`, `TurnState`, `ScoreBoard`는 우선 새 테이블/컬렉션이 아니라 기존 필드 집합의 개념 모델로 취급한다.
- 규칙이 커질 경우 `core/card_rules.py` 내부 또는 인접 파일로 순수 함수 묶음을 더 쪼개되, `api_server.py`에는 세션 변환과 입출력 제어만 남긴다.

## 이번 구현 범위 확정
- Advanced rules 범위:
- 이번 구현 범위의 advanced rules는 현재 코드에 이미 존재하는 `kraken`, `white_whale`까지만 포함한다.
- `loot` 및 기타 확장 카드 규칙은 이번 범위에서 제외한다.
- 기존 코드 재사용 지점:
- `discord_activity_skullking/core/card_rules.py`의 `KRAKEN`, `WHITE_WHALE`, `evaluate_trick_advanced()`

- 최종 승리자 정책:
- 이번 구현에서는 별도 tie-break 규칙이나 공동 우승 로직을 새로 도입하지 않는다.
- 최고 점수 기준으로 승자를 표시하며, 동점일 경우 현재 구현이 사용하는 정렬/선택 결과를 그대로 유지한다.
- 기존 코드 재사용 지점:
- `discord_activity_skullking/api_server.py`의 `winner = max(room.players, key=lambda p: p.score)`
- `discord_activity_skullking/app/app.js`의 종료 화면 점수 정렬 로직

- 배팅 공개 시점:
- 배팅은 제출 즉시 서버 snapshot에 반영되고, 기존 UI처럼 각 플레이어의 bid 상태를 공개한다.
- 배팅 완료 전 비공개 규칙은 이번 구현에서 도입하지 않는다.
- 기존 코드 재사용 지점:
- `discord_activity_skullking/api_server.py`의 `session_public_state()` 내 `players[*].bid`
- `discord_activity_skullking/app/app.js`의 `renderPlayerRing()`, `renderScoreboard()`

- 결과 저장 여부:
- 이번 구현 범위에서는 별도 `GameResult` 영속 저장을 추가하지 않는다.
- 게임 종료 결과는 기존처럼 session snapshot과 종료 UI에서만 소비한다.
- 기존 코드 재사용 지점:
- `discord_activity_skullking/api_server.py`의 `score_breakdown`
- `discord_activity_skullking/app/app.js`의 `renderFinishDialog()`

- spectator 범위:
- spectator는 현재 구현을 유지하며, 환경 변수 기반 read-only 옵션으로만 취급한다.
- spectator 정책 확장이나 권한 세분화는 이번 범위에서 제외한다.
- 기존 코드 재사용 지점:
- `discord_activity_skullking/api_server.py`의 `ALLOW_ACTIVITY_SPECTATORS`, `SPECTATOR_POLICY`, `viewer_role_in_session()`

## 1. 게임 라이프사이클

### 1. 방 생성
- 입력: 플레이어 ID, 이름, 룸 이름, 최대 인원, 옵션
- 결과: 빈 라운드 상태의 `GameSession` 생성, host 지정, host를 첫 플레이어로 등록
- 서버 상태:
- `status = lobby`
- `phase = idle`
- `round_number = 0`
- `players = [host]`
- 재사용 지점:
- `discord_activity_skullking/api_server.py`의 `create_session()`
- `discord_activity_skullking/core/game_engine.py`의 `build_room()`
- 설계 메모:
- 방 생성은 기존처럼 HTTP command로 유지하고, 성공 시 전체 snapshot을 반환한다.

### 2. 플레이어 입장
- 입력: 세션 ID, 플레이어 ID, 이름, 비밀번호, Discord 식별 정보
- 결과: 세션 참가 또는 재참가, 플레이어 메타 갱신
- 서버 상태:
- 로비 상태면 좌석 추가
- 진행 중이면 기존 멤버에 한해 재참가만 허용
- 재사용 지점:
- `api_server.py`의 `join_session()`
- `game_engine.py`의 `enter_room()`
- 설계 메모:
- 입장/재입장 규칙은 기존 `player_forfeited_cannot_rejoin_in_round` 정책을 유지한다.

### 3. 게임 시작
- 입력: host의 시작 요청
- 결과: 첫 라운드 시작
- 서버 상태:
- Ready 검증
- 카드 배분
- bidding phase 진입
- 턴 타이머 시작
- 재사용 지점:
- `api_server.py`의 `start_game()`
- `game_engine.py`의 `start_round()`
- 설계 메모:
- host만 시작 가능, 2인 이상 필요, 서버 authoritative 유지

### 4. 라운드 시작
- 입력: 새로운 라운드 시작 요청 또는 첫 게임 시작 요청
- 결과:
- `round_number += 1`
- 각 플레이어 손패 배분
- `bid = None`, `tricks_won = 0`, `round_bonus = 0`
- `leader_index`, `current_turn_index` 재설정
- 재사용 지점:
- `game_engine.py`의 `start_round()`
- `api_server.py`의 `sync_turn_timer_for_room_doc()`
- 설계 메모:
- 라운드 수와 배분 카드 수는 계속 `round_number`와 동일하게 유지한다.

### 5. 예측 제출
- 입력: 플레이어의 bid/prediction
- 결과:
- 플레이어별 예측 저장
- 모든 플레이어 제출 완료 시 phase를 `playing`으로 전환
- 재사용 지점:
- `api_server.py`의 `submit_bid()`
- `game_engine.py`의 `set_bid()`
- 설계 메모:
- 예측은 별도 엔티티를 만들지 않고 `PlayerState.bid`를 유지한다.

### 6. 카드 제출
- 입력: 플레이어 ID, hand index, tigress mode
- 결과:
- 합법 수 검증
- 카드 제거 후 `current_trick`에 추가
- 트릭 종료 조건이면 승자 판정으로 이어짐
- 재사용 지점:
- `api_server.py`의 `play_card()`
- `game_engine.py`의 `play_card()`
- `game_engine.py`의 `legal_card_indexes()`
- 설계 메모:
- 카드 판정과 합법 수 계산은 UI가 아니라 서버 코어가 책임진다.

### 7. 트릭 승자 판정
- 입력: 트릭에 제출된 카드 집합
- 결과:
- 승자 player index
- 다음 리더
- 보너스 누적
- 트릭 카운트 증가
- 재사용 지점:
- `core/card_rules.py`의 `evaluate_trick_base()`
- `core/card_rules.py`의 `evaluate_trick_advanced()`
- `game_engine.py`의 `play_card()` 내부 트릭 종료 처리
- 설계 메모:
- 판정 함수는 순수 함수로 유지하고, 상태 변경은 `game_engine.py`에서만 수행한다.

### 8. 라운드 점수 계산
- 입력: 모든 손패 소진 후 현재 라운드 결과
- 결과:
- 플레이어별 점수 증감 계산
- 다음 라운드 대기 또는 게임 종료
- 재사용 지점:
- `game_engine.py`의 `score_round()`
- `api_server.py`의 `build_next_session_doc_after_play()`
- 설계 메모:
- 라운드 종료 후 요약은 `score_breakdown` snapshot으로 노출한다.

### 9. 최종 승리자 결정
- 입력: 마지막 라운드 점수 계산 완료
- 결과:
- `status = finished`
- 최고 점수 플레이어를 승자로 표시
- 재사용 지점:
- `game_engine.py`의 `score_round()`
- `api_server.py`의 `build_next_session_doc_after_play()`
- 설계 메모:
- 이번 구현은 기존 동작을 유지한다.
- 즉, 최고 점수 기준 승자 표시만 유지하고 별도 tie-break/공동 우승 로직은 추가하지 않는다.

## 2. 핵심 도메인 모델

### Player
- 책임:
- 식별
- 손패 보유
- 예측 제출
- 트릭 획득 수
- 누적 점수
- 권장 표현:
- 기존 `game_engine.PlayerState`
- session document의 `players[]`
- 필드:
- `id`, `name`, `order`, `score`, `bid`, `tricks_won`, `round_bonus`, `hand`
- 플레이 메타:
- `discord_user_id`, `avatar_url`, `state`, `connection_state`, `afk`, `consecutive_timeout_count`
- 기존 코드 재사용 지점:
- `discord_activity_skullking/core/game_engine.py`의 `PlayerState`
- `discord_activity_skullking/api_server.py`의 `room_to_session_doc()`, `session_public_state()`

### Room / GameSession
- 책임:
- 플레이어 집합
- 현재 라운드/턴/트릭 상태
- 옵션
- 세션 수명주기
- 권장 표현:
- 런타임: `game_engine.RoomState`
- 저장/전송: activity session document
- 필드:
- `id`, `name`, `host_player/host_id`, `status`, `phase`, `settings`, `players`, `round_number`, `leader_index`, `current_turn_index`, `tricks_completed`, `current_trick`
- 기존 코드 재사용 지점:
- `discord_activity_skullking/core/game_engine.py`의 `RoomState`
- `discord_activity_skullking/api_server.py`의 session snapshot 구조

### Round
- 책임:
- 현재 라운드 번호
- 배분 카드 수
- 라운드별 예측/획득 트릭/보너스/정산 상태
- 권장 표현:
- 별도 영속 엔티티를 만들지 않고 `RoomState`와 `PlayerState`의 현재 필드 조합으로 표현
- 핵심 필드 매핑:
- `round_number`
- `phase`
- `players[*].bid`
- `players[*].tricks_won`
- `players[*].round_bonus`
- `cards_dealt`
- 기존 코드 재사용 지점:
- `game_engine.start_round()`
- `game_engine.score_round()`
- `api_server.session_public_state()`의 `score_breakdown`

### Trick
- 책임:
- 현재 제출 카드 목록
- 리드 슈트
- 승자와 다음 리더 결정
- 권장 표현:
- 진행 중 트릭: `RoomState.current_trick`
- 직전 트릭: session document의 `last_trick`, `last_winner_id`
- 기존 코드 재사용 지점:
- `game_engine.TrickPlay`
- `api_server.build_next_session_doc_after_play()`

### Bid / Prediction
- 책임:
- 플레이어별 라운드 예상 트릭 수
- 권장 표현:
- 별도 엔티티 없이 `PlayerState.bid`
- 기존 코드 재사용 지점:
- `game_engine.set_bid()`
- `api_server.submit_bid()`

### Card
- 책임:
- 숫자/특수 카드 타입과 속성 표현
- 권장 표현:
- 도메인 타입: `card_rules.Card`
- 저장/전송 payload: `type`, `suit`, `value`, `mode`, `label`, `needs_mode`
- 기존 코드 재사용 지점:
- `core/card_rules.py`의 `Card`
- `api_server.py`의 `engine_card_to_session_card()`, `client_card_payload_from_engine_card()`

### TurnState
- 책임:
- 현재 리더
- 현재 행동할 플레이어
- 행동 가능 시간
- 권장 표현:
- 별도 영속 엔티티 없이 session/room 필드로 표현
- 핵심 필드:
- `leader_index`
- `current_turn_index`
- `current_turn_player_id`
- `turn_started_at`
- `turn_deadline_at`
- `turn_limit_seconds`
- 기존 코드 재사용 지점:
- `game_engine.RoomState`
- `api_server.sync_turn_timer_for_room_doc()`
- `api_server.maybe_apply_server_timeouts_locked()`

### ScoreBoard
- 책임:
- 누적 점수
- 라운드 정산 결과
- 최종 순위
- 권장 표현:
- 누적 점수는 `players[*].score`
- 라운드 정산 뷰는 `score_breakdown`
- 게임 종료 뷰는 정렬된 `players`
- 기존 코드 재사용 지점:
- `game_engine.score_round()`
- `api_server.session_public_state()`
- `app/app.js`의 `renderScoreboard()`, `renderFinishDialog()`

## 3. 카드 규칙 설계

### 숫자 카드
- 수트:
- `yellow`, `green`, `purple`, `black`
- 검정 수트는 현재 구현에서 trump 역할
- 기존 코드 재사용 지점:
- `core/card_rules.py`의 `SUITS`, `NUMBERS`
- `evaluate_trick_base()`

### 특수 카드
- 현재 확인된 카드:
- `pirate`
- `mermaid`
- `skull_king`
- `escape`
- `tigress`
- advanced 일부:
- `kraken`
- `white_whale`
- 설계 원칙:
- 특수카드 규칙은 `card_rules.py`의 판정 함수로 캡슐화
- 상태 변경은 `game_engine.py`가 담당
- 기존 코드 재사용 지점:
- `core/card_rules.py`의 카드 상수와 `is_*` 헬퍼 함수

### 리드 슈트 / 트럼프 / 특수 우선순위
- 리드 슈트:
- 첫 카드가 숫자면 그 수트
- 첫 카드가 escape면 이후 처음 나온 숫자 카드의 수트
- 첫 카드가 pirate/mermaid/skull_king/tigress-pirate면 리드 슈트 없음
- 합법 수:
- 리드 슈트 숫자 카드를 갖고 있으면 그 수트를 따라야 함
- 특수 카드는 항상 합법 수로 허용
- 트럼프:
- 검정 수트 숫자 카드는 기본 숫자 카드보다 우선
- 기존 코드 재사용 지점:
- `game_engine.determine_lead_suit()`
- `game_engine.legal_card_indexes()`
- `card_rules.evaluate_trick_base()`

### 트릭 승리 판정 규칙
- 기본 우선순위:
- mermaid beats skull_king
- skull_king beats pirate and numbered cards
- pirate beats mermaid and numbered cards
- numbered cards only: black trump highest first, else lead suit highest
- all escape: 먼저 낸 escape 승리
- 보너스:
- 14 카드 보너스
- pirate가 mermaid를 잡을 때 보너스
- skull_king이 pirate를 잡을 때 보너스
- mermaid가 skull_king을 잡을 때 보너스
- advanced:
- kraken / white whale은 기존 `evaluate_trick_advanced()` 흐름 유지
- 기존 코드 재사용 지점:
- `core/card_rules.py`의 `evaluate_trick_base()`, `evaluate_trick_advanced()`
- `core/game_engine.py`의 `play_card()` 보너스 누적 로직

### 설계 권장 사항
- 규칙이 더 늘어나면 `card_rules.py` 안에서 다음 순수 함수 그룹으로 분리하는 것이 자연스럽다.
- `determine_lead_suit_from_plays()`
- `legal_card_indexes_from_hand()`
- `resolve_trick_winner()`
- `calculate_trick_bonus()`
- `calculate_round_score_delta()`
- 이 분리는 새 아키텍처 도입이 아니라 기존 `core` 모듈 내부 리팩터링 수준으로 유지한다.
- 기존 코드 재사용 지점:
- 현재 `game_engine.py`와 `card_rules.py` 함수 경계

## 4. 동기화 이벤트 설계

### 원칙
- 기존 전송 방식은 event envelope 중심이 아니라 authoritative snapshot 중심이다.
- 따라서 transport는 계속 "command -> updated snapshot broadcast"로 유지하는 것이 자연스럽다.
- 도메인 이벤트는 우선 snapshot 내부 필드와 `last_event`, `last_trick`, `score_breakdown`으로 표현한다.

### 이벤트 목록
- 플레이어 입장/퇴장
- 준비 상태 변경
- 게임 시작
- 패 분배
- 예측 제출
- 카드 제출
- 턴 변경
- 트릭 종료
- 라운드 종료
- 게임 종료

### 표현 방식
- 입장/퇴장: `players`, `latest_log`, `last_event`
- 준비 상태 변경: `players[*].state`
- 게임 시작/패 분배: `status`, `phase`, `round_number`, `players[*].hand_count`
- 예측 제출: `players[*].bid`, `phase`
- 카드 제출: `current_trick`, `players[*].hand_count`
- 턴 변경: `current_turn_player_id`, `turn_started_at`, `turn_deadline_at`
- 트릭 종료: `last_trick`, `last_winner_id`, `tricks_completed`
- 라운드 종료: `score_breakdown`, `phase=waiting_next_round`
- 게임 종료: `status=finished`, 정렬 가능한 `players[*].score`
- 기존 코드 재사용 지점:
- `api_server.session_public_state()`
- `api_server.build_next_session_doc_after_play()`
- `app/app.js`의 `handleGameTransitions()`

## 5. API / 소켓 이벤트 계약 설계

### 계약 원칙
- 명령은 HTTP POST 중심으로 유지한다.
- 읽기는 GET state와 websocket snapshot으로 유지한다.
- 서버 authoritative를 유지한다.
- 클라이언트는 낙관적 판정을 하지 않고 서버 snapshot을 다시 렌더한다.

### 요청/응답 공통 규칙
- 요청 DTO는 기존 Pydantic payload를 그대로 재사용한다.
- 성공 응답은 가능하면 `session_public_state()` 형태의 전체 snapshot을 유지한다.
- 에러는 계속 `HTTPException(detail=...)` 문자열 기반으로 전달한다.
- websocket도 동일 snapshot을 compact/full 형태로 보낸다.
- 기존 코드 재사용 지점:
- `api_server.py`의 payload 모델들
- `api_server.py`의 `session_public_state()`
- `app/app.js`의 `buildHttpError()`

## 구현 전에 반드시 결정해야 할 불확실한 부분
- 이번 태스크에서 확정된 항목:
- advanced rules는 `kraken`, `white_whale`까지만 포함
- 동점 전용 추가 규칙 없음
- bid는 제출 즉시 공개
- 결과 영속 저장 추가 없음
- spectator는 기존 read-only 옵션 유지

- 아직 남은 불확실성:
- Host 이탈/교체 시 게임 중 UX를 어디까지 보강할지
- advanced rules 제외 카드(`loot` 등)를 장기적으로 별도 릴리즈로 분리할지

## 권장 구현 단위
1. 순수 규칙 함수 단위 테스트 추가
2. 확정된 룰 범위에 맞춰 `core/card_rules.py` 정리
3. `game_engine.py`의 상태 전이 보강
4. `api_server.py` snapshot 반영
5. `app/app.js`의 UI 노출 최소 확장
