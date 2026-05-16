import random
import time
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Tuple

SUITS = ["yellow", "green", "purple", "black"]
NUMBERS = list(range(1, 15))  

PIRATE = "pirate"
MERMAID = "mermaid"
SKULL_KING = "skull_king"
ESCAPE = "escape"
TIGRESS = "tigress"
KRAKEN = "kraken"
WHITE_WHALE = "white_whale"

SPECIAL_CARDS = [
    PIRATE, PIRATE, PIRATE, PIRATE, PIRATE,  # 해적 5장
    MERMAID, MERMAID,                        # 인어 2장
    SKULL_KING,                              # 스컬킹 1장
    ESCAPE, ESCAPE, ESCAPE, ESCAPE, ESCAPE,  # 탈출 5장
    TIGRESS,                                 # 티그리스 1장(해적/탈출 선택)
]

ROUND_MAX = 10
BONUS_ENABLED = False  # 보너스 점수(14/캡처 보너스) 여부
ADVANCED_RULES_ENABLED = False  # 어드밴스 룰(크라켄/화이트 웨일 등) 사용 여부 - 기본: 꺼짐

@dataclass
class Card:
    suit: Optional[str] = False      # None이면 특수 카드
    number: Optional[int] = None    # 일반 카드 숫자
    kind: Optional[str] = None      # 특수 카드 타입
    tigress_as: Optional[str] = None  # TIGRESS일 때, PIRATE 또는 ESCAPE

    def __str__(self):
        if self.kind:
            mapping = {
                PIRATE: "해적",
                MERMAID: "인어",
                SKULL_KING: "스컬킹",
                ESCAPE: "탈출",
                TIGRESS: "티그리스",
                KRAKEN: "크라켄",
                WHITE_WHALE: "화이트웨일",
            }

            if self.kind == TIGRESS and self.tigress_as in (PIRATE, ESCAPE):
                return f"{mapping[TIGRESS]}({mapping[self.tigress_as]})"

            return mapping.get(self.kind, self.kind)

        else:
            suit_kor = {
                "yellow": "노랑",
                "green": "초록",
                "purple": "보라",
                "black": "검정(해골)"
            }
            return f"{suit_kor.get(self.suit, self.suit)} {self.number}"

def is_numbered(card: Card) -> bool:
    return card.kind is None


def is_escape(card: Card) -> bool:
    return card.kind == ESCAPE or (card.kind == TIGRESS and card.tigress_as == ESCAPE)


def is_pirate(card: Card) -> bool:
    return card.kind == PIRATE or (card.kind == TIGRESS and card.tigress_as == PIRATE)


def is_mermaid(card: Card) -> bool:
    return card.kind == MERMAID


def is_skull_king(card: Card) -> bool:
    return card.kind == SKULL_KING


def is_kraken(card: Card) -> bool:
    return card.kind == KRAKEN


def is_white_whale(card: Card) -> bool:
    return card.kind == WHITE_WHALE


def create_deck(*, include_advanced: bool = False) -> List[Card]:
    deck = []

    for s in SUITS:
        for n in NUMBERS:
            deck.append(Card(suit=s, number=n))

    # 특수 카드 추가
    for kind in SPECIAL_CARDS:
        deck.append(Card(kind=kind))

    if include_advanced:
        # 어드밴스 카드(대표): 크라켄, 화이트 웨일
        deck.append(Card(kind=KRAKEN))
        deck.append(Card(kind=WHITE_WHALE))
        
    random.shuffle(deck)
    return deck

@dataclass
class Player:
    name: str
    is_human: bool = False
    hand: List[Card] = field(default_factory=list)
    bid: int = 0
    tricks_won: int = 0
    score: int = 0
    round_bonus: int = 0

    def show_hand(self):
        print(f"\n[{self.name}]의 패:")
        for idx, card in enumerate(self.hand):
            print(f"{idx}: {card}")
        print()

    def choose_bid(self, round_num: int, *, silent: bool = False) -> int:
        if self.is_human:
            self.show_hand()
            while True:
                try:
                    val = int(input(f"{self.name}, 이번 라운드({round_num}장) 예상 승리 트릭 수를 입력하세요: "))

                    if 0 <= val <= round_num:
                        self.bid = val
                        return val

                except ValueError:
                    pass

                print("0 이상, 라운드 수 이하의 정수를 입력하세요.")
                
        else:
            # 간단한 AI: 0 ~ round_num 사이 랜덤 비딩
            if not silent:
                bot_delay()
            self.bid = random.randint(0, round_num)
            if not silent:
                print(f"{self.name}의 비딩: {self.bid}")
            return self.bid

    def play_card(self, lead_suit: Optional[str]) -> Card:
        if self.is_human:
            self.show_hand()
            while True:
                try:
                    idx = int(input(f"{self.name}, 낼 카드 인덱스를 선택하세요: "))
                    if 0 <= idx < len(self.hand):
                        chosen = self.hand[idx]

                        # 슈트 추종 규칙: 리드 슈트가 있고, 그 슈트 카드를 가지고 있다면 그 중에서만 낼 수 있도록 체크[web:6]
                        if lead_suit and is_numbered(chosen):
                            if any(is_numbered(c) and c.suit == lead_suit for c in self.hand):
                                if chosen.suit != lead_suit:
                                    print("리드 슈트를 따라야 합니다!")
                                    continue
                                
                        card = self.hand.pop(idx)
                        if card.kind == TIGRESS:
                            while True:
                                mode = input("티그리스는 (p)해적 / (e)탈출 중 선택: ").strip().lower()
                                if mode in ("p", "e"):
                                    card.tigress_as = PIRATE if mode == "p" else ESCAPE
                                    break
                                print("p 또는 e를 입력하세요.")
                        print(f"{self.name} ▶ {card}")
                        return card
                except ValueError:
                    pass
                print("유효한 인덱스를 입력하세요.")
        else:
            # 매우 단순한 AI: 가능한 카드 중 아무거나
            # 리드 슈트가 있을 때, 해당 슈트가 있다면 그 중에서 무작위 선택[web:6]
            bot_delay()
            candidates = self.hand
            if lead_suit:
                same_suit = [c for c in self.hand if (is_numbered(c) and c.suit == lead_suit)]
                if same_suit:
                    candidates = same_suit
            chosen = random.choice(candidates)
            self.hand.remove(chosen)
            if chosen.kind == TIGRESS:
                chosen.tigress_as = random.choice([PIRATE, ESCAPE])
            print(f"{self.name} ▶ {chosen}")
            return chosen


# ---- 트릭 승자 판정 ----
def determine_lead_suit(plays: List[Dict]) -> Optional[str]:
    """
    리드 슈트 결정 규칙:
    - 첫 카드가 숫자카드면 그 슈트가 리드 슈트
    - 첫 카드가 탈출(또는 티그리스-탈출)이면, 이후 처음 나온 숫자카드 슈트가 리드 슈트
    - 첫 카드가 해적/인어/스컬킹(또는 티그리스-해적)이면 리드 슈트 없음
    """
    if not plays:
        return None
    first = plays[0]["card"]
    if is_numbered(first):
        return first.suit
    if is_escape(first):
        for p in plays[1:]:
            c = p["card"]
            if is_numbered(c):
                return c.suit
        return None
    return None


def evaluate_trick_base(plays: List[Dict]) -> int:
    """
    plays: [{'player_index': i, 'card': Card}, ...]  순서대로 플레이된 카드
    반환값: 이긴 플레이어의 인덱스
    (기본 규칙 요약)
    - 인어는 스컬킹을 잡고, 스컬킹은 해적/숫자카드보다 강함
    - 해적은 숫자카드(검정 포함)와 인어를 잡음
    - 탈출은 항상 지며, 전원이 탈출이면 먼저 낸 탈출이 승리
    - 숫자카드만 있으면 검정(트럼프) 우선, 아니면 리드 슈트 최고 숫자
    """
    # 1) 스컬킹이 있으면: 인어가 있으면 (가장 먼저 나온) 인어 승리, 아니면 스컬킹 승리
    skull_king_play = next((p for p in plays if is_skull_king(p["card"])), None)
    if skull_king_play is not None:
        mermaid_play = next((p for p in plays if is_mermaid(p["card"])), None)
        if mermaid_play is not None:
            return mermaid_play["player_index"]
        return skull_king_play["player_index"]

    # 2) 스컬킹이 없고 해적이 있으면: 가장 먼저 나온 해적 승리
    pirate_play = next((p for p in plays if is_pirate(p["card"])), None)
    if pirate_play is not None:
        return pirate_play["player_index"]

    # 3) 해적/스컬킹이 없고 인어가 있으면: 가장 먼저 나온 인어 승리
    mermaid_play = next((p for p in plays if is_mermaid(p["card"])), None)
    if mermaid_play is not None:
        return mermaid_play["player_index"]

    # 4) 숫자카드가 있으면: 검정(트럼프) 최고 숫자, 없으면 리드 슈트 최고 숫자(리드 슈트 없으면 전체 최고 숫자)
    numbered_plays = [p for p in plays if is_numbered(p["card"])]
    if numbered_plays:
        black_plays = [p for p in numbered_plays if p["card"].suit == "black"]
        if black_plays:
            return max(black_plays, key=lambda p: p["card"].number)["player_index"]

        lead_suit = determine_lead_suit(plays)
        if lead_suit:
            same_suit = [p for p in numbered_plays if p["card"].suit == lead_suit]
            if same_suit:
                return max(same_suit, key=lambda p: p["card"].number)["player_index"]

        return max(numbered_plays, key=lambda p: p["card"].number)["player_index"]

    # 5) 전원이 탈출이면: 첫 탈출이 승리
    return plays[0]["player_index"]


def evaluate_trick_advanced(plays: List[Dict], num_players: int) -> Tuple[Optional[int], Optional[int]]:
    """
    어드밴스 룰(크라켄/화이트 웨일)을 적용한 트릭 결과.
    반환: (winner_index|None, next_leader_index|None)
    - winner_index가 None이면 트릭은 버려지고(무승부) 트릭 승자 없음
    """
    # 크라켄/화이트 웨일이 둘 다 있으면 '나중에 나온 카드'가 우선
    last_effect = None  # ("kraken"|"whale", player_index)
    for p in plays:
        c = p["card"]
        if is_kraken(c):
            last_effect = ("kraken", p["player_index"])
        elif is_white_whale(c):
            last_effect = ("whale", p["player_index"])

    if last_effect is None:
        w = evaluate_trick_base(plays)
        return w, w

    kind, who = last_effect
    if kind == "kraken":
        # 트릭 버림, 다음 리더는 크라켄 낸 사람의 왼쪽
        return None, (who + 1) % num_players

    # 화이트 웨일: 특수카드는 모두 탈출 취급, 숫자카드는 슈트 무시하고 최고 숫자(동점이면 먼저 낸 쪽)
    numbered = [(idx, p) for idx, p in enumerate(plays) if is_numbered(p["card"])]
    if not numbered:
        # 전부 특수카드면 트릭 버림, 다음 리더는 고래 낸 사람
        return None, who

    max_num = max(p["card"].number for _, p in numbered)
    for _, p in numbered:
        if p["card"].number == max_num:
            winner = p["player_index"]
            return winner, who  # 다음 리더는 고래 낸 사람

    # 도달 불가(안전장치)
    w = evaluate_trick_base(plays)
    return w, who


# ---- 점수 계산 ----
def score_round(players: List[Player], round_num: int):
    """
    기본 점수 규칙(간단 버전):
    - 비딩과 실제 트릭 수가 일치: 트릭당 +20점.[web:8]
    - 어긋나면: 차이 1트릭당 -10점.[web:8]
    - 0 트릭 비딩 성공: 라운드 번호 × 10점.[web:8]
    - 0 트릭 실패: -(라운드 번호 × 10점).[web:8]
    """
    print("\n=== 라운드 점수 계산 ===")
    for p in players:
        diff = abs(p.tricks_won - p.bid)
        if p.bid == 0:
            if p.tricks_won == 0:
                delta = 10 * round_num
            else:
                delta = -10 * round_num
        else:
            if diff == 0:
                bonus = p.round_bonus if BONUS_ENABLED else 0
                delta = 20 * p.bid + bonus
            else:
                delta = -10 * diff
        p.score += delta
        shown_bonus = p.round_bonus if BONUS_ENABLED else 0
        bonus_str = f"(보너스 {shown_bonus}) " if (p.bid != 0 and diff == 0 and shown_bonus) else ""
        print(f"{p.name}: 비딩 {p.bid}, 실제 {p.tricks_won}, {bonus_str}이번 라운드 {delta}점, 총점 {p.score}")


# ---- 게임 루프 ----
def play_game():
    print("=== 스컬킹 콘솔 게임 (간단 버전) ===")
    num_players = 0
    while num_players < 2 or num_players > 6:
        try:
            num_players = int(input("플레이어 수(2~6)를 입력하세요: "))
        except ValueError:
            pass

    human_name = input("당신의 이름을 입력하세요: ").strip() or "You"

    players: List[Player] = []
    # 첫 플레이어를 인간으로
    players.append(Player(human_name, is_human=True))

    # 나머지는 봇
    for i in range(1, num_players):
        players.append(Player(f"봇{i}"))

    dealer_index = 0

    for round_num in range(1, ROUND_MAX + 1):
        print(f"\n\n############################")
        print(f"### 라운드 {round_num} 시작 ###")
        print("############################\n")

        # 덱 생성 후 배분
        deck = create_deck(include_advanced=ADVANCED_RULES_ENABLED)
        for p in players:
            p.hand.clear()
            p.tricks_won = 0
            p.round_bonus = 0

        # 라운드 번호만큼 카드 나눠주기[web:7][web:8]
        for _ in range(round_num):
            for p in players:
                p.hand.append(deck.pop())

        # 비딩 단계
        print("\n--- 비딩 단계 ---")
        # 규칙서처럼 '동시에 공개'되도록 처리(콘솔에서는 봇 비딩을 숨겼다가 한 번에 공개)
        bid_start = (dealer_index + 1) % num_players  # 딜러 왼쪽부터(공개 순서)

        # 봇 비딩은 먼저 조용히 결정
        for p in players:
            if not p.is_human:
                p.choose_bid(round_num, silent=True)

        # 인간 비딩 입력(패를 보고 입력)
        human = next(p for p in players if p.is_human)
        print(f"\n[{human.name}] 비딩 입력(공개는 동시에 됩니다)")
        human.choose_bid(round_num)

        print("\n요-호-호! 비딩 공개!")
        for i in range(num_players):
            idx = (bid_start + i) % num_players
            p = players[idx]
            print(f"- {p.name}: {p.bid}")
        pause_if_needed(players)

        # 첫 트릭의 리더는 딜러 왼쪽
        leader_index = (dealer_index + 1) % num_players

        # 트릭 진행
        for trick in range(round_num):
            print(f"\n=== {trick + 1}번째 트릭 ===")
            plays = []
            lead_suit: Optional[str] = None

            # 각 플레이어가 한 장씩 냄
            for i in range(num_players):
                current_index = (leader_index + i) % num_players
                player = players[current_index]
                print(f"\n[{player.name}] 카드 낼 차례")
                card = player.play_card(lead_suit)
                plays.append({"player_index": current_index, "card": card})
                # 리드 슈트는 '현재까지의 플레이'로부터 동적으로 결정(탈출 리드 처리)
                if lead_suit is None:
                    lead_suit = determine_lead_suit(plays)
                # (중복 append 금지) plays는 위에서 1회만 추가
                pause_if_needed(players)

            # 승자 판정(어드밴스 룰 적용 가능)
            if ADVANCED_RULES_ENABLED:
                winner_index, next_leader = evaluate_trick_advanced(plays, num_players)
            else:
                winner_index = evaluate_trick_base(plays)
                next_leader = winner_index

            if winner_index is None:
                print("▶ 이번 트릭: 버려짐(승자 없음)")
                leader_index = next_leader if next_leader is not None else leader_index
                pause_if_needed(players)
                continue

            players[winner_index].tricks_won += 1
            print(f"▶ 이번 트릭 승자: {players[winner_index].name}")
            pause_if_needed(players)

            # 트릭 보너스(비딩 성공시에만 적용되므로 누적만 해둠)
            winner = players[winner_index]
            winning_card = next(p["card"] for p in plays if p["player_index"] == winner_index)
            trick_cards = [p["card"] for p in plays]

            # 14 보너스(잡은 트릭에 포함된 14)
            for c in trick_cards:
                if is_numbered(c) and c.number == 14:
                    winner.round_bonus += 20 if c.suit == "black" else 10

            # 해적으로 인어를 잡으면 +20 (인어 1장당)
            if is_pirate(winning_card):
                winner.round_bonus += 20 * sum(1 for c in trick_cards if is_mermaid(c))

            # 스컬킹으로 해적을 잡으면 +30 (해적 1장당)
            if is_skull_king(winning_card):
                winner.round_bonus += 30 * sum(1 for c in trick_cards if is_pirate(c))

            # 인어로 스컬킹을 잡으면 +40
            if is_mermaid(winning_card) and any(is_skull_king(c) for c in trick_cards):
                winner.round_bonus += 40

            # 다음 트릭 리더
            leader_index = next_leader if next_leader is not None else winner_index

        # 라운드 점수 계산
        score_round(players, round_num)

        # 딜러를 다음 사람으로
        dealer_index = (dealer_index + 1) % num_players

        # 중간 순위 표시
        print("\n--- 현재까지 총점 ---")
        for p in players:
            print(f"{p.name}: {p.score}점")

        cont = input("\n다음 라운드를 진행할까요? (y/n): ").strip().lower()
        if cont != "y":
            break

    # 최종 결과
    print("\n====================")
    print("게임 종료! 최종 점수:")
    print("====================")
    players_sorted = sorted(players, key=lambda x: x.score, reverse=True)
    for idx, p in enumerate(players_sorted, start=1):
        print(f"{idx}위: {p.name} - {p.score}점")


if __name__ == "__main__":
    play_game()
