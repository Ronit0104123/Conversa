"""
Conversa Backend — Supabase Client Initialization

Refactored to handle async client initialization correctly.
"""

from supabase import create_client, Client, create_async_client, AsyncClient
from app.config import settings

# ============================================================
# Synchronous Client (for scripts or legacy sync code)
# ============================================================
def get_supabase_admin() -> Client:
    """Creates a synchronous Supabase client."""
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_KEY
    )

supabase_admin: Client = get_supabase_admin()


# ============================================================
# Asynchronous Client (Main client for FastAPI)
# ============================================================
_supabase_async: AsyncClient = None

async def get_supabase_async() -> AsyncClient:
    """
    Returns the global async Supabase client, initializing it if necessary.
    This must be called within an async context.
    """
    global _supabase_async
    if _supabase_async is None:
        _supabase_async = await create_async_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_KEY
        )
    return _supabase_async
