"""
Conversa Backend — FastAPI Application Entry Point

WHY THIS EXISTS:
This is the "main" file — where FastAPI starts. It:
  1. Creates the FastAPI app instance
  2. Configures CORS (so the Next.js frontend can call our API)
  3. Registers all route groups (we'll add these as we build them)
  4. Provides a health check endpoint

WHAT IS CORS?
Cross-Origin Resource Sharing. By default, browsers block requests from
one domain (localhost:3000, your Next.js app) to another domain
(localhost:8000, this FastAPI app). CORS middleware tells the browser
"it's okay, let these specific origins talk to me."
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.services.embedding import get_embedding_model
import anyio

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load embedding model on startup so it's ready for requests
    print("Pre-loading embedding model...")
    await anyio.to_thread.run_sync(get_embedding_model)
    print("Embedding model loaded.")
    yield


# ============================================================
# Create the FastAPI app
# ============================================================
app = FastAPI(
    title="Conversa API",
    description="AI-powered lead generation chatbot platform",
    version="0.1.0",
    lifespan=lifespan,
)

# ============================================================
# CORS Middleware
# ============================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],                        # Allow all origins so the widget works on any website
    allow_credentials=False,                    # Must be False when allow_origins=["*"]
    allow_methods=["*"],                        # Allow all HTTP methods
    allow_headers=["*"],                        # Allow all headers
)


# ============================================================
# Health Check — used by Render to verify the app is alive
# ============================================================
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "conversa-api"}


# ============================================================
# Register Routers
# ============================================================
from app.routes import auth, chatbot, chat, scrape, leads, documents

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(chatbot.router, prefix="/api/chatbots", tags=["Chatbots"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(scrape.router, prefix="/api/scrape", tags=["Scrape"])
app.include_router(leads.router, prefix="/api/leads", tags=["Leads"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
