"""Pydantic schemas for request/response validation."""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field


# ── Sessions ──────────────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    title: str = Field(default="New Chat", max_length=255)
    user_metadata: dict[str, Any] = Field(default_factory=dict)


class SessionOut(BaseModel):
    id: uuid.UUID
    title: str
    user_metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Messages ──────────────────────────────────────────────────────────────────

class MessageOut(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    role: str
    content: str
    provider: str | None
    model: str | None
    citations: list[dict[str, Any]] | None = None
    artifact_type: str | None = None
    artifact_content: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Chat ──────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    session_id: uuid.UUID
    message: str = Field(..., min_length=1, max_length=8000)


class ChatResponse(BaseModel):
    session_id: uuid.UUID
    user_message: MessageOut
    assistant_message: MessageOut
    provider: str
    model: str
    request_id: str

class Ship30Request(BaseModel):
    session_id: uuid.UUID
    topic: str = Field(..., min_length=1, max_length=1000)

class ArtifactRequest(BaseModel):
    session_id: uuid.UUID
    topic: str = Field(..., min_length=1, max_length=1000)
    format: str = Field(..., description="Markdown or HTML/CSS")

