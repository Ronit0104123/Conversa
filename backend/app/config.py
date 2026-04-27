"""
Conversa Backend — Application Configuration

WHY THIS EXISTS:
Instead of scattering os.getenv() calls everywhere, we centralize ALL
environment variables into a single Pydantic Settings class. This gives us:
  1. Automatic validation — app won't start if a required var is missing
  2. Type coercion — strings become ints, bools, lists automatically
  3. Single source of truth — every config value is documented here
  4. .env file support — loads from .env automatically

HOW TO USE:
    from app.config import settings
    print(settings.SUPABASE_URL)
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """All environment variables for the Conversa backend."""
    
    # --- Supabase ---
    # SUPABASE_URL: Your project's API URL (found in Supabase Dashboard > Settings > API)
    SUPABASE_URL: str
    
    # SUPABASE_SERVICE_KEY: The "service_role" key (NOT the anon key!)
    # This bypasses Row Level Security — used only server-side for admin operations
    # like inserting documents after scraping.
    SUPABASE_SERVICE_KEY: str
    
    # SUPABASE_JWT_SECRET: Used to verify JWT tokens from Supabase Auth
    # Found in Dashboard > Settings > API > JWT Secret
    SUPABASE_JWT_SECRET: str
    
    # --- Groq (LLM) ---
    GROQ_API_KEY: str
    
    # Which Groq model to use. Default is Llama 3.3 70B — best for tool calling.
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    
    # --- App Settings ---
    APP_ENV: str = "development"
    
    # CORS origins — which frontend URLs can call this API
    # In production, this would be your Vercel domain
    # Accepts comma-separated values: "http://localhost:3000,https://myapp.com"
    CORS_ORIGINS: str = "http://localhost:3000"
    
    @property
    def cors_origins_list(self) -> list:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
    
    # --- Embedding Model ---
    # This runs locally via sentence-transformers — no API key needed
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Singleton instance — import this everywhere
settings = Settings()
