
import asyncio
import sys
import os

# Add the backend directory to sys.path so we can import the app
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.services.scraper import scrape_website

async def test_scrape(url):
    try:
        print(f"\n{'='*50}")
        print(f"Scraping: {url}")
        print(f"{'='*50}")
        result = await scrape_website(url)
        print(f"Title: {result.title}")
        print(f"Word Count: {result.word_count}")
        print("--- CONTENT ---")
        print(result.content)
        return result
    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return None

async def main():
    # Focusing on Notion for precision check
    await test_scrape("https://evergreen-volleyball-e49.notion.site/Conversa-34c55c59c74b80fc9617f69106ee43f3")

if __name__ == "__main__":
    asyncio.run(main())
