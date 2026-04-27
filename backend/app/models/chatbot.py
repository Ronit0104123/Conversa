"""
Conversa — Chatbot Pydantic Models

WHY PYDANTIC MODELS?
They serve THREE purposes simultaneously:
  1. REQUEST VALIDATION — FastAPI auto-validates incoming JSON against these
  2. RESPONSE SERIALIZATION — Defines exactly what the API returns
  3. DOCUMENTATION — FastAPI generates OpenAPI/Swagger docs from these

NAMING CONVENTION:
  - *Create  = what the client sends to CREATE a resource
  - *Update  = what the client sends to UPDATE (partial fields)
  - *Response = what the API sends back
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ChatbotCreate(BaseModel):
    """What the user sends when creating a new chatbot."""
    name: str = Field(..., min_length=1, max_length=100, description="Chatbot display name")
    website_url: str = Field(..., description="URL to scrape for chatbot knowledge")
    system_prompt: Optional[str] = Field(
        None,
        description="Custom system prompt. If not provided, a default lead-gen prompt is used."
    )
    settings: Optional[dict] = Field(
        default_factory=dict,
        description="Widget settings (colors, position, etc.)"
    )


class ChatbotUpdate(BaseModel):
    """Partial update — only send the fields you want to change."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    system_prompt: Optional[str] = None
    settings: Optional[dict] = None


class ChatbotResponse(BaseModel):
    """What the API returns for a chatbot."""
    id: str
    user_id: str
    name: str
    website_url: str
    system_prompt: Optional[str] = None
    status: str  # 'processing' | 'active' | 'error'
    settings: dict = {}
    created_at: datetime
    updated_at: datetime
