"""
Conversa — Reusable Database Queries (ASYNC)

Refactored to use the async Supabase client for maximum performance in FastAPI.
"""

from typing import List, Optional
from app.db.supabase import get_supabase_async


# ============================================================
# CHATBOT QUERIES
# ============================================================

async def create_chatbot(user_id: str, name: str, website_url: str, system_prompt: str = None) -> dict:
    """Create a new chatbot and return the created record."""
    client = await get_supabase_async()
    data = {
        "user_id": user_id,
        "name": name,
        "website_url": website_url,
        "status": "processing",
    }
    if system_prompt:
        data["system_prompt"] = system_prompt
    
    result = await client.table("chatbots").insert(data).execute()
    return result.data[0]


async def get_chatbot(chatbot_id: str) -> Optional[dict]:
    """Get a single chatbot by ID."""
    client = await get_supabase_async()
    result = await client.table("chatbots").select("*").eq("id", chatbot_id).execute()
    return result.data[0] if result.data else None


async def list_user_chatbots(user_id: str) -> List[dict]:
    """Get all chatbots for a specific user."""
    client = await get_supabase_async()
    result = (
        await client.table("chatbots")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


async def update_chatbot(chatbot_id: str, updates: dict) -> Optional[dict]:
    """Update a chatbot's fields."""
    client = await get_supabase_async()
    result = (
        await client.table("chatbots")
        .update(updates)
        .eq("id", chatbot_id)
        .execute()
    )
    return result.data[0] if result.data else None


async def delete_chatbot(chatbot_id: str) -> bool:
    """Delete a chatbot (cascades to documents, sessions, leads)."""
    client = await get_supabase_async()
    result = await client.table("chatbots").delete().eq("id", chatbot_id).execute()
    return len(result.data) > 0


# ============================================================
# CHAT SESSION & MESSAGE QUERIES
# ============================================================

async def create_chat_session(chatbot_id: str, visitor_id: str) -> dict:
    """Create a new chat session for a visitor."""
    client = await get_supabase_async()
    result = (
        await client.table("chat_sessions")
        .insert({"chatbot_id": chatbot_id, "visitor_id": visitor_id})
        .execute()
    )
    return result.data[0]


async def get_chat_session(session_id: str) -> Optional[dict]:
    """Get a chat session by ID."""
    client = await get_supabase_async()
    result = await client.table("chat_sessions").select("*").eq("id", session_id).execute()
    return result.data[0] if result.data else None


async def list_chatbot_sessions(chatbot_id: str, limit: int = 50) -> List[dict]:
    """Get recent chat sessions for a chatbot."""
    client = await get_supabase_async()
    result = (
        await client.table("chat_sessions")
        .select("*")
        .eq("chatbot_id", chatbot_id)
        .order("started_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data


async def save_message(session_id: str, role: str, content: str, metadata: dict = None) -> dict:
    """Save a single message to a chat session."""
    client = await get_supabase_async()
    data = {
        "session_id": session_id,
        "role": role,
        "content": content,
        "metadata": metadata or {},
    }
    result = await client.table("messages").insert(data).execute()
    return result.data[0]


async def get_session_messages(session_id: str, limit: int = 50) -> List[dict]:
    """Get messages for a chat session, ordered chronologically."""
    client = await get_supabase_async()
    result = (
        await client.table("messages")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
    )
    return result.data


# ============================================================
# LEAD QUERIES
# ============================================================

async def save_lead(
    chatbot_id: str,
    session_id: str = None,
    name: str = None,
    email: str = None,
    phone: str = None,
    company: str = None,
    additional_data: dict = None,
) -> dict:
    """Save a captured lead."""
    client = await get_supabase_async()
    data = {
        "chatbot_id": chatbot_id,
        "session_id": session_id,
        "name": name,
        "email": email,
        "phone": phone,
        "company": company,
        "additional_data": additional_data or {},
    }
    # Remove None values so we don't overwrite defaults
    data = {k: v for k, v in data.items() if v is not None}
    result = await client.table("leads").insert(data).execute()
    return result.data[0]


async def list_chatbot_leads(chatbot_id: str, limit: int = 100) -> List[dict]:
    """Get all leads for a chatbot, newest first."""
    client = await get_supabase_async()
    result = (
        await client.table("leads")
        .select("*")
        .eq("chatbot_id", chatbot_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data


async def list_user_leads(user_id: str, limit: int = 100) -> List[dict]:
    """Get all leads across all chatbots for a user."""
    client = await get_supabase_async()
    # First get the user's chatbot IDs, then get leads for those chatbots
    chatbots = await list_user_chatbots(user_id)
    chatbot_ids = [c["id"] for c in chatbots]
    
    if not chatbot_ids:
        return []
    
    result = (
        await client.table("leads")
        .select("*")
        .in_("chatbot_id", chatbot_ids)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data


# ============================================================
# DOCUMENT / VECTOR QUERIES
# ============================================================

async def search_similar_documents(
    chatbot_id: str,
    query_embedding: List[float],
    top_k: int = 5,
) -> List[dict]:
    """Search for most similar document chunks using pgvector RPC."""
    client = await get_supabase_async()
    result = await client.rpc(
        "match_documents",
        {
            "query_embedding": query_embedding,
            "match_chatbot_id": chatbot_id,
            "match_count": top_k,
        }
    ).execute()
    return result.data


async def delete_chatbot_documents(chatbot_id: str) -> int:
    """Delete all document chunks for a chatbot."""
    client = await get_supabase_async()
    result = (
        await client.table("documents")
        .delete()
        .eq("chatbot_id", chatbot_id)
        .execute()
    )
    return len(result.data)


async def delete_chatbot_url_documents(chatbot_id: str) -> int:
    """Delete only scraped document chunks (http%)."""
    client = await get_supabase_async()
    result = (
        await client.table("documents")
        .delete()
        .eq("chatbot_id", chatbot_id)
        .filter("metadata->>source_url", "ilike", "http%")
        .execute()
    )
    return len(result.data)


async def count_chatbot_documents(chatbot_id: str) -> int:
    """Return how many document chunks are indexed for a chatbot."""
    client = await get_supabase_async()
    result = (
        await client.table("documents")
        .select("id", count="exact", head=True)
        .eq("chatbot_id", chatbot_id)
        .execute()
    )
    return result.count or 0


async def list_chatbot_documents(chatbot_id: str) -> List[dict]:
    """
    Get all unique document sources for a chatbot.
    Optimized to select only metadata and deduplicate efficiently.
    """
    client = await get_supabase_async()
    # Fetch all metadata records (only the column we need)
    result = (
        await client.table("documents")
        .select("metadata")
        .eq("chatbot_id", chatbot_id)
        .execute()
    )
    
    seen_sources = set()
    unique_docs = []
    for doc in result.data:
        meta = doc.get("metadata") or {}
        source_url = meta.get("source_url")
        if source_url and source_url not in seen_sources:
            seen_sources.add(source_url)
            unique_docs.append(meta)
            
    return unique_docs
