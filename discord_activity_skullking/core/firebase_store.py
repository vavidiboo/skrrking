from __future__ import annotations

import asyncio
import os
from pathlib import Path
from threading import Lock
from typing import Any, Dict, Optional

try:
    import firebase_admin
    from firebase_admin import credentials, db

except ImportError:  # pragma: no cover
    firebase_admin = None  # type: ignore[assignment]
    credentials = None  # type: ignore[assignment]
    db = None  # type: ignore[assignment]


DEFAULT_DATABASE_URL = "https://dealer-38a1d-default-rtdb.asia-southeast1.firebasedatabase.app/"
DEFAULT_FIREBASE_CREDENTIAL_PATH = (
    Path(__file__).resolve().parent.parent / "config" / "firebase.json"
)

class DataBase:
    _initialized = False
    _init_lock = Lock()
    ref_name = ""

    @classmethod
    def connect(cls, *, database_url: str = DEFAULT_DATABASE_URL) -> None:
        if firebase_admin is None or credentials is None or db is None:  # pragma: no cover
            raise RuntimeError(
                "firebase_admin is not installed. `pip install firebase-admin` 이후 실행하세요."
            )

        if cls._initialized:
            return

        with cls._init_lock:
            if cls._initialized:
                return

            cred_path = Path(
                os.getenv("FIREBASE_CREDENTIALS_PATH", str(DEFAULT_FIREBASE_CREDENTIAL_PATH))
            ).expanduser()
            cred = credentials.Certificate(str(cred_path))
            firebase_admin.initialize_app(cred, {"databaseURL": database_url})
            cls._initialized = True

    @classmethod
    def _require_ref(cls) -> Any:
        if not cls.ref_name:
            raise ValueError("ref_name is required")
        if db is None:  # pragma: no cover
            raise RuntimeError("firebase_admin is not available")
        return db.reference(cls.ref_name)

    @classmethod
    def load_all_sync(cls) -> Optional[Dict[str, Any]]:
        """
        해당 ref의 모든 엔트리를 로드합니다.
        """
        ref = cls._require_ref()
        datas = ref.get()
        # Firebase: 데이터가 없으면 None
        return datas if isinstance(datas, dict) else None

    @classmethod
    def load_sync(cls, key: str) -> Optional[Dict[str, Any]]:
        ref = cls._require_ref()
        data = ref.child(key).get()
        return data if isinstance(data, dict) else None

    @classmethod
    def save_sync(cls, key: str, value: Dict[str, Any]) -> None:
        ref = cls._require_ref()
        ref.child(key).set(value)

    @classmethod
    def update_sync(cls, key: str, updates: Dict[str, Any]) -> None:
        ref = cls._require_ref()
        ref.child(key).update(updates)

    @classmethod
    def delete_sync(cls, key: str) -> None:
        ref = cls._require_ref()
        ref.child(key).delete()

    @classmethod
    async def load_all(cls) -> Optional[Dict[str, Any]]:
        try:
            return await asyncio.to_thread(cls.load_all_sync)
        except Exception as e:
            # 호출자가 예외를 원하면 여기서 raise 하도록 바꿀 수 있습니다.
            print(f"Error loading all data from {cls.ref_name}: {e}")
            return None

    @classmethod
    async def load(cls, key: str) -> Optional[Dict[str, Any]]:
        try:
            return await asyncio.to_thread(cls.load_sync, key)
        except Exception as e:
            print(f"Error loading data from {cls.ref_name} with key {key}: {e}")
            return None

class UserDB(DataBase):
    ref_name = "Users"

    @classmethod
    def upload_sync(cls, user: Dict[str, Any]) -> None:
        try:
            user_id = user["id"]
            cls.save_sync(user_id, user)
            
        except Exception as e:
            print(f"Error uploading user: {e}")

    @classmethod
    def update_sync(cls, user_id: str, updates: Dict[str, Any]) -> None:
        try:
            super().update_sync(user_id, updates)
        except Exception as e:
            print(f"Error updating user {user_id}: {e}")

    @classmethod
    def delete_sync(cls, user_id: str) -> None:
        try:
            super().delete_sync(user_id)
        except Exception as e:
            print(f"Error deleting user {user_id}: {e}")

    @classmethod
    async def upload(cls, user: Dict[str, Any]) -> None:
        await asyncio.to_thread(cls.upload_sync, user)

    @classmethod
    async def update(cls, user_id: str, updates: Dict[str, Any]) -> None:
        await asyncio.to_thread(cls.update_sync, user_id, updates)

    @classmethod
    async def delete(cls, user_id: str) -> None:
        await asyncio.to_thread(cls.delete_sync, user_id)


class RoomDB(DataBase):
    """
    방 상태를 저장합니다.

    - `room_id`가 key
    - value는 `engine.RoomState`를 dict로 직렬화한 값입니다.
    """

    ref_name = "Rooms"

    @classmethod
    def get_room_sync(cls, room_id: str) -> Optional[Dict[str, Any]]:
        return cls.load_sync(room_id)

    @classmethod
    def save_room_sync(cls, room_id: str, room_dict: Dict[str, Any]) -> None:
        cls.save_sync(room_id, room_dict)

    @classmethod
    def delete_room_sync(cls, room_id: str) -> None:
        cls.delete_sync(room_id)

    @classmethod
    async def get_room(cls, room_id: str) -> Optional[Dict[str, Any]]:
        return await asyncio.to_thread(cls.get_room_sync, room_id)

    @classmethod
    async def save_room(cls, room_id: str, room_dict: Dict[str, Any]) -> None:
        await asyncio.to_thread(cls.save_room_sync, room_id, room_dict)

    @classmethod
    async def delete_room(cls, room_id: str) -> None:
        await asyncio.to_thread(cls.delete_room_sync, room_id)


class ActivitySessionDB(DataBase):
    ref_name = "ActivitySessions"

    @staticmethod
    def _key(session_id: str) -> str:
        return session_id.replace("/", "_")

    @classmethod
    def get_session_sync(cls, session_id: str) -> Optional[Dict[str, Any]]:
        return cls.load_sync(cls._key(session_id))

    @classmethod
    def save_session_sync(cls, session_id: str, session_dict: Dict[str, Any]) -> None:
        cls.save_sync(cls._key(session_id), session_dict)

    @classmethod
    def delete_session_sync(cls, session_id: str) -> None:
        cls.delete_sync(cls._key(session_id))

    @classmethod
    async def get_session(cls, session_id: str) -> Optional[Dict[str, Any]]:
        return await asyncio.to_thread(cls.get_session_sync, session_id)

    @classmethod
    async def save_session(cls, session_id: str, session_dict: Dict[str, Any]) -> None:
        await asyncio.to_thread(cls.save_session_sync, session_id, session_dict)

    @classmethod
    async def delete_session(cls, session_id: str) -> None:
        await asyncio.to_thread(cls.delete_session_sync, session_id)
