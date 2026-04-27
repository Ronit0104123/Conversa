"""
Conversa — Embedding Service (Chunking + Vector Generation + Storage)

THE RAG PIPELINE:
    Scraped Text → Chunk → Embed → Store in pgvector
    
    Later (at chat time):
    User Question → Embed → Search pgvector → Top-K chunks → LLM context

WHY CHUNKING?
1. LLMs have context limits — we can't feed an entire website at once
2. Vector search is more accurate on focused text chunks than on huge documents
3. Smaller chunks = more precise retrieval = better answers

CHUNKING STRATEGY:
We use a simple "sliding window" approach:
- Chunk size: ~500 words (roughly 1-2 paragraphs)
- Overlap: 50 words between chunks
- WHY overlap? So that sentences at chunk boundaries aren't lost.
  If a key fact spans two chunks, the overlap ensures it appears in at least one.

WHY ALL-MINILM-L6-V2?
- FREE — runs locally, no API costs
- FAST — only 22M parameters, runs on CPU in ~5ms per chunk
- GOOD ENOUGH — top-tier for its size on semantic search benchmarks
- 384 dimensions — compact vectors, efficient storage
"""

from sentence_transformers import SentenceTransformer
from typing import List
from dataclasses import dataclass
from app.config import settings
from app.db.supabase import supabase_admin, get_supabase_async
import logging
import anyio

logger = logging.getLogger(__name__)

# ============================================================
# Load the embedding model ONCE at startup (not per request)
# This takes ~2 seconds on first load, then it's cached in memory
# ============================================================
_model = None


def get_embedding_model() -> SentenceTransformer:
    """Lazy-load the embedding model (singleton pattern)."""
    global _model
    if _model is None:
        logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
        _model = SentenceTransformer(settings.EMBEDDING_MODEL)
        logger.info("Embedding model loaded successfully")
    return _model


# ============================================================
# Text Chunking
# ============================================================

@dataclass
class TextChunk:
    """A chunk of text with metadata about where it came from."""
    content: str
    chunk_index: int
    word_count: int


def chunk_text(
    text: str,
    chunk_size: int = 500,
    overlap: int = 50,
) -> List[TextChunk]:
    """
    Splits text into overlapping chunks of roughly `chunk_size` words.
    
    Args:
        text: The full text to split
        chunk_size: Target number of words per chunk
        overlap: Number of words to overlap between consecutive chunks
    
    Returns:
        List of TextChunk objects
        
    Example:
        If text has 1200 words with chunk_size=500, overlap=50:
        Chunk 0: words 0-499
        Chunk 1: words 450-949   (50 words overlap with chunk 0)
        Chunk 2: words 900-1199  (50 words overlap with chunk 1)
    """
    words = text.split()
    
    if len(words) <= chunk_size:
        # Text is small enough to be one chunk
        return [TextChunk(content=text.strip(), chunk_index=0, word_count=len(words))]
    
    chunks = []
    start = 0
    chunk_index = 0
    
    while start < len(words):
        end = start + chunk_size
        chunk_words = words[start:end]
        chunk_text = " ".join(chunk_words)
        
        chunks.append(TextChunk(
            content=chunk_text,
            chunk_index=chunk_index,
            word_count=len(chunk_words),
        ))
        
        # Move the window forward by (chunk_size - overlap)
        start += chunk_size - overlap
        chunk_index += 1
    
    return chunks


# ============================================================
# Embedding Generation
# ============================================================

async def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Generates vector embeddings for a list of text strings.
    Runs in a background thread to avoid blocking the event loop.
    """
    model = await anyio.to_thread.run_sync(get_embedding_model)
    
    def _encode():
        return model.encode(texts, show_progress_bar=False)
    
    embeddings = await anyio.to_thread.run_sync(_encode)
    return [embedding.tolist() for embedding in embeddings]


# ============================================================
# Store in Supabase pgvector
# ============================================================

async def process_and_store_embeddings(
    chatbot_id: str,
    content: str,
    source_url: str,
    page_title: str = "",
) -> int:
    """
    Full pipeline: chunk text → generate embeddings → store in DB.
    
    Args:
        chatbot_id: Which chatbot these embeddings belong to
        content: The scraped text content
        source_url: Where the content came from (for metadata)
        page_title: Page title (for metadata)
        
    Returns:
        Number of chunks created and stored
    """
    # Step 1: Chunk the text
    chunks = chunk_text(content)
    logger.info(f"Created {len(chunks)} chunks from {source_url}")
    
    if not chunks:
        return 0
    
    # Step 2: Generate embeddings for all chunks at once (batched)
    texts = [chunk.content for chunk in chunks]
    embeddings = await generate_embeddings(texts)
    logger.info(f"Generated {len(embeddings)} embeddings")
    
    # Step 3: Prepare rows for database insertion
    rows = []
    for chunk, embedding in zip(chunks, embeddings):
        rows.append({
            "chatbot_id": chatbot_id,
            "content": chunk.content,
            "metadata": {
                "source_url": source_url,
                "page_title": page_title,
                "chunk_index": chunk.chunk_index,
                "word_count": chunk.word_count,
            },
            "embedding": embedding,
        })
    
    # Step 4: Insert into Supabase (using service client to bypass RLS)
    client = await get_supabase_async()
    result = await client.table("documents").insert(rows).execute()
    logger.info(f"Stored {len(result.data)} document chunks in database")
    
    return len(result.data)
