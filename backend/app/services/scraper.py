"""
Conversa — Website Scraper Service

WHAT THIS DOES:
Takes a URL → fetches the HTML → strips junk → returns clean text.

DESIGN DECISIONS:
1. We use httpx (async) instead of requests because FastAPI is async.
   Using sync requests would block the event loop and slow down other requests.

2. We strip these HTML elements because they add noise, not knowledge:
   - <script>, <style> — code, not content
   - <nav>, <footer>, <header> — navigation, not information
   - <iframe>, <noscript> — embedded content, usually ads

3. We extract text from <p>, <h1>-<h6>, <li>, <td>, <blockquote>, <article>
   because these contain the actual business information.

4. We also grab the page title and meta description — these are often
   the best summary of what the page is about.

FUTURE (V2): Multi-page crawling — follow links, respect robots.txt,
parse sitemaps, handle JavaScript-rendered pages (Playwright).
"""

from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from typing import Optional
from dataclasses import dataclass
import os
import httpx
import io
from pypdf import PdfReader
from docx import Document as DocxDocument


@dataclass
class ScrapedContent:
    """Container for scraped webpage data."""
    url: str
    title: str
    description: str
    content: str  # The clean text content
    word_count: int


# HTML tags that contain noise, not information
TAGS_TO_REMOVE = [
    "script", "style", "nav", "footer", "header",
    "iframe", "noscript", "form", "svg", "img",
    "button", "input", "select", "textarea", "aside", "modal",
]

# Phrases that indicate non-business junk content
JUNK_PHRASES = [
    "copyright", "all rights reserved", "privacy policy", "terms of service",
    "terms and conditions", "cookie policy", "subscribe to our newsletter",
    "follow us on", "designed by", "powered by", "sign in", "log in",
    "create account", "forgot password",
]

# HTML tags that typically contain meaningful content
CONTENT_TAGS = [
    "p", "h1", "h2", "h3", "h4", "h5", "h6",
    "li", "td", "th", "blockquote",
]


async def scrape_pdf(url: str) -> ScrapedContent:
    """Extracts text from a PDF file."""
    async with httpx.AsyncClient() as client:
        response = await client.get(url, follow_redirects=True)
        response.raise_for_status()
        
    pdf_file = io.BytesIO(response.content)
    reader = PdfReader(pdf_file)
    
    text_parts = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            text_parts.append(text)
            
    content = "\n\n".join(text_parts)
    title = os.path.basename(url)
    
    return ScrapedContent(
        url=url,
        title=title,
        description=f"PDF Document: {title}",
        content=content,
        word_count=len(content.split()),
    )


async def scrape_docx(url: str) -> ScrapedContent:
    """Extracts text from a DOCX file."""
    async with httpx.AsyncClient() as client:
        response = await client.get(url, follow_redirects=True)
        response.raise_for_status()
        
    docx_file = io.BytesIO(response.content)
    doc = DocxDocument(docx_file)
    
    text_parts = [p.text for p in doc.paragraphs if p.text.strip()]
    content = "\n\n".join(text_parts)
    title = os.path.basename(url)
    
    return ScrapedContent(
        url=url,
        title=title,
        description=f"Word Document: {title}",
        content=content,
        word_count=len(content.split()),
    )


async def scrape_website(url: str) -> ScrapedContent:
    """
    Scrapes a single webpage and extracts clean text content.
    
    Args:
        url: The URL to scrape
        
    Returns:
        ScrapedContent with title, description, and clean text
        
    Raises:
        httpx.HTTPError: If the request fails
        ValueError: If no content could be extracted
    """
    # Check for document types based on extension
    lower_url = url.lower().split("?")[0]
    if lower_url.endswith(".pdf"):
        return await scrape_pdf(url)
    if lower_url.endswith(".docx"):
        return await scrape_docx(url)

    # Fallback: check Content-Type with a HEAD request (more efficient than GET)
    try:
        async with httpx.AsyncClient() as client:
            head_resp = await client.head(url, follow_redirects=True, timeout=5.0)
            content_type = head_resp.headers.get("Content-Type", "").lower()
            if "application/pdf" in content_type:
                return await scrape_pdf(url)
            if "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in content_type:
                return await scrape_docx(url)
    except Exception:
        # If HEAD fails, just continue with Playwright/BeautifulSoup
        pass

    # --- Step 1: Fetch the HTML with Playwright ---
    async with async_playwright() as p:
        channel = os.getenv("PLAYWRIGHT_CHANNEL")
        launch_kwargs = {"headless": True}
        if channel:
            launch_kwargs["channel"] = channel

        try:
            browser = await p.chromium.launch(**launch_kwargs)
        except Exception as e:
            channel_hint = f" (channel={channel})" if channel else ""
            raise ValueError(
                "Playwright could not launch a browser" + channel_hint + ". "
                "Install browsers with 'python -m playwright install chromium' "
                "or set PLAYWRIGHT_CHANNEL=chrome to use the system Chrome."
            ) from e
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        try:
            # "networkidle" is best for heavy sites like Notion, but we use a timeout
            # to prevent hanging on sites with perpetual background requests.
            try:
                await page.goto(url, wait_until="networkidle", timeout=25000)
            except Exception:
                # If networkidle times out, the page is often actually loaded.
                # We proceed and let the Smart Wait loop or final extraction handle it.
                pass
            
            # --- Smart Wait Loop ---
            # Extra safety for sites that might need a bit more time even after networkidle
            max_wait_seconds = 10
            for _ in range(max_wait_seconds):
                # Check for "meaningful content" (> 50 words) in key areas
                has_content = await page.evaluate("""() => {
                    const selectors = ['.notion-page-content', '.notion-scroller', 'main', 'article'];
                    for (const s of selectors) {
                        const el = document.querySelector(s);
                        if (el && el.innerText.trim().split(/\\s+/).length > 50) return true;
                    }
                    return false;
                }""")
                if has_content:
                    break
                await page.wait_for_timeout(1000)
            
            # Final tiny pause for any last-second layout/rendering
            await page.wait_for_timeout(1000)
            html_content = await page.content()
        except Exception as e:
            # Fallback: try to grab whatever is there even if it timed out
            try:
                html_content = await page.content()
            except Exception:
                await browser.close()
                raise ValueError(f"Failed to fetch {url}: {str(e)}")
        finally:
            await browser.close()
    
    # --- Step 2: Parse the HTML ---
    soup = BeautifulSoup(html_content, "lxml")
    
    # Extract title
    title = ""
    if soup.title and soup.title.string:
        title = soup.title.string.strip()
    
    # Extract meta description
    description = ""
    meta_desc = soup.find("meta", attrs={"name": "description"})
    if meta_desc and meta_desc.get("content"):
        description = meta_desc["content"].strip()
    
    # --- Step 3: Remove noise elements ---
    for tag_name in TAGS_TO_REMOVE:
        for tag in soup.find_all(tag_name):
            tag.decompose()  # Completely removes the element
    
    # --- Step 4: Extract clean text ---
    # Strategy: get text from the <main> or <article> tag first (most specific),
    # fall back to <body> if those don't exist. For Notion, we look for its specific scroller.
    main_content = (
        soup.find("main") or 
        soup.find("article") or 
        soup.find(class_="notion-page-content") or
        soup.find(class_="notion-scroller") or
        soup.find("body")
    )
    
    if not main_content:
        raise ValueError(f"Could not extract content from {url}")
    
    # Get text from content-bearing tags
    text_parts = []
    
    for element in main_content.find_all(CONTENT_TAGS):
        # Keep spacing between inline nodes so words are not concatenated.
        text = element.get_text(" ", strip=True)
        # Skip very short fragments (likely navigation remnants)
        if text and len(text) > 10:
            text_parts.append(text)
    
    # If we didn't get much from specific tags, fall back to all text
    if len(text_parts) < 3:
        # Fallback extraction: get ALL text but filter out short fragments.
        # This is more robust for deeply nested div-based sites like Notion.
        raw_text = main_content.get_text(separator="\n")
        text_parts = []
        for line in raw_text.split("\n"):
            clean_line = line.strip()
            # If it's a Notion-like site, we might want even shorter fragments (bullet points)
            # Generally > 10 chars is safe to capture meaningful text while avoiding icons/noise.
            if clean_line and len(clean_line) > 10:
                text_parts.append(clean_line)

    # --- Step 5: Final Cleanup and Precision filtering ---
    final_parts = []
    for part in text_parts:
        lowered = part.lower()
        # Filter out junk phrases
        if any(junk in lowered for junk in JUNK_PHRASES):
            continue
        
        # Filter out navigation-like lines (e.g. "Home | About | Contact")
        if part.count("|") > 2 or part.count("•") > 2:
            continue
            
        final_parts.append(part)

    text_parts = final_parts
    
    # Remove duplicate fragments while preserving order.
    deduped_parts = []
    seen = set()
    for part in text_parts:
        normalized = " ".join(part.split())
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped_parts.append(normalized)

    text_parts = deduped_parts
    
    content = "\n\n".join(text_parts)

    # Keep title/description in the indexed content so broad questions like
    # "what is this company about" can still be answered reliably.
    summary_parts = []
    if title:
        summary_parts.append(f"Page title: {title}")
    if description:
        summary_parts.append(f"Page description: {description}")

    if summary_parts:
        content = "\n\n".join(summary_parts + [content]) if content else "\n\n".join(summary_parts)
    
    if not content.strip():
        raise ValueError(f"No meaningful content extracted from {url}")
    
    return ScrapedContent(
        url=url,
        title=title,
        description=description,
        content=content,
        word_count=len(content.split()),
    )
