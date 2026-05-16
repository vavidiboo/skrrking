# Skull King Turn-Based Transport Analysis

작성일: 2026-05-11

## 1. 목표

이 문서는 Skull King Activity의 현재 서버-클라이언트 통신 구조를 "실제 턴제 게임" 관점에서 분석하고, 어떤 점을 유지해야 하고 어떤 점을 개선해야 하는지 단계별로 정리한다.

이번 분석의 초점:

- authoritative server 모델이 제대로 유지되는가
- 턴제 게임에 맞는 실시간성/복구성이 확보되는가
- WebSocket과 polling fallback의 책임이 명확한가
- 재연결, 중복 연결, stale snapshot 처리에서 불필요한 churn이 없는가
- 지금 구조를 크게 깨지 않고도 안정성을 올릴 수 있는가

## 2. 현재 구조 요약

현재 구조는 "HTTP mutation + snapshot sync" 기반이다.

### 2.1 상태 변경 경로

클라이언트의 실제 게임 액션은 모두 HTTP POST로 들어간다.

- `POST /activity/sessions/{session_id}/start`
- `POST /activity/sessions/{session_id}/bid`
- `POST /activity/sessions/{session_id}/play`
- `POST /activity/sessions/{session_id}/player-state`
- `POST /activity/sessions/{session_id}/leave`

서버는 요청을 받으면:

1. 세션 문서 로드
2. identity 검증
3. `game_engine.RoomState`로 역직렬화
4. 룰 적용
5. 새 session snapshot 생성
6. `updated_at` 증가
7. WebSocket 브로드캐스트 또는 HTTP state 응답 제공

즉, "명령(command)"은 HTTP가 책임지고, "동기화(state replication)"는 WebSocket/long-poll이 책임지는 구조다.

### 2.2 상태 수신 경로

클라이언트는 상태를 두 가지 경로로 받는다.

- 우선순위 1: `WebSocket /ws/activity/sessions/{session_id}`
- 우선순위 2: `GET /activity/sessions/{session_id}/state` long-poll fallback

클라이언트는 WebSocket 연결이 불안정하면 polling으로 내려가고, 다시 백오프로 WebSocket 재연결을 시도한다.

### 2.3 authoritative snapshot

서버의 공개 상태 생성 함수는 `session_public_state()`다.

이 snapshot 안에 턴제 진행에 필요한 핵심 정보가 모두 들어간다.

- `status`
- `phase`
- `round_number`
- `current_turn_player_id`
- `turn_started_at`
- `turn_deadline_at`
- `current_trick`
- `last_trick`
- `score_breakdown`
- `players[*].legal_indexes`
- `flow_events`
- `updated_at`

클라이언트는 이 snapshot을 `ingestServerState()`로 받아 `appState.game`에 반영한다.

## 3. 턴제 게임 기준으로 잘 잡힌 점

### 3.1 명령과 동기화를 분리한 점

실제 턴제 게임에서는 "누가 어떤 행동을 했는지"보다 "서버가 최종적으로 무엇을 인정했는지"가 더 중요하다.

현재 구조는 이 점에서 맞다.

- 액션은 HTTP로 단일 진입
- 판정은 서버에서만 수행
- 결과는 snapshot으로 복제

이 모델은 다음 장점이 있다.

- 중복 클릭/중복 제출 방어가 쉽다
- not-your-turn, already-played 같은 충돌 처리가 간단하다
- reconnect 후에도 "현재 정답 상태"만 다시 받으면 된다

### 3.2 WebSocket 실패 시 게임이 멈추지 않는 점

턴제 게임은 FPS처럼 초저지연이 필수는 아니다. 대신 "끊겨도 복구된다"가 더 중요하다.

현재 구조는 WebSocket이 죽어도 polling fallback으로 진행이 가능하다. 이건 실제 서비스에서 매우 중요한 장점이다.

### 3.3 서버가 타이머/자동 행동을 권위적으로 처리하는 점

`turn_deadline_at`, auto-bid, auto-play, reconnect grace, AFK 처리 등이 서버 기준으로 돌아간다.

턴제 게임에서 이건 필수다.

- 클라이언트 타이머는 연출용
- 실제 턴 만료/패널티는 서버가 확정

## 4. 현재 구조의 리스크

### 4.1 transport 메타데이터가 약하다

현재 snapshot에는 `updated_at`이 있지만, transport 자체를 설명하는 메타데이터가 없다.

예를 들면 아래 질문에 대한 명시적 답이 없다.

- 이 payload는 compact snapshot인가 full snapshot인가
- 이 서버가 어떤 snapshot 프로토콜 버전을 말하고 있는가
- 클라이언트가 비교해야 할 revision 키가 무엇인가

지금은 `updated_at`과 암묵적 클라이언트 로직으로 버티고 있지만, 구조가 커질수록 추론 비용이 커진다.

### 4.2 terminal close와 recoverable close가 충분히 분리되어 있지 않다

현재 클라이언트는 WebSocket close/error를 만나면 기본적으로 polling fallback + 재연결을 시도한다.

하지만 실제로는 종료 사유가 다르다.

- recoverable:
  - 일시적 네트워크 문제
  - open timeout
  - quick close
  - proxy hiccup
- terminal:
  - session not found
  - spectator policy 변경으로 access denied
  - identity mismatch / authorization failure

turn-based 게임에서 terminal close까지 계속 재연결하면:

- 불필요한 재접속 루프가 생기고
- 사용자에게 "복구 중"이라는 잘못된 신호를 주고
- 서버에도 의미 없는 연결 시도가 반복된다

### 4.3 no-op connection update가 snapshot churn을 만든다

현재 `set_player_connection_state()`는 연결 상태가 실제로 바뀌지 않아도 `updated_at`을 올리고 저장한다.

즉, 아래 같은 경우에도 snapshot revision이 증가할 수 있다.

- 이미 connected인 플레이어가 같은 상태로 다시 연결 처리됨
- 이미 disconnected인 플레이어가 중복 정리됨

이건 턴제 게임에서 좋지 않다.

- 게임 상태가 안 바뀌었는데 snapshot revision만 증가
- 불필요한 broadcast 발생 가능
- 디버깅 시 "진짜 게임 상태 변경"과 "transport 소음"이 섞임

### 4.4 403 계열 상태 복구 UX가 약하다

state fetch가 403으로 떨어지는 경우는 보통 recoverable 문제가 아니라 "권한/세션 정합성 문제"다.

이 경우는 재시도보다 세션 이탈 또는 재입장 안내가 맞다.

## 5. 턴제 게임 기준 권장 원칙

이번 프로젝트에는 아래 원칙이 맞다.

### 5.1 명령 채널과 상태 채널을 분리 유지한다

권장:

- mutation: HTTP
- replication: WebSocket + long-poll fallback

이번 단계에서는 command를 WebSocket으로 옮기지 않는다.

이유:

- 현재 서버 구조가 snapshot authoritative 모델에 이미 잘 맞음
- idempotency와 auth 처리도 HTTP 쪽이 정리되어 있음
- 지금 필요한 건 "구조 교체"보다 "복구성/가시성/소음 감소"

### 5.2 snapshot revision은 명시적으로 다룬다

클라이언트가 상태를 수용할지 결정할 때 revision 기준이 명확해야 한다.

권장:

- transport metadata에 snapshot revision 명시
- compact/full 여부 명시
- protocol/schema version 명시

### 5.3 terminal authorization failure는 재연결하지 않는다

권한 거절은 네트워크 장애가 아니다.

따라서:

- access denied
- session not found
- identity mismatch로 이어지는 403

이 케이스는 자동 재연결보다 세션 종료/재입장 흐름으로 보내는 게 맞다.

### 5.4 transport 소음은 gameplay revision과 분리한다

연결 상태가 실제로 바뀌지 않았으면 snapshot revision도 가능하면 건드리지 않는 편이 좋다.

## 6. 이번에 적용할 개선안

우선순위가 높고, 기존 구조를 깨지 않는 변경만 이번 라운드에 적용한다.

### 6.1 snapshot transport metadata 추가

`session_public_state()`에 `transport` 필드를 추가한다.

포함 내용:

- `protocol_version`
- `snapshot_revision`
- `snapshot_generated_at_ms`
- `compact`

효과:

- 클라이언트가 어떤 종류의 snapshot을 받았는지 명시적으로 알 수 있음
- 향후 프로토콜 변경 시 디버깅이 쉬워짐
- stale state 수용 기준을 더 안정적으로 만들 수 있음

### 6.2 terminal WebSocket 종료 구분

클라이언트 transport 상태에 terminal reason을 기록한다.

대상:

- `session_not_found`
- `access_denied`
- state fetch 403

효과:

- 의미 없는 재연결 루프 감소
- 사용자에게 더 정확한 상태 전달
- polling fallback이 "복구 가능 문제"에서만 동작하도록 정리

### 6.3 no-op connection state write 제거

`set_player_connection_state()`에서 실제 상태 변화가 없는 경우:

- `updated_at` 증가 안 함
- store save 안 함
- broadcast 유발 안 함

효과:

- snapshot churn 감소
- transport 이벤트와 gameplay 이벤트 분리
- reconnect/flap 상황에서 쓸데없는 상태 복제 감소

## 7. 이번 라운드에서 하지 않는 것

아래는 중요하지만 이번 패치 범위에서는 보류한다.

- command를 WebSocket으로 옮기는 구조 개편
- delta patch/state diff 프로토콜 도입
- event-sourcing 기반의 별도 게임 로그 스트림 도입
- 멀티 리전/멀티 프로세스 ordering 보장 체계
- spectator 전용 transport 채널 분리
- WebSocket ack 기반 delivery 추적

## 8. 수정 후 기대 효과

### 플레이어 입장

- 정상 상태에서는 기존과 동일하게 작동
- 프로토콜 메타데이터가 state에 함께 내려옴

### 네트워크 흔들림

- recoverable 문제는 기존처럼 polling fallback + 재연결

### 권한/세션 종료

- session not found / access denied는 재연결 루프 대신 세션 종료 흐름으로 정리

### 서버 observability

- revision churn이 줄어 실제 게임 상태 변경 추적이 쉬워짐

## 9. 구현 체크리스트

- `api_server.py`
  - `transport` metadata 추가
  - no-op connection state write 제거
- `legacy-app.js`
  - transport metadata 수용
  - terminal WS reason 기록
  - 403/terminal close 처리 개선
- `tests/test_activity_api.py`
  - transport metadata 테스트
  - no-op connection state update 테스트

## 10. 결론

현재 구조의 큰 방향은 턴제 게임에 맞다.

특히 아래는 유지 가치가 높다.

- server authoritative 판정
- HTTP mutation + snapshot sync
- WebSocket 우선, polling fallback
- 서버 주도 timeout/AFK/reconnect 처리

문제는 구조 자체보다 "transport 메타데이터 부족", "terminal close 구분 부족", "연결 상태 write 소음" 쪽에 있다.

따라서 이번 수정은 아키텍처를 갈아엎기보다, 턴제 게임에서 중요한 안정성과 복구성을 높이는 방향으로 진행한다.
