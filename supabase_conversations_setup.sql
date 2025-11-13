-- 대화 기록 저장을 위한 Supabase 테이블 생성 SQL
-- Supabase 대시보드의 SQL Editor에서 실행하세요.

-- conversations 테이블 생성
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,  -- 사용자 식별자 (선택사항, 향후 인증 추가 시 사용)
    metadata JSONB DEFAULT '{}'::jsonb,  -- 추가 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- messages 테이블 생성
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    sources JSONB,  -- 출처 정보 배열 [{book, chapter, verse, content}, ...]
    metadata JSONB DEFAULT '{}'::jsonb,  -- 추가 메타데이터 (토큰 수, 지연 시간 등)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- conversations 테이블의 updated_at 자동 업데이트 트리거
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) 정책 (선택사항)
-- Service Role Key를 사용하는 경우 RLS를 비활성화해도 안전합니다.
-- 하지만 사용자별 접근 제어가 필요한 경우 아래 정책을 활성화하세요.

-- ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 대화만 조회 가능 (user_id 기반)
-- CREATE POLICY "Users can view own conversations"
--     ON conversations FOR SELECT
--     USING (auth.uid()::text = user_id);

-- CREATE POLICY "Users can view own messages"
--     ON messages FOR SELECT
--     USING (
--         conversation_id IN (
--             SELECT id FROM conversations WHERE user_id = auth.uid()::text
--         )
--     );

