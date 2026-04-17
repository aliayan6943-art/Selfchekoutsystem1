"""
Auth Dependencies — Smart Retail Backend
==========================================
FastAPI dependencies for securing endpoints with JWT.

Usage in any router:
    from auth_deps import get_current_user

    @router.get("/protected")
    async def protected_route(user: dict = Depends(get_current_user)):
        return {"user_id": user["user_id"], "phone": user["phone_number"]}
"""

from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import JWT_SECRET_KEY, JWT_ALGORITHM

# ─── Security Scheme ─────────────────────────────────────────────────────────

# HTTPBearer extracts the token from the `Authorization: Bearer <token>` header.
_bearer_scheme = HTTPBearer()


# ─── Dependency ───────────────────────────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> dict:
    """
    Decode and validate the JWT access token.

    Returns a dict with at minimum:
        - user_id   (str)  — UUID of the authenticated user
        - phone_number (str) — The phone number used to log in

    Raises 401 if the token is missing, expired, or tampered with.
    """
    token = credentials.credentials

    try:
        payload: dict = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Ensure critical claims are present
    user_id: str | None = payload.get("sub")
    phone_number: str | None = payload.get("phone")

    if not user_id or not phone_number:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is missing required claims.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "user_id": user_id,
        "phone_number": phone_number,
    }
