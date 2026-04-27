"""
Conversa — Agent Tools

WHAT ARE TOOLS IN LANGCHAIN?
Tools are Python functions that the LLM can "call" during a conversation.
The LLM doesn't execute the code — it generates a structured request
like "call save_lead with name='John', email='john@example.com'", and 
LangChain executes the function and feeds the result back.

Think of it like giving the AI a set of buttons it can press.
Each button has a name and a description that tells the AI WHEN to press it.

TOOLS IN CONVERSA:
1. save_lead — Store visitor contact info when they share it
2. search_website — Search for additional info in the website content
   (used when the initial RAG context isn't enough)

WHY NOT MAKE RAG A TOOL?
We do RAG retrieval BEFORE the agent runs (as a pre-processing step),
so the most relevant content is always in the system prompt. The 
search_website tool is a BACKUP for when the visitor asks a follow-up
question that wasn't covered by the initial retrieval.
"""

from langchain_core.tools import tool
from typing import Optional
from app.db import queries
from app.services.embedding import generate_embeddings
import logging

logger = logging.getLogger(__name__)
MIN_TOOL_SEARCH_SIMILARITY = 0.15


# ============================================================
# Tool 1: Save Lead
# ============================================================

@tool
def save_lead(
    chatbot_id: str,
    session_id: str,
    name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    company: Optional[str] = None,
) -> str:
    """Save a visitor's contact information as a lead. 
    Call this ONLY when the visitor voluntarily shares their contact details like name, email, phone, or company.
    Do NOT call this if the visitor hasn't shared any contact information.
    At minimum, either a name or email should be provided.
    
    Args:
        chatbot_id: The ID of the chatbot (provided in context)
        session_id: The current chat session ID (provided in context)
        name: The visitor's name if provided
        email: The visitor's email if provided
        phone: The visitor's phone number if provided
        company: The visitor's company name if provided
    """
    try:
        name = name.strip() if isinstance(name, str) else name
        email = email.strip() if isinstance(email, str) else email
        phone = phone.strip() if isinstance(phone, str) else phone
        company = company.strip() if isinstance(company, str) else company

        # Require at least one reliable identifier to avoid empty/low-quality leads.
        if not name and not email:
            return "No lead saved: missing required lead details (name or email)."

        lead = queries.save_lead(
            chatbot_id=chatbot_id,
            session_id=session_id,
            name=name,
            email=email,
            phone=phone,
            company=company,
        )
        logger.info(f"Lead captured: {lead['id']} for chatbot {chatbot_id}")
        return f"Lead saved successfully. Lead ID: {lead['id']}"
    except Exception as e:
        logger.error(f"Failed to save lead: {e}")
        return f"Failed to save lead: {str(e)}"


# ============================================================
# Tool 2: Search Website Content
# ============================================================

@tool
def search_website(query: str, chatbot_id: str) -> str:
    """Search the website's content for information relevant to the query.
    Use this when you need additional context beyond what's already provided
    to answer the visitor's question.
    
    Args:
        query: The search query — what information to look for
        chatbot_id: The ID of the chatbot whose website to search
    """
    try:
        # Generate embedding for the search query
        query_embedding = generate_embeddings([query])[0]
        
        # Search pgvector for similar chunks
        results = queries.search_similar_documents(
            chatbot_id=chatbot_id,
            query_embedding=query_embedding,
            top_k=3,
        )
        
        if not results:
            return "No additional information found on the website for this query."
        
        # Format the results into readable text. Keep strong matches first,
        # then fall back to top chunks for broad/underspecified queries.
        context_parts = []
        for doc in results:
            similarity = float(doc.get("similarity") or 0)
            if similarity >= MIN_TOOL_SEARCH_SIMILARITY:
                context_parts.append(doc["content"])

        if not context_parts:
            context_parts = [doc["content"] for doc in results[:2]]
        
        if not context_parts:
            return "No sufficiently relevant information found for this query."
        
        return "\n\n---\n\n".join(context_parts)
    
    except Exception as e:
        logger.error(f"Website search failed: {e}")
        return f"Search failed: {str(e)}"
