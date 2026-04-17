"""
Smart Retail Self-Checkout System — FastAPI Backend
====================================================
Async backend serving the Shopper App (React Native) and Guard Dashboard (React.js).

Endpoints:
  GET  /product/{barcode}    — Fetch product by barcode string
  POST /cart/sync            — Verify latest prices & stock for offline cart items
  POST /auth/request-otp     — Request a one-time password for phone login
  POST /auth/verify-otp      — Verify OTP, auto-register user, return JWT
  GET  /auth/me              — Protected: return current user info
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import asyncpg
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import (
    DATABASE_URL,
    LOW_STOCK_THRESHOLD,
    POOL_MAX_SIZE,
    POOL_MIN_SIZE,
)
from auth import router as auth_router

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-7s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("retail-backend")

# ─── Pydantic Models ─────────────────────────────────────────────────────────


class ProductResponse(BaseModel):
    """Returned by GET /product/{barcode}."""
    product_id: int
    name: str
    price: float


class CartSyncRequest(BaseModel):
    """Payload for POST /cart/sync."""
    product_ids: list[int] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="List of product IDs currently in the offline cart.",
    )


class CartSyncItem(BaseModel):
    """Single item in the cart/sync response."""
    product_id: int
    name: str
    current_price: float
    in_stock: bool
    stock_quantity: int
    stock_warning: bool = Field(
        description="True when stock_quantity ≤ LOW_STOCK_THRESHOLD."
    )
    price_changed: bool = Field(
        default=False,
        description="Reserved — will be True when price differs from scan-time price.",
    )


class CartSyncResponse(BaseModel):
    """Returned by POST /cart/sync."""
    items: list[CartSyncItem]
    total_verified_price: float
    warnings_count: int = Field(
        description="Number of items with stock_warning=True."
    )


# ─── Application Lifespan (DB Pool) ──────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Create the asyncpg connection pool on startup and release it on shutdown.
    The pool is stored on `app.state.pool` so route handlers can access it via
    `request.app.state.pool`.
    """
    logger.info("Connecting to PostgreSQL …")

    try:
        pool: asyncpg.Pool = await asyncpg.create_pool(
            dsn=DATABASE_URL,
            min_size=POOL_MIN_SIZE,
            max_size=POOL_MAX_SIZE,
            command_timeout=10,
        )
        app.state.pool = pool
        logger.info(
            "Connection pool ready  (min=%d, max=%d)",
            POOL_MIN_SIZE,
            POOL_MAX_SIZE,
        )
    except Exception as exc:
        logger.error("Failed to connect to PostgreSQL: %s", exc)
        raise

    yield  # ← application runs here

    logger.info("Closing connection pool …")
    await pool.close()
    logger.info("Pool closed.")


# ─── FastAPI App ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="Smart Retail Self-Checkout API",
    version="0.2.0",
    description="Backend for the Shopper App and Guard Dashboard.",
    lifespan=lifespan,
)

# CORS — allow the React Native app and Guard Dashboard on any local origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Mount Routers ────────────────────────────────────────────────────────────

app.include_router(auth_router)


# ─── Helper ───────────────────────────────────────────────────────────────────


def _get_pool(request: Request) -> asyncpg.Pool:
    """Retrieve the connection pool from app state."""
    return request.app.state.pool


# ─── Endpoint 1: GET /product/{barcode} ──────────────────────────────────────


@app.get(
    "/product/{barcode}",
    response_model=ProductResponse,
    summary="Fetch a product by its barcode string",
    tags=["Products"],
)
async def get_product_by_barcode(barcode: str, request: Request):
    """
    Look up a product in the **Products** table using its `barcode_string`.

    - Returns the `product_id`, `name`, and `price` on success.
    - Raises **404** if no matching barcode is found.
    """
    pool = _get_pool(request)

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT product_id, name, price
            FROM products
            WHERE barcode_string = $1
            """,
            barcode,
        )

    if row is None:
        raise HTTPException(
            status_code=404,
            detail=f"No product found for barcode '{barcode}'.",
        )

    return ProductResponse(
        product_id=row["product_id"],
        name=row["name"],
        price=float(row["price"]),
    )


# ─── Endpoint 2: POST /cart/sync ─────────────────────────────────────────────


@app.post(
    "/cart/sync",
    response_model=CartSyncResponse,
    summary="Sync offline cart — verify prices & stock",
    tags=["Cart"],
)
async def sync_cart(payload: CartSyncRequest, request: Request):
    """
    Accepts a list of `product_ids` from the React Native offline cart.

    For each product:
    - Fetches the **current database price** (may differ from scan-time price).
    - Checks **stock availability** and flags items at or below the low-stock
      threshold.
    - Items not found in the database are silently omitted (they may have been
      delisted).

    Returns the verified item list, a recalculated total, and a count of
    stock warnings.
    """
    pool = _get_pool(request)

    async with pool.acquire() as conn:
        # Use ANY($1::int[]) to batch-query all product IDs in a single round trip
        rows = await conn.fetch(
            """
            SELECT product_id, name, price, stock_quantity
            FROM products
            WHERE product_id = ANY($1::int[])
            """,
            payload.product_ids,
        )

    # Build response items
    items: list[CartSyncItem] = []
    for row in rows:
        stock_qty = row["stock_quantity"]
        items.append(
            CartSyncItem(
                product_id=row["product_id"],
                name=row["name"],
                current_price=float(row["price"]),
                in_stock=stock_qty > 0,
                stock_quantity=stock_qty,
                stock_warning=stock_qty <= LOW_STOCK_THRESHOLD,
            )
        )

    total = sum(item.current_price for item in items)
    warnings = sum(1 for item in items if item.stock_warning)

    return CartSyncResponse(
        items=items,
        total_verified_price=round(total, 2),
        warnings_count=warnings,
    )


# ─── Health Check ─────────────────────────────────────────────────────────────


@app.get("/health", tags=["System"], summary="Health check")
async def health_check(request: Request):
    """Verify the API is up and the database is reachable."""
    pool = _get_pool(request)
    try:
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "healthy", "database": "connected"}
    except Exception as exc:
        logger.error("Health check failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail=f"Database unreachable: {exc}",
        )
