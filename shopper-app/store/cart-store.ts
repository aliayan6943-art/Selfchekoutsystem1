import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Product {
  barcode: string;
  name: string;
  price: number;
  category: string;
  image?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartState {
  // State
  items: CartItem[];
  lastScannedBarcode: string | null;

  // Actions
  addItem: (product: Product) => void;
  removeItem: (barcode: string) => void;
  updateQuantity: (barcode: string, quantity: number) => void;
  clearCart: () => void;
  setLastScanned: (barcode: string | null) => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      lastScannedBarcode: null,

      // Actions
      addItem: (product: Product) => {
        set((state) => {
          const existingIndex = state.items.findIndex(
            (item) => item.product.barcode === product.barcode
          );

          if (existingIndex >= 0) {
            // Item already exists — increment quantity
            const updatedItems = [...state.items];
            updatedItems[existingIndex] = {
              ...updatedItems[existingIndex],
              quantity: updatedItems[existingIndex].quantity + 1,
            };
            return { items: updatedItems, lastScannedBarcode: product.barcode };
          }

          // New item
          return {
            items: [...state.items, { product, quantity: 1 }],
            lastScannedBarcode: product.barcode,
          };
        });
      },

      removeItem: (barcode: string) => {
        set((state) => ({
          items: state.items.filter((item) => item.product.barcode !== barcode),
        }));
      },

      updateQuantity: (barcode: string, quantity: number) => {
        set((state) => {
          if (quantity <= 0) {
            return {
              items: state.items.filter(
                (item) => item.product.barcode !== barcode
              ),
            };
          }
          return {
            items: state.items.map((item) =>
              item.product.barcode === barcode ? { ...item, quantity } : item
            ),
          };
        });
      },

      clearCart: () => set({ items: [], lastScannedBarcode: null }),

      setLastScanned: (barcode) => set({ lastScannedBarcode: barcode }),
    }),
    {
      name: 'smart-checkout-cart', // AsyncStorage key
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist items, not transient UI state
      partialize: (state) => ({
        items: state.items,
      }),
    }
  )
);

// ─── Derived Selectors (reactive — these subscribe to `items`) ────────────

/** Total price of all items in the cart. Triggers re-render when items change. */
export const useCartTotal = () =>
  useCartStore((s) =>
    s.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  );

/** Total quantity of all items. Triggers re-render when items change. */
export const useCartItemCount = () =>
  useCartStore((s) =>
    s.items.reduce((count, item) => count + item.quantity, 0)
  );
