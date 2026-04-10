import { Product } from '@/store/cart-store';

/**
 * Mock product catalog for development.
 * In production, these would come from the /fetch-product API endpoint.
 */
export const MOCK_PRODUCTS: Record<string, Product> = {
  '8901030865732': {
    barcode: '8901030865732',
    name: 'Organic Whole Milk',
    price: 4.99,
    category: 'Dairy',
  },
  '5000159484695': {
    barcode: '5000159484695',
    name: 'Premium Dark Chocolate',
    price: 3.49,
    category: 'Snacks',
  },
  '0012000001086': {
    barcode: '0012000001086',
    name: 'Sparkling Water (12pk)',
    price: 6.99,
    category: 'Beverages',
  },
  '0028400047685': {
    barcode: '0028400047685',
    name: 'Artisan Sourdough Bread',
    price: 5.29,
    category: 'Bakery',
  },
  '0041196910131': {
    barcode: '0041196910131',
    name: 'Free-Range Eggs (Dz)',
    price: 7.49,
    category: 'Dairy',
  },
  '8906002410279': {
    barcode: '8906002410279',
    name: 'Jasmine Rice (2lb)',
    price: 8.99,
    category: 'Grains',
  },
  '4011200296908': {
    barcode: '4011200296908',
    name: 'Extra Virgin Olive Oil',
    price: 12.99,
    category: 'Oils',
  },
  '7622210449283': {
    barcode: '7622210449283',
    name: 'Ground Coffee (340g)',
    price: 9.49,
    category: 'Beverages',
  },
};

/**
 * Simulates the /fetch-product API call.
 * Returns the product if found, null otherwise.
 * Includes a fake network delay.
 */
export async function fetchProductByBarcode(
  barcode: string
): Promise<Product | null> {
  // Simulate network delay (200-600ms)
  await new Promise((resolve) =>
    setTimeout(resolve, 200 + Math.random() * 400)
  );

  return MOCK_PRODUCTS[barcode] ?? null;
}
