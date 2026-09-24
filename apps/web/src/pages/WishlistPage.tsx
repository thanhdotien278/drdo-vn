import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiRequestError } from '../api/client';
import { moveWishlistToCart, removeWishlistItem } from '../api/wishlist';
import { useCart } from '../cart/CartContext';
import { StateBlock } from '../components/StateBlock';
import { useWishlist } from '../wishlist/WishlistContext';
import type { WishlistItem } from '../types/engagement';
import { formatVnd } from '../utils/format';

/** Story 7.2 — wishlist browsing. Inactive/deleted products are filtered server-side. */
export function WishlistPage() {
  const { items, status, setItems, refresh } = useWishlist();
  const { setCart } = useCart();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(productId: string, action: () => Promise<void>) {
    setBusyId(productId);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : 'Thao tác thất bại');
    } finally {
      setBusyId(null);
    }
  }

  function handleMove(item: WishlistItem) {
    void run(item.product.id, async () => {
      const { data } = await moveWishlistToCart(item.product.id);
      setItems(data.wishlist);
      setCart(data.cart);
    });
  }

  function handleRemove(item: WishlistItem) {
    void run(item.product.id, async () => {
      const { data } = await removeWishlistItem(item.product.id);
      setItems(data);
    });
  }

  if (status === 'loading' && items === null) {
    return (
      <>
        <h1>Yêu thích</h1>
        <StateBlock title="Đang tải danh sách yêu thích…" />
      </>
    );
  }

  if (items === null) {
    return (
      <>
        <h1>Yêu thích</h1>
        <StateBlock
          title="Không tải được danh sách yêu thích"
          actionLabel="Thử lại"
          onAction={() => void refresh()}
        />
      </>
    );
  }

  return (
    <div>
      <div className="admin-page__header">
        <h1>Yêu thích</h1>
        <Link className="button button--outline" to="/products">
          Tiếp tục mua sắm
        </Link>
      </div>

      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <StateBlock
          title="Danh sách yêu thích trống"
          description="Lưu sản phẩm bạn quan tâm để mua sau."
          actionLabel={undefined}
        />
      ) : (
        <ul className="wishlist-items">
          {items.map((item) => {
            const { product } = item;
            const busy = busyId === product.id;
            return (
              <li key={item.id} className="wishlist-item">
                <Link className="wishlist-item__media" to={`/products/${product.slug}`}>
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.imageAlt || product.name} />
                  ) : (
                    <div className="product-card__media-placeholder" aria-hidden="true" />
                  )}
                </Link>
                <div className="wishlist-item__info">
                  <Link to={`/products/${product.slug}`} className="wishlist-item__name">
                    {product.name}
                  </Link>
                  <p className="product-card__price">
                    <span className="price price--current">{formatVnd(product.effectivePrice)}</span>
                    {product.effectivePrice < product.price ? (
                      <span className="price price--original">{formatVnd(product.price)}</span>
                    ) : null}
                  </p>
                  <p className={product.inStock ? 'stock stock--in' : 'stock stock--out'}>
                    {product.inStock ? `Còn hàng (${product.availableStock})` : 'Tạm hết hàng'}
                  </p>
                </div>
                <div className="wishlist-item__actions">
                  <button
                    type="button"
                    className="button button--primary"
                    disabled={busy || !product.inStock}
                    onClick={() => handleMove(item)}
                  >
                    {busy ? 'Đang chuyển…' : 'Thêm vào giỏ'}
                  </button>
                  <button
                    type="button"
                    className="link-button link-button--danger"
                    disabled={busy}
                    onClick={() => handleRemove(item)}
                  >
                    Xóa
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
