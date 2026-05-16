# Skull King Task Checklist

작성일: 2026-04-06

## 사용 원칙
- 각 태스크는 한 번의 작업으로 끝낼 수 있을 만큼 작게 유지한다.
- 위험한 대규모 리팩터링은 금지한다.
- 기존 패턴을 유지하면서 `core -> api_server -> app -> tests` 순으로 점진적으로 반영한다.
- `공용 타입`은 새 패키지 도입보다 기존 payload/직렬화 헬퍼와 문서 계약을 안정화하는 작업으로 정의한다.

## 권장 실행 순서 요약
- 안정성 우선 순서: `공용 계약 고정 -> 순수 규칙 테스트 -> 코어 규칙 수정 -> 서버 snapshot 반영 -> 프론트 UI 반영 -> 회귀 테스트`
- 이유:
- 현재 구조는 프론트와 서버가 snapshot 스키마로 강하게 결합돼 있다.
- 먼저 규칙 테스트와 계약을 고정해야 이후 `api_server.py`와 `app.js` 수정이 안전해진다.

## 가장 먼저 해야 할 3개 태스크

### 추천 1. `SK-T01`
- 이유:
- 구현 범위가 확정되지 않으면 이후 테스트와 규칙 코드가 계속 흔들린다.
- 특히 advanced rules 범위와 동점 정책이 먼저 정리돼야 테스트 기대값을 쓸 수 있다.

### 추천 2. `SK-T02`
- 이유:
- 현재 가장 큰 리스크는 룰 단위 테스트 부재다.
- 작은 테스트 골격부터 만들어야 코어 로직을 건드려도 회귀를 빠르게 잡을 수 있다.

### 추천 3. `SK-T03`
- 이유:
- 리드 슈트/합법 수 계산은 턴 진행, 자동 플레이, UI 선택 가능 카드에 모두 영향을 준다.
- 가장 넓은 파급 범위를 가진 핵심 규칙이므로 먼저 고정하는 것이 안전하다.

## 구현 안정성을 높이려면 무엇을 먼저 해야 하나
- `SK-T01`, `SK-T02`, `SK-T03`, `SK-T04`, `SK-T05`를 먼저 수행하는 편이 가장 안전하다.
- 설명:
- 이 다섯 태스크는 모두 `core`와 `tests`에 집중돼 있다.
- 즉, API와 UI를 건드리기 전에 도메인 규칙을 고정하고 테스트로 잠그는 순서다.
- 현재 코드베이스에서 가장 위험한 부분은 큰 파일 수정 자체보다, 규칙 회귀가 UI와 서버 흐름에 연쇄 전파되는 점이다.

---

## 공용 계약 / 범위

### Task ID
`SK-T01`

### 목표
- 구현 전에 스컬킹 규칙 범위와 불확실한 정책을 확정 문서로 잠근다.
- 범위: advanced rules 포함 범위, 동점 정책, bid 공개 시점, 결과 저장 여부.

### 수정 파일 후보
- `[기존 코드 수정 없음]`
- `[기존 문서 수정]` `docs/skull-king/spec.md`
- `[기존 문서 수정]` `docs/skull-king/event-contract.md`
- `[기존 문서 수정]` `docs/skull-king/gap-analysis.md`

### 선행 조건
- 현재 분석 문서 존재

### 완료 조건
- 불확실성 항목마다 "이번 구현 범위 포함/제외"가 명시된다.
- 테스트 기대값에 바로 사용할 수 있는 정책 문장이 문서에 추가된다.

### 테스트 방법
- 문서 검토
- 이후 태스크에서 모호한 요구 없이 테스트 케이스 작성 가능한지 확인

### 리스크
- 사용자 합의 없이 임의 확정하면 뒤 태스크 재작업 가능성 있음

---

## 테스트

### Task ID
`SK-T02`

### 목표
- 룰 단위 테스트 파일 골격을 추가한다.

### 수정 파일 후보
- `[신규 파일 추가]` `tests/test_card_rules.py`

### 선행 조건
- `SK-T01`

### 완료 조건
- 테스트 파일이 생성되고 기본 import, 테스트 클래스, 공통 카드 생성 헬퍼가 준비된다.
- 아직 모든 규칙을 다루지 않아도 최소 1개 smoke test가 동작한다.

### 테스트 방법
- `python -m unittest tests.test_card_rules -v`

### 리스크
- 테스트 골격이 실제 도메인 모델과 어긋나면 이후 수정 비용 증가

---

### Task ID
`SK-T03`

### 목표
- 리드 슈트와 합법 수 계산 테스트를 추가한다.

### 수정 파일 후보
- `[기존 코드 수정 없음 또는 최소 수정]` `discord_activity_skullking/core/game_engine.py`
- `[기존 파일 수정]` `tests/test_card_rules.py`

### 선행 조건
- `SK-T02`

### 완료 조건
- 아래 케이스가 테스트로 고정된다.
- 숫자 카드 리드 슈트
- escape 선행 시 후속 숫자 카드 리드 슈트
- 특수 카드 선행 시 리드 슈트 없음
- 리드 수트 보유 시 follow-suit 강제
- 리드 수트 미보유 시 자유 플레이

### 테스트 방법
- `python -m unittest tests.test_card_rules -v`

### 리스크
- 현재 구현과 설계 문서가 어긋날 경우 규칙 해석 충돌 가능

---

### Task ID
`SK-T04`

### 목표
- 기본 트릭 승자 판정 규칙 테스트를 추가한다.

### 수정 파일 후보
- `[기존 코드 수정 없음 또는 최소 수정]` `discord_activity_skullking/core/card_rules.py`
- `[기존 파일 수정]` `tests/test_card_rules.py`

### 선행 조건
- `SK-T02`
- `SK-T03`

### 완료 조건
- 아래 케이스가 테스트로 고정된다.
- skull king vs mermaid
- pirate vs mermaid
- pirate vs numbered
- black trump 우선
- lead suit 최고 숫자
- all escape
- tigress as pirate / escape

### 테스트 방법
- `python -m unittest tests.test_card_rules -v`

### 리스크
- 조합 수가 많아 테스트가 산만해질 수 있음

---

### Task ID
`SK-T05`

### 목표
- 라운드 점수 계산과 보너스 규칙 테스트를 추가한다.

### 수정 파일 후보
- `[기존 코드 수정 없음 또는 최소 수정]` `discord_activity_skullking/core/game_engine.py`
- `[기존 파일 수정]` `tests/test_card_rules.py`

### 선행 조건
- `SK-T02`

### 완료 조건
- 아래 케이스가 테스트로 고정된다.
- 0 bid 성공/실패
- 일반 bid 성공/실패
- bonus on/off 차이
- round bonus가 누적 점수에 반영되는지
- max round 도달 시 finished 전이

### 테스트 방법
- `python -m unittest tests.test_card_rules -v`

### 리스크
- 현재 점수 정책과 공식 룰 범위 차이가 있으면 기대값 재정의 필요

---

## 백엔드 / 코어 규칙

### Task ID
`SK-T06`

### 목표
- `card_rules.py` 안의 순수 규칙 함수를 작은 헬퍼로 정리하되 외부 계약은 유지한다.

### 수정 파일 후보
- `[기존 코드 수정]` `discord_activity_skullking/core/card_rules.py`

### 선행 조건
- `SK-T03`
- `SK-T04`
- `SK-T05`

### 완료 조건
- 다음 중 최소 하나 이상이 함수 단위로 분리된다.
- lead suit 계산
- trick winner 계산
- trick bonus 계산
- 함수 시그니처는 테스트 가능한 순수 함수 형태를 유지한다.
- 기존 외부 호출 경로는 깨지지 않는다.

### 테스트 방법
- `python -m unittest tests.test_card_rules -v`
- 기존 API 테스트 일부 실행

### 리스크
- 리팩터링 범위가 커지면 사실상 대규모 변경이 될 수 있음

---

### Task ID
`SK-T07`

### 목표
- `game_engine.py`에서 트릭 종료 처리와 라운드 종료 처리의 규칙 적용 책임을 명확히 한다.

### 수정 파일 후보
- `[기존 코드 수정]` `discord_activity_skullking/core/game_engine.py`

### 선행 조건
- `SK-T06`

### 완료 조건
- 트릭 종료 시 승자 계산, 보너스 누적, 다음 리더 결정이 문서 설계와 맞는다.
- 라운드 종료 시 점수 계산 흐름이 테스트 기대값과 맞는다.
- UI 전용 로직은 추가되지 않는다.

### 테스트 방법
- `python -m unittest tests.test_card_rules -v`

### 리스크
- `play_card()`가 현재도 많은 일을 하고 있어 작은 수정이 큰 영향으로 번질 수 있음

---

### Task ID
`SK-T08`

### 목표
- advanced rules 범위가 확정되면 해당 규칙만 코어에 최소 단위로 반영한다.

### 수정 파일 후보
- `[기존 코드 수정]` `discord_activity_skullking/core/card_rules.py`
- `[기존 코드 수정]` `discord_activity_skullking/core/game_engine.py`
- `[기존 파일 수정]` `tests/test_card_rules.py`

### 선행 조건
- `SK-T01`
- `SK-T06`
- `SK-T07`

### 완료 조건
- 범위에 포함된 advanced rule 1개 또는 1묶음만 반영된다.
- 기존 basic rule 회귀가 없다.

### 테스트 방법
- `python -m unittest tests.test_card_rules -v`

### 리스크
- advanced rule 여러 개를 한 번에 넣으면 원인 추적이 어려워짐

---

## 공용 계약 / 서버 스냅샷

### Task ID
`SK-T09`

### 목표
- 서버 snapshot 필드와 score/trick 요약이 설계 문서와 맞는지 최소 수정으로 정리한다.

### 수정 파일 후보
- `[기존 코드 수정]` `discord_activity_skullking/api_server.py`

### 선행 조건
- `SK-T07`
- `SK-T08` 완료 또는 범위 제외 확정

### 완료 조건
- `session_public_state()`가 코어 상태를 올바르게 직렬화한다.
- `last_trick`, `last_winner_id`, `score_breakdown`, `current_turn_player_id`가 일관된다.
- 새 공용 타입 패키지는 추가하지 않는다.

### 테스트 방법
- `python -m unittest tests.test_activity_api -v`

### 리스크
- snapshot 필드 변경은 프론트 전체에 영향을 줄 수 있음

---

### Task ID
`SK-T10`

### 목표
- timeout/auto-play/auto-bid 경로가 새 규칙과 충돌하지 않도록 서버 로직을 점검하고 보정한다.

### 수정 파일 후보
- `[기존 코드 수정]` `discord_activity_skullking/api_server.py`
- `[기존 파일 수정]` `tests/test_activity_api.py`

### 선행 조건
- `SK-T09`

### 완료 조건
- bidding timeout과 play timeout 모두 합법적인 기본 동작을 유지한다.
- 새 또는 변경된 특수카드가 있어도 서버가 진행 불능에 빠지지 않는다.

### 테스트 방법
- `python -m unittest tests.test_activity_api -v`

### 리스크
- timeout 경로는 실사용에서만 드러나는 예외가 많아 회귀 위험이 높음

---

## 프론트엔드

### Task ID
`SK-T11`

### 목표
- 클라이언트가 서버 snapshot을 기반으로 새/정정된 카드 표현을 렌더하도록 맞춘다.

### 수정 파일 후보
- `[기존 코드 수정]` `discord_activity_skullking/app/app.js`
- `[기존 코드 수정 가능]` `discord_activity_skullking/app/styles.css`

### 선행 조건
- `SK-T09`

### 완료 조건
- `renderCard()`와 관련 UI가 서버 payload 포맷을 그대로 소비한다.
- 로컬 판정 로직은 추가하지 않는다.
- 특수카드 표시가 설계 범위와 맞는다.

### 테스트 방법
- 수동 검증: 방 생성 -> 시작 -> 카드 표시 확인
- 기존 API 테스트 병행

### 리스크
- `app.js`가 커서 작은 변경도 다른 렌더 영역에 영향 가능

---

### Task ID
`SK-T12`

### 목표
- 배팅/턴/트릭/라운드 종료 UI가 snapshot 필드를 일관되게 사용하도록 정리한다.

### 수정 파일 후보
- `[기존 코드 수정]` `discord_activity_skullking/app/app.js`

### 선행 조건
- `SK-T11`

### 완료 조건
- `deriveUiModel()`과 `renderGameTable()` 계열에서 서버 authoritative 필드만 사용한다.
- 턴 전환, 트릭 종료, 라운드 점수 요약이 문서 계약과 맞는다.

### 테스트 방법
- 수동 검증: 2인 플레이 플로우 1라운드 이상

### 리스크
- UI 편의 로직이 서버 규칙처럼 보이도록 섞일 수 있음

---

### Task ID
`SK-T13`

### 목표
- 종료 화면과 점수판이 최종 점수/동점 정책을 올바르게 반영하도록 정리한다.

### 수정 파일 후보
- `[기존 코드 수정]` `discord_activity_skullking/app/app.js`

### 선행 조건
- `SK-T01`
- `SK-T12`

### 완료 조건
- 게임 종료 시 승자 표기와 점수 정렬이 문서 정책과 맞는다.
- 동점 정책이 확정됐다면 UI에도 동일하게 반영된다.

### 테스트 방법
- 수동 검증 또는 fixture성 테스트 시나리오로 종료 상태 렌더 확인

### 리스크
- 현재 종료 UI는 snapshot 정렬에 의존하므로 서버와 클라이언트 정렬 기준이 달라질 수 있음

---

## 테스트 / 회귀

### Task ID
`SK-T14`

### 목표
- API 테스트에 규칙 회귀가 드러나는 최소 시나리오를 추가한다.

### 수정 파일 후보
- `[기존 파일 수정]` `tests/test_activity_api.py`

### 선행 조건
- `SK-T09`
- `SK-T10`

### 완료 조건
- 최소 아래 중 1개 이상이 API 레벨로 추가된다.
- 합법 수 위반
- 특수카드 제출 검증
- 라운드 종료 후 점수 반영 검증

### 테스트 방법
- `python -m unittest tests.test_activity_api -v`

### 리스크
- API 테스트가 너무 많은 규칙 디테일을 떠안으면 유지비 증가

---

### Task ID
`SK-T15`

### 목표
- 최종 회귀 검증과 작업 기록 업데이트를 수행한다.

### 수정 파일 후보
- `[기존 문서 수정]` `docs/skull-king/task-checklist.md`
- `[기존 문서 수정 가능]` `docs/skull-king/current-state.md`
- `[기존 문서 수정 가능]` `docs/skull-king/gap-analysis.md`

### 선행 조건
- `SK-T14`

### 완료 조건
- 실행한 테스트 결과가 기록된다.
- 실제 구현 범위와 남은 리스크가 문서에 반영된다.

### 테스트 방법
- `python -m unittest tests.test_card_rules tests.test_activity_api -v`

### 리스크
- 문서가 최신 구현과 다시 어긋날 수 있음

---

## 의존관계 맵
- `SK-T01 -> SK-T02`
- `SK-T02 -> SK-T03, SK-T04, SK-T05`
- `SK-T03, SK-T04, SK-T05 -> SK-T06`
- `SK-T06 -> SK-T07`
- `SK-T07 -> SK-T08`
- `SK-T07 or SK-T08 -> SK-T09`
- `SK-T09 -> SK-T10, SK-T11`
- `SK-T11 -> SK-T12`
- `SK-T01 + SK-T12 -> SK-T13`
- `SK-T09 + SK-T10 -> SK-T14`
- `SK-T14 -> SK-T15`

## 변경 유형 요약
- 기존 코드 수정 중심:
- `SK-T06` ~ `SK-T14`
- 신규 파일 추가 중심:
- `SK-T02`
- 문서/계약 정리 중심:
- `SK-T01`, `SK-T15`
