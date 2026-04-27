"""
Conversa — Chat & Message Pydantic Models

These models handle:
  - Incoming chat messages from the widget
  - Agent responses (structured JSON)
  - Chat session data
  - Message history
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ChatMessageRequest(BaseModel):
    """What the chat widget sends when a visitor types a message."""
    chatbot_id: str = Field(..., description="Which chatbot this message is for")
    session_id: Optional[str] = Field(None, description="Existing session ID, or null for new session")
    visitor_id: str = Field(..., description="Anonymous visitor identifier (from localStorage)")
    message: str = Field(..., min_length=1, description="The visitor's message")


class AgentResponse(BaseModel):
    """
    Structured output from the LangChain agent.
    
    WHY STRUCTURED OUTPUT?
    Instead of returning a plain string, the agent returns JSON with:
      - response: The text message to show the visitor
      - lead_captured: Whether contact info was just captured
      - lead_data: The captured info (if any)
      - suggested_questions: Follow-up prompts to show in the widget
    
    This lets the widget react to agent actions (e.g., show a "Thank you!" 
    animation when a lead is captured).
    """
    response: str = Field(..., description="The agent's text response to show the visitor")
    lead_captured: bool = Field(default=False, description="Whether a lead was just captured")
    lead_data: Optional[dict] = Field(default=None, description="Captured lead info if any")
    suggested_questions: List[str] = Field(
        default_factory=list,
        description="Suggested follow-up questions to display in the widget"
    )


class ChatMessageResponse(BaseModel):
    """Full response sent back to the chat widget."""
    session_id: str
    agent_response: AgentResponse
    created_at: datetime


class ChatSessionResponse(BaseModel):
    """Chat session metadata for the dashboard."""
    id: str
    chatbot_id: str
    visitor_id: Optional[str] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    message_count: Optional[int] = 0


class MessageResponse(BaseModel):
    """Individual message in a chat history view."""
    id: str
    session_id: str
    role: str  # 'user' | 'assistant'
    content: str
    metadata: dict = {}
    created_at: datetime
