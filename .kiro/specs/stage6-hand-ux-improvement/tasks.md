# Implementation Plan: Stage 6 Hand UX Improvement

## Overview

Convert the feature design into a series of prompts for a code-generation LLM that will implement each step with incremental progress. Make sure that each prompt builds on the previous prompts, and ends with wiring things together. There should be no hanging or orphaned code that isn't integrated into a previous step. Focus ONLY on tasks that involve writing, modifying, or testing code.

본 작업은 React `Hand_Presenter`(DOM-only, R3F 미사용)와 그 주변 모듈을 `discord_activity_skullking/app/src/hand/` 아래에 신설하고, `selectors/clientState.ts`에 `selectHandViewModel`을 추가하며, `legacy-app.js`에 한 곳의 가드 분기를 더해 hand DOM 책임을 점진적으로 이관한다. 구현 언어는 TypeScript / TSX이고, 테스트는 fast-check 기반 PBT와 vitest 기반 unit/DOM 테스트, 단발 실행 가능한 node smoke script로 구성한다. backend(`api_server.py`, `core/game_engine.py`)는 본 PR에서 변경하지 않는다.

## Tasks

- [x] 1. 테스트 toolchain과 hand 모듈 skeleton 준비
  - [x] 1.1 vitest, fast-check, jsdom, @testing-library/react를 devDependency로 추가하고, `vitest.config.ts`(jsdom env, hand 디렉터리 포함)와 `package.json`의 `test` / `test:hand` / `test:hand:smoke` 스크립트를 추가한다. `tsconfig.json`이 hand 디렉터리를 포함하도록 확인하고 필요한 경우 `types` 항목에 `vitest/globals`를 추가한다.
    - 산출물: `package.json`(scripts/devDeps), `vitest.config.ts`, `tsconfig.json` 보정.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6_

  - [x] 1.2 `discord_activity_skullking/app/src/hand/` 디렉터리에 모듈 skeleton을 생성한다: `deriveHandCardState.ts`, `handInteractionStore.ts`, `handInputController.ts`, `HandCard.tsx`, `HandPresenter.tsx`, `HandPresenterMount.tsx`, `hand.css`, `__tests__/`. 각 파일은 빈 export 또는 TODO export만 포함하고, design의 인터페이스 시그니처(`HandCardState`, `HandCardInput`, `HandInteractionState`, `HandInteractionActions`)를 타입으로만 미리 선언한다.
    - 산출물: 7개 신규 파일과 `__tests__/` 폴더, 타입 선언만 포함.
    - _Requirements: 6.1, 6.4, 6.7, 7.1, 7.3_

- [x] 2. `deriveHandCardState` 순수 함수 구현 및 검증
  - [x] 2.1 `src/hand/deriveHandCardState.ts`에 우선순위 규칙(`legalityKnown=false → blocked` → `isMyTurn=false → blocked` → `isLegal=false → blocked` → `isResolving → resolving` → `isAnyResolving → blocked` → `selected` > `held` > `hovered` > `legal` > `idle`)을 design "State Mapping Table" 그대로 구현한다. 알 수 없는 토큰 입력에 대해 `idle` 반환 + `console.warn` 호출. `HandCardState` enum과 `HandCardInput` 인터페이스를 export.
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 2.3, 2.6, 3.2, 4.3_

  - [x] 2.2 `src/hand/__tests__/hand.property01.test.ts` 작성 (fast-check, numRuns ≥ 200).
    - **Property 1: 단일 상태 + 단일 클래스 매핑** — 임의 `HandCardInput`에 대해 결과가 7개 상태 집합 중 정확히 1개이며, `HandCard`의 클래스 문자열에 `is-state-*` 클래스가 정확히 1개 포함됨을 단정.
    - 첫 줄 주석: `// Feature: stage6-hand-ux-improvement, Property 1: ...`
    - **Validates: Requirements 1.1, 1.5, 7.3, 9.1**

  - [x] 2.3 `src/hand/__tests__/hand.property02.test.ts` 작성.
    - **Property 2: 우선순위 규칙** — 임의 입력에 대해 design의 우선순위 함수와 동치임을 단정.
    - **Validates: Requirements 1.4, 3.2**

  - [x] 2.4 `src/hand/__tests__/hand.property11.test.ts` 작성.
    - **Property 11: legalityKnown=false ⇒ blocked** — `legalityKnown=false`이면 다른 입력에 무관하게 `blocked` 반환을 단정.
    - **Validates: Requirements 2.6**

  - [x] 2.5 `src/hand/__tests__/hand.property12.test.ts` 작성.
    - **Property 12: unknown enum 입력 ⇒ idle + warn** — 정의되지 않은 토큰 입력 시 `idle` 반환 + `console.warn` 1회 이상 호출됨을 단정(`vi.spyOn(console, "warn")`).
    - **Validates: Requirements 1.6**

  - [x] 2.6 `src/hand/__tests__/deriveHandCardState.unit.test.ts` 작성.
    - State Mapping Table의 각 행에 대한 example assertion(7개 상태 + blocked fallback 케이스).
    - _Requirements: 1.1, 1.4, 1.5, 2.3, 2.6, 3.2, 4.3, 4.5_

- [x] 3. `HandInteractionStore` 구현 및 검증
  - [x] 3.1 `src/hand/handInteractionStore.ts`에 `useSyncExternalStore` 기반 store를 구현한다. `HandInteractionState`(`hoveredIndex`, `selectedIndex`, `heldIndex`, `resolvingIndex`, `resolvingStartedAt`)와 `HandInteractionActions`(`setHovered`, `setSelected`, `setHeld`, `beginResolving`, `endResolving`, `reset`)를 export. `setSelected(index)`는 단일성 보장, `beginResolving`은 hovered/held/selected 자동 클리어, `setHeld(null)`은 selected 보존.
    - _Requirements: 1.3, 4.5, 4.6, 4.7, 4.9_

  - [x] 3.2 `src/hand/__tests__/hand.property03.test.ts` 작성.
    - **Property 3: 단일-selected store invariant** — 임의 `setSelected` 시퀀스 후 `selectedIndex`가 단일 정수 또는 `null`임을 단정.
    - **Validates: Requirements 1.3, 4.7**

  - [x] 3.3 `src/hand/__tests__/hand.property08.test.ts` 작성.
    - **Property 8: held round-trip 복원** — 임의 진입 직전 store 상태에서 `setHeld(i) → setHeld(null)` 후 store가 `setHeld(i)` 직전과 등가임을 단정.
    - **Validates: Requirements 4.6**

  - [x] 3.4 `src/hand/__tests__/hand.property09.test.ts` 작성.
    - **Property 9: selected toggle invariant** — 동일 인덱스 `i`에 대한 `setSelected(i)` n회 호출 후 `selectedIndex`가 짝수면 시작값, 홀수면 `i`임을 단정.
    - **Validates: Requirements 4.8**

  - [x] 3.5 `src/hand/__tests__/hand.property10.test.ts` 작성.
    - **Property 10: resolving 후 reject/timeout 복원** — `beginResolving(i, t) → endResolving("reject"|"timeout")` 후 store가 `beginResolving` 직전과 등가이고, hand 카드 보유 배열이 변하지 않음을 단정.
    - **Validates: Requirements 4.9**

- [x] 4. `selectHandViewModel` selector와 환경 hook 추가
  - [x] 4.1 `src/selectors/clientState.ts`에 `HandCardModel`, `HandViewModel` 인터페이스와 `selectHandViewModel(state)` 함수를 추가한다. backend `legal_indexes`가 `Array.isArray`이고 `myTurn`을 가진 시점부터만 `legalityKnown=true`. 신규 export는 selector 1건만 추가하여 legacyBridge truth surface는 변경하지 않는다.
    - _Requirements: 2.1, 2.6, 6.2, 6.6, 6.7_

  - [x] 4.2 `src/hand/useEnvironmentFlags.ts`에 `compactViewport`(360 ≤ width < 768)와 `performanceLite`(`document.body.classList.contains("performance-lite")`)를 도출하는 React hook을 구현한다. `resize` 이벤트 + `MutationObserver`로 갱신.
    - _Requirements: 2.5, 5.2, 5.3, 5.4, 5.5, 8.4_

  - [x] 4.3 `src/hand/__tests__/selectHandViewModel.test.ts` 작성.
    - 빈 snapshot, `legal_indexes` 미수신, viewer 비-자기차례, 정상 케이스에 대한 example assertion.
    - _Requirements: 2.1, 2.6_

- [x] 5. Checkpoint - 상태 모델 검증
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. `handInputController` 구현 및 검증
  - [x] 6.1 `src/hand/handInputController.ts`에 pointer/touch 이벤트 → store action 매핑 함수를 구현한다. 임계값: hover dwell 50ms 진입 + 100ms 적용, mobile tap/long-press 350ms 경계, blocked feedback 자동 소실 300~1000ms, play request 5초 timeout. blocked 카드는 모든 commit 입력에서 조기 반환. resolving 동안 추가 입력 차단. drag-cancel은 직전 상태로 복원.
    - DOM을 직접 mutating하지 않고 store action만 호출.
    - _Requirements: 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 6.2 `src/hand/__tests__/hand.property04.test.ts` 작성.
    - **Property 4: blocked 카드 입력 차단 + play 요청 0** — backend가 blocked로 평가한 카드에 대한 임의 입력 시퀀스 후 store에 해당 인덱스가 어디에도 들어가지 않고, mock `requestPlay` 호출 횟수가 0임을 단정.
    - **Validates: Requirements 2.3, 3.2, 3.3, 4.3, 9.3**

  - [x] 6.3 `src/hand/__tests__/hand.property05.test.ts` 작성.
    - **Property 5: legal commit 단일 play + resolving 추가 입력 차단** — legal 카드에 commit 액션 N≥1회 + resolving 동안 추가 입력에 대해 mock `requestPlay` 호출이 정확히 1회임을 단정.
    - **Validates: Requirements 3.4, 4.4, 4.5, 9.2**

  - [x] 6.4 `src/hand/__tests__/hand.property06.test.ts` 작성.
    - **Property 6: drag-cancel round-trip** — drag-start → 임의 pointermove → drag-cancel 시퀀스 후 mock `requestPlay` 호출 0회, store 상태가 drag-start 직전과 등가, derive 결과가 `resolving`인 카드 수 0임을 단정.
    - **Validates: Requirements 3.7**

  - [x] 6.5 `src/hand/__tests__/hand.property07.test.ts` 작성.
    - **Property 7: 다른 카드 derive 결과 독립성** — 자기 카드의 client interaction 입력을 임의 변화시켜도 다른 인덱스의 derive 결과가 변하지 않음을 단정.
    - **Validates: Requirements 3.8**

  - [x] 6.6 `src/hand/__tests__/handInputController.unit.test.ts` 작성 (`vi.useFakeTimers`).
    - 50ms hover dwell, 350ms mobile tap/long-press 경계, 300~1000ms blocked 토스트 자동 소실, 5초 timeout 복원에 대한 example assertion.
    - _Requirements: 2.4, 3.1, 3.5, 4.1, 4.2, 4.3, 9.4_

- [x] 7. `hand.css` 모듈 작성
  - [x] 7.1 `src/hand/hand.css`에 7개 상태 클래스(`is-state-idle`, `is-state-legal`, `is-state-blocked`, `is-state-hovered`, `is-state-selected`, `is-state-held`, `is-state-resolving`)를 1:1 매핑으로 정의한다. 각 상태는 색상 외 비-색상 채널(`outline`, `box-shadow`, `transform: translateY`, `opacity` 중 둘 이상)에서 식별 가능한 차이를 가지고, compact viewport(<768px), `body.performance-lite`, `prefers-reduced-motion` 분기를 동일 파일 안에서만 처리한다. 각 클래스에 `data-state-channels="..."` 토큰을 mirror 속성으로 표시(테스트 결정성 확보). 전역 `styles.css`에는 신규 hand selector 0건 추가.
    - _Requirements: 2.2, 2.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 7.2 `src/hand/__tests__/hand.css.tokens.test.ts` 작성.
    - 각 상태 클래스 적용 시 `data-state-channels` 토큰이 비-색상 채널 2개 이상을 포함하고, `legal` ↔ `blocked` 간 토큰 차이가 최소 1개 채널 이상임을 단정.
    - _Requirements: 2.2, 8.3, 8.4, 8.5_

- [ ] 8. `HandCard`와 `HandPresenter` 컴포넌트 구현
  - [x] 8.1 `src/hand/HandCard.tsx`를 구현한다. props로 `HandCardModel`과 derive된 `HandCardState`를 받아 단일 `is-state-*` 클래스와 `data-state-channels` 속성을 가진 카드 노드를 렌더한다. pointer/touch 이벤트는 `handInputController` 함수에 위임.
    - _Requirements: 1.5, 3.6, 8.1, 8.2, 8.3_

  - [x] 8.2 `src/hand/HandPresenter.tsx`를 구현한다. `useReactUiState()` + `selectHandViewModel`로 viewModel 구독, `useHandInteractionStore()` + `useEnvironmentFlags()`로 client 상태 구독, 각 카드에 대해 `deriveHandCardState`를 호출해 `HandCard`를 렌더한다. `useDomTarget("#handArea")`로 portal target을 얻어 `createPortal`로 마운트하고, 마운트/언마운트 시점에 `target.dataset.handPresenter = "active"` 설정/해제와 `window.__skullKingHandPresenterActive__` 토글을 수행한다. `hand.css`를 import.
    - _Requirements: 1.1, 1.2, 6.1, 6.2, 6.4, 6.5_

  - [x] 8.3 `src/hand/HandPresenterMount.tsx`를 구현한다. `App.tsx`에서 한 줄로 마운트 가능한 thin wrapper로, `currentView === "game"`일 때만 `<HandPresenter/>`를 렌더한다.
    - _Requirements: 6.1_

  - [-] 8.4 `src/hand/__tests__/HandPresenter.dom.test.tsx` 작성 (`@testing-library/react` + jsdom).
    - 33ms 이내 commit phase 갱신(R1.2), `selected` 상태 카드는 항상 0~1개(R1.3), portal target에 `data-hand-presenter="active"` 마운트 후 unmount 시 해제, blocked 카드 click → play 호출 0회 + 비침입 시각 신호 표시 후 1000ms 이내 자동 소실(R2.4, R4.3).
    - _Requirements: 1.2, 1.3, 2.4, 4.3, 6.5_

- [ ] 9. App 마운트와 legacy 가드 연결
  - [-] 9.1 `App.tsx`(또는 `App.jsx`)에 `<HandPresenterMount/>` 한 줄을 `currentView === "game"` 분기에 추가한다. hand 관련 LOC가 baseline 대비 증가하지 않도록 wrapper 한 줄만 사용하고, 기존 hand 관련 imperative 코드를 제거하지 않는다(공존 모드).
    - _Requirements: 6.1, 6.4_

  - [ ] 9.2 `discord_activity_skullking/app/legacy-app.js`의 `renderHand` 진입부에 `if (window.__skullKingHandPresenterActive__ || document.getElementById("handArea")?.dataset.handPresenter === "active") return;` 가드 분기 1개를 추가한다. 추가 분기는 기존 imperative DOM 쿼리를 0건 신설하지 않고 1회 lookup만 사용한다.
    - _Requirements: 6.4, 6.5, 6.7_

- [~] 10. Checkpoint - presenter ↔ legacy 공존 통합 검증
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Smoke test 산출물
  - [~] 11.1 `scripts/hand-smoke.mjs`를 작성한다. 단발 실행으로 다음을 단정한다: (a) 7개 상태 매핑 한 사이클(`deriveHandCardState`에 7개 입력 1건씩) → 각 결과가 정확히 1개 상태, (b) legal 입력 1건 + commit → `requestPlay` mock 1회 호출, (c) blocked 입력 임의 시퀀스 → `requestPlay` mock 0회 호출, (d) fake timer 모바일 350ms 미만 탭 → selected 전이 + `requestPlay` 0회. 실패 시 stderr에 식별자/사유 출력 + 비-0 종료 코드. `package.json`에 `npm run test:hand:smoke` 스크립트로 노출(1.1에서 추가).
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [~] 11.2 `docs/stage6-hand-smoke.md`에 README 형태 수동 절차를 작성한다. 실행 환경 전제(브라우저, viewport 폭, performance-lite 토글, grayscale 시뮬레이션), 단계별 절차, 단계별 기대, pass/fail 판단 기준을 모두 포함하고, 자동 smoke가 다루지 않는 viewport/safe-area/center battle space/grayscale 식별성/performance-lite 식별성 항목을 다룬다. 결과 기록란(체크박스 + 메모)을 포함.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 8.4, 8.5, 9.5, 9.6_

  - [~] 11.3 `scripts/hand-guardrail-check.mjs`를 작성한다. 다음을 정적 grep으로 검사한다: (a) `styles.css`의 hand 관련 selector 개수가 baseline `.kiro/specs/stage6-hand-ux-improvement/baseline.json`과 동일, (b) `shell.html` 내 hand 토큰 정적 markup 개수가 baseline과 동일, (c) `src/hand/` 신규 코드에 `document.querySelector` / `getElementById` / `getElementsByClassName` / `querySelectorAll` 추가 0건. 실패 시 위반 항목과 측정값을 stderr에 기록 + 비-0 종료 코드. baseline 파일은 본 task에서 함께 생성한다.
    - _Requirements: 6.1, 6.2, 6.3, 6.7, 6.8, 7.1, 7.4, 7.5_

- [~] 12. Final checkpoint - 전체 테스트 + smoke 통과 확인
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- `*` 표시 sub-task는 optional이며 MVP 단축을 위해 건너뛸 수 있다. 단, Property 1~12 sub-task는 design의 correctness properties 1:1 traceability를 위해 함께 실행하는 것을 권장한다.
- 모든 task는 design 문서와 requirements 문서의 sub-clause(예: 2.3, 4.5)에 직접 mapping된다. 구현 시 각 sub-task의 `_Requirements:` 또는 `Validates:` 라인을 traceability matrix로 검증할 수 있다.
- 1.2 skeleton 단계에서 타입과 export 시그니처를 먼저 고정하여 후속 task가 import 사이클 없이 병렬 진행되도록 했다.
- backend Card_Legality는 본 PR에서 변경하지 않는다(R6.6, R10.3). 합법성은 `legal_indexes`만 단일 출처로 사용한다.
- `hand.css`는 `HandPresenter.tsx`에서 import하여 esbuild가 동일 bundle로 처리하도록 한다(전역 `styles.css`에 hand 규칙 0건 추가, R7.1).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "3.1", "4.1", "4.2"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "3.2", "3.3", "3.4", "3.5", "4.3", "7.1"] },
    { "id": 4, "tasks": ["6.1", "7.2"] },
    { "id": 5, "tasks": ["6.2", "6.3", "6.4", "6.5", "6.6"] },
    { "id": 6, "tasks": ["8.1"] },
    { "id": 7, "tasks": ["8.2"] },
    { "id": 8, "tasks": ["8.3"] },
    { "id": 9, "tasks": ["8.4", "9.1", "9.2"] },
    { "id": 10, "tasks": ["11.1", "11.2", "11.3"] }
  ]
}
```
