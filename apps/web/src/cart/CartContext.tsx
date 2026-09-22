import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchCart } from '../api/cart';
import { useAuth } from '../auth/AuthContext';
import type { Cart } from '../types/commerce';

interface CartContextValue {
  cart: Cart | null;
  /** 'loading' while the first cart fetch for the signed-in customer runs. */
  status: 'loading' | 'ready';
  itemCount: number;
  /** Replaces local state with a cart returned by a mutation response. */
  setCart: (cart: Cart) => void;
  refresh: () => Promise<void>;
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

  useEffect(() => {
    if (authStatus === 'loading') return;
    if (!isCustomer) {
      setCartState(null);
      setStatus('ready');
      return;
    }
    setStatus('loading');
    void refresh().finally(() => setStatus('ready'));
  }, [authStatus, isCustomer, refresh]);

  const setCart = useCallback((next: Cart) => setCartState(next), []);

  const value = useMemo<CartContextValue>(
    () => ({ cart, status, itemCount: cart?.itemCount ?? 0, setCart, refresh }),
    [cart, status, setCart, refresh],
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
