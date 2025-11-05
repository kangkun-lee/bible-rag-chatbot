# 성경 QA 챗봇 시스템

성경 내용을 기반으로 한 질문-답변 AI 챗봇 시스템입니다.

**본 시스템에서 사용하는 성경 본문은 대한성서공회의 1961 개정 '성경전서 개역한글판'을 기반으로 합니다. 본문의 출처를 명시하며, 본문을 임의로 고치거나 삭제·개변하지 않습니다.**

## 프로젝트 구조

```
성경QA/
├── app/                    # FastAPI 백엔드
│   ├── main.py            # FastAPI 앱 진입점
│   ├── config.py          # 설정 관리
│   ├── langgraph/         # LangGraph 관련 파일 (사용자가 직접 구현)
│   ├── routers/           # API 라우터
│   ├── services/          # 비즈니스 로직
│   ├── models/            # Pydantic 모델
│   └── scripts/           # 유틸리티 스크립트
│       └── ingest_bible.py # 벡터 DB 적재 스크립트
├── bible/                 # 성경 XML 파일
│   └── SF_2022-09-19_KOR_KORRV_(Korean Revised Version 1952 1961).xml
├── frontend/              # Next.js 프론트엔드
│   ├── app/              # Next.js App Router
│   ├── components/       # React 컴포넌트
│   └── lib/              # 유틸리티 함수
├── pyproject.toml        # Python 의존성 관리 (uv 사용)
└── render.yaml           # Render 배포 설정
```

## 기술 스택

### 백엔드
- FastAPI: Python 웹 프레임워크
- Supabase: 벡터 DB 및 PostgreSQL
- OpenAI: 임베딩 및 LLM
- LangChain: RAG 파이프라인
- uv: Python 패키지 관리

### 프론트엔드
- Next.js 14: React 프레임워크
- TypeScript: 타입 안정성
- Tailwind CSS: 스타일링
- Vercel: 배포 플랫폼

## 설치 및 실행

### 사전 요구사항
- Python 3.10 이상
- Node.js 18 이상
- uv 설치: `pip install uv` 또는 `curl -LsSf https://astral.sh/uv/install.sh | sh`
- Supabase 계정 및 프로젝트
- OpenAI API 키

### 1. 환경변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
# Supabase 설정
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
SUPABASE_TABLE_NAME=bible_chunks

# OpenAI 설정
OPENAI_API_KEY=your_openai_api_key

# FastAPI 설정
API_HOST=0.0.0.0
API_PORT=8000

# CORS 설정
ALLOWED_ORIGINS=http://localhost:3000

# 임베딩 모델 설정
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSION=1536

# LLM 설정
LLM_MODEL=gpt-4-turbo-preview
```

### 2. Supabase 벡터 DB 설정

Supabase에서 벡터 확장을 활성화하고 다음 SQL을 실행하세요:

```sql
-- 벡터 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- 테이블 생성
CREATE TABLE bible_chunks (
    id BIGSERIAL PRIMARY KEY,
    book TEXT NOT NULL,
    chapter TEXT,
    verse TEXT,
    content TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 벡터 검색 함수 생성
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(1536),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    id bigint,
    book text,
    chapter text,
    verse text,
    content text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        bible_chunks.id,
        bible_chunks.book,
        bible_chunks.chapter,
        bible_chunks.verse,
        bible_chunks.content,
        1 - (bible_chunks.embedding <=> query_embedding) AS similarity
    FROM bible_chunks
    WHERE 1 - (bible_chunks.embedding <=> query_embedding) > match_threshold
    ORDER BY bible_chunks.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 인덱스 생성 (검색 성능 향상)
CREATE INDEX ON bible_chunks USING ivfflat (embedding vector_cosine_ops);
```

### 3. 백엔드 설정

```bash
# Python 의존성 설치 (uv 사용)
uv sync

# 가상환경 활성화 (uv 사용 시)
# Windows: .venv\Scripts\activate
# Linux/Mac: source .venv/bin/activate

# 성경 XML 파일을 벡터 DB에 적재
python app/scripts/ingest_bible.py

# FastAPI 서버 실행
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 프론트엔드 설정

```bash
cd frontend

# 의존성 설치
npm install

# 환경변수 설정
# frontend/.env.local 파일 생성
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:3000`을 열어 확인하세요.

## 배포

### Vercel 배포 (프론트엔드)

1. Vercel 계정에 로그인
2. 프로젝트 연결
3. 환경변수 설정:
   - `NEXT_PUBLIC_API_URL`: FastAPI 백엔드 URL
4. 배포

### Render 배포 (백엔드)

1. GitHub 저장소에 `render.yaml` 파일이 포함되어 있는지 확인
2. Render 대시보드에서 "New Web Service" 선택
3. GitHub 저장소 연결
4. Render가 자동으로 `render.yaml` 설정을 인식
5. 환경변수 설정:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `OPENAI_API_KEY`
   - `ALLOWED_ORIGINS` (프론트엔드 URL)
6. 배포 완료 후 생성된 URL 확인

**참고**: Render에서 배포 후 성경 데이터를 벡터 DB에 적재하려면:
- Render 서비스의 Shell에서 `python app/scripts/ingest_bible.py` 실행
- 또는 로컬에서 환경변수를 설정하고 스크립트 실행

## API 엔드포인트

### POST /api/chat
채팅 메시지를 전송하고 답변을 받습니다.

**Request:**
```json
{
  "message": "아브라함은 몇 살에 이삭을 얻었나요?",
  "conversation_id": "optional-conversation-id"
}
```

**Response:**
```json
{
  "answer": "답변 내용...",
  "conversation_id": "conversation-id",
  "sources": [
    {
      "book": "창세기",
      "chapter": "21",
      "verse": "5",
      "content": "내용 미리보기..."
    }
  ]
}
```

### GET /api/health
서비스 상태를 확인합니다.

**Response:**
```json
{
  "status": "healthy",
  "message": "서비스가 정상적으로 동작 중입니다."
}
```

## LangGraph 통합

LangGraph 관련 코드는 `app/langgraph/` 폴더에 직접 구현하시면 됩니다. 현재 `graph.py` 파일이 비어있으니 여기에 LangGraph 그래프를 정의하시면 됩니다.

## 개발 참고사항

- 성경 데이터는 `bible/` 폴더의 XML 파일을 사용합니다.
- XML 파일은 Zefania XML 형식으로 되어 있으며, `ingest_bible.py` 스크립트가 자동으로 파싱합니다.
- 벡터 DB 적재 스크립트는 텍스트를 500자 청크로 분할하며, 50자씩 겹치도록 설정되어 있습니다.
- RAG 서비스는 유사도 임계값 0.7을 사용하여 상위 5개의 문서를 검색합니다.

## 성경 본문 출처

본 시스템에서 사용하는 성경 본문은 다음과 같습니다:

- **출처**: 대한성서공회, 1961 개정 '성경전서 개역한글판'
- **파일 형식**: Zefania XML (Korean Revised Version 1952 1961)
- **라이선스**: Public Domain (재산권 만료)

**저작권 안내**:  
대한성서공회 FAQ에 따르면 『성경전서 개역한글판』의 재산권은 만료되어 로열티 없이 사용 가능합니다. 다만 인격권(성명표시권·동일성유지권)은 지켜야 하므로:
- 출처(대한성서공회, 1961 개정 '성경전서 개역한글판')를 명시합니다.
- 본문을 임의로 고치거나 삭제·개변하지 않습니다.

## 라이선스

이 프로젝트는 개인 학습 목적으로 사용됩니다.
