import { useState } from 'react';
import { Link } from 'react-router-dom';
import { removeCartItem, updateCartItem } from '../api/cart';
import { ApiRequestError } from '../api/client';
import { StateBlock } from '../components/StateBlock';
import { useCart } from '../cart/CartContext';
import type { CartItem } from '../types/commerce';
import { formatVnd } from '../utils/format';

function itemUnavailable(item: CartItem): string | null {
  if (!item.product || !item.product.purchasable) {
    return 'Sản phẩm không còn kinh doanh.';
  }
  if (!item.product.inStock) {
    return 'Sản phẩm tạm hết hàng.';
  }
  if (item.qty > item.product.availableStock) {
    return `Chỉ còn ${item.product.availableStock} sản phẩm trong kho.`;
  }
  return null;
}

function CartItemRow({
  item,
  pending,
  onUpdate,
  onRemove,
}: {
  item: CartItem;
  pending: boolean;
  onUpdate: (itemId: string, qty: number) => void;
  onRemove: (itemId: string) => void;
}) {
  const warning = itemUnavailable(item);
  const maxQty = item.product ? Math.max(1, item.product.availableStock) : 1;

  return (
    <article className={warning ? 'cart-item cart-item--warning' : 'cart-item'}>
      <Link className="cart-item__media" to={item.product ? `/products/${item.product.slug}` : '/cart'}>
        {item.product?.imageUrl ? (
          <img src={item.product.imageUrl} alt={item.product.imageAlt} />
        ) : (
          <div className="product-card__media-placeholder" aria-hidden="true" />
        )}
      </Link>

      <div className="cart-item__info">
        <h3>
          <Link to={item.product ? `/products/${item.product.slug}` : '/cart'}>
            {item.product?.name ?? 'Sản phẩm không còn tồn tại'}
          </Link>
        </h3>
        {item.product ? <p className="muted">SKU: {item.product.sku}</p> : null}
        <p className="price price--current">{formatVnd(item.unitPrice)}</p>
        {warning ? (
          <p className="error-text" role="alert">
            {warning}
          </p>
        ) : null}
      </div>

      <div className="qty-stepper" aria-label="Số lượng">
        <button
          type="button"
          disabled={pending || item.qty <= 1}
          onClick={() => onUpdate(item.id, item.qty - 1)}
          aria-label="Giảm số lượng"
        >
          −
        </button>
        <input
          type="number"
          min={1}
          max={maxQty}
          value={item.qty}
          disabled={pending}
          onChange={(event) => {
            const qty = Math.floor(Number(event.target.value));
            if (Number.isFinite(qty) && qty >= 1 && qty !== item.qty) {
              onUpdate(item.id, qty);
            }
          }}
          aria-label="Số lượng sản phẩm"
        />
        <button
          type="button"
          disabled={pending || item.qty >= maxQty}
          onClick={() => onUpdate(item.id, item.qty + 1)}
          aria-label="Tăng số lượng"
        >
          +
        </button>
      </div>

      <p className="cart-item__total price price--current">{formatVnd(item.lineTotal)}</p>

      <button
        type="button"
        className="link-button cart-item__remove"
        disabled={pending}
        onClick={() => onRemove(item.id)}
      >
        Xoá
      </button>
    </article>
  );
}

export function CartPage() {
  const { cart, status, setCart, refresh } = useCart();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpdate(itemId: string, qty: number) {
    setError(null);
    setPendingId(itemId);
    try {
      const { data } = await updateCartItem(itemId, qty);
      setCart(data);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Không cập nhật được giỏ hàng.');
      await refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function handleRemove(itemId: string) {
    setError(null);
    setPendingId(itemId);
    try {
      const { data } = await removeCartItem(itemId);
      setCart(data);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Không xoá được sản phẩm.');
      await refresh();
    } finally {
      setPendingId(null);
    }
  }

  if (status === 'loading') {
    return (
      <div className="page">
        <StateBlock title="Đang tải giỏ hàng…" />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="page">
        <StateBlock
          title="Giỏ hàng đang trống"
          description="Khám phá các sản phẩm chăm sóc da và thêm vào giỏ nhé."
        />
        <p className="cart-empty__cta">
          <Link className="button button--primary" to="/products">
            Tiếp tục mua sắm
          </Link>
        </p>
      </div>
    );
  }

  const hasUnavailable = cart.items.some((item) => itemUnavailable(item) !== null);

  return (
    <div className="page cart-page">
      <h1>Giỏ hàng</h1>
      <p className="muted">{cart.itemCount} sản phẩm</p>

      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}

      <div className="cart-layout">
        <section className="cart-items" aria-label="Sản phẩm trong giỏ">
          {cart.items.map((item) => (
            <CartItemRow
              key={item.id}
              item={item}
              pending={pendingId === item.id}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
            />
          ))}
        </section>

        <aside className="cart-summary">
          <h2>Tạm tính</h2>
          <dl className="summary-rows">
            <div className="summary-row">
              <dt>Tạm tính</dt>
              <dd>{formatVnd(cart.subtotal)}</dd>
            </div>
            <div className="summary-row">
              <dt>Phí vận chuyển</dt>
              <dd>Tính ở bước thanh toán</dd>
            </div>
          </dl>
          {hasUnavailable ? (
            <p className="error-text">Vui lòng cập nhật các sản phẩm không khả dụng trước khi đặt hàng.</p>
          ) : null}
          <Link
            className="button button--primary button--lg button--full"
            to="/checkout"
            aria-disabled={hasUnavailable}
          >
            Tiến hành thanh toán
          </Link>
          <Link className="cart-summary__continue" to="/products">
            Tiếp tục mua sắm
          </Link>
        </aside>
      </div>
    </div>
  );
}
