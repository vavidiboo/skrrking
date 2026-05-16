from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Mapping, Optional, Sequence

from .card_rules import (
    Card,
    ESCAPE,
    KRAKEN,
    MERMAID,
    PIRATE,
    SKULL_KING,
    WHITE_WHALE,
    is_escape,
    is_kraken,
    is_mermaid,
    is_numbered,
    is_pirate,
    is_skull_king,
    is_white_whale,
)


CardRole = Literal[
    "numbered",
    "escape",
    "pirate",
    "mermaid",
    "skull_king",
    "kraken",
    "white_whale",
]


@dataclass(frozen=True)
class TrickPlayInput:
    player_index: int
    card: Card


@dataclass(frozen=True)
class CardProfile:
    role: CardRole
    suit: Optional[str]
    number: Optional[int]


@dataclass(frozen=True, order=True)
class NumberedCardPriority:
    is_trump: bool
    follows_lead_suit: bool
    rank: int


@dataclass(frozen=True)
class SpecialResolutionRule:
    name: str
    winner_role: CardRole
    required_roles: frozenset[CardRole]

    def matches(self, roles: set[CardRole]) -> bool:
        return self.required_roles.issubset(roles)


@dataclass(frozen=True)
class TrickResolution:
    winner_index: Optional[int]
    next_leader_index: Optional[int]
    lead_suit: Optional[str]
    winning_card: Optional[Card]
    bonus_points: int
    applied_rule: str
    discarded: bool = False


@dataclass(frozen=True)
class RoundScoreInput:
    player_index: int
    bid: int
    tricks_won: int
    round_bonus: int = 0


@dataclass(frozen=True)
class RoundScoreResult:
    player_index: int
    delta: int
    matched_bid: bool
    applied_bonus: int


SPECIAL_WIN_RULES: tuple[SpecialResolutionRule, ...] = (
    SpecialResolutionRule(
        name="mermaid_counters_skull_king",
        winner_role="mermaid",
        required_roles=frozenset({"mermaid", "skull_king"}),
    ),
    SpecialResolutionRule(
        name="skull_king_over_pirates",
        winner_role="skull_king",
        required_roles=frozenset({"skull_king"}),
    ),
    SpecialResolutionRule(
        name="pirate_over_mermaid",
        winner_role="pirate",
        required_roles=frozenset({"pirate", "mermaid"}),
    ),
    SpecialResolutionRule(
        name="pirate_over_numbered",
        winner_role="pirate",
        required_roles=frozenset({"pirate"}),
    ),
    SpecialResolutionRule(
        name="mermaid_over_numbered",
        winner_role="mermaid",
        required_roles=frozenset({"mermaid"}),
    ),
)


def profile_card(card: Card) -> CardProfile:
    if is_numbered(card):
        return CardProfile(role="numbered", suit=str(card.suit), number=card.number)
    if is_escape(card):
        return CardProfile(role="escape", suit=None, number=None)
    if is_pirate(card):
        return CardProfile(role="pirate", suit=None, number=None)
    if is_mermaid(card):
        return CardProfile(role="mermaid", suit=None, number=None)
    if is_skull_king(card):
        return CardProfile(role="skull_king", suit=None, number=None)
    if is_kraken(card):
        return CardProfile(role="kraken", suit=None, number=None)
    if is_white_whale(card):
        return CardProfile(role="white_whale", suit=None, number=None)
    raise ValueError("unsupported card kind")


def determine_lead_suit_from_plays(plays: Sequence[Mapping[str, object] | TrickPlayInput]) -> Optional[str]:
    normalized = _normalize_plays(plays)
    return _determine_lead_suit_from_normalized(normalized)


def _determine_lead_suit_from_normalized(
    normalized: Sequence[tuple[int, Card, CardProfile]],
) -> Optional[str]:
    if not normalized:
        return None

    # Edge cases handled here:
    # 1. Opening numbered card sets the lead suit immediately.
    # 2. Opening escape defers lead suit until the first numbered card appears.
    # 3. Opening pirate/mermaid/skull king leaves the trick without a lead suit.
    first_profile = normalized[0][2]
    if first_profile.role == "numbered":
        return first_profile.suit
    if first_profile.role == "escape":
        for _, _, profile in normalized[1:]:
            if profile.role == "numbered":
                return profile.suit
    return None


def legal_card_indexes_from_hand(
    hand: Sequence[Card],
    plays: Sequence[Mapping[str, object] | TrickPlayInput],
) -> list[int]:
    lead_suit = determine_lead_suit_from_plays(plays)
    if not lead_suit:
        return list(range(len(hand)))

    lead_indexes = [
        index for index, card in enumerate(hand) if is_numbered(card) and card.suit == lead_suit
    ]
    if not lead_indexes:
        return list(range(len(hand)))

    legal_indexes: list[int] = []
    for index, card in enumerate(hand):
        if not is_numbered(card) or card.suit == lead_suit:
            legal_indexes.append(index)
    return legal_indexes


def resolve_trick(
    plays: Sequence[Mapping[str, object] | TrickPlayInput],
    *,
    num_players: int,
    advanced_rules_enabled: bool = False,
) -> TrickResolution:
    normalized = _normalize_plays(plays)
    if not normalized:
        raise ValueError("at least one play is required")
    if num_players <= 0:
        raise ValueError("num_players must be positive")

    lead_suit = _determine_lead_suit_from_normalized(normalized)

    if advanced_rules_enabled:
        advanced_resolution = _resolve_advanced_effect(normalized, num_players=num_players)
        if advanced_resolution is not None:
            if advanced_resolution.winner_index is None:
                return advanced_resolution
            return TrickResolution(
                winner_index=advanced_resolution.winner_index,
                next_leader_index=advanced_resolution.next_leader_index,
                lead_suit=lead_suit,
                winning_card=advanced_resolution.winning_card,
                bonus_points=calculate_trick_bonus(
                    advanced_resolution.winning_card,
                    [card for _, card, _ in normalized],
                ),
                applied_rule=advanced_resolution.applied_rule,
                discarded=False,
            )

    winner_index, winning_card, applied_rule = _resolve_base_winner(normalized, lead_suit)
    return TrickResolution(
        winner_index=winner_index,
        next_leader_index=winner_index,
        lead_suit=lead_suit,
        winning_card=winning_card,
        bonus_points=calculate_trick_bonus(winning_card, [card for _, card, _ in normalized]),
        applied_rule=applied_rule,
        discarded=False,
    )


def calculate_trick_bonus(winning_card: Optional[Card], trick_cards: Sequence[Card]) -> int:
    if winning_card is None:
        return 0

    bonus_points = 0

    for card in trick_cards:
        if is_numbered(card) and card.number == 14:
            bonus_points += 20 if card.suit == "black" else 10

    if is_pirate(winning_card):
        bonus_points += 20 * sum(1 for card in trick_cards if is_mermaid(card))

    if is_skull_king(winning_card):
        bonus_points += 30 * sum(1 for card in trick_cards if is_pirate(card))

    if is_mermaid(winning_card) and any(is_skull_king(card) for card in trick_cards):
        bonus_points += 40

    return bonus_points


def calculate_round_score_delta(
    *,
    round_number: int,
    bid: int,
    tricks_won: int,
    round_bonus: int,
    bonus_enabled: bool,
) -> int:
    difference = abs(tricks_won - bid)
    if bid == 0:
        return 10 * round_number if tricks_won == 0 else -10 * round_number

    if difference == 0:
        applied_bonus = round_bonus if bonus_enabled else 0
        return (20 * bid) + applied_bonus

    return -10 * difference


def calculate_round_scores(
    results: Sequence[RoundScoreInput],
    *,
    round_number: int,
    bonus_enabled: bool,
) -> list[RoundScoreResult]:
    scored_results: list[RoundScoreResult] = []
    for result in results:
        delta = calculate_round_score_delta(
            round_number=round_number,
            bid=result.bid,
            tricks_won=result.tricks_won,
            round_bonus=result.round_bonus,
            bonus_enabled=bonus_enabled,
        )
        matched_bid = result.bid == result.tricks_won
        applied_bonus = result.round_bonus if (bonus_enabled and result.bid != 0 and matched_bid) else 0
        scored_results.append(
            RoundScoreResult(
                player_index=result.player_index,
                delta=delta,
                matched_bid=matched_bid,
                applied_bonus=applied_bonus,
            )
        )
    return scored_results


def _normalize_plays(
    plays: Sequence[Mapping[str, object] | TrickPlayInput],
) -> list[tuple[int, Card, CardProfile]]:
    normalized: list[tuple[int, Card, CardProfile]] = []
    for play in plays:
        if isinstance(play, TrickPlayInput):
            player_index = play.player_index
            card = play.card
        else:
            player_index = int(play["player_index"])
            card = play["card"]
        if not isinstance(card, Card):
            raise TypeError("card must be a Card instance")
        normalized.append((player_index, card, profile_card(card)))
    return normalized


def _resolve_advanced_effect(
    normalized: Sequence[tuple[int, Card, CardProfile]],
    *,
    num_players: int,
) -> Optional[TrickResolution]:
    last_effect: Optional[tuple[CardRole, int]] = None
    for player_index, _, profile in normalized:
        if profile.role == "kraken":
            last_effect = ("kraken", player_index)
        elif profile.role == "white_whale":
            last_effect = ("white_whale", player_index)

    if last_effect is None:
        return None

    effect_role, effect_player = last_effect
    if effect_role == "kraken":
        return TrickResolution(
            winner_index=None,
            next_leader_index=(effect_player + 1) % num_players,
            lead_suit=_determine_lead_suit_from_normalized(normalized),
            winning_card=None,
            bonus_points=0,
            applied_rule="kraken_discards_trick",
            discarded=True,
        )

    numbered_plays = [(player_index, card, profile) for player_index, card, profile in normalized if profile.role == "numbered"]
    if not numbered_plays:
        return TrickResolution(
            winner_index=None,
            next_leader_index=effect_player,
            lead_suit=_determine_lead_suit_from_normalized(normalized),
            winning_card=None,
            bonus_points=0,
            applied_rule="white_whale_discards_special_only_trick",
            discarded=True,
        )

    winner_index, winning_card, _ = max(numbered_plays, key=lambda play: play[2].number or 0)
    return TrickResolution(
        winner_index=winner_index,
        next_leader_index=effect_player,
        lead_suit=_determine_lead_suit_from_normalized(normalized),
        winning_card=winning_card,
        bonus_points=0,
        applied_rule="white_whale_highest_number",
        discarded=False,
    )


def _resolve_base_winner(
    normalized: Sequence[tuple[int, Card, CardProfile]],
    lead_suit: Optional[str],
) -> tuple[int, Card, str]:
    roles = {profile.role for _, _, profile in normalized if profile.role != "escape"}
    for rule in SPECIAL_WIN_RULES:
        if rule.matches(roles):
            winner_index, winner_card = _first_play_for_role(normalized, rule.winner_role)
            return winner_index, winner_card, rule.name

    numbered_plays = [(player_index, card, profile) for player_index, card, profile in normalized if profile.role == "numbered"]
    if numbered_plays:
        black_plays = [play for play in numbered_plays if play[2].suit == "black"]
        if black_plays:
            winner_index, winner_card, _ = max(
                black_plays,
                key=lambda play: _numbered_priority(play[2], lead_suit),
            )
            return winner_index, winner_card, "highest_black_trump"

        if lead_suit:
            lead_plays = [play for play in numbered_plays if play[2].suit == lead_suit]
            if lead_plays:
                winner_index, winner_card, _ = max(
                    lead_plays,
                    key=lambda play: _numbered_priority(play[2], lead_suit),
                )
                return winner_index, winner_card, "highest_lead_suit"

        winner_index, winner_card, _ = max(
            numbered_plays,
            key=lambda play: _numbered_priority(play[2], lead_suit),
        )
        return winner_index, winner_card, "highest_numbered_card"

    winner_index, winner_card, _ = normalized[0]
    return winner_index, winner_card, "first_escape"


def _first_play_for_role(
    normalized: Sequence[tuple[int, Card, CardProfile]],
    role: CardRole,
) -> tuple[int, Card]:
    for player_index, card, profile in normalized:
        if profile.role == role:
            return player_index, card
    raise ValueError("no matching card role in trick")


def _numbered_priority(profile: CardProfile, lead_suit: Optional[str]) -> NumberedCardPriority:
    return NumberedCardPriority(
        is_trump=profile.suit == "black",
        follows_lead_suit=bool(lead_suit and profile.suit == lead_suit),
        rank=profile.number or 0,
    )
