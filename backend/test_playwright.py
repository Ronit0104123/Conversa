import asyncio
from app.services.scraper import scrape_website

async def main():
    print("Testing Playwright scraper on https://100x.bot...")
    try:
        content = await scrape_website("https://100x.bot")
        print("SUCCESS!")
        print(f"Title: {content.title}")
        print(f"Description: {content.description}")
        print(f"Word count: {content.word_count}")
        print("--- CONTENT PREVIEW ---")
        print(content.content[:500] + "...")
    except Exception as e:
        print(f"FAILED: {type(e).__name__} - {str(e)}")

asyncio.run(main())
