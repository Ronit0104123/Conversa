"""
Conversa — Auth Routes

Provides simple endpoints for authenticating/verifying the current user.
Most authentication is handled client-side by Supabase Auth, but this
is useful for the frontend to verify the backend is accepting its token.
"""

from fastapi import APIRouter, Depends
from app.middleware.auth import get_current_user

router = APIRouter()


@router.get("/me")
async def get_me(user_id: str = Depends(get_current_user)):
    """
    Verifies the JWT token and returns the user ID.
    If the token is invalid, the middleware will throw a 401 before
    this code even runs.
    """
    return {"user_id": user_id, "status": "authenticated"}
