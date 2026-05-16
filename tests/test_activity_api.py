import time
import unittest
from http.cookies import SimpleCookie
from unittest import mock

from fastapi import HTTPException
from fastapi import Response
from starlette.requests import Request

from discord_activity_skullking import api_server as srv


def _set_spectator_mode(allowed: bool) -> None:
    srv.ALLOW_ACTIVITY_SPECTATORS = bool(allowed)
    srv.SPECTATOR_POLICY = "allow_read_only" if allowed else "disabled"


def _request_with_cookies(
    cookies: dict[str, str] | None = None,
    headers: dict[str, str] | None = None,
    *,
    method: str = "GET",
    path: str = "/",
) -> Request:
    request_headers: list[tuple[bytes, bytes]] = []
    if headers:
        for key, value in headers.items():
            request_headers.append((str(key).lower().encode("utf-8"), str(value).encode("utf-8")))
    if cookies:
        header_value = "; ".join(f"{k}={v}" for k, v in cookies.items())
        request_headers.append((b"cookie", header_value.encode("utf-8")))
    scope = {
        "type": "http",
        "method": method,
        "path": path,
        "scheme": "http",
        "client": ("127.0.0.1", 50000),
        "headers": request_headers,
    }
    return Request(scope)


def _cookie_from_response(response: Response, name: str) -> str:
    raw = response.headers.get("set-cookie", "")
    parsed = SimpleCookie()
    parsed.load(raw)
    morsel = parsed.get(name)
    return str(morsel.value) if morsel else ""


class ActivityApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        srv.USE_MEMORY_SESSION_CACHE = True
        srv.FIREBASE_SESSIONS_ENABLED = False

    def setUp(self) -> None:
        srv.FIREBASE_SESSIONS_ENABLED = False
        srv.GAME_SERVICE = None
        with srv.LOCK:
            srv.SESSIONS.clear()
        with srv.RATE_LIMIT_BUCKETS_LOCK:
            srv.RATE_LIMIT_BUCKETS.clear()
        with srv.REQUEST_METRICS_LOCK:
            srv.REQUEST_METRICS["started_at"] = time.time()
            srv.REQUEST_METRICS["requests_total"] = 0
            srv.REQUEST_METRICS["errors_total"] = 0
            srv.REQUEST_METRICS["rate_limited_total"] = 0
            srv.REQUEST_METRICS["request_duration_ms_total"] = 0.0
            srv.REQUEST_METRICS["persistence_failures_total"] = 0
            srv.REQUEST_METRICS["status_counts"].clear()
            srv.REQUEST_METRICS["path_counts"].clear()
            srv.REQUEST_METRICS["persistence_failure_counts"].clear()
        _set_spectator_mode(False)
        self.host_id = "discord-host"
        self.p2_id = "discord-p2"

    def _create_room(self) -> tuple[str, str]:
        response = Response()
        payload = srv.CreateSessionPayload(
            player_id=self.host_id,
            player_name="Host",
            discord_user_id="1001",
            room_name="Room",
            max_players=4,
            bonus_enabled=False,
            advanced_rules_enabled=False,
        )
        created = srv.create_session(payload, response, _request_with_cookies())
        session_id = str(created["session_id"])
        token = _cookie_from_response(response, srv.identity_cookie_name(session_id))
        self.assertTrue(token)
        issued = str(created.get("identity_token") or "")
        self.assertTrue(issued)
        claims = srv.decode_identity_token(issued)
        self.assertEqual(str(claims.get("session_id") or ""), session_id)
        self.assertEqual(str(claims.get("player_id") or ""), self.host_id)
        return session_id, token

    def _join_p2(self, session_id: str) -> str:
        response = Response()
        payload = srv.JoinPayload(player_id=self.p2_id, player_name="P2", discord_user_id="1002")
        joined = srv.join_session(session_id, payload, response, _request_with_cookies())
        token = _cookie_from_response(response, srv.identity_cookie_name(session_id))
        self.assertTrue(token)
        issued = str(joined.get("identity_token") or "")
        self.assertTrue(issued)
        claims = srv.decode_identity_token(issued)
        self.assertEqual(str(claims.get("session_id") or ""), session_id)
        self.assertEqual(str(claims.get("player_id") or ""), self.p2_id)
        return token

    def _prepare_single_trick_round(self) -> tuple[str, Request, Request]:
        session_id, host_token = self._create_room()
        p2_token = self._join_p2(session_id)
        host_req = _request_with_cookies(headers={"x-sk-activity-identity": host_token})
        p2_req = _request_with_cookies(headers={"x-sk-activity-identity": p2_token})

        srv.set_player_state(session_id, srv.PlayerStatePayload(player_id=self.host_id, state="ready"), host_req)
        srv.set_player_state(session_id, srv.PlayerStatePayload(player_id=self.p2_id, state="ready"), p2_req)
        srv.start_game(session_id, srv.NextRoundPayload(player_id=self.host_id), host_req)
        srv.submit_bid(session_id, srv.BidPayload(player_id=self.host_id, bid=1), host_req)
        srv.submit_bid(session_id, srv.BidPayload(player_id=self.p2_id, bid=0), p2_req)

        with srv.LOCK:
            session = srv.resolve_session(session_id, create_if_missing=False)
            assert session is not None
            room = srv.session_doc_to_room(session)
            host = room.find_player(self.host_id)
            p2 = room.find_player(self.p2_id)
            host.hand = [srv.Card(suit="yellow", number=10)]
            p2.hand = [srv.Card(suit="green", number=9)]
            host.bid = 1
            p2.bid = 0
            host.tricks_won = 0
            p2.tricks_won = 0
            host.round_bonus = 0
            p2.round_bonus = 0
            room.round_number = 1
            room.leader_index = 0
            room.current_turn_index = 0
            room.current_trick.clear()
            room.phase = "playing"
            next_doc = srv.room_to_session_doc(room, prev=session)
            srv.sync_turn_timer_for_room_doc(next_doc, room, reset=True)
            srv.cache_set_session(next_doc)

        return session_id, host_req, p2_req

    def test_timeout_auto_bid_server_authoritative(self) -> None:
        session_id, host_token = self._create_room()
        p2_token = self._join_p2(session_id)

        host_req = _request_with_cookies({srv.identity_cookie_name(session_id): host_token})
        p2_req = _request_with_cookies({srv.identity_cookie_name(session_id): p2_token})

        r1 = srv.set_player_state(
            session_id,
            srv.PlayerStatePayload(player_id=self.host_id, state="ready"),
            host_req,
        )
        r2 = srv.set_player_state(
            session_id,
            srv.PlayerStatePayload(player_id=self.p2_id, state="ready"),
            p2_req,
        )
        self.assertEqual(r1["status"], "lobby")
        self.assertEqual(r2["status"], "lobby")

        started = srv.start_game(
            session_id,
            srv.NextRoundPayload(player_id=self.host_id),
            host_req,
        )
        self.assertEqual(started["status"], "bidding")

        with srv.LOCK:
            session = srv.resolve_session(session_id, create_if_missing=False)
            assert session is not None
            session["turn_deadline_at"] = int(time.time()) - 1
            session["updated_at"] = int(time.time())
            srv.cache_set_session(session)

        state = srv.get_state(
            session_id=session_id,
            player_id=self.host_id,
            discord_user_id="",
            since=0,
            wait_ms=0,
            compact=False,
            request=host_req,
        )
        bids = [p.get("bid") for p in state.get("players", [])]
        self.assertTrue(all(b is not None for b in bids), state)

    def test_afk_player_auto_bids_without_waiting_for_deadline(self) -> None:
        session_id, host_token = self._create_room()
        p2_token = self._join_p2(session_id)

        host_req = _request_with_cookies({srv.identity_cookie_name(session_id): host_token})
        p2_req = _request_with_cookies({srv.identity_cookie_name(session_id): p2_token})

        srv.set_player_state(session_id, srv.PlayerStatePayload(player_id=self.host_id, state="ready"), host_req)
        srv.set_player_state(session_id, srv.PlayerStatePayload(player_id=self.p2_id, state="ready"), p2_req)
        started = srv.start_game(session_id, srv.NextRoundPayload(player_id=self.host_id), host_req)
        self.assertEqual(started["status"], "bidding")

        with srv.LOCK:
            session = srv.resolve_session(session_id, create_if_missing=False)
            assert session is not None
            p2 = next(player for player in session["players"] if player["id"] == self.p2_id)
            p2["afk"] = True
            p2["afk_since"] = int(time.time())
            session["turn_deadline_at"] = int(time.time()) + 999
            srv.cache_set_session(session)

        state = srv.get_state(
            session_id=session_id,
            player_id=self.host_id,
            discord_user_id="",
            since=0,
            wait_ms=0,
            compact=False,
            request=host_req,
        )
        p2_state = next(player for player in state["players"] if player["id"] == self.p2_id)
        self.assertEqual(p2_state.get("bid"), 0)
        self.assertEqual(state.get("status"), "bidding")

    def test_reconnect_presence_state(self) -> None:
        session_id, host_token = self._create_room()
        host_req = _request_with_cookies({srv.identity_cookie_name(session_id): host_token})

        changed_to_connected = srv.set_player_connection_state(session_id, self.host_id, connected=True)
        self.assertFalse(changed_to_connected)

        changed_to_disconnected = srv.set_player_connection_state(session_id, self.host_id, connected=False)
        self.assertTrue(changed_to_disconnected)

        state = srv.get_state(
            session_id=session_id,
            player_id=self.host_id,
            discord_user_id="",
            since=0,
            wait_ms=0,
            compact=False,
            request=host_req,
        )
        mine = next(p for p in state["players"] if p["id"] == self.host_id)
        self.assertEqual(mine.get("connection_state"), "connected")

        with srv.LOCK:
            session = srv.resolve_session(session_id, create_if_missing=False)
            assert session is not None
            host = next(p for p in session["players"] if p["id"] == self.host_id)
            self.assertEqual(host.get("connection_state"), "connected")

    def test_session_public_state_includes_transport_metadata(self) -> None:
        session_id, host_token = self._create_room()
        host_req = _request_with_cookies({srv.identity_cookie_name(session_id): host_token})

        state = srv.get_state(
            session_id=session_id,
            player_id=self.host_id,
            discord_user_id="1001",
            since=0,
            wait_ms=0,
            compact=False,
            request=host_req,
        )

        transport = state.get("transport", {})
        self.assertEqual(transport.get("protocol_version"), srv.TRANSPORT_PROTOCOL_VERSION)
        self.assertEqual(int(transport.get("snapshot_revision") or 0), int(state.get("updated_at") or 0))
        self.assertEqual(bool(transport.get("compact")), False)
        self.assertGreater(int(transport.get("snapshot_generated_at_ms") or 0), 0)

        match_session = state.get("match_session", {})
        self.assertEqual(match_session.get("mode"), "shared_activity_session")
        self.assertEqual(match_session.get("phase_scope"), "lobby")
        self.assertEqual(match_session.get("commands_transport"), "http")
        self.assertEqual(match_session.get("replication_transport"), "websocket_with_poll_fallback")
        self.assertEqual(match_session.get("resume_strategy"), "snapshot_rehydrate")
        self.assertEqual(int(match_session.get("resume_window_seconds") or 0), srv.RECONNECT_GRACE_SECONDS)
        self.assertFalse(bool(match_session.get("match_continues_during_reconnect")))

    def test_match_state_exposes_reconnect_deadline(self) -> None:
        session_id, host_token = self._create_room()
        p2_token = self._join_p2(session_id)
        host_req = _request_with_cookies({srv.identity_cookie_name(session_id): host_token})
        p2_req = _request_with_cookies({srv.identity_cookie_name(session_id): p2_token})

        srv.set_player_state(session_id, srv.PlayerStatePayload(player_id=self.host_id, state="ready"), host_req)
        srv.set_player_state(session_id, srv.PlayerStatePayload(player_id=self.p2_id, state="ready"), p2_req)
        srv.start_game(session_id, srv.NextRoundPayload(player_id=self.host_id), host_req)

        changed = srv.set_player_connection_state(session_id, self.p2_id, connected=False)
        self.assertTrue(changed)

        state = srv.get_state(
            session_id=session_id,
            player_id=self.host_id,
            discord_user_id="1001",
            since=0,
            wait_ms=0,
            compact=False,
            request=host_req,
        )

        match_session = state.get("match_session", {})
        self.assertEqual(match_session.get("phase_scope"), "match_runtime")
        self.assertTrue(bool(match_session.get("match_continues_during_reconnect")))

        p2_state = next(player for player in state["players"] if player["id"] == self.p2_id)
        disconnected_at = int(p2_state.get("disconnected_at") or 0)
        reconnect_deadline_at = int(p2_state.get("reconnect_deadline_at") or 0)
        self.assertGreater(disconnected_at, 0)
        self.assertEqual(reconnect_deadline_at, disconnected_at + srv.RECONNECT_GRACE_SECONDS)
        self.assertEqual(p2_state.get("connection_state"), "reconnecting")

    def test_noop_connection_state_update_does_not_bump_snapshot_revision(self) -> None:
        session_id, _ = self._create_room()

        with srv.LOCK:
            session = srv.resolve_session(session_id, create_if_missing=False)
            assert session is not None
            baseline_updated_at = int(session.get("updated_at") or 0)

        changed = srv.set_player_connection_state(session_id, self.host_id, connected=True)
        self.assertFalse(changed)

        with srv.LOCK:
            session = srv.resolve_session(session_id, create_if_missing=False)
            assert session is not None
            self.assertEqual(int(session.get("updated_at") or 0), baseline_updated_at)

        changed = srv.set_player_connection_state(session_id, self.host_id, connected=False)
        self.assertTrue(changed)

        with srv.LOCK:
            session = srv.resolve_session(session_id, create_if_missing=False)
            assert session is not None
            disconnected_updated_at = int(session.get("updated_at") or 0)

        changed = srv.set_player_connection_state(session_id, self.host_id, connected=False)
        self.assertFalse(changed)

        with srv.LOCK:
            session = srv.resolve_session(session_id, create_if_missing=False)
            assert session is not None
            self.assertEqual(int(session.get("updated_at") or 0), disconnected_updated_at)

    def test_reconnect_grace_expiry_marks_afk(self) -> None:
        session_id, host_token = self._create_room()
        p2_token = self._join_p2(session_id)
        host_req = _request_with_cookies({srv.identity_cookie_name(session_id): host_token})
        p2_req = _request_with_cookies({srv.identity_cookie_name(session_id): p2_token})

        srv.set_player_state(session_id, srv.PlayerStatePayload(player_id=self.host_id, state="ready"), host_req)
        srv.set_player_state(session_id, srv.PlayerStatePayload(player_id=self.p2_id, state="ready"), p2_req)
        srv.start_game(session_id, srv.NextRoundPayload(player_id=self.host_id), host_req)

        with srv.LOCK:
            session = srv.resolve_session(session_id, create_if_missing=False)
            assert session is not None
            p2 = next(p for p in session["players"] if p["id"] == self.p2_id)
            p2["connection_state"] = "disconnected"
            p2["disconnected_at"] = int(time.time()) - (srv.RECONNECT_GRACE_SECONDS + 1)
            changed = srv.apply_reconnect_failure_policy_locked(session)
            self.assertTrue(changed)
            self.assertTrue(bool(p2.get("afk")))

    def test_mid_game_leave_forfeit_finishes_when_under_min_players(self) -> None:
        session_id, host_token = self._create_room()
        p2_token = self._join_p2(session_id)
        host_req = _request_with_cookies({srv.identity_cookie_name(session_id): host_token})
        p2_req = _request_with_cookies({srv.identity_cookie_name(session_id): p2_token})

        srv.set_player_state(session_id, srv.PlayerStatePayload(player_id=self.host_id, state="ready"), host_req)
        srv.set_player_state(session_id, srv.PlayerStatePayload(player_id=self.p2_id, state="ready"), p2_req)
        started = srv.start_game(session_id, srv.NextRoundPayload(player_id=self.host_id), host_req)
        self.assertEqual(started["status"], "bidding")

        leave_resp = Response()
        with mock.patch.object(srv, "clear_user_activity_presence_sync") as clear_presence:
            left = srv.leave_session(
                session_id,
                srv.LeavePayload(player_id=self.p2_id),
                p2_req,
                leave_resp,
            )
        clear_presence.assert_called_once_with(player_id=self.p2_id, discord_user_id="1002")
        self.assertTrue(left.get("forfeit", False))

        state = srv.get_state(
            session_id=session_id,
            player_id=self.host_id,
            discord_user_id="",
            since=0,
            wait_ms=0,
            compact=False,
            request=host_req,
        )
        self.assertEqual(state.get("status"), "finished")

    def test_timeout_streak_marks_afk(self) -> None:
        session_id, _ = self._create_room()
        with srv.LOCK:
            session = srv.resolve_session(session_id, create_if_missing=False)
            assert session is not None
            for _ in range(srv.AFK_TIMEOUT_STREAK_LIMIT):
                srv.mark_player_timeout_penalty(session, player_id=self.host_id)
            host = next(p for p in session["players"] if p["id"] == self.host_id)
            self.assertTrue(bool(host.get("afk")))
            self.assertGreaterEqual(int(host.get("consecutive_timeout_count", 0)), srv.AFK_TIMEOUT_STREAK_LIMIT)

    def test_afk_turn_auto_plays_without_waiting_for_deadline(self) -> None:
        session_id, host_req, p2_req = self._prepare_single_trick_round()

        with srv.LOCK:
            session = srv.resolve_session(session_id, create_if_missing=False)
            assert session is not None
            host = next(player for player in session["players"] if player["id"] == self.host_id)
            host["afk"] = True
            host["afk_since"] = int(time.time())
            session["turn_deadline_at"] = int(time.time()) + 999
            srv.cache_set_session(session)

        state = srv.get_state(
            session_id=session_id,
            player_id=self.p2_id,
            discord_user_id="",
            since=0,
            wait_ms=0,
            compact=False,
            request=p2_req,
        )

        self.assertEqual(len(state.get("current_trick", [])), 1)
        self.assertEqual(state["current_trick"][0]["player_id"], self.host_id)
        self.assertEqual(state.get("current_turn_player_id"), self.p2_id)
        self.assertTrue(any(bool(event.get("afk_auto")) for event in state.get("flow_events", [])))

    def test_spectator_access_control(self) -> None:
        session_id, host_token = self._create_room()
        host_req = _request_with_cookies({srv.identity_cookie_name(session_id): host_token})
        _ = srv.get_state(
            session_id=session_id,
            player_id=self.host_id,
            discord_user_id="",
            since=0,
            wait_ms=0,
            compact=False,
            request=host_req,
        )

        with self.assertRaises(HTTPException) as denied_ctx:
            srv.get_state(
                session_id=session_id,
                player_id="spectator-x",
                discord_user_id="",
                since=0,
                wait_ms=0,
                compact=False,
                request=_request_with_cookies(),
            )
        self.assertEqual(denied_ctx.exception.status_code, 403)

        _set_spectator_mode(True)
        spectator_state = srv.get_state(
            session_id=session_id,
            player_id="spectator-x",
            discord_user_id="",
            since=0,
            wait_ms=0,
            compact=False,
            request=_request_with_cookies(),
        )
        self.assertEqual(spectator_state.get("viewer_role"), "spectator")

    def test_state_accepts_canonical_player_via_discord_user_id(self) -> None:
        response = Response()
        payload = srv.CreateSessionPayload(
            player_id="player-local-host",
            player_name="Host",
            discord_user_id="1001",
            room_name="Room",
            max_players=4,
            bonus_enabled=False,
            advanced_rules_enabled=False,
        )
        created = srv.create_session(payload, response, _request_with_cookies())
        session_id = str(created["session_id"])
        token = _cookie_from_response(response, srv.identity_cookie_name(session_id))
        self.assertTrue(token)

        host_req = _request_with_cookies({srv.identity_cookie_name(session_id): token})
        state = srv.get_state(
            session_id=session_id,
            player_id="discord-1001",
            discord_user_id="1001",
            since=0,
            wait_ms=0,
            compact=False,
            request=host_req,
        )
        self.assertEqual(state.get("viewer_role"), "player")
        mine = next(p for p in state.get("players", []) if p.get("id") == "player-local-host")
        self.assertEqual(mine.get("discord_user_id"), "1001")

    def test_compact_state_trims_player_meta_and_logs(self) -> None:
        session_id, host_token = self._create_room()
        self._join_p2(session_id)
        host_req = _request_with_cookies(headers={"x-sk-activity-identity": host_token})

        with srv.LOCK:
            session = srv.resolve_session(session_id, create_if_missing=False)
            assert session is not None
            session["logs"] = [f"log-{idx}" for idx in range(6)]
            session["flow_events"] = [{"kind": f"evt-{idx}"} for idx in range(6)]
            srv.bump_session_updated_at(session)
            srv.cache_set_session(session)

        state = srv.get_state(
            session_id,
            player_id=self.host_id,
            discord_user_id="1001",
            since=0,
            wait_ms=0,
            compact=True,
            request=host_req,
        )

        mine = next(p for p in state.get("players", []) if p.get("id") == self.host_id)
        self.assertNotIn("discord_user_id", mine)
        self.assertNotIn("avatar_url", mine)
        self.assertNotIn("last_seen_at", mine)
        self.assertEqual(state.get("logs"), [])
        self.assertEqual(state.get("latest_log"), "log-0")
        self.assertEqual([event.get("kind") for event in state.get("flow_events", [])], ["evt-2", "evt-3", "evt-4", "evt-5"])

    def test_create_session_blocks_duplicate_active_membership(self) -> None:
        session_id, _ = self._create_room()

        with self.assertRaises(HTTPException) as ctx:
            srv.create_session(
                srv.CreateSessionPayload(
                    player_id=self.host_id,
                    player_name="Host Again",
                    discord_user_id="1001",
                    room_name="Another Room",
                    max_players=4,
                    bonus_enabled=False,
                    advanced_rules_enabled=False,
                ),
                Response(),
                _request_with_cookies(),
            )

        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(str(ctx.exception.detail), f"already_joined_session:{session_id}")

    def test_join_session_blocks_duplicate_active_membership(self) -> None:
        first_session_id, _ = self._create_room()
        second_created = srv.create_session(
            srv.CreateSessionPayload(
                player_id="discord-other",
                player_name="Other Host",
                discord_user_id="2002",
                room_name="Other Room",
                max_players=4,
                bonus_enabled=False,
                advanced_rules_enabled=False,
            ),
            Response(),
            _request_with_cookies(),
        )
        second_session_id = str(second_created["session_id"])

        with self.assertRaises(HTTPException) as ctx:
            srv.join_session(
                second_session_id,
                srv.JoinPayload(
                    player_id=self.host_id,
                    player_name="Host",
                    discord_user_id="1001",
                ),
                Response(),
                _request_with_cookies(),
            )

        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(str(ctx.exception.detail), f"already_joined_session:{first_session_id}")

    def test_list_sessions_prunes_expired_solo_lobby(self) -> None:
        session_id, _ = self._create_room()
        stale_ts = int(time.time()) - srv.SOLO_LOBBY_EXPIRY_SECONDS - 10

        with srv.LOCK:
            session = srv.resolve_session(session_id, create_if_missing=False)
            assert session is not None
            session["created_at"] = stale_ts
            session["updated_at"] = stale_ts * 1000
            host = next(player for player in session["players"] if player["id"] == self.host_id)
            host["joined_at"] = stale_ts
            host["last_seen_at"] = stale_ts
            host["connection_state"] = "connected"
            srv.cache_set_session(session)

        rooms = srv.list_sessions(limit=20)["rooms"]
        self.assertNotIn(session_id, [room["session_id"] for room in rooms])

        with srv.LOCK:
            self.assertIsNone(srv.resolve_session(session_id, create_if_missing=False))

    def test_identity_token_blocks_forged_player_id(self) -> None:
        session_id, host_token = self._create_room()
        _ = self._join_p2(session_id)
        host_req = _request_with_cookies({srv.identity_cookie_name(session_id): host_token})

        with self.assertRaises(HTTPException) as ctx:
            srv.set_player_state(
                session_id,
                srv.PlayerStatePayload(player_id=self.p2_id, state="ready"),
                host_req,
            )
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("identity_token_player_mismatch", str(ctx.exception.detail))

    def test_state_accepts_identity_token_header_without_cookie(self) -> None:
        session_id, host_token = self._create_room()
        header_req = _request_with_cookies(headers={"x-sk-activity-identity": host_token})

        state = srv.get_state(
            session_id=session_id,
            player_id=self.host_id,
            discord_user_id="1001",
            since=0,
            wait_ms=0,
            compact=False,
            request=header_req,
        )
        self.assertEqual(state.get("viewer_role"), "player")
        issued = str(state.get("identity_token") or "")
        self.assertTrue(issued)
        claims = srv.decode_identity_token(issued)
        self.assertEqual(str(claims.get("session_id") or ""), session_id)
        self.assertEqual(str(claims.get("player_id") or ""), self.host_id)

    def test_bid_keeps_shared_deadline_until_all_bids_locked(self) -> None:
        session_id, host_token = self._create_room()
        p2_token = self._join_p2(session_id)
        host_req = _request_with_cookies(headers={"x-sk-activity-identity": host_token})
        p2_req = _request_with_cookies(headers={"x-sk-activity-identity": p2_token})

        srv.set_player_state(session_id, srv.PlayerStatePayload(player_id=self.host_id, state="ready"), host_req)
        srv.set_player_state(session_id, srv.PlayerStatePayload(player_id=self.p2_id, state="ready"), p2_req)
        started = srv.start_game(session_id, srv.NextRoundPayload(player_id=self.host_id), host_req)
        original_deadline = int(started.get("turn_deadline_at") or 0)
        self.assertGreater(original_deadline, 0)

        bid_state = srv.submit_bid(
            session_id,
            srv.BidPayload(player_id=self.host_id, bid=1),
            host_req,
        )
        self.assertEqual(int(bid_state.get("turn_deadline_at") or 0), original_deadline)

    def test_turn_timer_setting_persists_into_started_round(self) -> None:
        session_id, host_token = self._create_room()
        p2_token = self._join_p2(session_id)
        host_req = _request_with_cookies(headers={"x-sk-activity-identity": host_token})
        p2_req = _request_with_cookies(headers={"x-sk-activity-identity": p2_token})

        updated = srv.update_settings(
            session_id,
            srv.UpdateSettingsPayload(
                player_id=self.host_id,
                turn_limit_seconds=45,
                allow_spectators=True,
            ),
            host_req,
        )
        self.assertEqual(int(updated["settings"]["turn_limit_seconds"]), 45)
        self.assertTrue(bool(updated["settings"]["allow_spectators"]))

        srv.set_player_state(session_id, srv.PlayerStatePayload(player_id=self.host_id, state="ready"), host_req)
        srv.set_player_state(session_id, srv.PlayerStatePayload(player_id=self.p2_id, state="ready"), p2_req)
        started = srv.start_game(session_id, srv.NextRoundPayload(player_id=self.host_id), host_req)

        self.assertEqual(int(started.get("turn_limit_seconds") or 0), 45)
        self.assertEqual(int(started["settings"]["turn_limit_seconds"]), 45)
        self.assertTrue(bool(started["settings"]["allow_spectators"]))

    def test_partial_setting_update_preserves_other_toggles(self) -> None:
        session_id, host_token = self._create_room()
        host_req = _request_with_cookies(headers={"x-sk-activity-identity": host_token})

        first = srv.update_settings(
            session_id,
            srv.UpdateSettingsPayload(
                player_id=self.host_id,
                bonus_enabled=True,
            ),
            host_req,
        )
        self.assertTrue(bool(first["settings"]["bonus_enabled"]))
        self.assertFalse(bool(first["settings"]["advanced_rules_enabled"]))

        second = srv.update_settings(
            session_id,
            srv.UpdateSettingsPayload(
                player_id=self.host_id,
                advanced_rules_enabled=True,
            ),
            host_req,
        )
        self.assertTrue(bool(second["settings"]["bonus_enabled"]))
        self.assertTrue(bool(second["settings"]["advanced_rules_enabled"]))

    def test_partial_setting_update_preserves_other_settings_across_multiple_changes(self) -> None:
        session_id, host_token = self._create_room()
        host_req = _request_with_cookies(headers={"x-sk-activity-identity": host_token})

        first = srv.update_settings(
            session_id,
            srv.UpdateSettingsPayload(
                player_id=self.host_id,
                turn_limit_seconds=45,
                bonus_enabled=True,
            ),
            host_req,
        )
        self.assertEqual(int(first["settings"]["turn_limit_seconds"]), 45)
        self.assertTrue(bool(first["settings"]["bonus_enabled"]))
        self.assertFalse(bool(first["settings"]["advanced_rules_enabled"]))
        self.assertFalse(bool(first["settings"]["allow_spectators"]))

        second = srv.update_settings(
            session_id,
            srv.UpdateSettingsPayload(
                player_id=self.host_id,
                advanced_rules_enabled=True,
            ),
            host_req,
        )
        self.assertEqual(int(second["settings"]["turn_limit_seconds"]), 45)
        self.assertTrue(bool(second["settings"]["bonus_enabled"]))
        self.assertTrue(bool(second["settings"]["advanced_rules_enabled"]))
        self.assertFalse(bool(second["settings"]["allow_spectators"]))

        third = srv.update_settings(
            session_id,
            srv.UpdateSettingsPayload(
                player_id=self.host_id,
                allow_spectators=True,
            ),
            host_req,
        )
        self.assertEqual(int(third["settings"]["turn_limit_seconds"]), 45)
        self.assertTrue(bool(third["settings"]["bonus_enabled"]))
        self.assertTrue(bool(third["settings"]["advanced_rules_enabled"]))
        self.assertTrue(bool(third["settings"]["allow_spectators"]))

    def test_host_and_membership_validation(self) -> None:
        session_id, host_token = self._create_room()
        host_req = _request_with_cookies({srv.identity_cookie_name(session_id): host_token})

        with self.assertRaises(HTTPException) as outsider_ctx:
            srv.start_game(
                session_id,
                srv.NextRoundPayload(player_id=self.p2_id),
                _request_with_cookies(),
            )
        self.assertEqual(outsider_ctx.exception.status_code, 404)

        p2_token = self._join_p2(session_id)
        p2_req = _request_with_cookies({srv.identity_cookie_name(session_id): p2_token})

        srv.set_player_state(session_id, srv.PlayerStatePayload(player_id=self.host_id, state="ready"), host_req)
        srv.set_player_state(session_id, srv.PlayerStatePayload(player_id=self.p2_id, state="ready"), p2_req)

        with self.assertRaises(HTTPException) as participant_ctx:
            srv.start_game(
                session_id,
                srv.NextRoundPayload(player_id=self.p2_id),
                p2_req,
            )
        self.assertEqual(participant_ctx.exception.status_code, 403)

    def test_ready_update_keeps_monotonic_updated_at(self) -> None:
        session_id, host_token = self._create_room()
        host_req = _request_with_cookies({srv.identity_cookie_name(session_id): host_token})

        joined = srv.get_state(
            session_id=session_id,
            player_id=self.host_id,
            discord_user_id="1001",
            since=0,
            wait_ms=0,
            compact=False,
            request=host_req,
        )
        ready_state = srv.set_player_state(
            session_id,
            srv.PlayerStatePayload(player_id=self.host_id, state="ready"),
            host_req,
        )

        self.assertGreater(int(ready_state.get("updated_at") or 0), int(joined.get("updated_at") or 0))
        host_row = next(p for p in ready_state.get("players", []) if p.get("id") == self.host_id)
        self.assertEqual(str(host_row.get("state") or ""), "ready")

    def test_start_requires_two_players(self) -> None:
        session_id, host_token = self._create_room()
        host_req = _request_with_cookies({srv.identity_cookie_name(session_id): host_token})

        with self.assertRaises(HTTPException) as ctx:
            srv.start_game(
                session_id,
                srv.NextRoundPayload(player_id=self.host_id),
                host_req,
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(str(ctx.exception.detail), "2인 이상이서 Start 할 수 있습니다.")

    def test_waiting_round_start_does_not_require_re_ready(self) -> None:
        session_id, host_req, p2_req = self._prepare_single_trick_round()

        srv.play_card(
            session_id,
            srv.PlayPayload(player_id=self.host_id, card_index=0),
            host_req,
        )
        scored = srv.play_card(
            session_id,
            srv.PlayPayload(player_id=self.p2_id, card_index=0),
            p2_req,
        )
        self.assertEqual(scored["status"], "waiting_round")

        updated = srv.set_player_state(
            session_id,
            srv.PlayerStatePayload(player_id=self.p2_id, state="not_ready"),
            p2_req,
        )
        self.assertEqual(updated["status"], "waiting_round")

        restarted = srv.start_game(
            session_id,
            srv.NextRoundPayload(player_id=self.host_id),
            host_req,
        )
        self.assertEqual(restarted["status"], "bidding")

    def test_finished_state_transition_visible(self) -> None:
        session_id, host_token = self._create_room()
        host_req = _request_with_cookies({srv.identity_cookie_name(session_id): host_token})

        with srv.LOCK:
            session = srv.resolve_session(session_id, create_if_missing=False)
            assert session is not None
            session["room_status"] = "finished"
            session["phase"] = "idle"
            srv.normalize_session_status_fields(session)
            session["updated_at"] = int(time.time())
            srv.cache_set_session(session)

        state = srv.get_state(
            session_id=session_id,
            player_id=self.host_id,
            discord_user_id="",
            since=0,
            wait_ms=0,
            compact=False,
            request=host_req,
        )
        self.assertEqual(state.get("status"), "finished")

    def test_finished_session_can_re_ready_and_restart_as_new_game(self) -> None:
        session_id, host_token = self._create_room()
        p2_token = self._join_p2(session_id)
        host_req = _request_with_cookies(headers={"x-sk-activity-identity": host_token})
        p2_req = _request_with_cookies(headers={"x-sk-activity-identity": p2_token})

        with srv.LOCK:
            session = srv.resolve_session(session_id, create_if_missing=False)
            assert session is not None
            session["status"] = "finished"
            session["room_status"] = "finished"
            session["phase"] = "idle"
            session["round_number"] = 10
            for idx, player in enumerate(session["players"]):
                player["score"] = 100 - (idx * 10)
                player["state"] = "not_ready"
                player["hand"] = []
                player["bid"] = None
                player["tricks_won"] = 0
                player["round_bonus"] = 0
            srv.bump_session_updated_at(session)
            srv.cache_set_session(session)

        ready_host = srv.set_player_state(
            session_id,
            srv.PlayerStatePayload(player_id=self.host_id, state="ready"),
            host_req,
        )
        ready_p2 = srv.set_player_state(
            session_id,
            srv.PlayerStatePayload(player_id=self.p2_id, state="ready"),
            p2_req,
        )
        self.assertEqual(
            next(p for p in ready_host["players"] if p["id"] == self.host_id)["state"],
            "ready",
        )
        self.assertEqual(
            next(p for p in ready_p2["players"] if p["id"] == self.p2_id)["state"],
            "ready",
        )

        restarted = srv.start_game(
            session_id,
            srv.NextRoundPayload(player_id=self.host_id),
            host_req,
        )
        self.assertEqual(restarted["status"], "bidding")
        self.assertEqual(int(restarted["round_number"]), 1)
        self.assertTrue(all(int(player["score"]) == 0 for player in restarted["players"]))

    def test_finished_session_can_return_to_lobby_and_reappear_in_room_search(self) -> None:
        session_id, host_token = self._create_room()
        p2_token = self._join_p2(session_id)
        host_req = _request_with_cookies(headers={"x-sk-activity-identity": host_token})
        p2_req = _request_with_cookies(headers={"x-sk-activity-identity": p2_token})

        with srv.LOCK:
            session = srv.resolve_session(session_id, create_if_missing=False)
            assert session is not None
            session["status"] = "finished"
            session["room_status"] = "finished"
            session["phase"] = "idle"
            session["round_number"] = 10
            session["current_trick"] = [{"player_id": self.host_id, "card": {"type": "pirate", "suit": None, "value": None}}]
            session["last_trick"] = [{"player_id": self.p2_id, "card": {"type": "escape", "suit": None, "value": None}}]
            session["flow_events"] = [{"kind": "round_scored"}]
            session["turn_started_at"] = 123
            session["turn_deadline_at"] = 456
            for idx, player in enumerate(session["players"]):
                player["score"] = 120 - (idx * 10)
                player["state"] = "ready"
                player["hand"] = [{"type": "pirate", "suit": None, "value": None}]
                player["bid"] = 1
                player["tricks_won"] = 2
                player["round_bonus"] = 30
            srv.bump_session_updated_at(session)
            srv.cache_set_session(session)

        returned = srv.return_session_to_lobby(
            session_id,
            srv.NextRoundPayload(player_id=self.host_id),
            host_req,
        )

        self.assertEqual(returned["status"], "lobby")
        self.assertEqual(int(returned["round_number"]), 0)
        self.assertEqual(returned.get("current_trick"), [])
        self.assertEqual(returned.get("last_trick"), [])
        self.assertTrue(all(player["state"] == "not_ready" for player in returned["players"]))
        self.assertTrue(all(int(player["score"]) == 0 for player in returned["players"]))

        rooms = srv.list_sessions(limit=20)["rooms"]
        self.assertIn(session_id, [room["session_id"] for room in rooms])

        host_player = next(player for player in returned["players"] if player["id"] == self.host_id)
        self.assertEqual(host_player["state"], "not_ready")

        ready_again = srv.set_player_state(
            session_id,
            srv.PlayerStatePayload(player_id=self.host_id, state="ready"),
            host_req,
        )
        self.assertEqual(
            next(player for player in ready_again["players"] if player["id"] == self.host_id)["state"],
            "ready",
        )

    def test_play_card_emits_flow_events_and_schedules_broadcast(self) -> None:
        session_id, host_req, _ = self._prepare_single_trick_round()

        with mock.patch.object(srv, "schedule_session_broadcast") as broadcast_mock:
            state = srv.play_card(
                session_id,
                srv.PlayPayload(player_id=self.host_id, card_index=0),
                host_req,
            )

        flow_kinds = [str(event.get("kind") or "") for event in state.get("flow_events", [])]
        self.assertIn("card_played", flow_kinds)
        self.assertIn("turn_changed", flow_kinds)
        self.assertEqual(len(state.get("current_trick", [])), 1)
        self.assertEqual(state.get("current_turn_player_id"), self.p2_id)
        broadcast_mock.assert_called_once_with(session_id, force=True)

    def test_play_card_rejects_wrong_turn_and_duplicate_submit(self) -> None:
        session_id, host_req, p2_req = self._prepare_single_trick_round()

        with self.assertRaises(HTTPException) as wrong_turn_ctx:
            srv.play_card(
                session_id,
                srv.PlayPayload(player_id=self.p2_id, card_index=0),
                p2_req,
            )
        self.assertEqual(wrong_turn_ctx.exception.status_code, 409)
        self.assertEqual(str(wrong_turn_ctx.exception.detail), "not your turn")

        _ = srv.play_card(
            session_id,
            srv.PlayPayload(player_id=self.host_id, card_index=0),
            host_req,
        )

        with self.assertRaises(HTTPException) as duplicate_ctx:
            srv.play_card(
                session_id,
                srv.PlayPayload(player_id=self.host_id, card_index=0),
                host_req,
            )
        self.assertEqual(duplicate_ctx.exception.status_code, 409)
        self.assertEqual(str(duplicate_ctx.exception.detail), "player already played in this trick")

    def test_play_card_closes_trick_and_scores_round(self) -> None:
        session_id, host_req, p2_req = self._prepare_single_trick_round()

        _ = srv.play_card(
            session_id,
            srv.PlayPayload(player_id=self.host_id, card_index=0),
            host_req,
        )
        state = srv.play_card(
            session_id,
            srv.PlayPayload(player_id=self.p2_id, card_index=0),
            p2_req,
        )

        flow_kinds = [str(event.get("kind") or "") for event in state.get("flow_events", [])]
        self.assertIn("card_played", flow_kinds)
        self.assertIn("trick_resolved", flow_kinds)
        self.assertIn("round_scored", flow_kinds)
        self.assertEqual(state.get("phase"), "waiting_next_round")
        self.assertEqual(state.get("tricks_completed"), 1)
        self.assertEqual(state.get("last_winner_id"), self.host_id)
        self.assertEqual(len(state.get("current_trick", [])), 0)
        self.assertEqual(len(state.get("last_trick", [])), 2)

        rows = {str(row.get("player_id")): row for row in state.get("score_breakdown", [])}
        self.assertEqual(int(rows[self.host_id]["tricks_won"]), 1)
        self.assertEqual(int(rows[self.host_id]["score"]), 20)
        self.assertEqual(int(rows[self.p2_id]["tricks_won"]), 0)
        self.assertEqual(int(rows[self.p2_id]["score"]), 10)

    def test_play_card_rejects_closed_trick_submit(self) -> None:
        session_id, host_req, _ = self._prepare_single_trick_round()

        with srv.LOCK:
            session = srv.resolve_session(session_id, create_if_missing=False)
            assert session is not None
            room = srv.session_doc_to_room(session)
            room.current_trick = [
                srv.engine.TrickPlay(player_id=self.host_id, card=srv.Card(suit="yellow", number=10)),
                srv.engine.TrickPlay(player_id=self.p2_id, card=srv.Card(suit="green", number=9)),
            ]
            room.current_turn_index = 0
            room.phase = "playing"
            next_doc = srv.room_to_session_doc(room, prev=session)
            srv.cache_set_session(next_doc)

        with self.assertRaises(HTTPException) as ctx:
            srv.play_card(
                session_id,
                srv.PlayPayload(player_id=self.host_id, card_index=0),
                host_req,
            )
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(str(ctx.exception.detail), "trick already closed; refresh state")

    def test_trick_reveal_hold_blocks_next_play_briefly(self) -> None:
        session_id, host_token = self._create_room()
        p2_token = self._join_p2(session_id)
        host_req = _request_with_cookies(headers={"x-sk-activity-identity": host_token})
        p2_req = _request_with_cookies(headers={"x-sk-activity-identity": p2_token})

        srv.set_player_state(session_id, srv.PlayerStatePayload(player_id=self.host_id, state="ready"), host_req)
        srv.set_player_state(session_id, srv.PlayerStatePayload(player_id=self.p2_id, state="ready"), p2_req)
        _ = srv.start_game(session_id, srv.NextRoundPayload(player_id=self.host_id), host_req)

        with srv.LOCK:
            session = srv.resolve_session(session_id, create_if_missing=False)
            assert session is not None
            room = srv.session_doc_to_room(session)
            room.round_number = 2
            room.status = "playing"
            room.phase = "playing"
            room.leader_index = 0
            room.current_turn_index = 0
            room.tricks_completed = 0
            room.current_trick.clear()
            room.players[0].bid = 0
            room.players[1].bid = 0
            room.players[0].hand = [srv.Card(suit="yellow", number=10), srv.Card(suit="yellow", number=8)]
            room.players[1].hand = [srv.Card(suit="yellow", number=4), srv.Card(suit="yellow", number=2)]
            next_doc = srv.room_to_session_doc(room, prev=session)
            srv.sync_turn_timer_for_room_doc(next_doc, room, reset=True)
            session.clear()
            session.update(next_doc)
            srv.cache_set_session(session)

        _ = srv.play_card(
            session_id,
            srv.PlayPayload(player_id=self.host_id, card_index=0),
            host_req,
        )
        state = srv.play_card(
            session_id,
            srv.PlayPayload(player_id=self.p2_id, card_index=0),
            p2_req,
        )

        self.assertEqual(state.get("phase"), "playing")
        self.assertEqual(state.get("current_trick"), [])
        self.assertEqual(state.get("tricks_completed"), 1)
        self.assertGreater(int(state.get("trick_hold_until") or 0), int(time.time()))
        self.assertGreaterEqual(int(state.get("turn_started_at") or 0), int(state.get("trick_hold_until") or 0))

        with self.assertRaises(HTTPException) as hold_ctx:
            srv.play_card(
                session_id,
                srv.PlayPayload(player_id=self.host_id, card_index=0),
                host_req,
            )
        self.assertEqual(hold_ctx.exception.status_code, 409)
        self.assertEqual(str(hold_ctx.exception.detail), "trick reveal in progress")

    def test_identity_cookie_policy_uses_none_for_discord_activity_headers(self) -> None:
        request = _request_with_cookies(
            headers={
                "host": "activity.example.com",
                "origin": "https://discord.com",
                "sec-fetch-site": "cross-site",
            }
        )
        samesite, secure = srv.resolve_identity_cookie_policy(request)
        self.assertEqual(samesite, "none")
        self.assertTrue(secure)

    def test_health_payload_reports_readiness_metadata(self) -> None:
        with mock.patch.object(
            srv,
            "load_discord_runtime_config",
            return_value={"discord_client_id": "cid", "discord_client_secret": "secret"},
        ), mock.patch.object(srv, "DEPLOYMENT_MODE", "single_instance"):
            payload = srv.build_health_payload()

        self.assertTrue(payload["ok"])
        self.assertTrue(payload["ready"])
        self.assertEqual(payload["status"], "degraded")
        self.assertEqual(payload["deployment_mode"], "single_instance")
        self.assertTrue(payload["oauth_configured"])
        self.assertTrue(payload["identity_signing_key_configured"])
        self.assertIn("firebase_persistence_disabled", payload["warnings"])

    def test_metrics_payload_summarizes_runtime_counters(self) -> None:
        srv.observe_request_metric("/health", 200, 5.0)
        srv.observe_request_metric("/activity/sessions/demo/state", 429, 7.5, rate_limited=True)
        srv.record_persistence_failure("save")

        payload = srv.build_metrics_payload()

        self.assertEqual(payload["requests_total"], 2)
        self.assertEqual(payload["errors_total"], 1)
        self.assertEqual(payload["rate_limited_total"], 1)
        self.assertEqual(payload["persistence_failures_total"], 1)
        self.assertEqual(payload["status_counts"]["2xx"], 1)
        self.assertEqual(payload["status_counts"]["4xx"], 1)
        self.assertEqual(payload["persistence_failure_counts"]["save"], 1)
        self.assertGreater(payload["average_request_duration_ms"], 0.0)

    def test_player_state_response_does_not_hit_userdb_presence_lookup(self) -> None:
        session_id, host_token = self._create_room()
        host_req = _request_with_cookies({srv.identity_cookie_name(session_id): host_token})

        with mock.patch.object(srv, "get_viewer_presence_state", side_effect=AssertionError("should not load UserDB")):
            state = srv.get_state(
                session_id=session_id,
                player_id=self.host_id,
                discord_user_id="1001",
                since=0,
                wait_ms=0,
                compact=False,
                request=host_req,
            )

        self.assertEqual(state.get("viewer_role"), "player")
        self.assertEqual(state.get("viewer_presence"), "waiting")
        self.assertTrue(bool(state.get("viewer_in_session")))

    def test_rate_limit_bucket_enforces_threshold(self) -> None:
        request = _request_with_cookies(
            headers={"x-forwarded-for": "10.0.0.8"},
            method="POST",
            path="/activity/sessions/demo/play",
        )
        original_enabled = srv.ENABLE_RATE_LIMIT
        original_limit = srv.RATE_LIMIT_MUTATION_MAX_REQUESTS
        try:
            srv.ENABLE_RATE_LIMIT = True
            srv.RATE_LIMIT_MUTATION_MAX_REQUESTS = 2
            self.assertIsNone(srv.consume_rate_limit_slot(request))
            self.assertIsNone(srv.consume_rate_limit_slot(request))
            limited = srv.consume_rate_limit_slot(request)
        finally:
            srv.ENABLE_RATE_LIMIT = original_enabled
            srv.RATE_LIMIT_MUTATION_MAX_REQUESTS = original_limit

        assert limited is not None
        self.assertEqual(limited["bucket"], "mutation")
        self.assertEqual(limited["client_ip"], "10.0.0.8")
        self.assertGreaterEqual(int(limited["retry_after_seconds"]), 1)

    def test_run_defaults_to_non_reload(self) -> None:
        with mock.patch.dict("os.environ", {}, clear=False), mock.patch("uvicorn.run") as uvicorn_run:
            srv.run()

        uvicorn_run.assert_called_once()
        _, kwargs = uvicorn_run.call_args
        self.assertEqual(kwargs["host"], "0.0.0.0")
        self.assertEqual(kwargs["port"], 8010)
        self.assertFalse(kwargs["reload"])


    def test_full_10_round_game_e2e(self) -> None:
        """Play a full 10-round game with 2 players, verifying game completes."""
        with mock.patch.object(srv, "TRICK_REVEAL_HOLD_SECONDS", 0):
            session_id, host_token = self._create_room()
            p2_token = self._join_p2(session_id)
            host_req = _request_with_cookies(headers={"x-sk-activity-identity": host_token})
            p2_req = _request_with_cookies(headers={"x-sk-activity-identity": p2_token})

            srv.set_player_state(session_id, srv.PlayerStatePayload(player_id=self.host_id, state="ready"), host_req)
            srv.set_player_state(session_id, srv.PlayerStatePayload(player_id=self.p2_id, state="ready"), p2_req)

            req_by_player = {self.host_id: host_req, self.p2_id: p2_req}

            for round_num in range(1, 11):
                result = srv.start_game(session_id, srv.NextRoundPayload(player_id=self.host_id), host_req)
                self.assertIn(result.get("status"), ("bidding",), f"Round {round_num}: expected bidding")

                srv.submit_bid(session_id, srv.BidPayload(player_id=self.host_id, bid=0), host_req)
                srv.submit_bid(session_id, srv.BidPayload(player_id=self.p2_id, bid=0), p2_req)

                for trick in range(round_num):
                    with srv.LOCK:
                        session = srv.resolve_session(session_id, create_if_missing=False)
                        assert session is not None
                        room = srv.session_doc_to_room(session)

                    for _ in range(2):
                        with srv.LOCK:
                            session = srv.resolve_session(session_id, create_if_missing=False)
                            assert session is not None
                            room = srv.session_doc_to_room(session)
                            turn_player = room.players[room.current_turn_index]
                            turn_id = turn_player.id
                            legal = srv.legal_card_indexes_room(room, turn_player)
                            card_index = legal[0]
                            chosen_card = turn_player.hand[card_index]
                            tigress_mode = "escape" if chosen_card.kind == "tigress" else None

                        req = req_by_player[turn_id]
                        srv.play_card(session_id, srv.PlayPayload(
                            player_id=turn_id, card_index=card_index, tigress_mode=tigress_mode,
                        ), req)

                with srv.LOCK:
                    session = srv.resolve_session(session_id, create_if_missing=False)
                    assert session is not None
                    if round_num < 10:
                        self.assertEqual(session.get("phase"), "waiting_next_round", f"Round {round_num}")
                    else:
                        self.assertEqual(str(session.get("room_status", "")).lower(), "finished")

            state = srv.get_state(
                session_id=session_id,
                player_id=self.host_id,
                discord_user_id="",
                since=0,
                wait_ms=0,
                compact=False,
                request=host_req,
            )
            self.assertEqual(state.get("status"), "finished")
            players = state.get("players", [])
            self.assertEqual(len(players), 2)
            for p in players:
                self.assertIsNotNone(p.get("score"))


if __name__ == "__main__":
    unittest.main()
