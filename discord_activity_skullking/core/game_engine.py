from __future__ import annotations

import random
from dataclasses import dataclass, field, asdict
import time
from typing import Any, Dict, List, Optional, Literal

from .card_rules import (
    Card,
    create_deck,
)
from .skull_king_rules import (
    RoundScoreInput,
    calculate_round_scores,
    determine_lead_suit_from_plays,
    legal_card_indexes_from_hand,
    resolve_trick,
)


RoomStatus = Literal["waiting", "playing", "finished"]
Phase = Literal["idle", "bidding", "playing", "scoring", "waiting_next_round"]

@dataclass
class Settings:
    bonus_enabled: bool = False
    advanced_rules_enabled: bool = False
    max_players: int = 6
    max_rounds: int = 10

@dataclass
class PlayerState:
    id: str
    name: str
    order: int
    score: int = 0
    bid: Optional[int] = None
    tricks_won: int = 0
    round_bonus: int = 0
    hand: List[Card] = field(default_factory=list)

@dataclass
class TrickPlay:
    player_id: str
    card: Card

@dataclass
class RoomState:
    id: str
    name: str
    host_player: PlayerState
    created_at: int = field(default_factory=lambda: int(time.time()))
    system_message_id: Optional[int] = None
    password: Optional[str] = None
    status: RoomStatus = "waiting"
    round_number: int = 0
    leader_index: int = 0
    current_turn_index: int = 0
    tricks_completed: int = 0
    phase: Phase = "idle"
    settings: Settings = field(default_factory=Settings)
    players: List[PlayerState] = field(default_factory=list)
    current_trick: List[TrickPlay] = field(default_factory=list)

    def find_player(self, player_id: str) -> PlayerState:
        for p in self.players:
            if p.id == player_id:
                return p

        raise ValueError("player not in room")

    def player_index(self, player_id: str) -> int:
        for i, p in enumerate(self.players):
            if p.id == player_id:
                return i
        raise ValueError("player not in room")


def card_to_dict(card: Card) -> Dict[str, Any]:
    # `Card`는 dataclass이지만, 파싱/역직렬화의 일관성을 위해 명시적으로 dict로 변환합니다.
    return dict(card.__dict__)


def card_from_dict(data: Dict[str, Any]) -> Card:
    return Card(
        suit=data.get("suit", False),
        number=data.get("number"),
        kind=data.get("kind"),
        tigress_as=data.get("tigress_as"),
    )


def room_to_dict(room: RoomState) -> Dict[str, Any]:
    # dataclass deep conversion (Card 포함)
    return asdict(room)


def room_from_dict(data: Dict[str, Any]) -> RoomState:
    settings_data = data.get("settings") or {}
    settings = Settings(
        bonus_enabled=settings_data.get("bonus_enabled", False),
        advanced_rules_enabled=settings_data.get("advanced_rules_enabled", False),
        max_players=settings_data.get("max_players", 6),
        max_rounds=settings_data.get("max_rounds", 10),
    )

    players: List[PlayerState] = []
    for idx, p in enumerate(data.get("players") or []):
        # Backward compatibility: legacy room data may store players as plain user_id strings.
        if isinstance(p, str):
            players.append(
                PlayerState(
                    id=p,
                    name="",
                    order=idx + 1,
                    score=0,
                    bid=None,
                    tricks_won=0,
                    round_bonus=0,
                    hand=[],
                )
            )
            continue

        if not isinstance(p, dict):
            continue

        hand = [card_from_dict(c) for c in (p.get("hand") or []) if isinstance(c, dict)]
        player_id = p.get("id", "")
        if not player_id:
            continue

        players.append(
            PlayerState(
                id=player_id,
                name=p.get("name", ""),
                order=p.get("order", idx + 1),
                score=p.get("score", 0),
                bid=p.get("bid"),
                tricks_won=p.get("tricks_won", 0),
                round_bonus=p.get("round_bonus", 0),
                hand=hand,
            )
        )

    current_trick: List[TrickPlay] = []
    for tp in data.get("current_trick") or []:
        if not isinstance(tp, dict):
            continue
        card_data = tp.get("card")
        if not isinstance(card_data, dict):
            continue
        current_trick.append(
            TrickPlay(
                player_id=tp.get("player_id", ""),
                card=card_from_dict(card_data),
            )
        )
    room = RoomState(
        id=data["id"],
        name=data.get("name", ""),
        host_player=data["host_player"],
        created_at=int(data.get("created_at") or int(time.time())),
        system_message_id=data.get("system_message_id"),
        status=data.get("status", "waiting"),
        round_number=data.get("round_number", 0),
        leader_index=data.get("leader_index", 0),
        current_turn_index=data.get("current_turn_index", data.get("leader_index", 0)),
        tricks_completed=data.get("tricks_completed", 0),
        phase=data.get("phase", "idle"),
        settings=settings,
        players=players,
        current_trick=current_trick,
    )

    if room.players:
        room.leader_index = room.leader_index % len(room.players)
        room.current_turn_index = room.current_turn_index % len(room.players)
        valid_player_ids = {p.id for p in room.players}
        room.current_trick = [tp for tp in room.current_trick if tp.player_id in valid_player_ids]
    else:
        room.leader_index = 0
        room.current_turn_index = 0
        room.current_trick = []

    return room

def build_room(
    room_id: str,
    room_name: str,
    host_player: PlayerState,
    *,
    settings: Optional[Settings] = None,
) -> RoomState:
    
    return RoomState(
        id=room_id,
        name=room_name,
        host_player=host_player['id'],
        players=[PlayerState(id=host_player['id'], name=host_player['name'], order=0)],
        settings=settings or Settings(),
    )


def enter_room(room: RoomState, player_id: str, name: str) -> RoomState:
    if any(player.id == player_id for player in room.players):
        # 이미 있는 경우 이름만 갱신
        player = room.find_player(player_id)
        player.name = name
        return room

    if len(room.players) >= room.settings.max_players:
        raise ValueError("room is full")

    order = 0
    player = PlayerState(id=player_id, name=name, order=order)
    room.players.append(player)

    # Before game start, keep order unset(0). Round order is assigned when a round starts.
    if room.round_number > 0:
        for idx, p in enumerate(room.players, start=1):
            p.order = idx

    return room


def determine_lead_suit(room: RoomState) -> Optional[str]:
    plays = [
        {
            "player_index": room.player_index(tp.player_id),
            "card": tp.card,
        }
        for tp in room.current_trick
    ]
    return determine_lead_suit_from_plays(plays)


def legal_card_indexes(room: RoomState, player: PlayerState) -> List[int]:
    plays = [
        {
            "player_index": room.player_index(tp.player_id),
            "card": tp.card,
        }
        for tp in room.current_trick
    ]
    return legal_card_indexes_from_hand(player.hand, plays)


def start_round(room: RoomState) -> None:
    if len(room.players) < 2:
        raise ValueError("at least 2 players required")
    if room.status == "finished":
        room.status = "waiting"
        room.phase = "idle"
        room.round_number = 0
        room.tricks_completed = 0
        room.current_trick.clear()
        for player in room.players:
            player.hand.clear()
            player.score = 0
            player.bid = None
            player.tricks_won = 0
            player.round_bonus = 0
    if room.round_number >= room.settings.max_rounds:
        raise ValueError("game already finished")
    if room.phase in ("bidding", "playing", "scoring"):
        raise ValueError("current round is not finished")
    if room.current_trick:
        raise ValueError("current trick is not finished")
    if any(len(player.hand) > 0 for player in room.players):
        raise ValueError("cards are still in players' hands")

    room.round_number += 1

    if room.round_number > room.settings.max_rounds:
        room.status = "finished"
        room.phase = "idle"
        return

    deck = create_deck(include_advanced=room.settings.advanced_rules_enabled)

    for player in room.players:
        player.hand.clear()
        player.tricks_won = 0
        player.round_bonus = 0
        player.bid = None

    for _ in range(room.round_number):
        for player in room.players:
            player.hand.append(deck.pop())

    room.status = "playing"
    room.phase = "bidding"

    # Use last trick winner as next leader across rounds.
    # For the first round (or invalid state), default to the first player.
    if room.round_number == 1:
        room.leader_index = random.randint(0, len(room.players)-1)

    else:
        room.leader_index = room.leader_index % len(room.players)
        
    room.current_turn_index = room.leader_index
    room.tricks_completed = 0
    room.current_trick.clear()

    # Set per-round play order based on starter.
    for seat, player in enumerate(room.players):
        player.order = ((seat - room.leader_index) % len(room.players)) + 1


def set_bid(room: RoomState, player_id: str, bid: int) -> None:
    if room.phase != "bidding":
        raise ValueError("not in bidding phase")

    player = room.find_player(player_id)
    if player.bid is not None:
        raise ValueError("bid already submitted")

    if bid < 0 or bid > room.round_number:
        raise ValueError("invalid bid")

    player.bid = bid

    if all(p.bid is not None for p in room.players):
        room.phase = "playing"


def play_card(room: RoomState, player_id: str, card_index: int) -> None:
    if room.phase != "playing":
        raise ValueError("not in playing phase")

    if not room.players:
        raise ValueError("no players in room")

    room.leader_index = room.leader_index % len(room.players)
    room.current_turn_index = room.current_turn_index % len(room.players)

    idx = room.player_index(player_id)

    if any(tp.player_id == player_id for tp in room.current_trick):
        raise ValueError("player already played in this trick")

    if idx != room.current_turn_index:
        raise ValueError("not your turn")
        
    player = room.find_player(player_id)
    if card_index < 0 or card_index >= len(player.hand):
        raise ValueError("invalid card index")
    if card_index not in legal_card_indexes(room, player):
        raise ValueError("must follow lead suit")

    card = player.hand.pop(card_index)
    room.current_trick.append(TrickPlay(player_id=player_id, card=card))

    if len(room.current_trick) == len(room.players):
        plays_for_eval = []
        for tp in room.current_trick:
            plays_for_eval.append(
                {
                    "player_index": room.player_index(tp.player_id),
                    "card": tp.card,
                }
            )

        trick_resolution = resolve_trick(
            plays_for_eval,
            num_players=len(room.players),
            advanced_rules_enabled=room.settings.advanced_rules_enabled,
        )
        winner_index = trick_resolution.winner_index
        next_leader = trick_resolution.next_leader_index

        if winner_index is not None:
            winner_player = room.players[winner_index]
            winner_player.tricks_won += 1
            winner_player.round_bonus += trick_resolution.bonus_points

        if next_leader is not None and room.players:
            room.leader_index = next_leader % len(room.players)

        room.current_turn_index = room.leader_index
        room.tricks_completed += 1
        room.current_trick.clear()

        if all(len(p.hand) == 0 for p in room.players):
            room.phase = "scoring"

    else:
        room.current_turn_index = (room.current_turn_index + 1) % len(room.players)


def score_round(room: RoomState) -> None:
    if room.phase not in ("playing", "scoring"):
        raise ValueError("round not finished")
    if room.current_trick:
        raise ValueError("current trick is not finished")
    if any(len(p.hand) > 0 for p in room.players):
        raise ValueError("round is not finished yet")
    if any(p.bid is None for p in room.players):
        raise ValueError("bidding is not complete")

    score_results = calculate_round_scores(
        [
            RoundScoreInput(
                player_index=index,
                bid=p.bid if p.bid is not None else 0,
                tricks_won=p.tricks_won,
                round_bonus=p.round_bonus,
            )
            for index, p in enumerate(room.players)
        ],
        round_number=room.round_number,
        bonus_enabled=room.settings.bonus_enabled,
    )
    for result in score_results:
        room.players[result.player_index].score += result.delta
    if room.round_number >= room.settings.max_rounds:
        room.status = "finished"
        room.phase = "idle"
    else:
        room.phase = "waiting_next_round"


def room_public_view(room: RoomState, viewer_id: str) -> Dict:
    """
    카카오/클라이언트용 뷰: 내가 가진 패는 카드 정보 전체, 다른 사람은 카드 장수만.
    """
    players_view = []
    for p in room.players:
        if p.id == viewer_id:
            players_view.append(
                {
                    "id": p.id,
                    "name": p.name,
                    "order": p.order,
                    "score": p.score,
                    "bid": p.bid,
                    "tricks_won": p.tricks_won,
                    "round_bonus": p.round_bonus,
                    "hand": [card.__dict__ for card in p.hand],
                }
            )
        else:
            players_view.append(
                {
                    "id": p.id,
                    "name": p.name,
                    "order": p.order,
                    "score": p.score,
                    "bid": p.bid,
                    "tricks_won": p.tricks_won,
                    "round_bonus": p.round_bonus,
                    "hand_count": len(p.hand),
                }
            )
    return {
        "id": room.id,
        "name": room.name,
        "host_player": room.host_player,
        "created_at": room.created_at,
        "status": room.status,
        "round_number": room.round_number,
        "leader_index": room.leader_index,
        "current_turn_index": room.current_turn_index,
        "tricks_completed": room.tricks_completed,
        "phase": room.phase,
        "settings": {
            "bonus_enabled": room.settings.bonus_enabled,
            "advanced_rules_enabled": room.settings.advanced_rules_enabled,
            "max_players": room.settings.max_players,
            "max_rounds": room.settings.max_rounds,
        },
        "players": players_view,
        "current_trick": [
            {
                "player_id": tp.player_id,
                "card": tp.card.__dict__,
            }
            for tp in room.current_trick
        ],
    }


