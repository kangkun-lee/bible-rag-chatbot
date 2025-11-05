"""FastAPI 애플리케이션 진입점"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import chat

app = FastAPI(
    title="성경 QA 챗봇 API",
    description="성경 내용을 기반으로 한 질문-답변 API (출처: 대한성서공회, 1961 개정 '성경전서 개역한글판')",
    version="0.1.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(chat.router)


@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "message": "성경 QA 챗봇 API에 오신 것을 환영합니다.",
        "docs": "/docs",
        "health": "/api/health"
    }


@app.get("/healthz")
async def healthz():
    """Render 헬스 체크용 엔드포인트"""
    return {"ok": True}

