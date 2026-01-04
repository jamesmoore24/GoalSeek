-- ============================================
-- MEMORY EMBEDDINGS MIGRATION
-- Adds vector support for semantic memory search (RAG)
-- ============================================

-- 1. Enable pgvector extension (required for vector operations)
-- Note: This may already be enabled in your Supabase project
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add new columns to user_memories table
ALTER TABLE user_memories
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS memory_type TEXT CHECK (memory_type IN (
    'insight', 'decision', 'fact', 'commitment', 'preference', 'goal', 'other'
  )),
  ADD COLUMN IF NOT EXISTS importance INTEGER CHECK (importance >= 1 AND importance <= 10),
  ADD COLUMN IF NOT EXISTS source_id UUID;

-- 3. Create index for vector similarity search
-- Using IVFFlat for approximate nearest neighbor search (faster than exact)
-- lists = 100 is good for tables up to ~1M rows
CREATE INDEX IF NOT EXISTS idx_user_memories_embedding
  ON user_memories
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 4. Create index on memory_type for filtering
CREATE INDEX IF NOT EXISTS idx_user_memories_type
  ON user_memories(memory_type)
  WHERE memory_type IS NOT NULL;

-- 5. Create a function for semantic search
-- This makes it easy to call from the API
CREATE OR REPLACE FUNCTION search_memories(
  query_embedding vector(1536),
  match_user_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  memory_type TEXT,
  importance INTEGER,
  pursuit_id UUID,
  tags TEXT[],
  created_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    um.id,
    um.content,
    um.memory_type,
    um.importance,
    um.pursuit_id,
    um.tags,
    um.created_at,
    1 - (um.embedding <=> query_embedding) AS similarity
  FROM user_memories um
  WHERE um.user_id = match_user_id
    AND um.embedding IS NOT NULL
    AND 1 - (um.embedding <=> query_embedding) > match_threshold
  ORDER BY um.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 6. Grant execute permission on the function
GRANT EXECUTE ON FUNCTION search_memories TO authenticated;
GRANT EXECUTE ON FUNCTION search_memories TO anon;

-- 7. Comment for documentation
COMMENT ON COLUMN user_memories.embedding IS 'Vector embedding from text-embedding-3-small (1536 dimensions)';
COMMENT ON COLUMN user_memories.memory_type IS 'Type of memory: insight, decision, fact, commitment, preference, goal';
COMMENT ON COLUMN user_memories.importance IS 'Importance score 1-10 assigned by extraction LLM';
COMMENT ON COLUMN user_memories.source_id IS 'Links memories extracted from the same conversation';
COMMENT ON FUNCTION search_memories IS 'Semantic search for memories using cosine similarity';
