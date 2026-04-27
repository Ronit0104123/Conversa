"""
Conversa — Chatbot CRUD Routes

Endpoints for the Next.js dashboard to Create, Read, Update, and Delete
chatbots. All routes are protected by the auth middleware so users can
only access their own chatbots.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.middleware.auth import get_current_user
from app.models.chatbot import ChatbotCreate, ChatbotUpdate, ChatbotResponse
from app.db import queries

router = APIRouter()


@router.post("/", response_model=ChatbotResponse, status_code=status.HTTP_201_CREATED)
async def create_chatbot(
    chatbot_in: ChatbotCreate,
    user_id: str = Depends(get_current_user)
):
    """Creates a new chatbot in the database."""
    try:
        chatbot = await queries.create_chatbot(
            user_id,
            chatbot_in.name,
            chatbot_in.website_url,
            chatbot_in.system_prompt
        )
        return chatbot
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create chatbot: {str(e)}"
        )


@router.get("/", response_model=List[ChatbotResponse])
async def list_chatbots(user_id: str = Depends(get_current_user)):
    """Lists all chatbots belonging to the authenticated user."""
    return await queries.list_user_chatbots(user_id)


@router.get("/{chatbot_id}", response_model=ChatbotResponse)
async def get_chatbot(chatbot_id: str, user_id: str = Depends(get_current_user)):
    """Gets a specific chatbot by ID."""
    chatbot = await queries.get_chatbot(chatbot_id)
    
    # Security check: Ensure the chatbot exists AND belongs to this user
    if not chatbot or str(chatbot["user_id"]) != user_id:
        raise HTTPException(status_code=404, detail="Chatbot not found")
        
    return chatbot


@router.patch("/{chatbot_id}", response_model=ChatbotResponse)
async def update_chatbot(
    chatbot_id: str,
    chatbot_in: ChatbotUpdate,
    user_id: str = Depends(get_current_user)
):
    """Updates specific fields of a chatbot."""
    chatbot = await queries.get_chatbot(chatbot_id)
    if not chatbot or str(chatbot["user_id"]) != user_id:
        raise HTTPException(status_code=404, detail="Chatbot not found")
        
    # Only update fields that were provided
    update_data = {k: v for k, v in chatbot_in.model_dump().items() if v is not None}
    
    if not update_data:
        return chatbot
        
    updated = await queries.update_chatbot(chatbot_id, update_data)
    return updated


@router.delete("/{chatbot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chatbot(chatbot_id: str, user_id: str = Depends(get_current_user)):
    """Deletes a chatbot and all its associated data (documents, leads, chats)."""
    chatbot = await queries.get_chatbot(chatbot_id)
    if not chatbot or str(chatbot["user_id"]) != user_id:
        raise HTTPException(status_code=404, detail="Chatbot not found")
    
    success = await queries.delete_chatbot(chatbot_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete chatbot"
        )
