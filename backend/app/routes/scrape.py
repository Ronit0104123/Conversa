"""
Conversa — Scrape Route

Handles triggering the website scraper.
Because scraping and embedding can take a long time (5-30 seconds),
we use FastAPI's BackgroundTasks. The API responds immediately with "processing",
and the actual work happens in the background.
"""

from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, status
from app.middleware.auth import get_current_user
from app.models.scrape import ScrapeRequest, ScrapeResponse
from app.db import queries
from app.services.scraper import scrape_website
from app.services.embedding import process_and_store_embeddings
from app.services.crawler import Crawler
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


async def scrape_background_task(
    chatbot_id: str, 
    url: str, 
    max_pages: int = 1, 
    recursive: bool = False, 
    respect_robots: bool = True
):
    """
    The actual work that runs in the background.
    1. Discovers target URLs using Crawler
    2. Scrapes each URL
    3. Deletes old embeddings (if this is a re-scrape)
    4. Chunks, embeds, and stores the new text
    5. Updates the chatbot status to 'active' or 'error'
    """
    try:
        logger.info(f"Starting background scrape for {url} (max_pages={max_pages}, recursive={recursive})")
        
        # Discover URLs
        crawler = Crawler(url, max_pages=max_pages, respect_robots=respect_robots)
        target_urls = await crawler.get_target_urls(recursive=recursive)
        logger.info(f"Found {len(target_urls)} URLs to scrape for {url}")
        
        if not target_urls:
            target_urls = [url] # Fallback to base URL

        # Delete only URL docs if re-scraping, preserving uploaded files
        await queries.delete_chatbot_url_documents(chatbot_id)
        
        total_chunks = 0
        success_count = 0
        
        for target_url in target_urls:
            try:
                # Scrape
                scraped_data = await scrape_website(target_url)
                logger.info(f"Scraped {scraped_data.word_count} words from {target_url}")
                
                # Embed and store in pgvector
                chunks_stored = await process_and_store_embeddings(
                    chatbot_id=chatbot_id,
                    content=scraped_data.content,
                    source_url=target_url,
                    page_title=scraped_data.title
                )
                total_chunks += chunks_stored
                success_count += 1
            except Exception as e:
                logger.error(f"Failed to scrape {target_url}: {e}")
                continue
        
        if success_count == 0:
            raise ValueError("No pages could be successfully scraped")

        # Mark as active
        await queries.update_chatbot(chatbot_id, {"status": "active"})
        logger.info(f"Successfully processed {success_count} pages. {total_chunks} total chunks stored.")
        
    except Exception as e:
        logger.error(f"Scrape task failed for {url}: {e}")
        await queries.update_chatbot(chatbot_id, {"status": "error"})


@router.post("/", response_model=ScrapeResponse, status_code=status.HTTP_202_ACCEPTED)
async def trigger_scrape(
    request: ScrapeRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user)
):
    """
    Endpoint called when user clicks "Create" or "Retrain".
    Validates ownership, updates status, and kicks off background task.
    """
    chatbot = await queries.get_chatbot(request.chatbot_id)
    if not chatbot or str(chatbot["user_id"]) != user_id:
        raise HTTPException(status_code=404, detail="Chatbot not found")
        
    # Set status to processing immediately
    await queries.update_chatbot(request.chatbot_id, {"status": "processing"})
    
    # Add the heavy lifting to the background task queue
    background_tasks.add_task(
        scrape_background_task, 
        request.chatbot_id, 
        request.url,
        max_pages=request.max_pages,
        recursive=request.recursive,
        respect_robots=request.respect_robots
    )
    
    return ScrapeResponse(
        chatbot_id=request.chatbot_id,
        status="processing",
        message="Scraping started in the background"
    )
