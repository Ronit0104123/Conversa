-- ============================================================
-- Conversa — Initial Database Schema
-- Run this in your Supabase SQL Editor (supabase.com/dashboard)
-- ============================================================

-- 1. Enable pgvector extension (for embedding storage + similarity search)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Profiles table (extends Supabase Auth's built-in auth.users)
-- WHY: Supabase Auth manages login/signup, but we need a place
--       for extra user data (name, company). This table links
--       to auth.users via the same UUID.
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    company_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Chatbots table
-- WHY: Each chatbot is tied to one user and one website.
--       status tracks the scraping pipeline state.
--       settings stores widget config (colors, position) as flexible JSON.
CREATE TABLE chatbots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    website_url TEXT NOT NULL,
    system_prompt TEXT DEFAULT 'You are a helpful assistant for this business. Answer questions using the provided context. When the user shows buying interest or asks about services, naturally ask for their name and email so someone from the team can follow up.',
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'active', 'error')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Documents table (website content chunks + vector embeddings)
-- WHY: After scraping a website, we split the text into chunks,
--       generate a 384-dim embedding for each chunk (using MiniLM),
--       and store them here. This powers the RAG retrieval.
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chatbot_id UUID NOT NULL REFERENCES chatbots(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    embedding VECTOR(384),  -- all-MiniLM-L6-v2 produces 384-dim vectors
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Chat sessions (one per website visitor)
-- WHY: Groups messages into conversations. visitor_id is a random
--       string generated client-side (stored in localStorage) so
--       we can track returning visitors without requiring login.
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chatbot_id UUID NOT NULL REFERENCES chatbots(id) ON DELETE CASCADE,
    visitor_id TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- 6. Messages table
-- WHY: Every message in every conversation. role is 'user' or 'assistant'.
--       metadata stores extra info like tool calls or lead data returned
--       by the agent.
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Leads table
-- WHY: When the AI agent captures contact info from a visitor,
--       it's stored here. This is the core value prop of Conversa.
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chatbot_id UUID NOT NULL REFERENCES chatbots(id) ON DELETE CASCADE,
    session_id UUID REFERENCES chat_sessions(id),
    name TEXT,
    email TEXT,
    phone TEXT,
    company TEXT,
    additional_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Vector similarity search index (IVFFlat for fast approximate nearest neighbor)
-- lists = 100 is a good default. Increase if you have 100k+ documents.
CREATE INDEX idx_documents_embedding ON documents 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Fast lookups by foreign keys (Supabase auto-indexes PKs but not FKs)
CREATE INDEX idx_chatbots_user_id ON chatbots(user_id);
CREATE INDEX idx_documents_chatbot_id ON documents(chatbot_id);
CREATE INDEX idx_chat_sessions_chatbot_id ON chat_sessions(chatbot_id);
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_leads_chatbot_id ON leads(chatbot_id);
CREATE INDEX idx_leads_email ON leads(email);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Ensures users can only see their own data
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbots ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only read/update their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Chatbots: users can only CRUD their own chatbots
CREATE POLICY "Users can view own chatbots" ON chatbots
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create chatbots" ON chatbots
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chatbots" ON chatbots
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own chatbots" ON chatbots
    FOR DELETE USING (auth.uid() = user_id);

-- Documents: users can view documents for their chatbots
CREATE POLICY "Users can view own documents" ON documents
    FOR SELECT USING (
        chatbot_id IN (SELECT id FROM chatbots WHERE user_id = auth.uid())
    );
CREATE POLICY "Users can insert documents" ON documents
    FOR INSERT WITH CHECK (
        chatbot_id IN (SELECT id FROM chatbots WHERE user_id = auth.uid())
    );
CREATE POLICY "Users can delete own documents" ON documents
    FOR DELETE USING (
        chatbot_id IN (SELECT id FROM chatbots WHERE user_id = auth.uid())
    );

-- Chat sessions: viewable by chatbot owner, creatable by anyone (visitors)
CREATE POLICY "Owners can view chat sessions" ON chat_sessions
    FOR SELECT USING (
        chatbot_id IN (SELECT id FROM chatbots WHERE user_id = auth.uid())
    );
CREATE POLICY "Anyone can create chat sessions" ON chat_sessions
    FOR INSERT WITH CHECK (true);

-- Messages: viewable by chatbot owner, creatable by anyone
CREATE POLICY "Owners can view messages" ON messages
    FOR SELECT USING (
        session_id IN (
            SELECT cs.id FROM chat_sessions cs
            JOIN chatbots c ON cs.chatbot_id = c.id
            WHERE c.user_id = auth.uid()
        )
    );
CREATE POLICY "Anyone can insert messages" ON messages
    FOR INSERT WITH CHECK (true);

-- Leads: only chatbot owners can view, anyone can insert (via agent)
CREATE POLICY "Owners can view leads" ON leads
    FOR SELECT USING (
        chatbot_id IN (SELECT id FROM chatbots WHERE user_id = auth.uid())
    );
CREATE POLICY "Anyone can insert leads" ON leads
    FOR INSERT WITH CHECK (true);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- This trigger automatically creates a profile row when
-- someone signs up via Supabase Auth
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RPC FUNCTIONS
-- ============================================================

-- match_documents: performs vector similarity search
-- WHY: pgvector provides the operator <=> but we need a function
--       that we can call via Supabase's .rpc() method from the backend.
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding VECTOR(384),
  match_chatbot_id UUID,
  match_count INT DEFAULT 5
) RETURNS TABLE (
  id UUID,
  chatbot_id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.chatbot_id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM documents d
  WHERE d.chatbot_id = match_chatbot_id
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
