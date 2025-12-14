"""채팅 라우터"""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from app.models.schemas import ChatRequest, ChatResponse
from app.langgraph.graph import agent, llm
from app.services.conversation_service import conversation_service
from langchain_core.messages import HumanMessage, AIMessage
import re
import json
from typing import AsyncGenerator, List

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """채팅 엔드포인트"""
    import asyncio
    try:
        # 대화 ID 생성 또는 조회 (없는 경우)
        # 빈 문자열이나 None인 경우도 새 대화로 처리
        if not request.conversation_id or request.conversation_id.strip() == "":
            conversation_id = await asyncio.to_thread(conversation_service.create_conversation)
        else:
            # 기존 대화 ID 검증 (존재하는지 확인)
            try:
                messages = await asyncio.to_thread(
                    conversation_service.get_conversation_messages,
                    request.conversation_id,
                    limit=1
                )
                conversation_id = request.conversation_id
            except Exception:
                # 대화가 존재하지 않으면 새로 생성
                conversation_id = await asyncio.to_thread(conversation_service.create_conversation)
        
        # 이전 대화 메시지 가져오기 (멀티턴 대화 지원) - 먼저 로드
        previous_messages: List = []
        if conversation_id:
            try:
                history = await asyncio.to_thread(
                    conversation_service.get_conversation_messages, 
                    conversation_id
                )
                # 최근 20개 메시지만 사용 (컨텍스트 폭주 방지)
                for msg in history[-20:]:
                    if msg.get("role") == "user":
                        previous_messages.append(HumanMessage(content=msg.get("content", "")))
                    elif msg.get("role") == "assistant":
                        previous_messages.append(AIMessage(content=msg.get("content", "")))
            except Exception as e:
                print(f"대화 기록 조회 오류: {e}")
        
        # 새 사용자 메시지 추가
        current_user_message = HumanMessage(content=request.message)
        all_messages = previous_messages + [current_user_message]
        
        # LangGraph 에이전트를 사용하여 질문 처리 (이전 대화 맥락 포함) - 한 번만 호출
        result = await asyncio.to_thread(
            agent.invoke,
            {"messages": all_messages}
        )
        
        # 최종 답변 추출
        final_content = result["messages"][-1].content
        
        # Gemini가 구조화된 응답을 반환하는 경우 처리
        if isinstance(final_content, list):
            # 리스트인 경우 텍스트 부분만 추출
            text_parts = []
            for item in final_content:
                if isinstance(item, dict) and 'text' in item:
                    text_parts.append(item['text'])
                elif isinstance(item, str):
                    text_parts.append(item)
            answer = '\n'.join(text_parts)
        elif isinstance(final_content, dict):
            # 딕셔너리인 경우 텍스트 부분만 추출
            if 'text' in final_content:
                answer = final_content['text']
            else:
                answer = str(final_content)
        else:
            answer = str(final_content)
        
        # 소스 정보 추출 (ToolMessage에서 검색 결과 파싱)
        sources = []
        for msg in result["messages"]:
            if hasattr(msg, '__class__') and msg.__class__.__name__ == "ToolMessage":
                tool_content = str(msg.content)
                # 검색 결과에서 성경 구절 정보 추출
                pattern = r'\[([^\]]+)\]\s*([^\n]+)'
                matches = re.findall(pattern, tool_content)
                for citation, content_preview in matches:
                    # citation에서 책, 장, 절 추출
                    parts = citation.split()
                    if len(parts) >= 2:
                        book = parts[0]
                        chapter = parts[1].replace('장', '') if '장' in parts[1] else None
                        verse = None
                        if len(parts) >= 3:
                            verse = parts[2].replace('절', '') if '절' in parts[2] else None
                        
                        sources.append({
                            "book": book,
                            "chapter": chapter or "",
                            "verse": verse or "",
                            "content": content_preview[:200] + "..." if len(content_preview) > 200 else content_preview
                        })
                        # 최대 3개까지만
                        if len(sources) >= 3:
                            break
        
        # 사용자 메시지 저장
        try:
            await asyncio.to_thread(
                conversation_service.append_message,
                conversation_id=conversation_id,
                role="user",
                content=request.message
            )
        except Exception as e:
            print(f"사용자 메시지 저장 오류: {e}")
        
        # AI 응답 저장
        try:
            await asyncio.to_thread(
                conversation_service.append_message,
                conversation_id=conversation_id,
                role="assistant",
                content=answer,
                sources=sources if sources else None
            )
        except Exception as e:
            print(f"AI 메시지 저장 오류: {e}")
        
        return ChatResponse(
            answer=answer,
            conversation_id=conversation_id,
            sources=sources if sources else None
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"처리 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """스트리밍 채팅 엔드포인트"""
    async def generate() -> AsyncGenerator[str, None]:
        """스트리밍 응답 생성"""
        import asyncio

        def format_stream_error(error_text: str | None) -> str:
            """LLM/툴 오류 메시지를 사용자가 이해할 수 있는 문장으로 정리."""
            if not error_text:
                return "AI 응답을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요."

            lowered = error_text.lower()
            if "429" in error_text or "quota" in lowered or "rate limit" in lowered or "resourceexhausted" in lowered:
                return "AI 모델 호출 한도를 초과했습니다. 잠시 뒤 다시 시도해 주세요."
            if "permission" in lowered or "unauthorized" in lowered:
                return "AI 모델 인증에 실패했습니다. API 키를 확인해 주세요."
            return f"AI 응답 생성 중 오류가 발생했습니다: {error_text}"
        try:
            # 대화 ID 생성 또는 조회 (없는 경우)
            # 빈 문자열이나 None인 경우도 새 대화로 처리
            if not request.conversation_id or request.conversation_id.strip() == "":
                conversation_id = await asyncio.to_thread(conversation_service.create_conversation)
            else:
                # 기존 대화 ID 검증 (존재하는지 확인)
                try:
                    messages = await asyncio.to_thread(
                        conversation_service.get_conversation_messages,
                        request.conversation_id,
                        limit=1
                    )
                    conversation_id = request.conversation_id
                except Exception:
                    # 대화가 존재하지 않으면 새로 생성
                    conversation_id = await asyncio.to_thread(conversation_service.create_conversation)
            
            # 이전 대화 메시지 가져오기 (멀티턴 대화 지원) - 먼저 로드
            previous_messages: List = []
            if conversation_id:
                try:
                    history = await asyncio.to_thread(
                        conversation_service.get_conversation_messages,
                        conversation_id
                    )
                    # 최근 20개 메시지만 사용 (컨텍스트 폭주 방지)
                    for msg in history[-20:]:
                        if msg.get("role") == "user":
                            previous_messages.append(HumanMessage(content=msg.get("content", "")))
                        elif msg.get("role") == "assistant":
                            previous_messages.append(AIMessage(content=msg.get("content", "")))
                except Exception as e:
                    print(f"대화 기록 조회 오류: {e}")
            
            # 새 사용자 메시지 추가 (히스토리에 포함되지 않도록)
            current_user_message = HumanMessage(content=request.message)
            all_messages = previous_messages + [current_user_message]
            
            # 초기 메타데이터 전송
            yield f"data: {json.dumps({'type': 'start', 'conversation_id': conversation_id}, ensure_ascii=False)}\n\n"
            
            # 서버리스 환경에서 연결 확인을 위한 초기 heartbeat
            yield f": heartbeat\n\n"
            
            accumulated_text = ""
            sources = []
            event_count = 0
            has_streamed = False
            
            # 사용자 메시지 저장 (비동기로 실행, 스트리밍과 병렬)
            async def save_user_message():
                try:
                    await asyncio.to_thread(
                        conversation_service.append_message,
                        conversation_id=conversation_id,
                        role="user",
                        content=request.message
                    )
                except Exception as e:
                    print(f"사용자 메시지 저장 오류: {e}")
            
            # 백그라운드에서 사용자 메시지 저장 시작
            save_task = asyncio.create_task(save_user_message())

            stream_error_message = None
            fallback_error_message = None

            # LangChain Agent 실행 - 스트리밍 시도, 실패 시 폴백
            # 먼저 astream_events로 스트리밍 시도
            try:
                last_ai_content = ""
                async for event in agent.astream_events(
                    {"messages": all_messages},
                    version="v1"
                ):
                    event_type = event.get("event")
                    event_name = event.get("name", "")
                    
                    # LLM 스트리밍 이벤트 처리
                    if event_type == "on_chat_model_stream":
                        data = event.get("data", {})
                        chunk = data.get("chunk")
                        
                        if chunk:
                            # chunk에서 content 추출
                            if hasattr(chunk, 'content'):
                                content = chunk.content
                                if isinstance(content, str) and content:
                                    # 이전 내용 이후의 새로운 부분만 추출
                                    if last_ai_content and content.startswith(last_ai_content):
                                        new_text = content[len(last_ai_content):]
                                        if new_text:
                                            yield f"data: {json.dumps({'type': 'token', 'content': new_text}, ensure_ascii=False)}\n\n"
                                            accumulated_text += new_text
                                            has_streamed = True
                                            last_ai_content = content
                                    elif content != last_ai_content:
                                        if last_ai_content:
                                            new_text = content[len(last_ai_content):] if content.startswith(last_ai_content) else content
                                        else:
                                            new_text = content
                                        if new_text:
                                            yield f"data: {json.dumps({'type': 'token', 'content': new_text}, ensure_ascii=False)}\n\n"
                                            accumulated_text += new_text
                                            has_streamed = True
                                            last_ai_content = content
                            
                    # Tool 실행 완료 시 소스 정보 추출
                    elif event_type == "on_tool_end":
                        tool_output = event.get("data", {}).get("output", "")
                        if tool_output:
                            tool_content = str(tool_output)
                            pattern = r'\[([^\]]+)\]\s*([^\n]+)'
                            matches = re.findall(pattern, tool_content)
                            for citation, content_preview in matches:
                                parts = citation.split()
                                if len(parts) >= 2:
                                    book = parts[0]
                                    chapter = parts[1].replace('장', '') if '장' in parts[1] else None
                                    verse = None
                                    if len(parts) >= 3:
                                        verse = parts[2].replace('절', '') if '절' in parts[2] else None
                                    
                                    sources.append({
                                        "book": book,
                                        "chapter": chapter or "",
                                        "verse": verse or "",
                                        "content": content_preview[:200] + "..." if len(content_preview) > 200 else content_preview
                                    })
                                    if len(sources) >= 3:
                                        break
                    
                    # AIMessage 완성 시 최종 텍스트 추출
                    elif event_type == "on_chain_end" and event_name == "RunnableAgent":
                        output = event.get("data", {}).get("output", {})
                        if "messages" in output:
                    for msg in output["messages"]:
                        if hasattr(msg, '__class__') and msg.__class__.__name__ == "AIMessage":
                            content = msg.content
                            if isinstance(content, str) and content:
                                if not accumulated_text:
                                    yield f"data: {json.dumps({'type': 'token', 'content': content}, ensure_ascii=False)}\n\n"
                                    accumulated_text = content
                                elif content.startswith(accumulated_text):
                                    missing_text = content[len(accumulated_text):]
                                    if missing_text:
                                        yield f"data: {json.dumps({'type': 'token', 'content': missing_text}, ensure_ascii=False)}\n\n"
                                        accumulated_text = content
                                else:
                                    # 스트리밍 중 일부 앞부분이 누락된 경우 전체 텍스트를 다시 전송
                                    yield f"data: {json.dumps({'type': 'token', 'content': content}, ensure_ascii=False)}\n\n"
                                    accumulated_text = content
                            break
            except Exception as stream_error:
                stream_error_message = str(stream_error)
                print(f"스트리밍 오류: {stream_error_message}")
                # 스트리밍 실패 시 폴백: 최종 결과를 가져와서 청크 단위로 전송
                has_streamed = False
            
            # 스트리밍이 전혀 발생하지 않았거나 accumulated_text가 비어있는 경우 폴백
            if not has_streamed or not accumulated_text:
                try:
                    result = await asyncio.to_thread(
                        agent.invoke,
                        {"messages": all_messages}
                    )
                    
                    if "messages" in result:
                        # ToolMessage에서 소스 추출
                        for msg in result["messages"]:
                            if hasattr(msg, '__class__') and msg.__class__.__name__ == "ToolMessage":
                                tool_content = str(msg.content)
                                pattern = r'\[([^\]]+)\]\s*([^\n]+)'
                                matches = re.findall(pattern, tool_content)
                                for citation, content_preview in matches:
                                    parts = citation.split()
                                    if len(parts) >= 2:
                                        book = parts[0]
                                        chapter = parts[1].replace('장', '') if '장' in parts[1] else None
                                        verse = None
                                        if len(parts) >= 3:
                                            verse = parts[2].replace('절', '') if '절' in parts[2] else None
                                        
                                        sources.append({
                                            "book": book,
                                            "chapter": chapter or "",
                                            "verse": verse or "",
                                            "content": content_preview[:200] + "..." if len(content_preview) > 200 else content_preview
                                        })
                                        if len(sources) >= 3:
                                            break
                        
                        # AIMessage에서 최종 답변 추출
                        for msg in result["messages"]:
                            if hasattr(msg, '__class__') and msg.__class__.__name__ == "AIMessage":
                                content = msg.content
                                if isinstance(content, str) and content:
                                    if not accumulated_text:
                                        chunk_size = 20
                                        for i in range(0, len(content), chunk_size):
                                            chunk = content[i:i+chunk_size]
                                            yield f"data: {json.dumps({'type': 'token', 'content': chunk}, ensure_ascii=False)}\n\n"
                                            accumulated_text += chunk
                                            await asyncio.sleep(0.02)
                                    elif content.startswith(accumulated_text):
                                        missing_text = content[len(accumulated_text):]
                                        if missing_text:
                                            yield f"data: {json.dumps({'type': 'token', 'content': missing_text}, ensure_ascii=False)}\n\n"
                                            accumulated_text = content
                                    else:
                                        yield f"data: {json.dumps({'type': 'token', 'content': content}, ensure_ascii=False)}\n\n"
                                        accumulated_text = content
                                break
                except Exception as e:
                    fallback_error_message = str(e)
                    print(f"폴백 처리 오류: {fallback_error_message}")
            
            # 사용자 메시지 저장 완료 대기
            await save_task

            if not accumulated_text:
                error_msg = format_stream_error(fallback_error_message or stream_error_message)
                yield f"data: {json.dumps({'type': 'error', 'content': error_msg}, ensure_ascii=False)}\n\n"
                return

            # 최종 메타데이터 전송
            yield f"data: {json.dumps({'type': 'done', 'sources': sources if sources else None}, ensure_ascii=False)}\n\n"
            
            # AI 응답 저장 (스트리밍 완료 후) - accumulated_text가 있으면 반드시 저장
            if accumulated_text:
                try:
                    await asyncio.to_thread(
                        conversation_service.append_message,
                        conversation_id=conversation_id,
                        role="assistant",
                        content=accumulated_text,
                        sources=sources if sources else None
                    )
                except Exception as e:
                    print(f"AI 메시지 저장 오류: {e}")
            else:
                # accumulated_text가 여전히 비어있으면 에러 로그
                print(f"경고: accumulated_text가 비어있어 메시지를 저장할 수 없습니다. conversation_id: {conversation_id}")
            
        except Exception as e:
            error_msg = f"처리 중 오류가 발생했습니다: {str(e)}"
            yield f"data: {json.dumps({'type': 'error', 'content': error_msg}, ensure_ascii=False)}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Nginx 버퍼링 비활성화
            "Transfer-Encoding": "chunked",  # 청크 전송 활성화
            "X-Content-Type-Options": "nosniff",  # MIME 타입 스니핑 방지
        }
    )


@router.get("/conversations")
async def get_conversations(limit: int = 50):
    """대화 목록 조회 (각 대화의 첫 번째 사용자 메시지 포함)"""
    import asyncio
    try:
        # 최적화된 메서드로 한 번에 조회 (N+1 문제 해결)
        conversations = await asyncio.to_thread(
            conversation_service.get_user_conversations,
            user_id=None,  # 향후 인증 추가 시 수정
            limit=limit
        )
        
        return {"conversations": conversations}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"대화 목록 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(conversation_id: str):
    """특정 대화의 메시지 조회"""
    import asyncio
    try:
        messages = await asyncio.to_thread(
            conversation_service.get_conversation_messages,
            conversation_id
        )
        return {"messages": messages}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"메시지 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """대화 삭제"""
    import asyncio
    try:
        success = await asyncio.to_thread(
            conversation_service.delete_conversation,
            conversation_id
        )
        if success:
            return {"success": True, "message": "대화가 삭제되었습니다."}
        else:
            raise HTTPException(
                status_code=500,
                detail="대화 삭제에 실패했습니다."
            )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"대화 삭제 중 오류가 발생했습니다: {str(e)}"
        )


@router.patch("/conversations/{conversation_id}")
async def update_conversation(conversation_id: str, title: str = Query(..., description="대화 제목")):
    """대화 제목 수정"""
    import asyncio
    try:
        success = await asyncio.to_thread(
            conversation_service.update_conversation,
            conversation_id=conversation_id,
            metadata={"title": title}
        )
        if success:
            return {"success": True, "message": "대화 제목이 수정되었습니다."}
        else:
            raise HTTPException(
                status_code=500,
                detail="대화 제목 수정에 실패했습니다."
            )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"대화 제목 수정 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/health")
async def health():
    """헬스 체크 엔드포인트"""
    return {"status": "healthy", "message": "서비스가 정상적으로 동작 중입니다."}
