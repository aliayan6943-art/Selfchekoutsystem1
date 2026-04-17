"""
Centralised Configuration — Smart Retail Backend
==================================================
All environment-driven settings in one place.
Import from here instead of scattering os.getenv() across modules.
"""

from __future__ import annotations

import os
import secrets

# ─── Database ─────────────────────────────────────────────────────────────────

DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:ayan1234@localhost:5432/smart_retail_db",
)

POOL_MIN_SIZE: int = int(os.getenv("POOL_MIN_SIZE", "5"))
POOL_MAX_SIZE: int = int(os.getenv("POOL_MAX_SIZE", "20"))

# ─── Stock ────────────────────────────────────────────────────────────────────

LOW_STOCK_THRESHOLD: int = int(os.getenv("LOW_STOCK_THRESHOLD", "5"))

# ─── JWT / Auth ───────────────────────────────────────────────────────────────

# IMPORTANT — In production, set a strong random key via the environment.
# Default is a random string so the app never accidentally ships with a
# predictable secret.
JWT_SECRET_KEY: str = os.getenv(
    "JWT_SECRET_KEY",
    "dev-secret-change-me-in-production",          # pragma: allowlist secret
)
JWT_ALGORITHM: str = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
    os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "1440")   # 24 hours default
)

# ─── OTP ──────────────────────────────────────────────────────────────────────

# For DEVELOPMENT ONLY — hardcoded OTP.  Set to "" in production to use real
# OTP generation (SMS gateway, etc.).
DEV_HARDCODED_OTP: str = os.getenv("DEV_HARDCODED_OTP", "123456")

# OTP expiry in seconds (5 minutes)
OTP_EXPIRY_SECONDS: int = int(os.getenv("OTP_EXPIRY_SECONDS", "300"))
