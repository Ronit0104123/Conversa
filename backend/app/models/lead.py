"""
Conversa — Lead Pydantic Models

Leads are the core value of Conversa — when the AI agent captures
a visitor's contact information, it's stored as a lead.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class LeadCreate(BaseModel):
    """Created internally by the agent's lead capture tool."""
    chatbot_id: str
    session_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    additional_data: dict = Field(default_factory=dict)


class LeadResponse(BaseModel):
    """What the dashboard shows for each captured lead."""
    id: str
    chatbot_id: str
    session_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    additional_data: dict = {}
    created_at: datetime
