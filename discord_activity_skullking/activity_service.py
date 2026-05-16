import random
import time
from typing import Any, Dict, List, Optional

from .core import game_engine as engine
from .core.firebase_store import ActivitySessionDB, DataBase, RoomDB, UserDB


class GameService:
    def __init__(self) -> None:
        DataBase.connect()
        self.room_db = RoomDB()
        self.user_db = UserDB()
        self.activity_session_db = ActivitySessionDB()
        
    async def generate_room_id(self) -> str:
        for _ in range(50):
            room_id = f"{random.randint(0, 99_999):05d}"
            if await self.room_db.get_room(room_id) is None:
                return room_id

        raise RuntimeError("방 ID 생성 실패")

    async def get_registered_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        return await self.user_db.load(user_id)

    async def set_user_current_room(self, user_id: str, room_id: Optional[str]) -> None:
        await self.user_db.update(user_id, {"current_room_id": room_id})

    async def get_room_state(self, room_id: str):
        room_dict = await self.room_db.load(room_id)
        if room_dict is None:
            return None
        return engine.room_from_dict(room_dict)

    async def save_room_state(self, room) -> None:
        await self.room_db.save_room(room.id, engine.room_to_dict(room))

    async def build_room_cards_data(self) -> List[Dict[str, Any]]:
        rooms = await self.room_db.load_all() or {}
        rooms_data: List[Dict[str, Any]] = []

        for room_id, room_dict in rooms.items():
            if not isinstance(room_dict, dict):
                continue

            host_player_id = room_dict.get("host_player")
            host_player = await self.user_db.load(host_player_id) if host_player_id else None
            host_name = host_player.get("name", "알 수 없음") if host_player else "알 수 없음"

            players = room_dict.get("players") or []
            player_count = len(players)
            settings = room_dict.get("settings") or {}
            max_players = int(settings.get("max_players", 6))

            rooms_data.append(
                {
                    "id": room_dict.get("id", room_id),
                    "name": room_dict.get("name", f"Room-{room_id}"),
                    "host_name": host_name,
                    "player_count": player_count,
                    "max_players": max_players,
                }
            )

        rooms_data.sort(key=lambda x: x["id"])
        return rooms_data

    async def get_recruiting_status_text(self) -> str | None:
        rooms = await self.room_db.load_all() or {}
        recruiting_candidates: List[Dict[str, Any]] = []

        for room_id, room_dict in rooms.items():
            if not isinstance(room_dict, dict):
                continue

            status = str(room_dict.get("status", "waiting"))
            players = room_dict.get("players") or []
            settings = room_dict.get("settings") or {}
            max_players = int(settings.get("max_players", 6))
            player_count = len(players)

            if status == "waiting" and player_count < max_players:
                recruiting_candidates.append(
                    {
                        "id": room_dict.get("id", room_id),
                        "name": room_dict.get("name", f"Room-{room_id}"),
                        "player_count": player_count,
                        "max_players": max_players,
                    }
                )

        if not recruiting_candidates:
            return None

        # Prefer the most filled recruiting room so progress changes are reflected quickly.
        recruiting_candidates.sort(
            key=lambda x: (x["player_count"] / max(x["max_players"], 1), x["player_count"]),
            reverse=True,
        )
        
        room = recruiting_candidates[random.randint(0, len(recruiting_candidates)-1)]
        room_name = str(room["name"]).strip() or "이름없는방"

        if len(room_name) > 40:
            room_name = room_name[:37] + "..."

        return f"{room_name} ({room['player_count']}/{room['max_players']}) 모집 중..."

    async def migrate_legacy_rooms(self) -> int:
        """
        Normalize legacy room schemas so every room stores players as PlayerState dict entries.
        Returns the number of migrated rooms.
        """
        rooms = await self.room_db.load_all() or {}
        migrated_count = 0

        for room_id, room_dict in rooms.items():
            if not isinstance(room_dict, dict):
                continue

            raw_players = room_dict.get("players") or []
            needs_migration = False
            if "current_turn_index" not in room_dict or "tricks_completed" not in room_dict:
                needs_migration = True
            if "created_at" not in room_dict:
                needs_migration = True
            for idx, player in enumerate(raw_players):
                if isinstance(player, str):
                    needs_migration = True
                    break
                if not isinstance(player, dict):
                    needs_migration = True
                    break
                if not player.get("id"):
                    needs_migration = True
                    break
                if "order" not in player:
                    # Keep consistent order field for PlayerState schema.
                    needs_migration = True
                    break

            if not needs_migration:
                continue

            room = engine.room_from_dict(room_dict)

            # Fill missing names in migrated players where possible.
            for idx, player in enumerate(room.players, start=1):
                if room.round_number == 0:
                    player.order = 0
                else:
                    player.order = idx
                if not player.name:
                    user = await self.user_db.load(player.id)
                    if user and isinstance(user, dict):
                        player.name = user.get("name", "")

            normalized = engine.room_to_dict(room)
            normalized["created_at"] = int(room_dict.get("created_at") or time.time())
            await self.room_db.save_room(room.id, normalized)
            migrated_count += 1

        return migrated_count

    async def find_player_room(self, user_id: str) -> Optional[Dict[str, str]]:
        """
        Return the room info the user currently belongs to, if any.
        """
        rooms = await self.room_db.load_all() or {}
        for room_id, room_dict in rooms.items():
            if not isinstance(room_dict, dict):
                continue

            players = room_dict.get("players") or []
            for player in players:
                if isinstance(player, str) and player == user_id:
                    return {
                        "id": str(room_dict.get("id", room_id)),
                        "name": str(room_dict.get("name", f"Room-{room_id}")),
                    }
                if isinstance(player, dict) and player.get("id") == user_id:
                    return {
                        "id": str(room_dict.get("id", room_id)),
                        "name": str(room_dict.get("name", f"Room-{room_id}")),
                    }

        return None

    async def get_user_room_state(self, user_id: str):
        """
        Resolve user's current room by `current_room_id` first, then fallback scan for consistency.
        """
        user = await self.user_db.load(user_id)
        if not user:
            return None

        current_room_id = user.get("current_room_id")
        if current_room_id:
            room = await self.get_room_state(str(current_room_id))
            if room and any(player.id == user_id for player in room.players):
                return room
            await self.set_user_current_room(user_id, None)

        found = await self.find_player_room(user_id)
        if not found:
            return None

        await self.set_user_current_room(user_id, found["id"])
        return await self.get_room_state(found["id"])

    @staticmethod
    def room_player_ids(room_dict: Dict[str, Any]) -> List[str]:
        ids: List[str] = []
        for player in room_dict.get("players") or []:
            if isinstance(player, str):
                ids.append(player)
            elif isinstance(player, dict) and player.get("id"):
                ids.append(str(player["id"]))
        return ids

    async def clear_users_current_room(self, user_ids: List[str], room_id: str) -> None:
        for uid in user_ids:
            user = await self.user_db.load(uid)
            if not user or not isinstance(user, dict):
                continue
            if str(user.get("current_room_id", "")) == str(room_id):
                await self.set_user_current_room(uid, None)

    async def find_expired_waiting_rooms(self, *, timeout_seconds: int = 300) -> List[Dict[str, Any]]:
        now = int(time.time())
        rooms = await self.room_db.load_all() or {}
        expired: List[Dict[str, Any]] = []

        for room_id, room_dict in rooms.items():
            if not isinstance(room_dict, dict):
                continue

            if str(room_dict.get("status", "waiting")) != "waiting":
                continue
            if int(room_dict.get("round_number", 0)) > 0:
                continue

            created_at = room_dict.get("created_at")
            if created_at is None:
                continue

            try:
                created_ts = int(created_at)
            except (TypeError, ValueError):
                continue

            if now - created_ts >= timeout_seconds:
                expired.append(
                    {
                        "id": str(room_dict.get("id", room_id)),
                        "name": str(room_dict.get("name", f"Room-{room_id}")),
                        "player_ids": self.room_player_ids(room_dict),
                    }
                )

        return expired

    def get_activity_session_sync(self, session_id: str) -> Optional[Dict[str, Any]]:
        return self.activity_session_db.get_session_sync(session_id)

    def save_activity_session_sync(self, session_id: str, session_dict: Dict[str, Any]) -> None:
        self.activity_session_db.save_session_sync(session_id, session_dict)

    def delete_activity_session_sync(self, session_id: str) -> None:
        self.activity_session_db.delete_session_sync(session_id)

    def load_all_activity_sessions_sync(self) -> Dict[str, Any]:
        return self.activity_session_db.load_all_sync() or {}

    def get_raw_room_sync(self, room_id: str) -> Optional[Dict[str, Any]]:
        return self.room_db.load_sync(room_id)

    def save_raw_room_sync(self, room_id: str, room_dict: Dict[str, Any]) -> None:
        self.room_db.save_sync(room_id, room_dict)

    def load_all_raw_rooms_sync(self) -> Dict[str, Any]:
        return self.room_db.load_all_sync() or {}

    @staticmethod
    def _activity_user_key_from_player(
        player: engine.PlayerState,
        player_meta: Optional[Dict[str, Any]] = None,
    ) -> str:
        discord_user_id = str((player_meta or {}).get("discord_user_id") or "").strip()
        if discord_user_id:
            return discord_user_id
        pid = str(player.id or "").strip()
        if pid.startswith("discord-"):
            return pid[len("discord-") :]
        return pid

    @staticmethod
    def _activity_presence_from_room(room: engine.RoomState) -> str:
        if str(room.status) == "playing":
            return "playing"
        return "waiting"

    def sync_activity_users_from_room_sync(
        self,
        room: engine.RoomState,
        *,
        player_meta_by_id: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> None:
        """
        Activity 방(RoomState/PlayerState) 기준 사용자 상태를 UserDB에 반영한다.
        - activity_presence: waiting | playing
        - activity_session_id/current_room_id: 세션 참여 여부
        """
        if room is None:
            return

        player_meta_by_id = player_meta_by_id or {}
        session_id = str(room.id or "")
        session_status = str(room.status or "waiting")
        session_phase = str(room.phase or "idle")
        now_ts = int(time.time())
        presence = self._activity_presence_from_room(room)
        in_session = session_status != "finished"

        for player in room.players:
            if not isinstance(player, engine.PlayerState):
                continue
            player_meta = player_meta_by_id.get(player.id, {})
            user_key = self._activity_user_key_from_player(player, player_meta)
            if not user_key:
                continue
            updates: Dict[str, Any] = {
                "activity_presence": presence,
                "activity_status": session_status,
                "activity_phase": session_phase,
                "activity_session_id": session_id if in_session else None,
                "current_room_id": session_id if in_session else None,
                "activity_updated_at": now_ts,
            }
            name = str(player.name or "").strip()
            if name:
                updates["name"] = name
            avatar_url = str(player_meta.get("avatar_url") or "").strip()
            if avatar_url:
                updates["avatar_url"] = avatar_url
            try:
                self.user_db.update_sync(user_key, updates)
            except Exception:
                # 사용자 상태 동기화 실패는 게임 진행을 막지 않는다.
                continue

    def sync_activity_users_sync(self, session: Dict[str, Any]) -> None:
        """
        Backward-compatible wrapper. Prefer `sync_activity_users_from_room_sync`.
        """
        if not isinstance(session, dict):
            return
        room_id = str(session.get("session_id") or session.get("id") or "")
        if not room_id:
            return
        room = engine.room_from_dict(
            {
                "id": room_id,
                "name": str(session.get("room_name") or session.get("name") or room_id),
                "host_player": str(session.get("host_id") or ""),
                "status": str(session.get("room_status") or "waiting"),
                "phase": str(session.get("phase") or "idle"),
                "round_number": int(session.get("round_number", 0)),
                "leader_index": int(session.get("leader_index", 0)),
                "current_turn_index": int(session.get("turn_index", 0)),
                "tricks_completed": int(session.get("tricks_completed", 0)),
                "settings": session.get("settings") or {},
                "players": session.get("players") or [],
                "current_trick": session.get("current_trick") or [],
                "created_at": int(session.get("created_at") or int(time.time())),
            }
        )
        meta = {
            str(p.get("id")): p
            for p in (session.get("players") or [])
            if isinstance(p, dict) and p.get("id")
        }
        self.sync_activity_users_from_room_sync(room, player_meta_by_id=meta)
