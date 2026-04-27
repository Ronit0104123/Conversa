"""
Conversa — Leads Routes

Endpoints for the Next.js dashboard to view captured leads.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.middleware.auth import get_current_user
from app.models.lead import LeadResponse
from app.db import queries

router = APIRouter()


@router.get("/{chatbot_id}", response_model=List[LeadResponse])
async def list_leads_for_chatbot(chatbot_id: str, user_id: str = Depends(get_current_user)):
    """Get all leads captured by a specific chatbot."""
    chatbot = await queries.get_chatbot(chatbot_id)
    if not chatbot or str(chatbot["user_id"]) != user_id:
        raise HTTPException(status_code=404, detail="Chatbot not found")
        
    return await queries.list_chatbot_leads(chatbot_id)


@router.get("/", response_model=List[LeadResponse])
async def list_all_leads(user_id: str = Depends(get_current_user)):
    """Get all leads across all chatbots for the current user."""
    return await queries.list_user_leads(user_id)
