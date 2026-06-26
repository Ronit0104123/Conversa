"""
Conversa — Agent Memory (Chat History Management)

HOW MEMORY WORKS IN CONVERSA:

Unlike simple chatbots that lose memory on page refresh, Conversa
persists ALL conversations in the database. When a visitor sends a 
message, we:

1. Load the last N messages from this session (from the DB)
2. Convert them into LangChain message objects
3. Pass them to the LLM so it has full conversation context

WHY DB-BACKED MEMORY?
- Survives page refreshes (visitor closes tab, comes back tomorrow)
- Dashboard owner can review full conversations
- No memory leaks (unlike in-memory storage)
- Works across multiple server instances (important for scaling)

ALTERNATIVE WE DIDN'T CHOOSE:
LangChain's ConversationBufferMemory stores in RAM — fine for demos,
terrible for production. It dies when the server restarts and can't
be shared across multiple workers.
"""

from langchain_core.messages import HumanMessage, AIMessage
from typing import List
from app.db import queries
import logging
import re

logger = logging.getLogger(__name__)
INLINE_FUNCTION_CALL_PATTERN = re.compile(
    r"<function=[a-zA-Z0-9_]+>\{.*?\}</function>",
    re.DOTALL,
)


def _sanitize_assistant_message(content: str) -> str:
    """Remove raw inline tool-call markup from persisted assistant messages."""
    if not content:
        return ""
    cleaned = INLINE_FUNCTION_CALL_PATTERN.sub("", content)
    return cleaned.strip()


async def load_chat_history(session_id: str, max_messages: int = 20) -> List:
    """
    Loads recent chat history from the database and converts to 
    LangChain message objects.
    
    Args:
        session_id: The chat session to load history for
        max_messages: Maximum number of messages to load (prevents
                      huge contexts that blow up the token limit)
    
    Returns:
        List of HumanMessage and AIMessage objects
    
    WHY max_messages = 20?
    Llama 3.3 70B has an 8k context window on Groq. With RAG context
    taking ~2k tokens and the system prompt ~1k tokens, we have ~5k 
    tokens for history. 20 messages is roughly 2-3k tokens — safe margin.
    """
    messages = await queries.get_session_messages(session_id, limit=max_messages)
    
    langchain_messages = []
    for msg in messages:
        if msg["role"] == "user":
            langchain_messages.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            langchain_messages.append(
                AIMessage(content=_sanitize_assistant_message(msg["content"]))
            )
    
    logger.info(f"Loaded {len(langchain_messages)} messages for session {session_id}")
    return langchain_messages
