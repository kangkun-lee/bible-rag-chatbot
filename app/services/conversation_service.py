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
            settings.supabase_url, settings.supabase_key
        )

    def create_conversation(
        self, user_id: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        새 대화 생성 (동시 접속 안정성을 위해 재시도 로직 포함)

        Args:
            user_id: 사용자 ID (선택사항)
            metadata: 추가 메타데이터 (선택사항)

        Returns:
            conversation_id (UUID 문자열)
        """
        max_retries = 3
        retry_count = 0

        while retry_count < max_retries:
            try:
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

                # 동시 접속 시 충돌 방지를 위해 insert 시도
                result = self.supabase.table("conversations").insert(data).execute()

                # 성공적으로 생성되었는지 확인
                if result.data and len(result.data) > 0:
                    return conversation_id
                else:
                    raise Exception("대화 생성 실패: 응답 데이터가 없습니다")

            except Exception as e:
                retry_count += 1
                error_msg = str(e).lower()

                # 중복 키 오류나 충돌인 경우에만 재시도
                if (
                    "duplicate" in error_msg
                    or "unique" in error_msg
                    or "conflict" in error_msg
                ) and retry_count < max_retries:
                    # 새로운 UUID로 재시도
                    import time

                    time.sleep(0.1 * retry_count)  # 지수 백오프
                    continue
                else:
                    # 다른 오류이거나 최대 재시도 횟수 초과
                    print(f"대화 생성 오류 (재시도 {retry_count}/{max_retries}): {e}")
                    if retry_count >= max_retries:
                        raise
                    import time

                    time.sleep(0.1 * retry_count)

        # 이 지점에 도달하면 안 됨
        raise Exception("대화 생성 실패: 최대 재시도 횟수 초과")

    def append_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        sources: Optional[List[Dict[str, str]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        메시지 추가 (동시 접속 안정성을 위해 재시도 로직 포함)

        Args:
            conversation_id: 대화 ID
            role: 메시지 역할 ('user' | 'assistant' | 'system')
            content: 메시지 내용
            sources: 출처 정보 (선택사항)
            metadata: 추가 메타데이터 (선택사항)

        Returns:
            message_id (UUID 문자열)
        """
        max_retries = 3
        retry_count = 0

        while retry_count < max_retries:
            try:
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

                # 메시지 추가
                self.supabase.table("messages").insert(data).execute()

                # 대화의 updated_at 업데이트 (동시 업데이트 충돌 방지)
                try:
                    self.supabase.table("conversations").update(
                        {"updated_at": datetime.utcnow().isoformat()}
                    ).eq("id", conversation_id).execute()
                except Exception as update_error:
                    # updated_at 업데이트 실패는 치명적이지 않음 (로그만 남김)
                    print(
                        f"대화 updated_at 업데이트 오류 (치명적이지 않음): {update_error}"
                    )

                return message_id
            except Exception as e:
                retry_count += 1
                error_msg = str(e).lower()

                # 중복 키 오류나 충돌인 경우에만 재시도
                if (
                    "duplicate" in error_msg
                    or "unique" in error_msg
                    or "conflict" in error_msg
                ) and retry_count < max_retries:
                    # 새로운 UUID로 재시도
                    import time

                    time.sleep(0.1 * retry_count)  # 지수 백오프
                    continue
                else:
                    # 다른 오류이거나 최대 재시도 횟수 초과
                    print(f"메시지 추가 오류 (재시도 {retry_count}/{max_retries}): {e}")
                    if retry_count >= max_retries:
                        raise
                    import time

                    time.sleep(0.1 * retry_count)

        # 이 지점에 도달하면 안 됨
        raise Exception("메시지 추가 실패: 최대 재시도 횟수 초과")

    def update_message(
        self,
        message_id: str,
        content: Optional[str] = None,
        sources: Optional[List[Dict[str, str]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
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
        self, conversation_id: str, limit: Optional[int] = None
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
            query = (
                self.supabase.table("messages")
                .select("*")
                .eq("conversation_id", conversation_id)
                .order("created_at", desc=False)
            )

            if limit:
                query = query.limit(limit)

            result = query.execute()
            return result.data if result.data else []
        except Exception as e:
            print(f"메시지 조회 오류: {e}")
            return []

    def get_user_conversations(
        self, user_id: Optional[str] = None, limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        사용자의 대화 목록 조회 (첫 번째 사용자 메시지 포함)

        Args:
            user_id: 사용자 ID (None이면 모든 대화 조회)
            limit: 조회할 대화 수 제한 (선택사항)

        Returns:
            대화 목록 (각 대화에 first_message 필드 포함)
        """
        try:
            # 대화 목록 조회
            query = self.supabase.table("conversations").select("*")

            if user_id:
                query = query.eq("user_id", user_id)

            query = query.order("updated_at", desc=True)

            if limit:
                query = query.limit(limit)

            result = query.execute()
            conversations = result.data if result.data else []

            if not conversations:
                return []

            # 각 대화의 첫 번째 사용자 메시지를 한 번에 조회 (N+1 문제 해결)
            conversation_ids = [conv["id"] for conv in conversations]

            # 모든 대화의 첫 번째 사용자 메시지를 한 번에 조회
            # Supabase에서 in 연산자를 사용하여 모든 대화의 메시지를 한 번에 가져온 후 Python에서 그룹화
            first_messages_map = {}

            if conversation_ids:
                try:
                    # 모든 관련 메시지를 한 번에 조회
                    all_messages_result = (
                        self.supabase.table("messages")
                        .select("conversation_id, content, created_at")
                        .in_("conversation_id", conversation_ids)
                        .eq("role", "user")
                        .order("created_at", desc=False)
                        .execute()
                    )

                    if all_messages_result.data:
                        # 각 대화별로 첫 번째 메시지만 추출
                        seen_conversations = set()
                        for msg in all_messages_result.data:
                            conv_id = msg.get("conversation_id")
                            if conv_id and conv_id not in seen_conversations:
                                content = msg.get("content", "")
                                first_messages_map[conv_id] = content[:50] + (
                                    "..." if len(content) > 50 else ""
                                )
                                seen_conversations.add(conv_id)
                except Exception as e:
                    print(f"첫 메시지 일괄 조회 오류: {e}")
                    # 폴백: 개별 조회
                    for conv_id in conversation_ids:
                        try:
                            msg_result = (
                                self.supabase.table("messages")
                                .select("content")
                                .eq("conversation_id", conv_id)
                                .eq("role", "user")
                                .order("created_at", desc=False)
                                .limit(1)
                                .execute()
                            )

                            if msg_result.data and len(msg_result.data) > 0:
                                content = msg_result.data[0].get("content", "")
                                first_messages_map[conv_id] = content[:50] + (
                                    "..." if len(content) > 50 else ""
                                )
                        except Exception as e2:
                            print(f"대화 {conv_id}의 첫 메시지 조회 오류: {e2}")
                            continue

            # 각 대화에 first_message 추가
            for conv in conversations:
                conv["first_message"] = first_messages_map.get(conv["id"], "")

            return conversations
        except Exception as e:
            print(f"대화 목록 조회 오류: {e}")
            return []

    def conversation_belongs_to_user(self, conversation_id: str, user_id: str) -> bool:
        """대화가 사용자 소유인지 확인"""
        try:
            result = (
                self.supabase.table("conversations")
                .select("user_id")
                .eq("id", conversation_id)
                .execute()
            )
            if not result.data:
                return False
            return result.data[0].get("user_id") == user_id
        except Exception:
            return False

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
            self.supabase.table("conversations").delete().eq(
                "id", conversation_id
            ).execute()
            return True
        except Exception as e:
            print(f"대화 삭제 오류: {e}")
            return False

    def update_conversation(
        self, conversation_id: str, metadata: Optional[Dict[str, Any]] = None
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
            data = {"updated_at": datetime.utcnow().isoformat()}

            if metadata:
                # 기존 metadata와 병합
                existing = (
                    self.supabase.table("conversations")
                    .select("metadata")
                    .eq("id", conversation_id)
                    .execute()
                )
                if existing.data:
                    existing_metadata = existing.data[0].get("metadata", {}) or {}
                    if isinstance(existing_metadata, dict):
                        existing_metadata.update(metadata)
                        data["metadata"] = existing_metadata
                    else:
                        data["metadata"] = metadata
                else:
                    data["metadata"] = metadata

            self.supabase.table("conversations").update(data).eq(
                "id", conversation_id
            ).execute()
            return True
        except Exception as e:
            print(f"대화 업데이트 오류: {e}")
            return False


# 싱글톤 인스턴스
conversation_service = ConversationService()
