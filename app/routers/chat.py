"""채팅 라우터"""
from fastapi import APIRouter, HTTPException
from app.models.schemas import ChatRequest, ChatResponse
from app.services.rag_service import rag_service
import uuid

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """채팅 엔드포인트"""
    try:
        # RAG 서비스를 사용하여 질문 처리
        result = rag_service.process_query(request.message)
        
        # 대화 ID 생성 (없는 경우)
        conversation_id = request.conversation_id or str(uuid.uuid4())
        
        return ChatResponse(
            answer=result["answer"],
            conversation_id=conversation_id,
            sources=result.get("sources")
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"처리 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/health")
async def health():
    """헬스 체크 엔드포인트"""
    return {"status": "healthy", "message": "서비스가 정상적으로 동작 중입니다."}

