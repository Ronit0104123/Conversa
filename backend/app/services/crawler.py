"""
Conversa — Website Crawler Service

Handles discovering all relevant URLs on a website using:
1. Sitemap discovery (sitemap.xml)
2. Recursive link extraction (BFS)
3. Respecting robots.txt
"""

import asyncio
import logging
import re
from typing import List, Set, Optional
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx
from bs4 import BeautifulSoup
from usp.tree import sitemap_tree_for_homepage

logger = logging.getLogger(__name__)

class Crawler:
    def __init__(
        self,
        base_url: str,
        max_pages: int = 50,
        respect_robots: bool = True,
        user_agent: str = "LeadPilotBot/1.0"
    ):
        self.base_url = base_url
        self.domain = urlparse(base_url).netloc
        self.max_pages = max_pages
        self.respect_robots = respect_robots
        self.user_agent = user_agent
        self.visited: Set[str] = set()
        self.queue: List[str] = []
        self.robot_parser: Optional[RobotFileParser] = None

    async def _init_robots(self):
        """Fetches and parses robots.txt for the domain."""
        if not self.respect_robots:
            return

        robots_url = urljoin(self.base_url, "/robots.txt")
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(robots_url, timeout=10.0)
                if response.status_code == 200:
                    self.robot_parser = RobotFileParser()
                    self.robot_parser.parse(response.text.splitlines())
                    logger.info(f"Loaded robots.txt from {robots_url}")
        except Exception as e:
            logger.warning(f"Could not fetch robots.txt from {robots_url}: {e}")

    def _is_allowed(self, url: str) -> bool:
        """Checks if a URL is allowed by robots.txt and belongs to the same domain."""
        parsed = urlparse(url)
        if parsed.netloc and parsed.netloc != self.domain:
            return False
            
        # Ignore common non-content extensions (except PDF/DOCX)
        if re.search(r"\.(jpg|jpeg|png|gif|svg|css|js|mp4|wav|zip|tar|gz)$", url.lower()):
            return False

        if self.respect_robots and self.robot_parser:
            return self.robot_parser.can_fetch(self.user_agent, url)
        
        return True

    def _normalize_url(self, url: str) -> str:
        """Removes fragments and trailing slashes for consistent comparison."""
        parsed = urlparse(url)
        # Reconstruct URL without fragment
        normalized = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        if parsed.query:
            normalized += f"?{parsed.query}"
        return normalized.rstrip("/")

    async def get_sitemap_urls(self) -> List[str]:
        """Discovers URLs from the website's sitemap."""
        try:
            # ultimate-sitemap-parser is synchronous, run in thread
            loop = asyncio.get_event_loop()
            tree = await loop.run_in_executor(None, sitemap_tree_for_homepage, self.base_url)
            urls = [page.url for page in tree.all_pages()]
            
            allowed_urls = [
                self._normalize_url(url) 
                for url in urls 
                if self._is_allowed(url)
            ]
            
            # Remove duplicates and limit
            unique_urls = []
            seen = set()
            for url in allowed_urls:
                if url not in seen:
                    unique_urls.append(url)
                    seen.add(url)
            
            logger.info(f"Found {len(unique_urls)} URLs in sitemap for {self.base_url}")
            return unique_urls
        except Exception as e:
            logger.warning(f"Sitemap discovery failed for {self.base_url}: {e}")
            return []

    async def get_target_urls(self, recursive: bool = False) -> List[str]:
        """
        The main entry point to get all URLs for scraping.
        1. Try sitemap first.
        2. If sitemap is empty or recursive=True, perform BFS crawl.
        """
        await self._init_robots()
        
        # 1. Try Sitemap
        sitemap_urls = await self.get_sitemap_urls()
        
        if sitemap_urls:
            # If we have enough from sitemap, just return those
            if len(sitemap_urls) >= self.max_pages or not recursive:
                return sitemap_urls[:self.max_pages]
            
            # Otherwise, seed the BFS with sitemap URLs
            for url in sitemap_urls:
                norm = self._normalize_url(url)
                if norm not in self.visited:
                    self.queue.append(url)
                    self.visited.add(norm)
        else:
            # Seed with base URL
            self.queue.append(self.base_url)
            self.visited.add(self._normalize_url(self.base_url))

        if not recursive:
            return list(self.visited)[:self.max_pages]

        # 2. BFS Crawl
        final_urls = list(self.visited)
        
        async with httpx.AsyncClient(headers={"User-Agent": self.user_agent}, timeout=15.0) as client:
            idx = 0
            while idx < len(self.queue) and len(final_urls) < self.max_pages:
                current_url = self.queue[idx]
                idx += 1
                
                # Skip if it's a document (we can't extract links from it easily here)
                if current_url.lower().endswith((".pdf", ".docx")):
                    continue

                try:
                    logger.debug(f"Crawling: {current_url}")
                    response = await client.get(current_url, follow_redirects=True)
                    if response.status_code != 200:
                        continue

                    soup = BeautifulSoup(response.text, "lxml")
                    for a in soup.find_all("a", href=True):
                        href = a["href"]
                        full_url = urljoin(current_url, href)
                        normalized = self._normalize_url(full_url)
                        
                        if normalized not in self.visited and self._is_allowed(full_url):
                            self.visited.add(normalized)
                            self.queue.append(full_url)
                            final_urls.append(full_url)
                            
                            if len(final_urls) >= self.max_pages:
                                break
                    
                    # Be polite: small delay between requests
                    await asyncio.sleep(0.5)
                    
                except Exception as e:
                    logger.warning(f"Failed to crawl {current_url}: {e}")

        return final_urls[:self.max_pages]
