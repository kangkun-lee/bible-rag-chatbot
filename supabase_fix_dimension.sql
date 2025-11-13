-- Supabase 테이블 차원 수정 SQL
-- Gemini 임베딩 모델의 output_dimensionality 파라미터로 차원을 제어합니다.

-- 중요: 기존 데이터가 있다면 먼저 백업하세요!

-- 1. 기존 함수 및 인덱스 삭제
DROP FUNCTION IF EXISTS match_documents(vector, float, int) CASCADE;
DROP INDEX IF EXISTS bible_chunks_embedding_idx CASCADE;

-- 2. 기존 테이블 삭제 후 재생성
DROP TABLE IF EXISTS bible_chunks CASCADE;

-- 3. 테이블 재생성 (임베딩 차원: 1536, output_dimensionality로 설정)
CREATE TABLE bible_chunks (
    id BIGSERIAL PRIMARY KEY,
    book TEXT NOT NULL,
    chapter TEXT,
    verse TEXT,
    content TEXT NOT NULL,
    embedding vector(1536),  -- output_dimensionality로 설정된 차원
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 벡터 검색 함수 재생성 (1536 차원)
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

-- 5. 인덱스 재생성 (1536 차원은 ivfflat 인덱스 지원, 최대 2000 차원까지 지원)
-- 데이터가 충분히 많을 때만 인덱스 생성 (최소 1000개 이상 권장)
CREATE INDEX bible_chunks_embedding_idx 
ON bible_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

