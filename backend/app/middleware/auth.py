"""
Conversa — Auth Middleware (JWT Validation)

HOW SUPABASE AUTH WORKS WITH FASTAPI:

1. User signs up/logs in via the Next.js frontend using Supabase Auth
2. Supabase returns a JWT signed with ES256 (ECDSA asymmetric key)
3. The frontend sends it with every API request:
   Authorization: Bearer eyJhbGciOiJFUzI1NiIs...
4. THIS MIDDLEWARE fetches Supabase's public key (JWKS), verifies
   the token's signature, and extracts the user_id
5. If invalid/expired → 401 Unauthorized
6. If valid → route handler receives user_id

WHY ES256?
Newer Supabase projects use ES256 (asymmetric key) instead of HS256.
The public key can only VERIFY tokens, not create them — more secure.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt  # PyJWT
from jwt.algorithms import ECAlgorithm
import httpx
import json
import time
from app.config import settings
import logging
import asyncio

logger = logging.getLogger(__name__)

# This tells FastAPI to look for "Authorization: Bearer <token>" headers
security = HTTPBearer()

# ============================================================
# JWKS Cache — fetch the public key once and cache it
# We use httpx instead of PyJWKClient because macOS Python has
# SSL cert issues with urllib (the library PyJWKClient uses)
# ============================================================
_jwks_cache = {
    "keys": None,
    "fetched_at": 0,
}
_jwks_lock = asyncio.Lock()
JWKS_CACHE_TTL = 3600  # Re-fetch every hour


async def _get_signing_key(token: str):
    """
    Fetch the public key from Supabase JWKS and match it to the token's 'kid'.
    Results are cached so we don't hit the network on every request.
    """
    now = time.time()
    
    # Fetch JWKS if not cached or expired, using a lock to prevent race conditions
    if _jwks_cache["keys"] is None or (now - _jwks_cache["fetched_at"]) > JWKS_CACHE_TTL:
        async with _jwks_lock:
            # Re-check after acquiring lock in case another task fetched it
            if _jwks_cache["keys"] is None or (now - _jwks_cache["fetched_at"]) > JWKS_CACHE_TTL:
                jwks_url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
                async with httpx.AsyncClient() as client:
                    resp = await client.get(jwks_url, timeout=10)
                    resp.raise_for_status()
                    _jwks_cache["keys"] = resp.json()["keys"]
                    _jwks_cache["fetched_at"] = now
                    logger.info("Fetched JWKS from Supabase (Async)")
    
    # Get the 'kid' from the token header
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    
    # Find the matching key
    for key_data in _jwks_cache["keys"]:
        if key_data.get("kid") == kid:
            # Convert JWK to a PEM public key that PyJWT can use
            public_key = ECAlgorithm.from_jwk(json.dumps(key_data))
            return public_key
    
    raise ValueError(f"No matching key found for kid: {kid}")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """
    Extracts and validates the user ID from a Supabase JWT token.
    
    Returns:
        str: The user's UUID from Supabase Auth
    
    Raises:
        HTTPException 401: If token is missing, invalid, or expired
    """
    token = credentials.credentials
    
    try:
        # Step 1: Get the public key matching this token
        public_key = await _get_signing_key(token)
        
        # Step 2: Decode and verify the JWT
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["ES256"],
            options={
                "verify_aud": False,  # Supabase tokens have varying audience values
            }
        )
        
        # The user's UUID is in the "sub" (subject) claim
        user_id = payload.get("sub")
        
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: no user ID found",
            )
        
        return user_id
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please sign in again.",
        )
    except jwt.InvalidTokenError as e:
        logger.error(f"JWT validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
        )
