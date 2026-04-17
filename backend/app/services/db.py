from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase


class DB:
    client: AsyncIOMotorClient | None = None
    database: AsyncIOMotorDatabase | None = None


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_database() -> AsyncIOMotorDatabase:
    if DB.database is None:
        raise RuntimeError("Database has not been initialized")
    return DB.database


async def connect_db() -> None:
    mongodb_uri = os.getenv("MONGODB_URI")
    db_name = os.getenv("DB_NAME", "loan_onboarding")

    if not mongodb_uri:
        raise RuntimeError("MONGODB_URI is required")

    DB.client = AsyncIOMotorClient(mongodb_uri)
    DB.database = DB.client[db_name]


async def disconnect_db() -> None:
    if DB.client:
        DB.client.close()
        DB.client = None
        DB.database = None


async def log_event(collection: str, payload: dict[str, Any]) -> None:
    db = get_database()
    payload["created_at"] = utc_now()
    await db[collection].insert_one(payload)
