-- ============================================================
-- Conversa — Vector Similarity Search Function
-- Run this in Supabase SQL Editor AFTER the initial schema
-- ============================================================

-- WHY A SQL FUNCTION?
-- pgvector's similarity search requires a special SQL query with
-- the <=> operator (cosine distance). Supabase's JS/Python client
-- can't do this directly in a .select() call, so we wrap it in
-- a PostgreSQL function and call it via supabase.rpc().

-- HOW IT WORKS:
-- 1. Takes a query embedding (the user's question, vectorized)
-- 2. Filters documents to only those belonging to the target chatbot
-- 3. Sorts by cosine similarity (closest first)
-- 4. Returns the top N matches with their similarity score

CREATE OR REPLACE FUNCTION match_documents(
    query_embedding VECTOR(384),   -- The search vector
    match_chatbot_id UUID,         -- Only search this chatbot's docs
    match_count INT DEFAULT 5      -- How many results to return
)
RETURNS TABLE (
    id UUID,
    chatbot_id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.chatbot_id,
        d.content,
        d.metadata,
        -- Cosine similarity = 1 - cosine distance
        -- <=> is pgvector's cosine distance operator
        1 - (d.embedding <=> query_embedding) AS similarity
    FROM documents d
    WHERE d.chatbot_id = match_chatbot_id
    ORDER BY d.embedding <=> query_embedding  -- Closest first
    LIMIT match_count;
END;
$$;
