"""
Conversa — Scrape Request/Response Models

These handle the "paste a URL" flow — the user submits a URL,
the backend scrapes it, and returns progress updates.
"""

from pydantic import BaseModel, Field
from typing import Optional


class ScrapeRequest(BaseModel):
    """What the frontend sends to trigger website scraping."""
    url: str = Field(..., description="The website URL to scrape")
    chatbot_id: str = Field(..., description="Which chatbot to associate the scraped content with")
    max_pages: int = Field(1, description="Maximum number of pages to crawl (1 = single page)")
    recursive: bool = Field(False, description="Whether to follow internal links recursively")
    respect_robots: bool = Field(True, description="Whether to respect robots.txt rules")


class ScrapeResponse(BaseModel):
    """Status update returned after triggering a scrape."""
    chatbot_id: str
    status: str  # 'processing' | 'active' | 'error'
    message: str
    chunks_created: Optional[int] = None
