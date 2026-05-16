# Skull King Current State

작성일: 2026-04-06

## 전체 아키텍처 요약
- 서버 진입점은 `discord_activity_skullking/api_server.py` 단일 FastAPI 앱이다.
- 게임 규칙과 상태 전이는 `discord_activity_skullking/core/game_engine.py`, `discord_activity_skullking/core/card_rules.py`에 분리돼 있다.
- 프론트엔드는 `discord_activity_skullking/app/index.html` + `discord_activity_skullking/app/app.js` + `discord_activity_skullking/app/styles.css`의 정적 SPA 구조다.
- 저장 계층은 `discord_activity_skullking/core/firebase_store.py`에 있으며 Firebase Realtime Database의 `Users`, `Rooms`, `ActivitySessions` ref를 사용한다.
- 서비스 계층 흔적은 `discord_activity_skullking/activity_service.py`의 `GameService`에 존재하지만, Activity API는 대부분 `api_server.py`에서 직접 세션 문서를 다룬다.
- 테스트는 `tests/test_activity_api.py`에 집중돼 있다.

## 폴더 구조 스캔 결과
- 앱 코드 루트: `discord_activity_skullking/`
- 프론트엔드: `discord_activity_skullking/app/`
- 백엔드/API: `discord_activity_skullking/api_server.py`
- 서비스/DB 연결: `discord_activity_skullking/activity_service.py`
- 게임 규칙 코어: `discord_activity_skullking/core/`
- 설정 파일: `discord_activity_skullking/config/discord_config.local.json`, `discord_activity_skullking/config/firebase.json`
- 테스트: `tests/test_activity_api.py`
- 문서: `docs/skull-king/`

## 프론트엔드 현재 상태

### 진입점과 라우팅 구조
- HTML 진입점은 `discord_activity_skullking/app/index.html`이다.
- 서버는 `discord_activity_skullking/api_server.py`에서 `/`, `/app.js`, `/styles.css`, `/assets/...`, `/vendor/discord-sdk/output/...`를 직접 서빙한다.
- 프론트엔드 라우터 라이브러리는 없고, `discord_activity_skullking/app/app.js`의 `setView()`가 `home/lobby/game` 패널 표시를 토글하는 방식이다.
- URL 기반 SPA 라우팅, `history.pushState`, hash router 구조는 현재 확인되지 않았다.

### 상태관리 방식
- 전역 단일 상태 객체 `appState`가 `discord_activity_skullking/app/app.js`에 있다.
- 서버 응답은 `applyServerState()`로 흡수된다.
- 화면 파생 상태는 `deriveUiModel()`에서 계산한다.
- 실제 DOM 갱신은 `render()`, `renderRoomScreen()`, `renderGameTable()`, `renderHand()`, `renderScoreboard()` 등으로 나뉘어 있다.
- 즉, 구조는 "서버 상태 -> `appState` -> `deriveUiModel()` -> render 함수들"이다.

### 공용 UI 컴포넌트 패턴
- React/Vue 컴포넌트 시스템은 없다.
- 대신 `renderCard()`, `renderPlayerSeat()`, `renderRoomList()`, `renderTrickCenter()` 같은 DOM 생성 함수 기반 패턴이 공용 UI 역할을 한다.
- 공용 스타일은 `discord_activity_skullking/app/styles.css`에서 관리된다.
- 모달/드로어 패턴은 `index.html`의 dialog/section 요소와 `safeOpenDialog()`, `forceCloseDialog()` 같은 헬퍼로 공통 처리한다.

### 인증과 세션 연동
- Discord SDK 번들은 `discord_activity_skullking/app/vendor/discord-sdk/output/` 아래 포함돼 있다.
- 클라이언트는 `buildIdentityHeaders()`로 `X-Sk-Activity-Identity` 헤더를 붙인다.
- 세션 참가/생성은 `joinBySession()`, `onCreateRoom()`에서 처리한다.

### 공용 타입 관점
- 별도의 프론트/백엔드 공용 타입 패키지는 없다.
- 실질적인 공유 계약은 `api_server.py`의 응답 스키마와 `app.js`의 소비 코드다.
- 카드 payload는 `discord_activity_skullking/api_server.py`의 `client_card_payload_from_engine_card()`가 정의하고, 클라이언트는 그 구조를 그대로 사용한다.

## 백엔드 현재 상태

### 진입점과 구조
- 백엔드 진입점은 `discord_activity_skullking/api_server.py`다.
- 라우터/컨트롤러/서비스/모델이 파일 단위로 분리된 구조는 아니다.
- API 엔드포인트, 인증, 세션 캐시, websocket, timeout watcher, 상태 직렬화가 모두 `api_server.py`에 모여 있다.

### 도메인 구조
- 순수 게임 상태 타입은 `discord_activity_skullking/core/game_engine.py`의 `Settings`, `PlayerState`, `TrickPlay`, `RoomState`다.
- 카드와 트릭 판정 함수는 `discord_activity_skullking/core/card_rules.py`의 `Card`, `create_deck()`, `evaluate_trick_base()`, `evaluate_trick_advanced()`에 있다.
- Activity 세션 문서와 게임 코어 상태의 변환은 `discord_activity_skullking/api_server.py`의 `session_doc_to_room()` / `room_to_session_doc()`가 담당한다.

### API 구조
- 세션 목록: `GET /activity/sessions`
- 재입장 후보 조회: `GET /activity/sessions/resume`
- 방 생성: `POST /activity/sessions`
- 방 참가: `POST /activity/sessions/{session_id}/join`
- 플레이어 준비 상태: `POST /activity/sessions/{session_id}/player-state`
- 방 나가기/기권: `POST /activity/sessions/{session_id}/leave`
- 라운드 시작: `POST /activity/sessions/{session_id}/start`
- 배팅: `POST /activity/sessions/{session_id}/bid`
- 카드 제출: `POST /activity/sessions/{session_id}/play`
- 상태 조회: `GET /activity/sessions/{session_id}/state`
- 실시간 상태: `WebSocket /ws/activity/sessions/{session_id}`

### DTO / 모델 / 엔티티
- 요청 DTO는 `discord_activity_skullking/api_server.py`의 Pydantic 모델에 있다.
- `CreateSessionPayload`
- `JoinPayload`
- `PlayerStatePayload`
- `NextRoundPayload`
- `BidPayload`
- `PlayPayload`
- `LeavePayload`
- 도메인 엔티티에 가까운 구조는 `game_engine.py` dataclass들이다.

### DB 구조
- `discord_activity_skullking/core/firebase_store.py`의 `UserDB`, `RoomDB`, `ActivitySessionDB`가 Firebase ref를 래핑한다.
- `Users`: 유저 메타와 activity presence 동기화에 사용된다.
- `Rooms`: 기존 룸 상태 저장소다.
- `ActivitySessions`: Activity 세션 스냅샷 저장소다.
- 서버는 `api_server.py` 내부 `SESSIONS` 메모리 캐시도 병행 사용한다.
- `USE_MEMORY_SESSION_CACHE`, `FIREBASE_SESSIONS_ENABLED` 플래그로 저장 경로를 전환한다.

### 인증 구조
- Discord OAuth 교환 엔드포인트는 `POST /api/discord/exchange`다.
- Activity 액션 보호는 `issue_identity_token()`, `decode_identity_token()`, `verify_player_identity_for_session()` 기반으로 동작한다.
- identity token은 쿠키, `X-Sk-Activity-Identity`, `Authorization: Bearer`, websocket query param로 읽을 수 있다.

## 실시간 통신 현재 상태
- 클라이언트는 `startStateWebSocket()`으로 websocket 연결을 우선 시도한다.
- websocket 실패 시 `startPolling()`으로 long-polling fallback을 사용한다.
- 서버는 `GET /activity/sessions/{session_id}/state`에서 `since`, `wait_ms`, `compact`를 받아 long-polling 형태로 상태를 반환한다.
- 서버는 `schedule_session_broadcast()`와 websocket subscriber 관리 로직으로 상태 브로드캐스트를 수행한다.
- 턴 시간 제한은 `sync_turn_timer_for_room_doc()`와 `maybe_apply_server_timeouts_locked()`가 서버 권위로 처리한다.
- 자동 배팅, 자동 카드 플레이, reconnect grace, AFK 처리까지 서버에서 관리한다.

## 게임방 / 매치메이킹 / 턴 관리 관련 구현
- 게임방 생성/참가/나가기/재참가 흐름은 이미 `api_server.py`에 구현돼 있다.
- 방 목록과 resume 후보 조회는 `list_sessions()`, `find_resume_session()`에 있다.
- 턴 순서, 리더, 현재 트릭, 합법 수 계산은 `game_engine.py`가 관리한다.
- 실시간 세션 동기화는 websocket + polling 구조가 이미 있다.
- 별도 매치메이킹 큐, 자동 룸 매칭, 랭크 매칭 시스템은 현재 보이지 않는다.

## 인증 / 유저 / 룸 / 카드 / 게임 세션 / 결과 저장 관련 타입
- 유저 관련 저장: `discord_activity_skullking/core/firebase_store.py`의 `UserDB`
- 룸 저장: `RoomDB`
- Activity 세션 저장: `ActivitySessionDB`
- 카드 타입: `discord_activity_skullking/core/card_rules.py`의 `Card`
- 세션 상태 타입: `discord_activity_skullking/core/game_engine.py`의 `RoomState`, `PlayerState`, `TrickPlay`, `Settings`
- 결과 요약 payload: `api_server.py`의 `session_public_state()` 내부 `score_breakdown`
- 별도 영속 `GameResult` 엔티티나 랭킹 저장 모델은 현재 확인되지 않았다.

## 테스트 현재 상태
- 테스트 코드는 `tests/test_activity_api.py` 한 파일만 확인됐다.
- 검증 범위는 세션 생성/참가, identity token 검증, spectator 접근 제어, reconnect/AFK, timeout auto-bid, 중도 이탈 forfeit, finished 상태 전이 등 API/세션 흐름이다.
- 룰 함수 단위 테스트는 없다.
- 프론트엔드 테스트는 없다.
- mock/fixture/seed 전용 디렉터리는 없다.
- 예외적으로 외부 번들 내부에는 `discord_activity_skullking/app/vendor/discord-sdk/output/mock.*`가 있지만, 프로젝트 자체 테스트 자산은 아니다.

## 재사용 가능한 모듈 목록
- 게임 상태 타입: `discord_activity_skullking/core/game_engine.py`
- 카드/트릭 판정: `discord_activity_skullking/core/card_rules.py`
- 공개 상태 직렬화: `discord_activity_skullking/api_server.py`의 `session_public_state()`
- 세션 <-> 코어 변환: `session_doc_to_room()`, `room_to_session_doc()`
- 카드 payload 변환: `session_card_to_engine_card()`, `engine_card_to_session_card()`, `client_card_payload_from_engine_card()`
- 실시간 통신: `startStateWebSocket()` / `GET state` long-polling / server broadcast
- 준비/시작/배팅/플레이 API 흐름: `api_server.py`
- 기본 UI 조립 함수: `renderCard()`, `renderPlayerSeat()`, `renderScoreboard()`, `renderHand()`
- Firebase 저장 추상화: `discord_activity_skullking/core/firebase_store.py`

## 스컬킹 구현에 직접 재사용해야 하는 것
- 새 규칙은 우선 `core/card_rules.py`와 `core/game_engine.py`에 넣는 것이 맞다.
- 클라이언트 카드 표시 규약은 `client_card_payload_from_engine_card()`를 재사용해야 한다.
- 턴/타임아웃/재접속 정책은 `api_server.py`의 기존 세션 로직에 맞춰 확장해야 한다.
- 로비/게임 화면 전환은 새 라우터를 만들지 말고 `setView()`와 기존 render 흐름을 따라야 한다.

## 위험 요소
- `discord_activity_skullking/api_server.py`와 `discord_activity_skullking/app/app.js`가 큰 단일 파일이라 수정 영향 범위가 넓다.
- 프론트/백 공용 타입 패키지가 없어 응답 스키마 변경 시 클라이언트 회귀 위험이 크다.
- README에는 Advanced 룰 미포함이라고 쓰여 있지만, 실제 코드에는 `kraken`, `white_whale` 지원 흔적이 있어 문서와 코드가 불일치한다.
- `discord_activity_skullking/core/card_rules.py`에는 콘솔 플레이용 레거시 코드가 남아 있어 책임 경계가 혼재돼 있다.
- 테스트가 API 중심이라 카드 규칙 회귀를 세밀하게 잡기 어렵다.
- 별도 결과 저장 엔티티가 없어 게임 종료 후 영속 집계 기능을 붙일 때 구조 충돌 가능성이 있다.
