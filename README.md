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
- Google Generative AI (Gemini): 임베딩 및 LLM
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
- Google Generative AI API 키

### 1. 환경변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
# Supabase 설정
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
SUPABASE_TABLE_NAME=bible_chunks

# Google Generative AI 설정
GOOGLE_API_KEY=your_google_api_key

# FastAPI 설정
API_HOST=0.0.0.0
API_PORT=8000

# CORS 설정
ALLOWED_ORIGINS=http://localhost:3000

# 임베딩 모델 설정 (Google Gemini)
EMBEDDING_MODEL=models/gemini-embedding-001
EMBEDDING_DIMENSION=1536

# LLM 설정 (Google Gemini)
LLM_MODEL=gemini-pro
```

### 2. Supabase 벡터 DB 설정

**⚠️ 중요: 스크립트 실행 전에 반드시 Supabase에서 테이블을 생성해야 합니다!**

Supabase 대시보드에서 다음 단계를 따라하세요:

1. **Supabase 대시보드 접속** → 프로젝트 선택
2. **Table Editor** 메뉴 클릭 → **New Table** 클릭
3. 테이블 이름: `bible_chunks`
4. **SQL Editor**로 이동하여 아래 SQL 실행 (또는 `supabase_setup.sql` 파일 사용)

**Table Editor에서 테이블 생성 시 설정:**
- ✅ **Enable Row Level Security (RLS)**: **비활성화** (또는 활성화 후 정책 추가)
  - 백엔드에서 Service Role Key를 사용하므로 RLS를 비활성화해도 안전합니다
  - 보안을 강화하려면 RLS를 활성화하고 아래 정책을 추가하세요 (선택사항)
- ❌ **Enable Realtime**: **비활성화** (실시간 업데이트가 필요하지 않음)

**SQL Editor에서 실행할 SQL:**

```sql
-- 벡터 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- 테이블 생성 (임베딩 차원: 1536, output_dimensionality로 설정)
CREATE TABLE IF NOT EXISTS bible_chunks (
    id BIGSERIAL PRIMARY KEY,
    book TEXT NOT NULL,
    chapter TEXT,
    verse TEXT,
    content TEXT NOT NULL,
    embedding vector(1536),  -- output_dimensionality로 설정된 차원
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
-- 1536 차원은 ivfflat 인덱스를 지원합니다 (최대 2000 차원까지 지원)
-- 데이터가 충분히 많을 때만 인덱스 생성 (최소 1000개 이상 권장)
CREATE INDEX IF NOT EXISTS bible_chunks_embedding_idx 
ON bible_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- (선택사항) RLS 정책 추가 (보안 강화용)
-- RLS를 활성화한 경우에만 필요합니다
-- ALTER TABLE bible_chunks ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Enable read access for service role" ON bible_chunks
--     FOR SELECT USING (true);
-- CREATE POLICY "Enable insert access for service role" ON bible_chunks
--     FOR INSERT WITH CHECK (true);
```

**참고**: 
- 프로젝트 루트에 `supabase_setup.sql` 파일이 있습니다. 이 파일을 Supabase SQL Editor에서 실행할 수 있습니다.
- Gemini 임베딩 `models/gemini-embedding-001`은 `output_dimensionality` 파라미터로 차원을 제어할 수 있습니다.
- `.env` 파일의 `EMBEDDING_DIMENSION` 환경변수로 차원을 설정합니다 (기본값: 1536).
- 1536 차원은 `ivfflat` 인덱스를 지원하므로 검색 성능을 향상시킬 수 있습니다.
- 기존에 3072 차원으로 테이블을 생성했다면 `supabase_fix_dimension.sql` 파일을 실행하여 수정하세요.
- **RLS 설정**: 백엔드에서 Service Role Key를 사용하므로 RLS를 비활성화해도 안전합니다. 하지만 보안을 강화하려면 RLS를 활성화하고 위의 정책을 추가하세요.
- **Realtime 설정**: 이 프로젝트는 실시간 업데이트가 필요하지 않으므로 비활성화하세요.

### 3. 백엔드 설정

```bash
# Python 의존성 설치 (uv 사용)
uv sync

# 가상환경 활성화 (uv 사용 시)
# Windows: .venv\Scripts\activate
# Linux/Mac: source .venv/bin/activate

# 성경 데이터를 벡터 DB에 적재 (최초 1회만 실행)
python app/scripts/ingest_bible.py
```

### 4. 프론트엔드 설정

```bash
cd frontend

# 의존성 설치
npm install
# 또는
pnpm install
# 또는
yarn install

# 환경변수 설정
# frontend/.env.local 파일 생성
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
```

## 서버 실행

### 백엔드 서버 실행

프로젝트 루트 디렉토리에서 실행:

```bash
# 방법 1: uvicorn 직접 실행
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 방법 2: uv를 사용하여 실행
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**실행 확인:**
- 서버가 정상적으로 실행되면 `http://localhost:8000`에서 API 문서를 확인할 수 있습니다.
- API 문서: `http://localhost:8000/docs` (Swagger UI)
- 대체 문서: `http://localhost:8000/redoc` (ReDoc)

**백엔드 서버 기본 정보:**
- 포트: `8000`
- 호스트: `0.0.0.0` (모든 네트워크 인터페이스에서 접근 가능)
- 자동 리로드: `--reload` 옵션으로 코드 변경 시 자동 재시작

### 프론트엔드 서버 실행

`frontend` 디렉토리에서 실행:

```bash
cd frontend

# 개발 서버 실행
npm run dev
# 또는
pnpm dev
# 또는
yarn dev
```

**실행 확인:**
- 서버가 정상적으로 실행되면 `http://localhost:3000`에서 애플리케이션을 확인할 수 있습니다.
- 브라우저가 자동으로 열리지 않으면 수동으로 `http://localhost:3000`을 열어주세요.

**프론트엔드 서버 기본 정보:**
- 포트: `3000`
- 핫 리로드: 코드 변경 시 자동으로 브라우저가 새로고침됩니다.

### 서버 실행 순서

1. **백엔드 서버 먼저 실행** (터미널 1)
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **프론트엔드 서버 실행** (터미널 2)
   ```bash
   cd frontend
   npm run dev
   ```

3. **브라우저에서 확인**
   - 프론트엔드: `http://localhost:3000`
   - 백엔드 API 문서: `http://localhost:8000/docs`

**참고:**
- 두 서버를 동시에 실행해야 정상적으로 작동합니다.
- 백엔드 서버가 실행되지 않으면 프론트엔드에서 API 호출이 실패합니다.
- 각 서버는 별도의 터미널 창에서 실행하거나, 터미널 멀티플렉서(tmux, screen 등)를 사용할 수 있습니다.

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
   - `GOOGLE_API_KEY`
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

- 성경 데이터는 `ingest_bible.py` 스크립트를 통해 벡터 DB에 적재됩니다.
- 벡터 DB 적재 스크립트는 텍스트를 500자 청크로 분할하며, 50자씩 겹치도록 설정되어 있습니다.
- RAG 서비스는 유사도 임계값 0.7을 사용하여 상위 5개의 문서를 검색합니다.

## 성경 본문 출처

본 시스템에서 사용하는 성경 본문은 다음과 같습니다:

- **출처**: 대한성서공회, 1961 개정 '성경전서 개역한글판'
- **라이선스**: Public Domain (재산권 만료)

**저작권 안내**:  
대한성서공회 FAQ에 따르면 『성경전서 개역한글판』의 재산권은 만료되어 로열티 없이 사용 가능합니다. 다만 인격권(성명표시권·동일성유지권)은 지켜야 하므로:
- 출처(대한성서공회, 1961 개정 '성경전서 개역한글판')를 명시합니다.
- 본문을 임의로 고치거나 삭제·개변하지 않습니다.

## 라이선스

이 프로젝트는 개인 학습 목적으로 사용됩니다.
