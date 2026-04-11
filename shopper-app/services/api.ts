/**
 * API Service — Smart Retail Self-Checkout
 * =========================================
 * Connects the React Native shopper app to the live FastAPI backend.
 *
 * Base URL should point to the local network IP where the backend is running.
 * Update BASE_URL if your backend IP changes.
 */

import { Product } from '@/store/cart-store';

// ─── Configuration ───────────────────────────────────────────────────────────

const BASE_URL = 'http://10.137.63.89:8000';

/** Timeout in milliseconds for API requests */
const REQUEST_TIMEOUT_MS = 8000;

// ─── Types (matching FastAPI response models) ────────────────────────────────

interface ProductApiResponse {
  product_id: number;
  name: string;
  price: number;
}

interface ApiErrorResponse {
  detail: string;
}

// ─── Custom Error ────────────────────────────────────────────────────────────

export class ApiError extends Error {
  statusCode: number;
  detail: string;

  constructor(statusCode: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Wraps fetch with a timeout using AbortController.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new ApiError(0, 'Request timed out. Check your network connection.');
    }
    throw new ApiError(0, 'Network error. Is the backend running?');
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── API Functions ───────────────────────────────────────────────────────────

/**
 * Fetch a product from the backend by its barcode string.
 *
 * - Returns a `Product` on success (200 OK).
 * - Throws `ApiError` with `statusCode: 404` if the product doesn't exist.
 * - Throws `ApiError` with `statusCode: 0` for network/timeout issues.
 *
 * @param barcode - The barcode string to look up.
 * @returns The product data mapped to the frontend's Product shape.
 */
export async function fetchProductByBarcode(barcode: string): Promise<Product> {
  const url = `${BASE_URL}/product/${encodeURIComponent(barcode)}`;

  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (response.ok) {
    const data: ProductApiResponse = await response.json();

    // Map backend response → frontend Product shape
    return {
      barcode: barcode,
      name: data.name,
      price: data.price,
      category: 'General', // Backend doesn't return category yet
    };
  }

  // Handle known error codes
  if (response.status === 404) {
    const errorBody: ApiErrorResponse = await response.json().catch(() => ({
      detail: 'Product not found in database',
    }));
    throw new ApiError(404, errorBody.detail);
  }

  // Unexpected server errors
  const errorText = await response.text().catch(() => 'Unknown server error');
  throw new ApiError(response.status, errorText);
}

/**
 * Quick health check against the backend.
 * Useful for verifying connectivity on app launch.
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/health`, {}, 5000);
    if (response.ok) {
      const data = await response.json();
      return data.status === 'healthy';
    }
    return false;
  } catch {
    return false;
  }
}
