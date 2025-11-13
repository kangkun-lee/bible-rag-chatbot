import os
import re
from dotenv import load_dotenv, find_dotenv
from langchain.agents import create_agent
from langchain.agents.middleware.types import AgentMiddleware
from langchain_core.messages import ToolMessage
from langchain.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from supabase import create_client
from app.config import settings

load_dotenv(find_dotenv(), override=True)

# Google API 키 환경변수 설정
os.environ["GOOGLE_API_KEY"] = settings.google_api_key

# Supabase 클라이언트 생성
supabase = create_client(settings.supabase_url, settings.supabase_key)

# 임베딩 모델 초기화 (쿼리용)
embeddings = GoogleGenerativeAIEmbeddings(
    model=settings.embedding_model,
    task_type="RETRIEVAL_QUERY"
)

# LLM 모델 초기화 (Gemini)
llm = ChatGoogleGenerativeAI(
    model=settings.llm_model,
    temperature=0.7,
    google_api_key=settings.google_api_key
)

# 한국어 책 이름 목록 (검색 쿼리 파싱용)
KOREAN_BOOK_NAMES = [
    "창세기", "출애굽기", "레위기", "민수기", "신명기",
    "여호수아", "사사기", "룻기", "사무엘상", "사무엘하",
    "열왕기상", "열왕기하", "역대상", "역대하", "에스라",
    "느헤미야", "에스더", "욥기", "시편", "잠언",
    "전도서", "아가", "이사야", "예레미야", "예레미야애가",
    "에스겔", "다니엘", "호세아", "요엘", "아모스",
    "오바댜", "요나", "미가", "나훔", "하박국",
    "스바냐", "학개", "스가랴", "말라기",
    "마태복음", "마가복음", "누가복음", "요한복음", "사도행전",
    "로마서", "고린도전서", "고린도후서", "갈라디아서", "에베소서",
    "빌립보서", "골로새서", "데살로니가전서", "데살로니가후서", "디모데전서",
    "디모데후서", "디도서", "빌레몬서", "히브리서", "야고보서",
    "베드로전서", "베드로후서", "요한일서", "요한이서", "요한삼서",
    "유다서", "요한계시록"
]

def parse_bible_reference(query: str) -> tuple[str | None, str | None, str | None, bool]:
    """
    쿼리에서 책 이름, 장, 절을 파싱합니다.
    
    예시:
    - "역대상 1장" -> ("역대상", "1", None, False)
    - "창세기 1장 1절" -> ("창세기", "1", "1", False)
    - "요한복음 3:16" -> ("요한복음", "3", "16", False)
    - "마태복음 5장 3절" -> ("마태복음", "5", "3", False)
    - "역대상 전체" -> ("역대상", None, None, True)
    - "역대상 요약" -> ("역대상", None, None, True)
    
    Returns:
        (book_name, chapter, verse, is_full_book) 튜플
        is_full_book: 전체 책을 의미하는지 여부 (책 이름만 있고 장이 없을 때)
    """
    # "전체", "전부", "모두", "요약" 같은 키워드 확인
    full_book_keywords = ["전체", "전부", "모두", "요약", "전체를", "전부를", "모두를"]
    is_full_book = any(keyword in query for keyword in full_book_keywords)
    # 숫자:숫자 형식 (예: 3:16)
    colon_pattern = r'(\d+):(\d+)'
    colon_match = re.search(colon_pattern, query)
    if colon_match:
        chapter = colon_match.group(1)
        verse = colon_match.group(2)
        # 콜론 앞의 책 이름 찾기
        book_part = query[:colon_match.start()].strip()
        for book in KOREAN_BOOK_NAMES:
            if book in book_part:
                return (book, chapter, verse, False)
    
    # 책 이름 찾기
    found_book = None
    for book in sorted(KOREAN_BOOK_NAMES, key=len, reverse=True):  # 긴 이름부터 매칭
        if book in query:
            found_book = book
            break
    
    if not found_book:
        return (None, None, None, False)
    
    # 장 찾기 (예: "1장", "1 장", "chapter 1", "ch 1")
    chapter_patterns = [
        r'(\d+)\s*장',
        r'chapter\s*(\d+)',
        r'ch\s*(\d+)',
        r'(\d+)\s*:',
    ]
    chapter = None
    for pattern in chapter_patterns:
        match = re.search(pattern, query, re.IGNORECASE)
        if match:
            chapter = match.group(1)
            break
    
    # 절 찾기 (예: "1절", "1 절", "verse 1", "v 1")
    verse_patterns = [
        r'(\d+)\s*절',
        r'verse\s*(\d+)',
        r'v\s*(\d+)',
    ]
    verse = None
    for pattern in verse_patterns:
        match = re.search(pattern, query, re.IGNORECASE)
        if match:
            verse = match.group(1)
            break
    
    # 장이 없고 전체 책 키워드가 있으면 전체 책으로 간주
    if not chapter and is_full_book:
        return (found_book, None, None, True)
    
    # 장이 없으면 전체 책일 가능성 (키워드가 없어도)
    if not chapter:
        return (found_book, None, None, True)
    
    return (found_book, chapter, verse, False)

def improve_query_for_search(query: str, book: str | None = None, chapter: str | None = None, verse: str | None = None) -> str:
    """
    검색 쿼리를 개선합니다.
    책 이름과 장/절이 파싱된 경우, 더 나은 검색을 위해 쿼리를 변환합니다.
    """
    if book and chapter:
        # "역대상 1장" -> "역대상 1" 또는 "역대상 chapter 1"
        improved = f"{book} {chapter}"
        if verse:
            improved += f" {verse}"
        return improved
    return query

# 원본 함수 정의 (테스트용으로 직접 호출 가능)
def _search_bible_impl(query: str, limit: int = 5) -> str:
    """Search for Bible content based on the query."""
    try:
        # 환경변수 확인
        if not settings.supabase_url or not settings.supabase_key:
            return "오류: Supabase URL 또는 키가 설정되지 않았습니다. .env 파일을 확인하세요."
        
        # 쿼리에서 책 이름, 장, 절 파싱
        book, chapter, verse, is_full_book = parse_bible_reference(query)
        
        # 전체 책 요청인 경우
        if book and is_full_book and not chapter:
            try:
                # 해당 책의 모든 장을 가져오기 (chapter를 숫자로 정렬)
                # chapter를 TEXT로 저장했으므로 숫자로 변환하여 정렬
                filtered_response = supabase.table('bible_chunks').select('*').eq('book', book).order('chapter', desc=False).limit(1000).execute()
                
                if filtered_response.data and len(filtered_response.data) > 0:
                    # 필터링된 결과가 있으면 사용
                    docs = filtered_response.data
                    result_parts = []
                    for doc in docs:
                        chapter_num = doc.get('chapter', '')
                        citation = f"{book}"
                        if chapter_num:
                            citation += f" {chapter_num}장"
                        result_parts.append(
                            f"[{citation}] {doc.get('content', '')}"
                        )
                    return "\n\n".join(result_parts)
            except Exception as filter_error:
                # 필터링 실패 시 벡터 검색으로 폴백
                pass
        
        # 쿼리 개선
        improved_query = improve_query_for_search(query, book, chapter, verse)
        
        # 쿼리 임베딩 생성
        query_embedding = embeddings.embed_query(
            improved_query,
            output_dimensionality=settings.embedding_dimension
        )
        
        # Supabase RPC를 통한 벡터 검색
        # 책과 장이 파싱된 경우 필터링을 시도
        if book and chapter:
            # 먼저 book과 chapter로 직접 필터링 시도
            try:
                # Supabase에서 book과 chapter로 필터링
                filtered_response = supabase.table('bible_chunks').select('*').eq('book', book).eq('chapter', chapter).limit(limit).execute()
                
                if filtered_response.data and len(filtered_response.data) > 0:
                    # 필터링된 결과가 있으면 사용
                    docs = filtered_response.data
                    result_parts = []
                    for doc in docs:
                        result_parts.append(
                            f"[{book} {chapter}장] {doc.get('content', '')}"
                        )
                    return "\n\n".join(result_parts)
            except Exception as filter_error:
                # 필터링 실패 시 벡터 검색으로 폴백
                pass
        
        # 전체 책 요청이지만 필터링이 실패한 경우, limit을 크게 늘려서 검색
        if book and is_full_book:
            limit = 100  # 전체 책이면 더 많은 결과를 가져오기
        
        # 벡터 검색 (기본 방법)
        response = supabase.rpc(
            'match_documents',
            {
                'query_embedding': query_embedding,
                'match_threshold': 0.5,  # 0.7에서 0.5로 낮춤
                'match_count': limit
            }
        ).execute()
        
        # 결과 포맷팅
        docs = response.data if response.data else []
        if not docs:
            return "관련된 성경 내용을 찾을 수 없습니다."
        
        result_parts = []
        for doc in docs:
            book = doc.get('book', '')
            chapter = doc.get('chapter', '')
            verse = doc.get('verse', '')
            content = doc.get('content', '')
            similarity = doc.get('similarity', 0)
            
            citation = f"{book}"
            if chapter:
                citation += f" {chapter}장"
            if verse:
                citation += f" {verse}절"
            
            result_parts.append(
                f"[{citation}] {content}\n(유사도: {similarity:.4f})"
            )
        
        return "\n\n".join(result_parts)
    except Exception as e:
        # 네트워크 연결 오류인 경우 더 명확한 메시지
        if "getaddrinfo failed" in str(e) or "ConnectError" in str(e):
            return "네트워크 연결 오류: Supabase 서버에 연결할 수 없습니다."
        return f"검색 중 오류가 발생했습니다: {str(e)}"

# LangChain Tool로 래핑
@tool
def search_bible(query: str, limit: int = 5) -> str:
    """Search for Bible content based on the query. Use this tool to find relevant Bible verses and passages.
    
    Args:
        query: The search query about Bible content
        limit: Number of results to return (default: 5)
    
    Returns:
        A formatted string containing relevant Bible passages with book, chapter, verse, and content.
    """
    return _search_bible_impl(query, limit)

class ToolErrorMiddleware(AgentMiddleware):
    """Handle tool execution errors with custom messages (supports both sync and async)."""
    
    def wrap_tool_call(self, request, handler):
        """Synchronous tool call wrapper."""
        try:
            return handler(request)
        except Exception as e:
            # Return a custom error message to the model
            return ToolMessage(
                content=f"Tool error: Please check your input and try again. ({str(e)})",
                tool_call_id=request.tool_call["id"]
            )
    
    async def awrap_tool_call(self, request, handler):
        """Asynchronous tool call wrapper."""
        try:
            return await handler(request)
        except Exception as e:
            # Return a custom error message to the model
            return ToolMessage(
                content=f"Tool error: Please check your input and try again. ({str(e)})",
                tool_call_id=request.tool_call["id"]
            )

agent = create_agent(
    model=llm,
    tools=[search_bible],
    middleware=[ToolErrorMiddleware()],
    system_prompt="""You are a Q&A AI chatbot based on Bible content. 

When users ask questions about the Bible:
1. ALWAYS use the search_bible tool to search for relevant Bible passages.
2. The search function automatically parses book names, chapters, and verses from queries.
3. You can use natural Korean queries like:
   - "역대상 1장 요약해줘" (will automatically find 1 Chronicles chapter 1)
   - "창세기 1장 1절" (will find Genesis 1:1)
   - "요한복음 3:16" (will find John 3:16)
   - "역대상 전체 요약해줘" (will find all chapters of 1 Chronicles)
   - "역대상 요약" (will find all chapters of 1 Chronicles)
4. For full book summaries, use queries like "역대상 전체", "역대상 요약", "역대상 전부" etc.
5. Use the EXACT Korean text from the user's question as the query parameter.
6. If the first search doesn't find results, try variations of the query (e.g., if user asks about "팔복", also try "복", "복이", "8복" etc.)
7. Provide accurate answers based on the Bible content you find.
8. Always cite the book, chapter, and verse when referencing Bible passages.
9. When summarizing a full book, organize the content by chapters and provide a comprehensive overview.
10. When a verse or character is mentioned briefly in the Bible, still provide meaningful context: summarize the surrounding passage, theological significance, historical background, and, if appropriate, practical applications for today.
11. Present answers in Korean with clear structure: begin with a concise 요약, then organize the explanation with 소제목, bullet lists, and numbered steps where helpful.
12. Include the key takeaways and related passages that can deepen understanding, even if they were not in the original query.
13. If information is sparse, explain what is known, what is not recorded, and suggest related areas the user could explore.

Important: 
- Never say you cannot find information without trying the search_bible tool first.
- The search function handles book names and chapter/verse parsing automatically, so you can use natural queries.
- For full book requests, the search function will automatically retrieve all chapters of the specified book."""
)
