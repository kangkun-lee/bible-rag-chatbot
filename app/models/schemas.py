"""Pydantic 모델 정의"""
from pydantic import BaseModel
from typing import Optional, List


class ChatRequest(BaseModel):
    """채팅 요청 모델"""
    message: str
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    """채팅 응답 모델"""
    answer: str
    conversation_id: Optional[str] = None
    sources: Optional[List[dict]] = None


class HealthResponse(BaseModel):
    """헬스 체크 응답 모델"""
    status: str
    message: str

