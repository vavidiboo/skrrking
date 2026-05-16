# Skull King Rule Notes

작성일: 2026-04-06

## 목적
- UI, 소켓, DB와 분리된 순수 규칙 계층을 `discord_activity_skullking/core/skull_king_rules.py`에 둔다.
- 기존 `RoomState`와 세션 snapshot 구조는 유지하고, `game_engine.py`는 상태 반영만 담당한다.

## 기존 코드 재사용 지점
- 카드 모델 재사용:
  - `discord_activity_skullking/core/card_rules.py`의 `Card`
- 카드 판별 헬퍼 재사용:
  - `is_numbered()`
  - `is_escape()`
  - `is_pirate()`
  - `is_mermaid()`
  - `is_skull_king()`
  - `is_kraken()`
  - `is_white_whale()`
- 상태 전이 재사용:
  - `discord_activity_skullking/core/game_engine.py`의 `RoomState`, `PlayerState`, `play_card()`, `score_round()`

## 이번에 분리한 순수 규칙 함수
- `profile_card(card)`
  - 기존 `Card`를 명시적인 역할 모델(`numbered`, `escape`, `pirate`, `mermaid`, `skull_king`, `kraken`, `white_whale`)로 매핑
- `determine_lead_suit_from_plays(plays)`
  - 트릭 입력만 받아 리드 슈트를 계산
- `legal_card_indexes_from_hand(hand, plays)`
  - 현재 트릭과 손패만으로 follow-suit 가능 카드 계산
- `resolve_trick(plays, num_players, advanced_rules_enabled=False)`
  - 승자, 다음 리더, 적용 규칙, 보너스 점수를 계산
- `calculate_trick_bonus(winning_card, trick_cards)`
  - 트릭 보너스를 독립 계산
- `calculate_round_score_delta(...)`
  - 플레이어 1명의 라운드 점수 변화량 계산
- `calculate_round_scores(results, round_number, bonus_enabled)`
  - 라운드 전체 점수 계산

## edge case 목록
### 리드 슈트
- 첫 카드가 숫자 카드면 그 슈트가 즉시 리드 슈트
- 첫 카드가 escape면 이후 처음 나온 숫자 카드의 슈트가 리드 슈트
- 첫 카드가 pirate, mermaid, skull king, tigress-as-pirate면 리드 슈트 없음

### 합법 수
- 리드 슈트 숫자 카드를 보유하면 해당 슈트를 따라야 함
- 특수 카드는 항상 합법 수로 취급
- 리드 슈트 숫자 카드가 없으면 아무 카드나 가능

### 기본 승자 판정
- mermaid가 skull king을 이김
- skull king은 pirate와 숫자 카드를 이김
- pirate는 mermaid와 숫자 카드를 이김
- 숫자 카드만 남으면 black이 trump
- black이 없으면 lead suit 최고 숫자가 승리
- 전원이 escape면 가장 먼저 나온 escape가 승리

### advanced rules 범위
- 이번 범위는 `kraken`, `white_whale`만 포함
- 마지막에 나온 `kraken` 또는 `white_whale`만 유효
- `kraken`
  - 트릭 버림
  - 승자 없음
  - 다음 리더는 kraken을 낸 플레이어의 왼쪽
- `white_whale`
  - 특수 카드 효력을 무시하고 숫자 카드 중 최고 숫자가 승리
  - 숫자 카드가 하나도 없으면 트릭 버림
  - 다음 리더는 white whale을 낸 플레이어

### 점수 계산
- bid 0 성공: `10 * round_number`
- bid 0 실패: `-10 * round_number`
- bid 적중: `20 * bid + bonus(optional)`
- bid 실패: `-10 * abs(tricks_won - bid)`

### 보너스 계산
- 트릭에 포함된 모든 14는 승자에게 보너스 적용
- black 14는 +20, 나머지 14는 +10
- pirate로 mermaid를 잡으면 mermaid 1장당 +20
- skull king으로 pirate를 잡으면 pirate 1장당 +30
- mermaid로 skull king을 잡으면 +40

## 구현 메모
- `game_engine.determine_lead_suit()`와 `legal_card_indexes()`는 새 순수 함수를 호출하는 wrapper로 유지했다.
- `game_engine.play_card()`는 트릭 종료 시 상태를 직접 판정하지 않고 `resolve_trick()` 결과를 반영만 한다.
- `game_engine.score_round()`는 플레이어별 delta 계산을 직접 하지 않고 `calculate_round_scores()` 결과를 적용만 한다.

## 테스트 메모
- 테스트 파일:
  - `tests/test_card_rules.py`
- 현재 고정한 시나리오:
  - escape 선행 리드 슈트 계산
  - mermaid vs skull king
  - pirate vs mermaid
  - black trump 우선
  - all escape
  - kraken discard
  - white whale highest number
  - zero bid / exact bid / miss score 계산
