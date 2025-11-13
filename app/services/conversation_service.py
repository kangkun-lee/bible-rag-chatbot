"""대화 기록 서비스"""
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime
from supabase import create_client, Client
from app.config import settings


class ConversationService:
    """대화 기록 관리 서비스"""
    
    def __init__(self):
        """초기화"""
        self.supabase: Client = create_client(
            settings.supabase_url,
            settings.supabase_key
        )
    
    def create_conversation(
        self,
        user_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        새 대화 생성
        
        Args:
            user_id: 사용자 ID (선택사항)
            metadata: 추가 메타데이터 (선택사항)
            
        Returns:
            conversation_id (UUID 문자열)
        """
        conversation_id = str(uuid4())
        
        data = {
            "id": conversation_id,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        if user_id:
            data["user_id"] = user_id
        
        if metadata:
            data["metadata"] = metadata
        
        try:
            result = self.supabase.table("conversations").insert(data).execute()
            return conversation_id
        except Exception as e:
            print(f"대화 생성 오류: {e}")
            raise
    
    def append_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        sources: Optional[List[Dict[str, str]]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        메시지 추가
        
        Args:
            conversation_id: 대화 ID
            role: 메시지 역할 ('user' | 'assistant' | 'system')
            content: 메시지 내용
            sources: 출처 정보 (선택사항)
            metadata: 추가 메타데이터 (선택사항)
            
        Returns:
            message_id (UUID 문자열)
        """
        message_id = str(uuid4())
        
        data = {
            "id": message_id,
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "created_at": datetime.utcnow().isoformat(),
        }
        
        if sources:
            data["sources"] = sources
        
        if metadata:
            data["metadata"] = metadata
        
        try:
            # 메시지 추가
            self.supabase.table("messages").insert(data).execute()
            
            # 대화의 updated_at 업데이트
            self.supabase.table("conversations").update({
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", conversation_id).execute()
            
            return message_id
        except Exception as e:
            print(f"메시지 추가 오류: {e}")
            raise
    
    def update_message(
        self,
        message_id: str,
        content: Optional[str] = None,
        sources: Optional[List[Dict[str, str]]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        메시지 업데이트 (스트리밍 중 내용 누적용)
        
        Args:
            message_id: 메시지 ID
            content: 업데이트할 내용
            sources: 출처 정보
            metadata: 추가 메타데이터
            
        Returns:
            성공 여부
        """
        data = {}
        
        if content is not None:
            data["content"] = content
        
        if sources is not None:
            data["sources"] = sources
        
        if metadata is not None:
            data["metadata"] = metadata
        
        if not data:
            return False
        
        try:
            self.supabase.table("messages").update(data).eq("id", message_id).execute()
            return True
        except Exception as e:
            print(f"메시지 업데이트 오류: {e}")
            return False
    
    def get_conversation_messages(
        self,
        conversation_id: str,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        대화의 메시지 목록 조회
        
        Args:
            conversation_id: 대화 ID
            limit: 조회할 메시지 수 제한 (선택사항)
            
        Returns:
            메시지 목록
        """
        try:
            query = self.supabase.table("messages").select("*").eq(
                "conversation_id", conversation_id
            ).order("created_at", desc=False)
            
            if limit:
                query = query.limit(limit)
            
            result = query.execute()
            return result.data if result.data else []
        except Exception as e:
            print(f"메시지 조회 오류: {e}")
            return []
    
    def get_user_conversations(
        self,
        user_id: Optional[str] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        사용자의 대화 목록 조회
        
        Args:
            user_id: 사용자 ID (None이면 모든 대화 조회)
            limit: 조회할 대화 수 제한 (선택사항)
            
        Returns:
            대화 목록
        """
        try:
            query = self.supabase.table("conversations").select("*")
            
            if user_id:
                query = query.eq("user_id", user_id)
            
            query = query.order("updated_at", desc=True)
            
            if limit:
                query = query.limit(limit)
            
            result = query.execute()
            return result.data if result.data else []
        except Exception as e:
            print(f"대화 목록 조회 오류: {e}")
            return []


    def delete_conversation(self, conversation_id: str) -> bool:
        """
        대화 삭제 (연관된 메시지도 함께 삭제됨 - CASCADE)
        
        Args:
            conversation_id: 대화 ID
            
        Returns:
            성공 여부
        """
        try:
            # CASCADE로 인해 messages도 자동 삭제됨
            self.supabase.table("conversations").delete().eq("id", conversation_id).execute()
            return True
        except Exception as e:
            print(f"대화 삭제 오류: {e}")
            return False
    
    def update_conversation(
        self,
        conversation_id: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        대화 메타데이터 업데이트 (제목 등)
        
        Args:
            conversation_id: 대화 ID
            metadata: 업데이트할 메타데이터 (예: {"title": "새 제목"})
            
        Returns:
            성공 여부
        """
        try:
            data = {
                "updated_at": datetime.utcnow().isoformat()
            }
            
            if metadata:
                # 기존 metadata와 병합
                existing = self.supabase.table("conversations").select("metadata").eq("id", conversation_id).execute()
                if existing.data:
                    existing_metadata = existing.data[0].get("metadata", {}) or {}
                    if isinstance(existing_metadata, dict):
                        existing_metadata.update(metadata)
                        data["metadata"] = existing_metadata
                    else:
                        data["metadata"] = metadata
                else:
                    data["metadata"] = metadata
            
            self.supabase.table("conversations").update(data).eq("id", conversation_id).execute()
            return True
        except Exception as e:
            print(f"대화 업데이트 오류: {e}")
            return False


# 싱글톤 인스턴스
conversation_service = ConversationService()

