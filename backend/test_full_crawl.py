import asyncio
import sys
import os

# Add the app directory to sys.path
sys.path.append(os.path.join(os.getcwd(), "app"))

from app.routes.scrape import scrape_background_task
from app.db import queries
from app.db.supabase import supabase_admin

async def test_full_integration():
    chatbot_id = "31598be1-1e3e-4ceb-a05d-5325f3d2cc73"
    url = "https://books.toscrape.com/"
    
    print(f"--- Starting Full Integration Test for {url} ---")
    print(f"Using Chatbot ID: {chatbot_id}")
    
    # Check current document count
    initial_count = queries.count_chatbot_documents(chatbot_id)
    print(f"Initial document chunks: {initial_count}")
    
    # Run the background task
    # We'll crawl 3 pages recursively
    await scrape_background_task(
        chatbot_id=chatbot_id,
        url=url,
        max_pages=3,
        recursive=True,
        respect_robots=False # Disable robots.txt for this test site to be sure
    )
    
    # Check final document count
    final_count = queries.count_chatbot_documents(chatbot_id)
    print(f"Final document chunks: {final_count}")
    
    # Check unique source URLs in the documents table
    result = supabase_admin.table("documents").select("metadata->source_url").eq("chatbot_id", chatbot_id).execute()
    urls = set(row['metadata']['source_url'] for row in result.data)
    
    print(f"Unique URLs indexed: {urls}")
    
    if len(urls) > 1:
        print("Integration Test PASSED: Multiple pages crawled and indexed!")
    else:
        print("Integration Test FAILED: Only one or zero pages indexed.")

if __name__ == "__main__":
    asyncio.run(test_full_integration())
