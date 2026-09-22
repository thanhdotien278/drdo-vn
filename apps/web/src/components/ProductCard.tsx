import { Link } from 'react-router-dom';
import type { ProductListItem } from '../types/catalog';
import { formatRating, formatVnd } from '../utils/format';

export function ProductCard({ product }: { product: ProductListItem }) {
  const image = product.images.find((item) => item.isPrimary) ?? product.images[0];
  const lowStock = product.inStock && product.availableStock <= 5;

  return (
    <article className="product-card">
      <Link className="product-card__link" to={`/san-pham/${product.slug}`}>
        <div className="product-card__media">
          {image ? (
            <img src={image.url} alt={image.alt || product.name} loading="lazy" />
          ) : (
            <div className="product-card__media-placeholder" aria-hidden="true" />
          )}
          {product.discountPercent > 0 ? (
            <span className="badge badge--sale">-{product.discountPercent}%</span>
          ) : null}
          {!product.inStock ? <span className="badge badge--muted">Hết hàng</span> : null}
        </div>
        <div className="product-card__body">
          <p className="product-card__brand">{product.brand?.name ?? 'Không rõ thương hiệu'}</p>
          <h3 className="product-card__name">{product.name}</h3>
          <p className="product-card__meta">
            {product.volume ? <span>{product.volume}</span> : null}
            {product.ratingCount > 0 ? (
              <span className="product-card__rating">
                ★ {formatRating(product.ratingAverage)} ({product.ratingCount})
              </span>
            ) : null}
          </p>
          <p className="product-card__price">
            <span className="price price--current">{formatVnd(product.effectivePrice)}</span>
            {product.effectivePrice < product.price ? (
              <span className="price price--original">{formatVnd(product.price)}</span>
            ) : null}
          </p>
          {lowStock ? <p className="product-card__stock">Chỉ còn {product.availableStock} sản phẩm</p> : null}
        </div>
      </Link>
    </article>
  );
}

export function ProductGrid({ products }: { products: ProductListItem[] }) {
  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
