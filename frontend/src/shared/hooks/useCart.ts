import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  cartId: string; // unique key: itemId + JSON.stringify(customs)
  menuItemId: string;
  name: string;
  price: number;
  image: string | null;
  isVeg: boolean;
  quantity: number;
  customs: Record<string, boolean>; // e.g. { "Extra Cheese": true }
  notes: string;
}

interface CartState {
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, 'cartId'>) => void;
  removeFromCart: (cartId: string) => void;
  updateQuantity: (cartId: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      cart: [],

      addToCart: (newItem) => {
        const cartId = `${newItem.menuItemId}-${JSON.stringify(newItem.customs)}`;
        const existing = get().cart.find((x) => x.cartId === cartId);

        if (existing) {
          set({
            cart: get().cart.map((x) =>
              x.cartId === cartId ? { ...x, quantity: x.quantity + newItem.quantity } : x
            ),
          });
        } else {
          set({
            cart: [...get().cart, { ...newItem, cartId }],
          });
        }
      },

      removeFromCart: (cartId) => {
        set({
          cart: get().cart.filter((x) => x.cartId !== cartId),
        });
      },

      updateQuantity: (cartId, quantity) => {
        if (quantity <= 0) {
          get().removeFromCart(cartId);
          return;
        }
        set({
          cart: get().cart.map((x) => (x.cartId === cartId ? { ...x, quantity } : x)),
        });
      },

      clearCart: () => set({ cart: [] }),

      getCartTotal: () => {
        return get().cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      },
    }),
    {
      name: 'crunchos-customer-cart',
    }
  )
);
