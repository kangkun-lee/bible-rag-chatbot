-- Supabase 벡터 DB 설정 스크립트
-- Gemini 임베딩 모델용 (output_dimensionality로 차원 제어 가능)

-- 1. 벡터 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 테이블 생성 (임베딩 차원: 1536, output_dimensionality로 설정)
CREATE TABLE IF NOT EXISTS bible_chunks (
    id BIGSERIAL PRIMARY KEY,
    book TEXT NOT NULL,
    chapter TEXT,
    verse TEXT,
    content TEXT NOT NULL,
    embedding vector(1536),  -- output_dimensionality로 설정된 차원
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 벡터 검색 함수 생성
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

-- 4. 인덱스 생성 (검색 성능 향상)
-- 1536 차원은 ivfflat 인덱스를 지원합니다 (최대 2000 차원까지 지원)
-- 데이터가 충분히 많을 때만 인덱스 생성 (최소 1000개 이상 권장)
CREATE INDEX IF NOT EXISTS bible_chunks_embedding_idx 
ON bible_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 5. (선택사항) RLS 정책 추가 (보안 강화용)
-- Table Editor에서 RLS를 활성화한 경우에만 아래 주석을 해제하세요
-- ALTER TABLE bible_chunks ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Enable read access for service role" ON bible_chunks
--     FOR SELECT USING (true);
-- CREATE POLICY "Enable insert access for service role" ON bible_chunks
--     FOR INSERT WITH CHECK (true);

-- 6. 확인용 쿼리
-- SELECT COUNT(*) FROM bible_chunks;


