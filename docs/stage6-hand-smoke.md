# Stage 6 Hand UX — Manual Smoke Test Procedure

## 개요

자동 smoke script (`npm run test:hand:smoke`)가 커버하지 못하는 시각적/환경적 검증 항목을 수동으로 확인하는 절차.

## 실행 환경 전제

| 항목 | 요구 |
|------|------|
| 브라우저 | Chrome 120+ 또는 Firefox 120+ (DevTools 필요) |
| Viewport 폭 | 360px (compact), 768px (standard), 1280px (wide) 각각 테스트 |
| performance-lite | `document.body.classList.toggle("performance-lite")` 로 토글 |
| Grayscale 시뮬레이션 | DevTools → Rendering → Emulate vision deficiency → Achromatopsia |
| Discord Activity | 로컬 개발 서버 또는 Discord Activity iframe |

## 단계별 절차

### 1. Viewport / Safe-Area 검증

**절차:**
1. DevTools에서 viewport를 360px로 설정
2. 게임 뷰 진입 후 hand 영역 확인
3. 카드가 viewport 밖으로 잘리지 않는지 확인
4. 768px, 1280px에서도 반복

**기대:**
- 모든 viewport에서 hand 카드가 완전히 보임
- compact viewport(<768px)에서 카드 크기가 축소됨
- safe-area 침범 없음

### 2. Center Battle Space 확보

**절차:**
1. 게임 뷰에서 hand 영역과 table-wrap 영역 확인
2. hand 카드가 중앙 전투 공간을 가리지 않는지 확인

**기대:**
- hand 영역이 하단에 위치하여 중앙 공간 미침범
- 카드 hover/selected lift가 중앙 공간과 겹치지 않음

### 3. Grayscale 식별성 (R8.4, R8.5)

**절차:**
1. DevTools → Rendering → Emulate vision deficiency → Achromatopsia
2. legal 카드와 blocked 카드를 나란히 비교
3. 7개 상태 각각의 시각적 차이 확인

**기대:**
- legal vs blocked: outline/shadow/opacity 차이로 구분 가능
- 모든 상태가 색상 없이도 최소 2개 비-색상 채널로 구분됨
- `data-state-channels` 속성에 명시된 채널이 시각적으로 확인됨

### 4. Performance-Lite 식별성 (R5.4, R5.5)

**절차:**
1. Console에서 `document.body.classList.add("performance-lite")` 실행
2. 카드 hover, selected, resolving 전이 확인
3. 애니메이션이 단순화되었는지 확인

**기대:**
- transition duration 감소 또는 제거
- box-shadow 복잡도 감소
- 상태 전이가 여전히 식별 가능

### 5. Prefers-Reduced-Motion

**절차:**
1. DevTools → Rendering → Emulate CSS media feature → prefers-reduced-motion: reduce
2. 카드 상태 전이 확인

**기대:**
- 모든 transition/animation이 즉시 적용 (duration: 0 또는 매우 짧음)
- 상태 변화는 여전히 시각적으로 구분 가능

### 6. Legacy 공존 모드 (R6.4, R6.5)

**절차:**
1. 게임 뷰 진입
2. DevTools Elements에서 `#handArea[data-hand-presenter="active"]` 확인
3. Console에서 `window.__skullKingHandPresenterActive__` 확인

**기대:**
- React presenter 활성 시 legacy renderHand가 실행되지 않음
- `data-hand-presenter="active"` 속성이 존재
- `window.__skullKingHandPresenterActive__ === true`

## 결과 기록

| # | 항목 | Pass/Fail | 메모 |
|---|------|-----------|------|
| 1 | Viewport 360px | ☐ | |
| 2 | Viewport 768px | ☐ | |
| 3 | Viewport 1280px | ☐ | |
| 4 | Safe-area | ☐ | |
| 5 | Center battle space | ☐ | |
| 6 | Grayscale legal vs blocked | ☐ | |
| 7 | Grayscale 7-state 구분 | ☐ | |
| 8 | Performance-lite 전이 | ☐ | |
| 9 | Reduced-motion | ☐ | |
| 10 | Legacy 공존 guard | ☐ | |

**테스터:** _______________  
**날짜:** _______________  
**빌드:** _______________
