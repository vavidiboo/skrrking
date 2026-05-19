# Requirements Document

## Introduction

본 스펙은 로드맵 Stage 6 "Hand UX Improvement"의 요구사항을 정의한다. 목표는 현재 `legacy-app.js`와 `shell.html`이 공동으로 책임지고 있는 Hand 영역을 더 강한 tactical interaction surface로 끌어올리되, `docs/codex.md`의 마이그레이션 가드레일과 `docs/architecture.md`의 점진적 컴포넌트화/상태 정규화 원칙, `docs/discord-activity-ux.md`의 compact viewport 및 safe-area 제약, `docs/uiux-direction.md`의 center battle space 보호 원칙, `docs/tech-debt.md`의 부채 우선순위를 모두 위반하지 않는 범위에서 진행하는 것이다.

본 작업은 Discord Activity 안에서 실행되는 desktop hover 사용자와 mobile touch 사용자 모두를 대상으로 하며, 동시에 `legacy-app.js` monolith와 `shell.html` 의존성을 더 키우지 않는다는 개발팀 측 마이그레이션 제약을 함께 만족시켜야 한다. 풀 리라이트, HUD 전면 재작성, Stage 9 수준의 고급 효과 확장, Python backend authority 변경은 본 스펙의 비범위(out of scope)이다.

## Glossary

- **Hand_Area**: 화면 하단에 위치한 플레이어 손패 시각/상호작용 영역. 카드 fan layout, 상태 클래스, hover/drag/tap/hold 입력을 모두 포함하는 단일 인터랙션 surface.
- **Hand_Card**: Hand_Area 내부의 개별 카드 엘리먼트. 본 스펙의 상태 언어(`legal`, `blocked`, `selected`, `hovered`, `held`, `idle`, `resolving`)를 가지는 단위.
- **Hand_Presenter**: Hand_Area 렌더링과 상태 클래스 조합 책임을 가지는 React 컴포넌트 경계. 본 스펙으로 신설 또는 분리되며, `App.tsx`에 hand 관련 로직을 더 누적하지 않기 위한 presenter 계층.
- **Legacy_Runtime**: `discord_activity_skullking/app/legacy-app.js`. 현재 networking, DOM mutation, hand drag, dialog, HUD를 함께 소유하고 있는 모놀리식 imperative controller.
- **Legacy_Bridge**: `discord_activity_skullking/app/src/legacyBridge.js`. React shell이 읽는 임시 snapshot adapter.
- **Shell_Fragments**: `discord_activity_skullking/app/src/shell.html`. 현재 home, lobby, game 영역의 markup source로 남아 있는 HTML fragment 집합.
- **Client_State**: `legacyBridge`가 노출하는 React-facing snapshot 및 향후 typed store가 합쳐진 클라이언트측 읽기용 상태. 본 스펙에서는 hand 관련 derived 값을 우선 읽는 대상.
- **Card_Legality**: 백엔드(Python `api_server.py` / `core/game_engine.py`)가 결정한, 현재 trick에서 어떤 Hand_Card가 합법적으로 낼 수 있는지 여부. 클라이언트는 이를 권위적 출처로 간주한다.
- **Center_Battle_Space**: 화면 중앙의 trick zone 및 board reaction 공간. `docs/uiux-direction.md`에 따라 영구 패널이나 큰 오버레이로 가려지면 안 되는 영역.
- **Compact_Viewport**: Discord Activity가 제공하는 좁은 mobile / 작은 desktop 패널 뷰포트. 본 스펙에서는 가로 360 CSS 픽셀 이상 768 CSS 픽셀 미만 범위를 기본 정의로 사용한다. dynamic viewport unit, safe-area inset, thumb-reachable 영역 제약을 받는다.
- **Safe_Area**: 모바일 system UI / Discord chrome으로 인한 회피 영역. Hand_Area 하단과 액션 컨트롤은 이 영역을 침범하지 않아야 한다.
- **Performance_Lite_Mode**: `docs/tech-debt.md` 및 `docs/discord-activity-ux.md`에서 언급된 저사양/모바일 fallback 동작 경로. 효과 비용을 줄여야 하는 모드.
- **Smoke_Test**: 본 스펙에서 도입하는 최소 수준의 자동화 또는 반자동 검증 포인트. Hand 상태 클래스 매핑, legal/blocked 분기, 모바일 입력 차단 동작을 빠르게 확인하는 수준을 말한다.

### Hand State Language (정식 정의)

본 스펙은 Hand_Card에 대해 다음 7개 상태를 표준 상태 언어로 고정한다. UI 클래스, 시각 피드백, 입력 처리 분기 모두 이 언어를 기준으로 통일된다.

- **idle**: 사용자 입력이 없고, 현재 turn에서 합법이지만 아직 강조되지 않은 기본 상태.
- **legal**: 현재 turn에서 백엔드가 합법으로 판정했고, 사용자에게 "낼 수 있음"이 시각적으로 읽혀야 하는 상태.
- **blocked**: 현재 turn에서 백엔드가 비합법으로 판정했거나, 사용자가 자기 차례가 아닌 등 입력이 차단된 상태.
- **hovered**: desktop pointer hover로 미리보기 단계에 들어간 상태. mobile에서는 사용되지 않는다.
- **selected**: 사용자가 tap 또는 click으로 선택을 확정한 상태. 모바일 confirm flow의 사전 단계.
- **held**: 모바일 long-press inspect 또는 desktop pointer down 유지 단계. 카드 정보 강조 단계이며 즉시 play를 의미하지 않는다.
- **resolving**: 카드가 trick으로 이동 중이거나 백엔드 응답을 기다리는 중간 상태. 추가 입력이 잠겨 있어야 한다.

## Requirements

### Requirement 1: Hand 상태 언어의 일관된 적용

**User Story:** As a Discord Activity 플레이어, I want Hand_Area의 모든 카드가 동일한 상태 언어로 시각적으로 구분되기를 원한다, so that 어떤 카드가 낼 수 있는 카드인지, 내가 선택 중인지, 시스템이 응답을 처리 중인지를 한눈에 읽을 수 있다.

#### Acceptance Criteria

1. THE Hand_Presenter SHALL 각 Hand_Card에 대해 `idle`, `legal`, `blocked`, `hovered`, `selected`, `held`, `resolving` 일곱 가지 상태 중 정확히 하나만을, 외부에서 주입되는 단일 상태 입력(single source of truth)으로부터 직접 도출하며, 동일 Hand_Card가 동시에 두 개 이상의 상태를 보유한 결과를 산출하지 않는다.
2. WHEN 한 Hand_Card의 상태 입력이 `legal`에서 `blocked`로 전이될 때, THE Hand_Presenter SHALL 전이 입력을 수신한 시점부터 33ms 이내에 해당 Hand_Card의 시각 피드백을 새 상태에 대응하는 표현으로 갱신한다.
3. WHEN 사용자가 한 Hand_Card를 `selected` 상태로 만들 때, THE Hand_Presenter SHALL 동일 갱신 사이클 내에 직전까지 `selected`였던 다른 모든 Hand_Card를 비-`selected` 상태로 되돌려, Hand_Area 전체에서 `selected` 상태인 Hand_Card 수가 0 또는 1을 유지하도록 보장한다.
4. IF Hand_Presenter가 동일 Hand_Card에 대해 두 개 이상의 상태가 동시에 활성으로 표시된 입력을 수신한다면, THEN THE Hand_Presenter SHALL 우선순위 규칙(`resolving` > `blocked` > `selected` > `held` > `hovered` > `legal` > `idle`)에 따라 가장 높은 우선순위 상태 정확히 하나만을 활성 상태로 채택하고, 나머지 상태는 비활성으로 정규화한다.
5. THE Hand_Presenter SHALL Hand_Card에 적용되는 상태 클래스 명명을 본 스펙에서 정의한 일곱 개 상태 이름과 1:1로 매핑하며, 동일 Hand_Card 요소에 두 개 이상의 상태 클래스가 동시에 부여된 결과를 산출하지 않는다.
6. IF Hand_Presenter가 정의된 일곱 상태 이름에 속하지 않는 상태 값을 입력으로 수신한다면, THEN THE Hand_Presenter SHALL 해당 Hand_Card를 `idle` 상태로 도출하고 비정상 입력 발생 사실을 호출자에게 식별 가능한 형태로 표시한다.

### Requirement 2: Legal vs Blocked 시각 피드백 강화

**User Story:** As a Discord Activity 플레이어, I want 현재 trick에서 낼 수 있는 카드와 낼 수 없는 카드의 차이가 즉시 읽히기를 원한다, so that 잘못된 선택을 시도하기 전에 결정을 빠르게 내릴 수 있다.

#### Acceptance Criteria

1. WHEN 백엔드가 새로운 Card_Legality 정보를 보내올 때, THE Hand_Presenter SHALL Hand_Area의 모든 Hand_Card에 대해 `legal` 또는 `blocked` 상태를 200ms 이내에 다시 계산하여 화면에 반영한다.
2. THE Hand_Presenter SHALL `legal` 상태의 Hand_Card와 `blocked` 상태의 Hand_Card를 색상에 더해 최소 한 가지 비-색상 채널(테두리, 밝기, 위치, 그림자, outline 중 하나 이상)에서 식별 가능한 차이로 구분하며, 두 상태 간 해당 채널 값은 시각적으로 변별 가능한 수준으로 다르게 적용한다.
3. WHILE Hand_Card가 `blocked` 상태일 때, THE Hand_Presenter SHALL 해당 카드에 대해 `selected` 또는 `held` 상태로의 전이가 발생하지 않도록 클릭, 탭, 키보드, 드래그를 포함한 모든 입력 처리에서 제외한다.
4. WHEN 사용자가 `blocked` 상태의 Hand_Card를 클릭하거나 탭할 때, THE Hand_Presenter SHALL 해당 카드를 play하지 않고, Hand_Area 내부에 모달과 오디오를 사용하지 않는 비-침입적 시각 신호를 표시하며, 해당 신호를 표시 시작 후 300ms 이상 1000ms 이하 시간 내에 자동으로 소실시킨다.
5. THE Hand_Presenter SHALL `legal`과 `blocked`의 비-색상 채널 시각 차이를 가로 폭 360 CSS 픽셀 이상 1920 CSS 픽셀 이하의 모든 Compact_Viewport에서 동일하게 유지한다.
6. IF 백엔드로부터 Card_Legality 정보가 도착하지 않았거나 유효하지 않을 때, THEN THE Hand_Presenter SHALL 모든 Hand_Card를 `blocked` 상태와 동일한 비-색상 채널 시각으로 표시하고 입력 처리에서 제외한다.

### Requirement 3: Desktop Hover, Drag, Selected Affordance 강화

**User Story:** As a Discord desktop 플레이어, I want hover, drag, selected 단계에서 카드가 시각적으로 명확하게 반응하기를 원한다, so that 마우스 입력 기반 결정 흐름이 자연스럽고 만족스럽게 느껴진다.

#### Acceptance Criteria

1. WHEN desktop pointer가 `legal` 상태인 Hand_Card의 hit area 안으로 진입한 후 50ms 이상 연속해서 머무를 때, THE Hand_Presenter SHALL 100ms 이내에 해당 카드를 `hovered` 상태로 전이시키고, 기존 visual language(navy/brass/sea glow) 안에서 lift 변위와 glow 강도를 포함한 두 개 이상의 시각 채널로 hover affordance를 표시한다.
2. WHEN desktop pointer가 `blocked` 상태인 Hand_Card 위에 있을 때, THE Hand_Presenter SHALL 해당 카드를 `hovered` 상태로 전이시키지 않으며, lift 또는 glow 형태의 hover affordance를 적용하지 않는다.
3. IF desktop pointer가 `blocked` 상태인 Hand_Card 위에서 click 또는 drag-commit 입력이 발생한다면, THEN THE Hand_Presenter SHALL 해당 입력을 play 의사로 처리하지 않고 백엔드로 play request를 전송하지 않으며, 거부를 나타내는 시각 피드백을 100ms 이내에 표시한다.
4. WHEN 사용자가 desktop pointer로 `legal` Hand_Card를 click 또는 drag-commit으로 play 의사를 확정할 때, THE Hand_Presenter SHALL 100ms 이내에 해당 카드를 `resolving` 상태로 표시하고, 동일 play 의사에 대해 단일 play request만 백엔드로 전송하며, 백엔드 응답이 도착하기 전까지 발생하는 추가 click 또는 drag-commit 입력을 무시한다.
5. IF `resolving` 상태인 Hand_Card에 대한 play request가 5초 이내에 백엔드 성공 응답을 받지 못하거나 거부 응답을 받는다면, THEN THE Hand_Presenter SHALL 해당 카드를 직전 상태(`legal` 또는 `selected`)로 복원하고 실패 사유를 나타내는 시각 피드백을 표시한다.
6. WHILE 한 Hand_Card가 `selected` 상태일 때, THE Hand_Presenter SHALL desktop에서 해당 selected 시각 피드백을 hover 시각 피드백과 최소 두 개 이상의 시각 채널(예: lift 변위, glow 색상, outline 중 둘 이상)에서 구분되는 형태로 유지한다.
7. WHEN 사용자가 `legal` Hand_Card에 대한 drag를 drag-commit 없이 취소(drag-cancel)할 때, THE Hand_Presenter SHALL 해당 카드를 직전의 `legal` 또는 `selected` 상태로 복원하고 `resolving` 상태로 전이시키지 않으며 백엔드로 play request를 전송하지 않는다.
8. WHERE drag 기반 confirm 경로가 사용 가능한 desktop 환경, THE Hand_Presenter SHALL drag 도중 대상 Hand_Card의 위치가 변경되더라도 다른 Hand_Card의 `legal` / `blocked` 상태 표시와 화면상의 layout 위치를 변경하지 않는다.

### Requirement 4: Mobile Tap Focus, Long-Press Inspect, Accidental Play Protection

**User Story:** As a Discord mobile 플레이어, I want 탭으로 카드를 먼저 선택한 뒤 확정 액션으로 play가 되도록 하기를 원한다, so that 좁은 뷰포트와 엄지 입력 환경에서 의도하지 않은 카드를 실수로 내는 일이 줄어든다.

#### Acceptance Criteria

1. WHEN 모바일 사용자가 `legal` Hand_Card를 350ms 미만 동안 누른 후 손가락을 뗄 때, THE Hand_Presenter SHALL 해당 카드를 `selected` 상태로 전이시키고, play 요청을 백엔드로 전송하지 않는다.
2. WHEN 모바일 사용자가 `legal` Hand_Card를 350ms 이상 연속으로 누르고 있을 때, THE Hand_Presenter SHALL 해당 카드를 `held` 상태로 전이시키고 카드 정보를 강조하는 inspect 시각 피드백을 표시한다.
3. IF 모바일 사용자가 `blocked` Hand_Card에 탭 또는 long-press 입력을 가한다면, THEN THE Hand_Presenter SHALL `selected` 또는 `held` 전이를 발생시키지 않고, 1000ms 이내에 자동으로 사라지는 비-침입적 시각 차단 피드백만 표시하며, 모달이나 전체화면 차단 UI는 띄우지 않는다.
4. WHEN 한 Hand_Card가 `selected` 상태이고 사용자가 thumb-reachable 영역의 confirm 액션을 트리거할 때, THE Hand_Presenter SHALL 해당 카드에 대해 단 한 번의 play 요청만 백엔드로 전송하고 카드를 `resolving` 상태로 전이시킨다.
5. WHILE Hand_Card가 `resolving` 상태일 때, THE Hand_Presenter SHALL 동일 또는 다른 Hand_Card에 대한 추가 탭, 추가 long-press, 추가 드래그로 발생하는 모든 추가 play 요청을 차단한다.
6. WHEN `held` 상태인 Hand_Card에서 pointer 또는 touch가 카드 hit-area 바깥으로 이동하거나 시스템 cancel 이벤트로 종료될 때, THE Hand_Presenter SHALL 해당 카드를 `held`에서 진입 직전 상태(`legal` 또는 `selected`)로 되돌리고 inspect 시각 피드백을 제거한다.
7. WHEN 한 Hand_Card가 `selected` 상태인 동안 사용자가 다른 `legal` Hand_Card를 350ms 미만으로 탭할 때, THE Hand_Presenter SHALL 이전 카드의 `selected` 상태를 해제하여 `legal`로 되돌리고 새 카드를 `selected` 상태로 전이시키며, 두 카드 어느 쪽에 대해서도 play 요청을 전송하지 않는다.
8. WHEN `selected` 상태인 Hand_Card를 사용자가 동일 카드에 대해 350ms 미만으로 다시 탭할 때, THE Hand_Presenter SHALL 해당 카드를 `selected`에서 `legal`로 되돌리고 play 요청을 전송하지 않는다.
9. IF `resolving` 상태인 Hand_Card에 대한 play 요청이 백엔드 실패 응답 또는 응답 타임아웃으로 종료된다면, THEN THE Hand_Presenter SHALL 해당 카드를 `resolving`에서 진입 직전의 `legal` 상태로 복원하고, 손패 보유는 유지한 상태로 실패 사유를 나타내는 비-침입적 오류 피드백을 표시한다.

### Requirement 5: Compact Viewport, Safe-Area, Center Battle Space 보호

**User Story:** As a Discord Activity 플레이어, I want Hand_Area가 어떤 뷰포트에서도 시스템 UI나 Discord chrome과 충돌하지 않고 중앙 battle 영역을 가리지 않기를 원한다, so that 게임이 임베디드 웹페이지처럼 보이지 않고 일관된 game-app 경험을 유지한다.

#### Acceptance Criteria

1. THE Hand_Area SHALL `Safe_Area` 하단 inset(`env(safe-area-inset-bottom)` 또는 동등한 값)과 자체 콘텐츠 박스가 1 CSS 픽셀이라도 겹치지 않도록 하단 패딩을 적용한다.
2. WHILE Compact_Viewport(가로 360 CSS 픽셀 이상 768 CSS 픽셀 미만) 환경일 때, THE Hand_Area SHALL Center_Battle_Space의 수직 중앙 30% 높이 영역을 어떤 단일 시점 기준으로도 연속 2초를 초과하여 가리지 않는다.
3. WHEN 뷰포트 크기가 desktop 패널 리사이즈 또는 모바일 회전으로 변할 때, THE Hand_Area SHALL 해당 변경 시작 후 300ms 이내에 Hand_Card의 fan layout, hit target 크기, 상태 시각 피드백 정확도를 유지한 채 새 폭에 맞게 재배치를 완료한다.
4. WHILE Compact_Viewport 환경일 때, THE Hand_Area SHALL confirm 트리거의 hit target 중심점이 뷰포트 높이 60% 이상 100% 이하 구간(thumb-reachable 영역)에 위치하도록 배치한다.
5. THE Hand_Area SHALL Hand_Card의 시각/상호작용 영역을 dynamic viewport unit(`dvh`/`svh` 또는 동등한 단위)을 기반으로 계산하여, virtual keyboard 또는 시스템 UI 변동 시 해당 영역이 clipping이나 overflow 없이 100% 가시 상태로 유지되도록 한다.
6. THE Hand_Area SHALL Center_Battle_Space 영역에 화면 면적 25%를 초과하는 오버레이나 영구 패널을 연속 2초를 초과하여 노출시키지 않는다.

### Requirement 6: Legacy 마이그레이션 가드레일 준수 (비파괴 공존)

**User Story:** As a 마이그레이션 가드레일을 지키는 개발 팀원, I want Hand UX 개선 작업이 `legacy-app.js`와 `shell.html`의 의존성을 더 키우지 않으면서 점진적으로 React presenter로 책임을 옮겨가기를 원한다, so that 풀 리라이트 없이도 Stage 7 이후 작업이 더 어려워지지 않는다.

#### Acceptance Criteria

1. THE Hand_Presenter SHALL React 컴포넌트 경계 안에서 정의되며, Stage 6 변경 이후 `App.tsx` 또는 `App.jsx` 단일 파일의 hand 관련 LOC(주석/공백 제외, hand/Hand_Card/Hand_Presenter 식별자를 포함하는 라인 기준)가 Stage 6 시작 시점 baseline 대비 0줄 이상 증가하지 않아야 한다.
2. WHEN Hand_Presenter가 Hand_Card 데이터를 읽을 때, THE Hand_Presenter SHALL Client_State(typed selector 또는 legacyBridge snapshot)를 단일 출처로 사용하며, 동일 Hand_Card 정보를 얻기 위한 imperative DOM 쿼리(`document.querySelector`, `getElementById`, `getElementsByClassName`, `querySelectorAll` 등)를 Stage 6 신규 코드에서 0건 추가하지 않아야 한다.
3. THE Stage 6 변경 SHALL `shell.html` Shell_Fragments 내 hand 관련 영구 markup(클래스명 또는 id에 `hand` 토큰을 포함하는 정적 엘리먼트)의 개수를 Stage 6 시작 시점 baseline 대비 0개 이상 증가시키지 않아야 한다.
4. THE Stage 6 변경 SHALL Legacy_Runtime이 보유한 hand 관련 직접 DOM 책임 중 최소 1건 이상을 React Hand_Presenter로 이관하거나 동등한 추상화 경계(예: 단일 진입 함수, presenter 인터페이스) 뒤로 캡슐화하여, 이관 전/후 책임 항목을 1개 이상 명시적으로 식별 가능해야 한다.
5. WHILE Hand_Presenter가 활성 상태(마운트되어 렌더 사이클에 참여 중)인 동안, THE Legacy_Runtime SHALL 동일 Hand_Card DOM 노드에 대한 상태 클래스 또는 인라인 스타일 토글을 동일 애니메이션 프레임(16ms 이내)에서 0회 수행해야 한다.
6. THE Stage 6 변경 SHALL Python backend(`api_server.py`, `core/game_engine.py`) 내 Card_Legality 결정 코드 경로(함수 시그니처, 반환 규약, 권위 판정 로직)를 0건 수정해야 하며, backend 응답 스키마의 legality 관련 필드를 0개 추가/제거/의미 변경하지 않아야 한다.
7. THE Stage 6 변경 SHALL Legacy_Bridge가 노출하는 hand 관련 truth source 표면(공개 함수/속성 개수)을 Stage 6 시작 시점 baseline 대비 0개 이상 증가시키지 않아야 하며, 신규 hand 상태 값은 Client_State 측 selector에서 도출되어야 한다.
8. IF Stage 6 변경 후 검증 시 위 항목 중 어느 하나라도 위반(예: hand 관련 LOC 증가, 신규 imperative DOM 쿼리 발견, 동일 프레임 이중 토글 발생, backend Card_Legality 코드 변경)이 발견된다면, THEN THE 검증_프로세스 SHALL 해당 위반 항목과 측정값을 식별하는 실패 표시를 산출하고 Stage 6 변경을 미승인 상태로 유지해야 한다.

### Requirement 7: CSS 분리 및 책임 정돈

**User Story:** As a 마이그레이션 가드레일을 지키는 개발 팀원, I want hand 관련 CSS를 전역 `styles.css`의 큰 덩어리에서 분리해 hand feature 단위로 정돈되기를 원한다, so that 향후 Stage 7 이후의 효과/렌더링 작업과 충돌하지 않으며 visual regression 위험을 줄인다.

#### Acceptance Criteria

1. WHEN Stage 6 변경이 hand 관련 신규 CSS 규칙을 도입할 때, THE Stage 6 변경 SHALL 해당 규칙을 hand feature 디렉터리 하위의 단일 CSS 파일(또는 모듈) 안에 100% 작성하며, 전역 `styles.css`에는 신규 hand 규칙을 0건 추가하지 않는다.
2. IF 본 스펙으로 새로 도입된 상태 클래스(`legal`, `blocked`, `selected`, `hovered`, `held`, `idle`, `resolving`) 매핑 규칙이 기존 `styles.css` 안에 작성되려 한다면, THEN THE Stage 6 변경 SHALL 해당 규칙 추가를 차단하고 hand feature 단위 파일(또는 모듈) 안에서만 정의되도록 한다.
3. THE Hand_Presenter SHALL 본 스펙에서 정의한 7개 상태(`legal`, `blocked`, `selected`, `hovered`, `held`, `idle`, `resolving`) 각각에 대해 1:1로 매핑되는 CSS 클래스 이름을 사용하며, 한 시점의 hand 카드 요소는 이 상태 클래스 중 정확히 1개만 포함한다.
4. WHILE Stage 6 변경이 진행되는 동안, THE Stage 6 변경 SHALL `styles.css` 내 hand 관련 selector(클래스, ID, 속성 selector 포함)의 총 개수를 Stage 6 시작 시점 대비 증가시키지 않는다.
5. IF `styles.css`에서 hand feature 단위 파일(또는 모듈)로 이동된 hand 관련 selector가 존재한다면, THEN THE Stage 6 변경 SHALL 동일 selector를 `styles.css`에 잔존시키지 않으며, 이동 전후 hand 영역의 시각적 출력(클래스별 적용 스타일 집합)을 동일하게 유지한다.

### Requirement 8: 시각 일관성 및 비-웹페이지 인상 유지

**User Story:** As a Discord Activity 플레이어, I want Hand_Area 개선이 기존 game-app 시각 언어 안에서 이루어지기를 원한다, so that 게임이 임베디드 웹페이지나 폼처럼 보이지 않고 전투형 카드 게임의 인상이 유지된다.

#### Acceptance Criteria

1. THE Hand_Area SHALL 기존 시각 언어인 navy / brass / sea glow 기반 색 팔레트, fan layout, lift/glow 계열 affordance를 유지한다.
2. THE Hand_Area SHALL 평면 리스트, 일반 버튼 행 등 텍스트-only 폼 형태의 hand 표현을 영구 레이아웃으로 도입하지 않으며 카드 형태의 fan layout을 기본 표현으로 유지한다.
3. THE Hand_Area SHALL `legal`, `blocked`, `selected` 상태 각각을 색상 외에 outline, 위치(offset), opacity, icon overlay 중 최소 1개의 비-색상 채널과 함께 사용하여 구분한다.
4. WHEN Performance_Lite_Mode가 활성화될 때, THE Hand_Area SHALL hover lift, glow, 그림자 등 부가 효과를 제거하거나 정적 형태로 대체하면서 `legal` / `blocked` / `selected` 상태의 시각적 식별 가능성을 유지한다.
5. WHILE Hand_Area가 흑백(grayscale) 시뮬레이션 환경에서 표시되는 동안, THE Hand_Area SHALL `legal` 상태와 `blocked` 상태를 비-색상 채널만으로 구분 가능하게 표시한다.

### Requirement 9: 검증 포인트(Smoke Test 수준)

**User Story:** As a 마이그레이션 가드레일을 지키는 개발 팀원, I want Hand UX 변경이 핵심 상태 분기를 깨뜨리지 않았다는 것을 빠르게 확인할 수 있는 최소 검증 포인트가 있기를 원한다, so that 후속 Stage 작업으로 넘어가기 전 안전하게 검증할 수 있다.

#### Acceptance Criteria

1. THE Stage 6 변경 SHALL Hand_Card의 상태 매핑 동작을 검증하는 Smoke_Test를 최소 1개 포함하며, 해당 Smoke_Test는 정의된 7개 상태 각각에 대해 최소 1건의 입력 샘플을 제공하고, 각 입력에 대해 매핑 결과가 7개 상태 중 정확히 하나와 일치함을 단정(assert)한다.
2. THE Stage 6 변경 SHALL `legal` 상태 Hand_Card 입력에 대해 play 요청 경로가 1회 호출됨을 단정(assert)하는 Smoke_Test를 최소 1개 포함한다.
3. THE Stage 6 변경 SHALL `blocked` 상태 Hand_Card 입력에 대해 play 요청 경로가 0회 호출됨을 단정(assert)하는 Smoke_Test를 최소 1개 포함한다.
4. THE Stage 6 변경 SHALL 모바일 입력 흐름에서 300ms 이하 지속 시간의 탭 입력이 발생했을 때 play 요청 경로가 0회 호출되고 대상 Hand_Card가 `selected` 상태로 전이됨을 단정(assert)하는 Smoke_Test를 최소 1개 포함한다.
5. IF Smoke_Test 중 하나 이상이 실패한다면, THEN THE Stage 6 변경 SHALL 통합 불가 상태로 표시되어야 하며, 실패한 Smoke_Test 식별자와 실패 사유가 검증 산출물(콘솔 출력 또는 README의 결과 기록란)에 기록되어야 한다.
6. THE Stage 6 변경 SHALL Smoke_Test를 다음 두 형태 중 최소 하나로 제공한다: (a) Node 또는 동등 환경에서 단일 명령으로 단발 실행 가능하고 종료 코드(0=성공, 0이 아닌 값=실패)로 결과를 반환하는 자동 형태, 또는 (b) README에 명시된 수동 검증 절차 형태로서 실행 환경 전제, 단계별 수행 절차, 각 단계의 기대 결과, 그리고 통과/실패 판단 기준을 모두 포함한다.

### Requirement 10: 비범위(Out of Scope) 명시

**User Story:** As a 마이그레이션 가드레일을 지키는 개발 팀원, I want 이번 Stage 6 작업의 비범위가 요구사항 단계에서 명확하게 고정되기를 원한다, so that 작업 도중 범위 밀어넣기로 인해 docs와 충돌하는 대규모 구조 변경이 발생하지 않는다.

#### Acceptance Criteria

1. THE Stage 6 변경 SHALL 현재 HUD 영역에 해당하는 전체 파일을 동일 PR 내에서 동시에 교체하는 형태의 HUD 전면 재작성을 포함하지 않는다.
2. THE Stage 6 변경 SHALL Stage 9 로드맵 항목에 해당하는 고급 효과(legendary 시그니처 연출, 풀 입자 효과 시스템, 고비용 후처리 효과 등)를 도입하지 않는다.
3. THE Stage 6 변경 SHALL Python backend(`core/game_engine.py`, `api_server.py`)의 Card_Legality, trick 결정, 점수 계산 코드 경로의 함수 시그니처, 반환 규약, 권위 판정 로직을 0건 수정한다.
4. THE Stage 6 변경 SHALL 동일 PR 내에서 `legacy-app.js`, `shell.html`, `legacyBridge.js` 중 둘 이상의 파일을 전부 제거하는 형태의 풀 리라이트를 시도하지 않는다.
5. THE Stage 6 변경 SHALL R3F 기반 새 canvas 또는 scene을 hand UX 개선 명목으로 도입하지 않으며, Stage 5에서 정의된 R3F 경계를 확장하는 작업을 본 PR에 포함하지 않는다.
6. THE Stage 6 변경 SHALL docs(`docs/codex.md`, `docs/architecture.md`, `docs/uiux-direction.md`, `docs/discord-activity-ux.md`, `docs/tech-debt.md`)의 아키텍처 결정, 레이어 분리, 컴포넌트 책임 정의와 모순되는 변경을 포함하지 않는다.
7. THE Stage 6 변경 SHALL 단일 PR 내 비-테스트 코드 변경 규모가 800 LOC를 초과하거나 5개 이상 모듈 경계(directory boundary 또는 명시적 컴포넌트 경계)를 동시에 변경하는 형태의 대규모 구조 변경을 포함하지 않는다.
8. IF 작업 도중 비범위로 식별되는 항목이 발견된다면, THEN THE Stage 6 변경 SHALL 해당 항목을 본 PR에서 제외하고 별도 후속 작업(별도 PR 또는 별도 spec)으로 분리하여 추적한다.
