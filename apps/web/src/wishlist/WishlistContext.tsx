import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchWishlist } from '../api/wishlist';
import { useAuth } from '../auth/AuthContext';
import type { WishlistItem } from '../types/engagement';

interface WishlistContextValue {
  /** null until the first fetch for the signed-in customer resolves. */
  items: WishlistItem[] | null;
  status: 'loading' | 'ready';
  count: number;
  has: (productId: string) => boolean;
  /** Replaces local state with a wishlist returned by a mutation response. */
  setItems: (items: WishlistItem[]) => void;
  refresh: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user, status: authStatus } = useAuth();
  const isCustomer = Boolean(user?.roles.includes('customer'));

  const [items, setItemsState] = useState<WishlistItem[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>('ready');

  const refresh = useCallback(async () => {
    try {
      const { data } = await fetchWishlist();
      setItemsState(data);
    } catch {
      setItemsState(null);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'loading') return;
    if (!isCustomer) {
      setItemsState(null);
      setStatus('ready');
      return;
    }
    setStatus('loading');
    void refresh().finally(() => setStatus('ready'));
  }, [authStatus, isCustomer, refresh]);

  const setItems = useCallback((next: WishlistItem[]) => setItemsState(next), []);

  const value = useMemo<WishlistContextValue>(
    () => ({
      items,
      status,
      count: items?.length ?? 0,
      has: (productId) => (items ?? []).some((item) => item.product.id === productId),
      setItems,
      refresh,
    }),
    [items, status, setItems, refresh],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within WishlistProvider');
  }
  return context;
}
