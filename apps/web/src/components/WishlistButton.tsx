import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { addWishlistItem, removeWishlistItem } from '../api/wishlist';
import { useAuth } from '../auth/AuthContext';
import { useWishlist } from '../wishlist/WishlistContext';

/**
 * Story 7.1 — heart toggle shown on product cards and the detail page.
 * Only renders for signed-in customers; anonymous clicks go to login.
 */
export function WishlistButton({ productId }: { productId: string }) {
  const { user } = useAuth();
  const { has, setItems } = useWishlist();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  if (user && !user.roles.includes('customer')) {
    return null;
  }

  const saved = has(productId);

  function handleClick() {
    if (!user) {
      navigate(`/login?from=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setBusy(true);
    const action = saved ? removeWishlistItem : addWishlistItem;
    action(productId)
      .then(({ data }) => setItems(data))
      .catch(() => {})
      .finally(() => setBusy(false));
  }

  return (
    <button
      type="button"
      className={saved ? 'wishlist-toggle wishlist-toggle--saved' : 'wishlist-toggle'}
      disabled={busy}
      onClick={handleClick}
      aria-pressed={saved}
      aria-label={saved ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
      title={saved ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
    >
      <svg viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} aria-hidden="true">
        <path
          d="M12 20s-7-4.3-8.5-9C2.6 8 4.6 5 7.7 5c1.8 0 3.3 1 4.3 2.3C13 6 14.5 5 16.3 5c3.1 0 5.1 3 4.2 6-1.5 4.7-8.5 9-8.5 9Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
