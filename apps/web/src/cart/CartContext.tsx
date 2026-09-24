import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { addCartItem, fetchCart } from '../api/cart';
import { useAuth } from '../auth/AuthContext';
import type { Cart } from '../types/commerce';
import { guestCart, mergeGuestCart as mergeEntries } from './guestCart';

interface CartContextValue {
  cart: Cart | null;
  /** 'loading' while the first cart fetch for the signed-in customer runs. */
  status: 'loading' | 'ready';
  itemCount: number;
  /** Replaces local state with a cart returned by a mutation response. */
  setCart: (cart: Cart) => void;
  refresh: () => Promise<void>;
  /**
   * Replays the guest cart into the signed-in customer's persistent cart.
   * Safe to call multiple times — concurrent calls share one merge.
   */
  mergeGuestCart: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, status: authStatus } = useAuth();
  const isCustomer = Boolean(user?.roles.includes('customer'));

  const [cart, setCartState] = useState<Cart | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>('ready');

  const refresh = useCallback(async () => {
    try {
      const { data } = await fetchCart();
      setCartState(data);
    } catch {
      setCartState(null);
    }
  }, []);

  const mergeRef = useRef<Promise<void> | null>(null);
  const mergeGuestCart = useCallback((): Promise<void> => {
    mergeRef.current ??= mergeEntries(addCartItem)
      .then(() => refresh())
      .finally(() => {
        mergeRef.current = null;
      });
    return mergeRef.current;
  }, [refresh]);

  useEffect(() => {
    if (authStatus === 'loading') return;
    if (!isCustomer) {
      setCartState(guestCart());
      setStatus('ready');
      return;
    }
    setStatus('loading');
    void mergeGuestCart().finally(() => setStatus('ready'));
  }, [authStatus, isCustomer, mergeGuestCart]);

  const setCart = useCallback((next: Cart) => setCartState(next), []);

  const value = useMemo<CartContextValue>(
    () => ({ cart, status, itemCount: cart?.itemCount ?? 0, setCart, refresh, mergeGuestCart }),
    [cart, status, setCart, refresh, mergeGuestCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
