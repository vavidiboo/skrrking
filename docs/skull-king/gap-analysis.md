# Skull King Gap Analysis

작성일: 2026-04-06

## 스컬킹 구현에 필요한 핵심 기능 목록
- 카드 덱 구성과 카드 타입 정의
- 라운드 시작, 카드 배분, 선 리더 결정
- 배팅 제출과 라운드 전환
- 리드 슈트/합법 수 계산
- 트릭 승자 판정
- 라운드 점수 계산 및 보너스 반영
- 방 생성/참가/재입장/퇴장
- 실시간 상태 동기화
- reconnect/AFK/timeout 처리
- 클라이언트 카드 렌더링과 턴 UI
- 세션/유저/룸 상태 저장
- 테스트 자동화

## 이미 있는 기능

### 코어 게임 규칙
- 카드 타입 `Card`와 기본 특수카드 정의가 `discord_activity_skullking/core/card_rules.py`에 있다.
- 기본 트릭 판정은 `evaluate_trick_base()`에 있다.
- Advanced 일부 판정은 `evaluate_trick_advanced()`에 있다.
- 라운드 시작, 배팅, 카드 제출, 점수 계산은 `discord_activity_skullking/core/game_engine.py`에 있다.
- 공개 시야 분리는 `room_public_view()`에 있다.

### 세션/룸/실시간
- 방 생성/참가/시작/배팅/플레이/나가기 API가 `discord_activity_skullking/api_server.py`에 있다.
- websocket 실시간 동기화와 long-poll fallback이 있다.
- timeout auto-bid, timeout auto-play, reconnect grace, AFK 처리 정책이 있다.
- spectator read-only 정책까지 이미 구현돼 있다.

### 프론트엔드
- home/lobby/game 화면이 이미 존재한다.
- 로비 플레이어 좌석, 손패 렌더링, 트릭 중앙 영역, 점수판, 로그 패널이 존재한다.
- 티그리스 선택 modal, 배팅 dialog, 방 생성/비밀번호 dialog 등 플레이 흐름 UI가 있다.

### 저장/인증
- Firebase 기반 `Users`, `Rooms`, `ActivitySessions` 저장 추상화가 있다.
- Activity identity token 기반 인증이 있다.
- Discord OAuth 교환 경로가 있다.

### 테스트
- Activity 세션 흐름 테스트가 이미 있다.

## 부족한 기능

### 규칙 측면
- 룰 단위 테스트가 부족하다.
- README 기준 미구현으로 적힌 Advanced 룰 중 `Loot` 등은 현재 코드에서 확인되지 않았다.
- 이번 구현 범위에서는 advanced rules를 `kraken`, `white_whale`까지만 유지하고, `Loot`는 제외하는 것이 현재 코드와 가장 자연스럽다.
- 카드 효과가 늘어날 때 사용할 독립 규칙 모듈 분리가 더 필요하다.

### 구조 측면
- 프론트/백 공용 타입 패키지가 없다.
- API 서버 파일이 단일 파일이라 규칙 확장 시 응답 직렬화/운영 정책과 섞일 위험이 있다.
- `card_rules.py`에 콘솔 플레이 레거시 코드가 섞여 있다.

### 데이터 측면
- 완료된 매치 결과를 별도 엔티티로 저장하는 구조는 보이지 않는다.
- seed/fixture/mock 데이터 세트가 없다.
- 이번 구현 범위에서는 결과 영속 저장을 새로 도입하지 않고, session snapshot 기반 종료 처리만 유지하는 편이 안전하다.

### 테스트 측면
- 프론트엔드 UI 테스트가 없다.
- 카드 판정, 점수 계산, 특수카드 상호작용을 직접 검증하는 테스트가 없다.

## 충돌 가능성이 있는 기존 구조
- `discord_activity_skullking/api_server.py`의 카드 payload 포맷(`type`, `suit`, `value`, `mode`, `label`, `needs_mode`)을 바꾸면 `discord_activity_skullking/app/app.js` 렌더링과 즉시 충돌할 수 있다.
- `session_public_state()` 응답 필드 변경은 `deriveUiModel()`과 다수의 render 함수에 영향을 준다.
- timeout auto-play는 `legal_card_indexes_room()`과 카드 타입 의미에 의존하므로 새 특수카드 추가 시 같이 수정해야 한다.
- `room_to_session_doc()` / `session_doc_to_room()` 변환 규칙을 놓치면 저장 상태와 런타임 상태가 어긋날 수 있다.
- `game_engine.py`의 phase/status 전이 규약을 깨면 클라이언트 `setView()`와 phase badge 로직이 어긋난다.
- bid 공개 정책을 바꾸면 `app/app.js`의 좌석/점수판 렌더와 직접 충돌할 수 있다.
- websocket envelope을 바꾸면 클라이언트 state 수신 경로와 충돌할 수 있다.

## 스컬킹 구현에 재사용 가능한 것
- `discord_activity_skullking/core/game_engine.py`의 상태 전이 구조
- `discord_activity_skullking/core/card_rules.py`의 카드 기본 타입과 판정 함수
- `discord_activity_skullking/api_server.py`의 세션 직렬화/공개 상태 응답
- `discord_activity_skullking/api_server.py`의 identity/auth/timeout/reconnect 정책
- `discord_activity_skullking/app/app.js`의 기존 로비/플레이 렌더 패턴
- `discord_activity_skullking/core/firebase_store.py`의 저장 추상화
- `tests/test_activity_api.py`의 세션 흐름 테스트 골격

## 새로 만들어야 하는 것
- 카드 규칙 회귀를 막는 단위 테스트 세트
- 아직 빠진 Advanced 룰 구현
- 필요 시 결과 영속 저장 구조
- 필요 시 응답 계약을 문서화한 명시적 shared schema 또는 타입 레이어
- 새 규칙이 추가될 경우 이를 UI에 반영하는 최소 렌더링 확장

## 이번 구현 범위에서 고정한 정책
- advanced rules 포함 범위: `kraken`, `white_whale`만
- 제외 범위: `Loot`, 별도 결과 저장, spectator 정책 확장, websocket envelope 변경
- 승리자 정책: 별도 tie-break 추가 없이 기존 최고 점수 표시 유지
- bid 공개 정책: 제출 즉시 공개 유지

## 권장 구현 순서
1. `core/card_rules.py`, `core/game_engine.py`에 대한 룰 단위 테스트 기반부터 만든다.
2. README와 실제 구현 상태의 차이를 정리해 현재 기준 기능을 확정한다.
3. 빠진 규칙을 코어 로직에 먼저 추가한다.
4. `api_server.py`의 세션 직렬화와 timeout 경로가 새 규칙을 반영하도록 맞춘다.
5. 마지막으로 `app/app.js`에서 기존 render 패턴을 따라 UI 노출만 최소 보강한다.
