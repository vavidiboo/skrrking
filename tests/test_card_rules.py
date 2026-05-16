import unittest

from discord_activity_skullking.core import card_rules as rules
from discord_activity_skullking.core import skull_king_rules as domain_rules


def _numbered(suit: str, number: int) -> rules.Card:
    return rules.Card(suit=suit, number=number)


def _special(kind: str, *, tigress_as: str | None = None) -> rules.Card:
    return rules.Card(kind=kind, tigress_as=tigress_as)


def _plays(*cards: rules.Card) -> list[dict[str, object]]:
    return [
        {
            "player_index": index,
            "card": card,
        }
        for index, card in enumerate(cards)
    ]


class CardRulesTests(unittest.TestCase):
    def test_create_deck_smoke_basic_and_advanced_counts(self) -> None:
        basic_deck = rules.create_deck(include_advanced=False)
        advanced_deck = rules.create_deck(include_advanced=True)

        self.assertEqual(len(basic_deck), 70)
        self.assertEqual(len(advanced_deck), 72)
        self.assertFalse(any(card.kind == rules.KRAKEN for card in basic_deck))
        self.assertFalse(any(card.kind == rules.WHITE_WHALE for card in basic_deck))
        self.assertTrue(any(card.kind == rules.KRAKEN for card in advanced_deck))
        self.assertTrue(any(card.kind == rules.WHITE_WHALE for card in advanced_deck))

    def test_card_helpers_smoke_numbered_and_special(self) -> None:
        yellow_one = _numbered("yellow", 1)
        tigress_escape = _special(rules.TIGRESS, tigress_as=rules.ESCAPE)

        self.assertTrue(rules.is_numbered(yellow_one))
        self.assertTrue(rules.is_escape(tigress_escape))
        self.assertEqual(_plays(yellow_one, tigress_escape)[0]["player_index"], 0)

    def test_determine_lead_suit_skips_opening_escape(self) -> None:
        lead_suit = domain_rules.determine_lead_suit_from_plays(
            _plays(
                _special(rules.ESCAPE),
                _numbered("green", 7),
                _numbered("yellow", 12),
            )
        )

        self.assertEqual(lead_suit, "green")

    def test_resolve_trick_mermaid_beats_skull_king(self) -> None:
        resolution = domain_rules.resolve_trick(
            _plays(
                _special(rules.SKULL_KING),
                _special(rules.MERMAID),
                _numbered("black", 14),
            ),
            num_players=3,
            advanced_rules_enabled=False,
        )

        self.assertEqual(resolution.winner_index, 1)
        self.assertEqual(resolution.next_leader_index, 1)
        self.assertEqual(resolution.bonus_points, 60)
        self.assertEqual(resolution.applied_rule, "mermaid_counters_skull_king")

    def test_resolve_trick_pirate_beats_mermaid_and_numbers(self) -> None:
        resolution = domain_rules.resolve_trick(
            _plays(
                _numbered("yellow", 14),
                _special(rules.MERMAID),
                _special(rules.PIRATE),
            ),
            num_players=3,
            advanced_rules_enabled=False,
        )

        self.assertEqual(resolution.winner_index, 2)
        self.assertEqual(resolution.bonus_points, 30)
        self.assertEqual(resolution.applied_rule, "pirate_over_mermaid")

    def test_resolve_trick_black_trump_beats_lead_suit(self) -> None:
        resolution = domain_rules.resolve_trick(
            _plays(
                _numbered("green", 10),
                _numbered("green", 12),
                _numbered("black", 3),
            ),
            num_players=3,
        )

        self.assertEqual(resolution.lead_suit, "green")
        self.assertEqual(resolution.winner_index, 2)
        self.assertEqual(resolution.applied_rule, "highest_black_trump")

    def test_resolve_trick_all_escape_uses_first_escape(self) -> None:
        resolution = domain_rules.resolve_trick(
            _plays(
                _special(rules.ESCAPE),
                _special(rules.TIGRESS, tigress_as=rules.ESCAPE),
            ),
            num_players=2,
        )

        self.assertEqual(resolution.winner_index, 0)
        self.assertEqual(resolution.applied_rule, "first_escape")

    def test_resolve_trick_kraken_discards_trick_and_advances_leader(self) -> None:
        resolution = domain_rules.resolve_trick(
            _plays(
                _numbered("yellow", 10),
                _special(rules.KRAKEN),
                _special(rules.PIRATE),
            ),
            num_players=3,
            advanced_rules_enabled=True,
        )

        self.assertIsNone(resolution.winner_index)
        self.assertEqual(resolution.next_leader_index, 2)
        self.assertTrue(resolution.discarded)
        self.assertEqual(resolution.applied_rule, "kraken_discards_trick")

    def test_resolve_trick_white_whale_uses_highest_number_only(self) -> None:
        resolution = domain_rules.resolve_trick(
            _plays(
                _special(rules.WHITE_WHALE),
                _special(rules.PIRATE),
                _numbered("green", 13),
                _numbered("black", 9),
            ),
            num_players=4,
            advanced_rules_enabled=True,
        )

        self.assertEqual(resolution.winner_index, 2)
        self.assertEqual(resolution.next_leader_index, 0)
        self.assertEqual(resolution.applied_rule, "white_whale_highest_number")

    def test_calculate_round_scores_supports_zero_bid_and_bonus_toggle(self) -> None:
        no_bonus = domain_rules.calculate_round_scores(
            [
                domain_rules.RoundScoreInput(player_index=0, bid=0, tricks_won=0, round_bonus=20),
                domain_rules.RoundScoreInput(player_index=1, bid=2, tricks_won=2, round_bonus=30),
            ],
            round_number=3,
            bonus_enabled=False,
        )
        with_bonus = domain_rules.calculate_round_scores(
            [
                domain_rules.RoundScoreInput(player_index=0, bid=0, tricks_won=0, round_bonus=20),
                domain_rules.RoundScoreInput(player_index=1, bid=2, tricks_won=2, round_bonus=30),
            ],
            round_number=3,
            bonus_enabled=True,
        )

        self.assertEqual(no_bonus[0].delta, 30)
        self.assertEqual(no_bonus[1].delta, 40)
        self.assertEqual(no_bonus[1].applied_bonus, 0)
        self.assertEqual(with_bonus[1].delta, 70)
        self.assertEqual(with_bonus[1].applied_bonus, 30)

    # ── calculate_trick_bonus tests ──

    def test_trick_bonus_fourteen_black_gives_20(self) -> None:
        bonus = domain_rules.calculate_trick_bonus(
            _numbered("black", 14),
            [_numbered("black", 14), _numbered("green", 5)],
        )
        self.assertEqual(bonus, 20)

    def test_trick_bonus_fourteen_color_gives_10(self) -> None:
        bonus = domain_rules.calculate_trick_bonus(
            _numbered("yellow", 14),
            [_numbered("yellow", 14), _numbered("green", 3)],
        )
        self.assertEqual(bonus, 10)

    def test_trick_bonus_pirate_captures_mermaids(self) -> None:
        bonus = domain_rules.calculate_trick_bonus(
            _special(rules.PIRATE),
            [_special(rules.PIRATE), _special(rules.MERMAID), _special(rules.MERMAID)],
        )
        self.assertEqual(bonus, 40)  # 20 per mermaid

    def test_trick_bonus_skull_king_captures_pirates(self) -> None:
        bonus = domain_rules.calculate_trick_bonus(
            _special(rules.SKULL_KING),
            [_special(rules.SKULL_KING), _special(rules.PIRATE), _special(rules.PIRATE)],
        )
        self.assertEqual(bonus, 60)  # 30 per pirate

    def test_trick_bonus_mermaid_captures_skull_king(self) -> None:
        bonus = domain_rules.calculate_trick_bonus(
            _special(rules.MERMAID),
            [_special(rules.MERMAID), _special(rules.SKULL_KING)],
        )
        self.assertEqual(bonus, 40)

    def test_trick_bonus_no_winner_gives_zero(self) -> None:
        bonus = domain_rules.calculate_trick_bonus(
            None,
            [_special(rules.ESCAPE), _special(rules.ESCAPE)],
        )
        self.assertEqual(bonus, 0)

    # ── Tigress interaction tests ──

    def test_tigress_as_pirate_beats_numbered(self) -> None:
        resolution = domain_rules.resolve_trick(
            _plays(
                _numbered("green", 10),
                _special(rules.TIGRESS, tigress_as=rules.PIRATE),
            ),
            num_players=2,
        )
        self.assertEqual(resolution.winner_index, 1)

    def test_tigress_as_escape_defers_lead(self) -> None:
        lead = domain_rules.determine_lead_suit_from_plays(
            _plays(
                _special(rules.TIGRESS, tigress_as=rules.ESCAPE),
                _numbered("purple", 8),
            )
        )
        self.assertEqual(lead, "purple")

    def test_tigress_as_pirate_loses_to_skull_king(self) -> None:
        resolution = domain_rules.resolve_trick(
            _plays(
                _special(rules.TIGRESS, tigress_as=rules.PIRATE),
                _special(rules.SKULL_KING),
            ),
            num_players=2,
        )
        self.assertEqual(resolution.winner_index, 1)

    def test_tigress_as_pirate_beats_mermaid(self) -> None:
        resolution = domain_rules.resolve_trick(
            _plays(
                _special(rules.MERMAID),
                _special(rules.TIGRESS, tigress_as=rules.PIRATE),
            ),
            num_players=2,
        )
        self.assertEqual(resolution.winner_index, 1)

    def test_calculate_round_score_delta_penalizes_bid_miss(self) -> None:
        delta = domain_rules.calculate_round_score_delta(
            round_number=5,
            bid=3,
            tricks_won=1,
            round_bonus=50,
            bonus_enabled=True,
        )

        self.assertEqual(delta, -20)


if __name__ == "__main__":
    unittest.main()
