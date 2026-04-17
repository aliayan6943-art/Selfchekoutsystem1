"""
Authentication Router — Smart Retail Backend
==============================================
Phone-number + OTP authentication flow.

Endpoints:
  POST /auth/request-otp  — Send (or simulate) an OTP to a phone number
  POST /auth/verify-otp   — Verify the OTP, auto-register the user, return JWT
  GET  /auth/me            — Return current user info (protected, for testing)

Flow:
  1. Client sends phone number → backend stores OTP in memory (dev: always 123456)
  2. Client sends phone + OTP  → backend verifies → creates user if new → returns JWT
  3. Client stores JWT and sends it as `Authorization: Bearer <token>` on future requests

Security Notes:
  - OTPs are stored server-side in a dict with expiry timestamps.
  - In production, replace the in-memory store with Redis + a real SMS gateway.
  - JWTs are stateless HS256 tokens (no refresh tokens in Phase 1).
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator

from config import (
    DEV_HARDCODED_OTP,
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
    OTP_EXPIRY_SECONDS,
)
from auth_deps import get_current_user

# ─── Logging ──────────────────────────────────────────────────────────────────

logger = logging.getLogger("retail-backend.auth")

# ─── Router ───────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/auth", tags=["Authentication"])

# ─── In-Memory OTP Store (dev only — replace with Redis in production) ────────
# Structure: { phone_number: { "otp": "123456", "expires_at": <unix_timestamp> } }

_otp_store: dict[str, dict] = {}

# ─── Pydantic Models ─────────────────────────────────────────────────────────


class RequestOtpPayload(BaseModel):
    """Payload for POST /auth/request-otp."""
    phone_number: str = Field(
        ...,
        min_length=10,
        max_length=15,
        description="Phone number in E.164 or local format (10–15 digits).",
        examples=["+919876543210", "9876543210"],
    )

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        # Strip spaces and dashes for flexibility
        cleaned = v.replace(" ", "").replace("-", "")
        # Must start with optional + followed by digits only
        if cleaned.startswith("+"):
            if not cleaned[1:].isdigit():
                raise ValueError("Phone number must contain only digits after '+'.")
        else:
            if not cleaned.isdigit():
                raise ValueError("Phone number must contain only digits.")
        if not (10 <= len(cleaned.replace("+", "")) <= 15):
            raise ValueError("Phone number must be 10–15 digits.")
        return cleaned


class RequestOtpResponse(BaseModel):
    """Response for POST /auth/request-otp."""
    message: str
    phone_number: str
    # In dev mode we return the OTP for convenience; omit in production
    dev_otp: str | None = Field(
        default=None,
        description="Returned ONLY in development mode for testing.",
    )


class VerifyOtpPayload(BaseModel):
    """Payload for POST /auth/verify-otp."""
    phone_number: str = Field(
        ...,
        min_length=10,
        max_length=15,
        description="Same phone number used in request-otp.",
    )
    otp: str = Field(
        ...,
        min_length=6,
        max_length=6,
        description="The 6-digit OTP code.",
        examples=["123456"],
    )

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = v.replace(" ", "").replace("-", "")
        if cleaned.startswith("+"):
            if not cleaned[1:].isdigit():
                raise ValueError("Phone number must contain only digits after '+'.")
        else:
            if not cleaned.isdigit():
                raise ValueError("Phone number must contain only digits.")
        return cleaned

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("OTP must be 6 digits.")
        return v


class VerifyOtpResponse(BaseModel):
    """Response for POST /auth/verify-otp."""
    access_token: str
    token_type: str = "bearer"
    user_id: str
    phone_number: str
    is_new_user: bool = Field(
        description="True if the user was just created during this verification.",
    )


class MeResponse(BaseModel):
    """Response for GET /auth/me."""
    user_id: str
    phone_number: str
    is_active: bool


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _create_access_token(user_id: str, phone_number: str) -> str:
    """Create a signed JWT with user claims."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "phone": phone_number,
        "iat": now,
        "exp": now + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def _cleanup_expired_otps() -> None:
    """Remove expired entries from the in-memory store."""
    now = time.time()
    expired = [phone for phone, data in _otp_store.items() if data["expires_at"] < now]
    for phone in expired:
        del _otp_store[phone]


# ─── Endpoint 1: POST /auth/request-otp ──────────────────────────────────────


@router.post(
    "/request-otp",
    response_model=RequestOtpResponse,
    status_code=status.HTTP_200_OK,
    summary="Request a one-time password for phone login",
)
async def request_otp(payload: RequestOtpPayload):
    """
    Accept a phone number and generate a 6-digit OTP.

    **Development mode**: OTP is always `123456` and returned in the response.

    **Production**: Replace with an SMS gateway call (Twilio, AWS SNS, etc.)
    and remove the `dev_otp` field from the response.
    """
    _cleanup_expired_otps()

    phone = payload.phone_number

    # In dev mode, always use the hardcoded OTP
    otp_code = DEV_HARDCODED_OTP if DEV_HARDCODED_OTP else str(uuid.uuid4().int)[:6]

    # Store OTP with expiry
    _otp_store[phone] = {
        "otp": otp_code,
        "expires_at": time.time() + OTP_EXPIRY_SECONDS,
        "attempts": 0,
    }

    logger.info("OTP generated for %s (dev_mode=%s)", phone, bool(DEV_HARDCODED_OTP))

    return RequestOtpResponse(
        message="OTP sent successfully.",
        phone_number=phone,
        dev_otp=otp_code if DEV_HARDCODED_OTP else None,
    )


# ─── Endpoint 2: POST /auth/verify-otp ───────────────────────────────────────


@router.post(
    "/verify-otp",
    response_model=VerifyOtpResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify OTP and receive a JWT access token",
)
async def verify_otp(payload: VerifyOtpPayload, request: Request):
    """
    Verify the OTP sent to the given phone number.

    - If the user does **not** exist in the `users` table, create them (auto-register).
    - Return a signed JWT access token on success.

    **Rate Limiting**: allows 5 attempts per OTP before invalidating it.
    """
    phone = payload.phone_number

    # ── 1. Check OTP exists ───────────────────────────────────────────────
    otp_data = _otp_store.get(phone)

    if not otp_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No OTP was requested for this phone number. Call /auth/request-otp first.",
        )

    # ── 2. Check expiry ──────────────────────────────────────────────────
    if time.time() > otp_data["expires_at"]:
        del _otp_store[phone]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new one.",
        )

    # ── 3. Rate-limit check (max 5 attempts) ─────────────────────────────
    otp_data["attempts"] += 1
    if otp_data["attempts"] > 5:
        del _otp_store[phone]
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Please request a new OTP.",
        )

    # ── 4. Verify the code ────────────────────────────────────────────────
    if payload.otp != otp_data["otp"]:
        remaining = 5 - otp_data["attempts"]
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid OTP. {remaining} attempt(s) remaining.",
        )

    # OTP is valid — remove it (single-use)
    del _otp_store[phone]

    # ── 5. Find or create user in the database ────────────────────────────
    pool = request.app.state.pool
    is_new_user = False

    async with pool.acquire() as conn:
        # Check if user already exists
        row = await conn.fetchrow(
            """
            SELECT user_id, phone_number, is_active
            FROM users
            WHERE phone_number = $1
            """,
            phone,
        )

        if row is None:
            # Auto-register: create a new user
            new_user_id = str(uuid.uuid4())
            await conn.execute(
                """
                INSERT INTO users (user_id, phone_number, is_active)
                VALUES ($1, $2, TRUE)
                """,
                new_user_id,
                phone,
            )
            user_id = new_user_id
            is_new_user = True
            logger.info("New user created: %s (%s)", user_id, phone)
        else:
            user_id = str(row["user_id"])
            if not row["is_active"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="This account has been deactivated.",
                )
            logger.info("Existing user authenticated: %s (%s)", user_id, phone)

    # ── 6. Issue JWT ──────────────────────────────────────────────────────
    access_token = _create_access_token(user_id=user_id, phone_number=phone)

    return VerifyOtpResponse(
        access_token=access_token,
        user_id=user_id,
        phone_number=phone,
        is_new_user=is_new_user,
    )


# ─── Endpoint 3: GET /auth/me (Protected — for testing) ──────────────────────


@router.get(
    "/me",
    response_model=MeResponse,
    summary="Get current authenticated user info",
)
async def get_me(
    request: Request,
    user: dict = Depends(get_current_user),
):
    """
    Returns the profile of the currently authenticated user.
    Requires a valid JWT Bearer token.
    Useful for the frontend to verify the stored token is still valid.
    """
    pool = request.app.state.pool

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT user_id, phone_number, is_active
            FROM users
            WHERE user_id = $1::text::uuid
            """,
            user["user_id"],
        )

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    return MeResponse(
        user_id=str(row["user_id"]),
        phone_number=row["phone_number"],
        is_active=row["is_active"],
    )
