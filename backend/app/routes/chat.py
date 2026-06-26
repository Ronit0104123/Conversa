"""
Conversa — Chat & Agent Routes

Contains:
1. Public endpoint for the chat widget to send messages to the agent
2. Protected endpoints for the dashboard to view chat history
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
import json
from pydantic import BaseModel
from app.models.chat import (
    ChatMessageRequest,
    ChatMessageResponse,
    ChatSessionResponse,
    MessageResponse
)
from app.agent.agent import run_agent, stream_run_agent
from app.db import queries
from typing import List, Optional
from app.middleware.auth import get_current_user
from app.config import settings
from datetime import datetime, timezone

router = APIRouter()

# ============================================================
# LANDING PAGE DEMO ENDPOINT (No DB, no auth)
# ============================================================

DEMO_SYSTEM_PROMPT = """You are the Conversa assistant on our landing page. Conversa is an AI chatbot platform that helps businesses turn their website into a lead-generating chatbot.

## What Conversa Does
- Paste your website URL — our AI scrapes and indexes your content in seconds
- A custom chatbot trained on YOUR website content goes live instantly
- Embed it with one line of code — takes under 2 minutes total
- The chatbot answers visitor questions, captures leads (emails, phones), and gives you analytics on what customers are asking

## Key Features
- **AI responses**: Human-like natural language understanding using your actual website content
- **Lead capture**: Automatically collects emails and phone numbers in the natural flow of conversation
- **Analytics**: Deep insights into what your customers ask most
- **Fast setup**: From URL to live chatbot in under 2 minutes
- **Customization**: Match your brand colors, tone, and personality
- **Security**: Enterprise-grade encryption for all your data
- **Free to start**: No credit card required

## Your Behavior
- Speak as "we" — you ARE Conversa, not an external assistant
- Keep responses short: 1-3 sentences unless asked for detail
- Only discuss Conversa and how it can help the visitor's business
- For off-topic questions, redirect: "I can only help with questions about Conversa — is there something specific you'd like to know?"
- When a visitor asks about pricing, a demo, or how to get started, ask for their name and email so our team can follow up personally
- For questions you can't answer specifically: "I don't have those details handy — want me to have someone from our team reach out?"
- Never be pushy about contact info"""


class _DemoMessage(BaseModel):
    role: str
    content: str


class DemoChatRequest(BaseModel):
    message: str
    history: List[_DemoMessage] = []


@router.post("/demo")
async def chat_demo_endpoint(request: DemoChatRequest):
    """
    Stateless demo chat for the landing page.
    No DB, no chatbot_id, no auth — just Groq + hardcoded Conversa product prompt.
    """
    from langchain_groq import ChatGroq
    from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

    llm = ChatGroq(
        model=settings.GROQ_MODEL,
        api_key=settings.GROQ_API_KEY,
        temperature=0.7,
        max_tokens=512,
    )

    messages = [SystemMessage(content=DEMO_SYSTEM_PROMPT)]
    for msg in request.history:
        if msg.role == "user":
            messages.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            messages.append(AIMessage(content=msg.content))
    messages.append(HumanMessage(content=request.message))

    async def event_generator():
        try:
            async for chunk in llm.astream(messages):
                if chunk.content:
                    yield f"data: {json.dumps({'type': 'chunk', 'content': chunk.content})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

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


@router.post("/stream")
async def chat_stream_endpoint(request: ChatMessageRequest):
    """
    Streaming version of the public chat endpoint.
    Returns a Server-Sent Events (SSE) stream.
    """
    chatbot = await queries.get_chatbot(request.chatbot_id)
    if not chatbot:
        raise HTTPException(status_code=404, detail="Chatbot not found")

    # Validation logic (same as standard endpoint)
    status_value = chatbot.get("status")
    if status_value in ["processing", "error"]:
        raise HTTPException(status_code=409, detail=f"Chatbot status: {status_value}")

    session_id = request.session_id
    if not session_id:
        session = await queries.create_chat_session(request.chatbot_id, request.visitor_id)
        session_id = session["id"]

    await queries.save_message(session_id, "user", request.message)

    async def event_generator():
        full_response = ""
        metadata = {}
        
        try:
            async for event in stream_run_agent(
                chatbot_id=request.chatbot_id,
                session_id=session_id,
                user_message=request.message,
                custom_system_prompt=chatbot.get("system_prompt")
            ):
                if event["type"] == "chunk":
                    full_response += event["content"]
                    yield f"data: {json.dumps(event)}\n\n"
                elif event["type"] == "metadata":
                    metadata = event
                    yield f"data: {json.dumps(event)}\n\n"
            
            # Save the complete assistant message to DB after stream finishes
            await queries.save_message(
                session_id, 
                "assistant", 
                full_response, 
                {"lead_captured": metadata.get("lead_captured", False)}
            )
            
        except Exception as e:
            error_data = {"type": "error", "content": str(e)}
            yield f"data: {json.dumps(error_data)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


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
