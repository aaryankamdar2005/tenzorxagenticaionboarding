from __future__ import annotations

from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.sessions import router as session_router
from app.routers.websocket import router as websocket_router
from app.routers.documents import router as documents_router
from app.routers.admin import router as admin_router
from app.routers.bureau import router as bureau_router
from app.routers.auth import router as auth_router
from app.services.db import connect_db, disconnect_db

load_dotenv()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await connect_db()
    yield
    await disconnect_db()


app = FastAPI(title="Agentic AI Video KYC — SecureBank", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(session_router)
app.include_router(websocket_router)
app.include_router(documents_router)
app.include_router(admin_router)
app.include_router(bureau_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "SecureBank KYC API"}
