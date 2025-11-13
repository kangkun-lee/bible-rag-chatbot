"""RAG 서비스 로직"""
from typing import List, Dict, Optional
from supabase import create_client, Client
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from app.config import settings
import json


class RAGService:
    """RAG 서비스 클래스"""
    
    def __init__(self):
        """초기화"""
        self.supabase: Client = create_client(
            settings.supabase_url,
            settings.supabase_key
        )
        self.embedding_model = settings.embedding_model
        self.llm_model = settings.llm_model
        
        # Google API 키 환경변수 설정 (langchain-google-genai가 자동으로 사용)
        import os
        os.environ["GOOGLE_API_KEY"] = settings.google_api_key
        
        # Google Generative AI 임베딩 모델 초기화 (쿼리용)
        self.query_embeddings = GoogleGenerativeAIEmbeddings(
            model=self.embedding_model,
            task_type="RETRIEVAL_QUERY"
        )
        
        # Google Generative AI LLM 초기화
        self.llm = ChatGoogleGenerativeAI(
            model=self.llm_model,
            temperature=0.7,
            google_api_key=settings.google_api_key
        )
        
        self.settings = settings  # settings 참조 저장
    
    def get_embedding(self, text: str) -> List[float]:
        """텍스트를 임베딩으로 변환 (쿼리용)"""
        try:
            return self.query_embeddings.embed_query(
                text,
                output_dimensionality=self.settings.embedding_dimension  # 환경변수에서 차원 가져오기
            )
        except Exception as e:
            print(f"임베딩 생성 오류: {e}")
            return []
    
    def search_similar_documents(
        self,
        query: str,
        limit: int = 5
    ) -> List[Dict]:
        """유사한 문서 검색"""
        query_embedding = self.get_embedding(query)
        
        # Supabase 벡터 검색
        response = self.supabase.rpc(
            'match_documents',
            {
                'query_embedding': query_embedding,
                'match_threshold': 0.7,
                'match_count': limit
            }
        ).execute()
        
        return response.data if response.data else []
    
    def generate_answer(
        self,
        question: str,
        context_documents: List[Dict]
    ) -> str:
        """컨텍스트를 사용하여 답변 생성"""
        # 컨텍스트 문서들을 텍스트로 결합
        context_text = "\n\n".join([
            doc.get('content', '') for doc in context_documents
        ])
        
        # 프롬프트 구성
        prompt = f"""다음은 성경 내용입니다. 질문에 대해 성경 내용을 바탕으로 정확하고 도움이 되는 답변을 제공해주세요.

성경 내용:
{context_text}

질문: {question}

답변:"""
        
        # LLM 호출 (Gemini)
        from langchain_core.messages import SystemMessage, HumanMessage
        
        messages = [
            SystemMessage(content="당신은 성경 내용을 바탕으로 정확하고 도움이 되는 답변을 제공하는 AI 어시스턴트입니다."),
            HumanMessage(content=prompt)
        ]
        
        response = self.llm.invoke(messages)
        
        return response.content
    
    def process_query(self, question: str) -> Dict:
        """질문 처리 및 답변 생성"""
        # 유사 문서 검색
        similar_docs = self.search_similar_documents(question)
        
        # 답변 생성
        answer = self.generate_answer(question, similar_docs)
        
        # 소스 정보 추출
        sources = [
            {
                "book": doc.get('book', ''),
                "chapter": doc.get('chapter', ''),
                "verse": doc.get('verse', ''),
                "content": doc.get('content', '')[:200] + "..."
            }
            for doc in similar_docs[:3]
        ]
        
        return {
            "answer": answer,
            "sources": sources
        }


# 싱글톤 인스턴스
rag_service = RAGService()

