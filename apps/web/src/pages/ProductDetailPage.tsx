import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchProductBySlug, fetchRelatedProducts } from '../api/catalog';
import { addCartItem } from '../api/cart';
import { ApiRequestError } from '../api/client';
import { useCart } from '../cart/CartContext';
import { ProductGrid } from '../components/ProductCard';
import { ProductReviews } from '../components/ProductReviews';
import { StateBlock } from '../components/StateBlock';
import { WishlistButton } from '../components/WishlistButton';
import { useAsync } from '../hooks/useAsync';
import type { ProductDetail, ProductListItem } from '../types/catalog';
import { formatRating, formatVnd } from '../utils/format';

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="detail-block">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function ProductDetailPage() {
  const { slug = '' } = useParams();
  const { setCart } = useCart();
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [cartMessage, setCartMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const product = useAsync<ProductDetail>(async () => (await fetchProductBySlug(slug)).data, [slug]);
  const related = useAsync<ProductListItem[]>(async () => (await fetchRelatedProducts(slug)).data, [slug]);

  if (product.status === 'loading') {
    return <p className="muted">Đang tải sản phẩm…</p>;
  }

  if (product.status === 'error') {
    const notFound = product.error instanceof ApiRequestError && product.error.status === 404;
    return (
      <StateBlock
        title={notFound ? 'Không tìm thấy sản phẩm' : 'Không tải được sản phẩm'}
        description={
          notFound
            ? 'Sản phẩm có thể đã ngừng kinh doanh hoặc đường dẫn không đúng.'
            : product.error?.message
        }
        actionLabel={notFound ? undefined : 'Thử lại'}
        onAction={notFound ? undefined : product.reload}
      />
    );
  }

  const data = product.data;
  if (!data) {
    return null;
  }

  const image = data.images[activeImage] ?? data.images[0];

  return (
    <article className="product-detail">
      <nav className="breadcrumb" aria-label="Đường dẫn">
        <Link to="/">Trang chủ</Link>
        <span aria-hidden="true">/</span>
        <Link to="/products">Sản phẩm</Link>
        {data.category ? (
          <>
            <span aria-hidden="true">/</span>
            <Link to={`/products?category=${data.category.slug}`}>{data.category.name}</Link>
          </>
        ) : null}
      </nav>

      <div className="product-detail__top">
        <div className="gallery">
          <div className="gallery__main">
            {image ? <img src={image.url} alt={image.alt || data.name} /> : null}
          </div>
          {data.images.length > 1 ? (
            <div className="gallery__thumbs">
              {data.images.map((item, index) => (
                <button
                  key={item.url}
                  type="button"
                  className={index === activeImage ? 'gallery__thumb gallery__thumb--active' : 'gallery__thumb'}
                  onClick={() => setActiveImage(index)}
                  aria-label={`Xem ảnh ${index + 1} của ${data.name}`}
                >
                  <img src={item.url} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="product-summary">
          <p className="product-summary__brand">{data.brand?.name}</p>
          <h1>{data.name}</h1>
          <p className="product-summary__meta">
            <span>SKU: {data.sku}</span>
            {data.volume ? <span>Dung tích: {data.volume}</span> : null}
            {data.ratingCount > 0 ? (
              <span>
                ★ {formatRating(data.ratingAverage)} · {data.ratingCount} đánh giá
              </span>
            ) : null}
          </p>

          <p className="product-summary__price">
            <span className="price price--current price--lg">{formatVnd(data.effectivePrice)}</span>
            {data.effectivePrice < data.price ? (
              <>
                <span className="price price--original">{formatVnd(data.price)}</span>
                <span className="badge badge--sale">-{data.discountPercent}%</span>
              </>
            ) : null}
          </p>

          <p className={data.inStock ? 'stock stock--in' : 'stock stock--out'}>
            {data.inStock ? `Còn hàng (${data.availableStock} sản phẩm)` : 'Tạm hết hàng'}
          </p>

          {data.shortDescription ? <p className="product-summary__lead">{data.shortDescription}</p> : null}

          {data.skinTypes.length > 0 ? (
            <ul className="chip-list" aria-label="Loại da phù hợp">
              {data.skinTypes.map((type) => (
                <li key={type} className="chip">
                  {type}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="product-summary__buy">
            <div className="qty-stepper" aria-label="Số lượng">
              <button
                type="button"
                disabled={qty <= 1}
                onClick={() => setQty((value) => Math.max(1, value - 1))}
                aria-label="Giảm số lượng"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={Math.max(1, data.availableStock)}
                value={qty}
                onChange={(event) => {
                  const next = Math.floor(Number(event.target.value));
                  if (Number.isFinite(next) && next >= 1) {
                    setQty(next);
                  }
                }}
                aria-label="Số lượng sản phẩm"
              />
              <button
                type="button"
                disabled={qty >= data.availableStock}
                onClick={() => setQty((value) => value + 1)}
                aria-label="Tăng số lượng"
              >
                +
              </button>
            </div>
            <button
              type="button"
              className="button button--primary button--lg"
              disabled={!data.inStock || adding}
              onClick={() => {
                setCartMessage(null);
                setAdding(true);
                addCartItem(data, qty)
                  .then(({ data: cart }) => {
                    setCart(cart);
                    setCartMessage({ kind: 'ok', text: 'Đã thêm vào giỏ hàng.' });
                  })
                  .catch((err: unknown) => {
                    setCartMessage({
                      kind: 'error',
                      text:
                        err instanceof ApiRequestError
                          ? err.message
                          : 'Không thêm được vào giỏ hàng.',
                    });
                  })
                  .finally(() => setAdding(false));
              }}
            >
              {!data.inStock ? 'Hết hàng' : adding ? 'Đang thêm…' : 'Thêm vào giỏ hàng'}
            </button>
            <WishlistButton productId={data.id} />
          </div>
          {cartMessage ? (
            <p className={cartMessage.kind === 'error' ? 'error-text' : 'muted'} role="status">
              {cartMessage.text}{' '}
              {cartMessage.kind === 'ok' ? <Link to="/cart">Xem giỏ hàng →</Link> : null}
            </p>
          ) : null}
        </div>
      </div>

      {data.benefits.length > 0 ? (
        <DetailBlock title="Công dụng chính">
          <ul className="bullet-list">
            {data.benefits.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
        </DetailBlock>
      ) : null}

      {data.description ? (
        <DetailBlock title="Mô tả sản phẩm">
          <p>{data.description}</p>
        </DetailBlock>
      ) : null}

      {data.ingredients ? (
        <DetailBlock title="Thành phần">
          <p>{data.ingredients}</p>
        </DetailBlock>
      ) : null}

      {data.usageInstructions ? (
        <DetailBlock title="Hướng dẫn sử dụng">
          <p>{data.usageInstructions}</p>
        </DetailBlock>
      ) : null}

      <ProductReviews productId={data.id} />

      {related.data && related.data.length > 0 ? (
        <DetailBlock title="Sản phẩm liên quan">
          <ProductGrid products={related.data} />
        </DetailBlock>
      ) : null}
    </article>
  );
}
