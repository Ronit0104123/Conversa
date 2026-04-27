"""
Conversa — Chat & Agent Routes

Contains:
1. Public endpoint for the chat widget to send messages to the agent
2. Protected endpoints for the dashboard to view chat history
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from app.models.chat import (
    ChatMessageRequest, 
    ChatMessageResponse, 
    ChatSessionResponse, 
    MessageResponse
)
from app.agent.agent import run_agent
from app.db import queries
from typing import List
from app.middleware.auth import get_current_user
from datetime import datetime, timezone

router = APIRouter()

# ============================================================
# PUBLIC ENDPOINT (Called by widget)
# ============================================================

@router.post("/", response_model=ChatMessageResponse)
async def chat_endpoint(request: ChatMessageRequest):
    """
    Public endpoint for the chat widget on customer websites.
    No JWT auth required here, but we validate the chatbot exists.
    """
    chatbot = await queries.get_chatbot(request.chatbot_id)
    if not chatbot:
        raise HTTPException(status_code=404, detail="Chatbot not found")

    status_value = chatbot.get("status")
    if status_value == "processing":
        raise HTTPException(
            status_code=409,
            detail="This chatbot is still training on website content. Please try again in a moment.",
        )

    if status_value == "error":
        raise HTTPException(
            status_code=409,
            detail="This chatbot's last scrape failed. Re-train it from the dashboard and try again.",
        )

    doc_count = await queries.count_chatbot_documents(request.chatbot_id)
    if doc_count == 0:
        raise HTTPException(
            status_code=409,
            detail="No website content is indexed for this chatbot yet. Re-train it to load context.",
        )
        
    session_id = request.session_id
    
    # Create a new session if one doesn't exist
    if not session_id:
        session = await queries.create_chat_session(
            request.chatbot_id,
            request.visitor_id
        )
        session_id = session["id"]
        
    # Save the user's message to the DB
    await queries.save_message(session_id, "user", request.message)
    
    # Run the LangChain agent
    try:
        agent_response = await run_agent(
            chatbot_id=request.chatbot_id,
            session_id=session_id,
            user_message=request.message,
            custom_system_prompt=chatbot.get("system_prompt")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")
        
    # Save the assistant's message to the DB
    metadata = {}
    if agent_response.lead_captured:
        metadata["lead_captured"] = True
        
    await queries.save_message(
        session_id,
        "assistant",
        agent_response.response,
        metadata
    )
    
    return ChatMessageResponse(
        session_id=session_id,
        agent_response=agent_response,
        created_at=datetime.now(timezone.utc)
    )


@router.get("/history", response_model=List[MessageResponse])
async def get_public_history(
    chatbot_id: str = Query(..., description="Chatbot ID for validation"),
    session_id: str = Query(..., description="Session ID to load"),
    visitor_id: str = Query(..., description="Anonymous visitor ID"),
    limit: int = Query(30, ge=1, le=100, description="Max messages to return"),
):
    """
    Public endpoint for widget history hydration after refresh.
    We allow only the same visitor_id + chatbot_id pair to fetch that session.
    """
    chatbot = await queries.get_chatbot(chatbot_id)
    if not chatbot:
        raise HTTPException(status_code=404, detail="Chatbot not found")

    session = await queries.get_chat_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if str(session.get("chatbot_id")) != chatbot_id:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.get("visitor_id") != visitor_id:
        raise HTTPException(status_code=403, detail="Unauthorized session access")

    return await queries.get_session_messages(session_id, limit)

# ============================================================
# PROTECTED ENDPOINTS (Called by Dashboard)
# ============================================================

@router.get("/sessions/{chatbot_id}", response_model=List[ChatSessionResponse])
async def list_sessions(chatbot_id: str, user_id: str = Depends(get_current_user)):
    """List recent chat sessions for a specific chatbot."""
    chatbot = await queries.get_chatbot(chatbot_id)
    if not chatbot or str(chatbot["user_id"]) != user_id:
        raise HTTPException(status_code=404, detail="Chatbot not found")
        
    return await queries.list_chatbot_sessions(chatbot_id)


@router.get("/messages/{session_id}", response_model=List[MessageResponse])
async def list_messages(session_id: str, user_id: str = Depends(get_current_user)):
    """Get the full message history for a specific session."""
    session = await queries.get_chat_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    chatbot = await queries.get_chatbot(session["chatbot_id"])
    if not chatbot or str(chatbot["user_id"]) != user_id:
        raise HTTPException(status_code=404, detail="Unauthorized")
        
    return await queries.get_session_messages(session_id)
