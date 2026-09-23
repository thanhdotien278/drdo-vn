import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { fetchCategories, fetchFeaturedProducts } from '../api/catalog';
import { BannerStrip } from '../components/BannerStrip';
import { ProductGrid } from '../components/ProductCard';
import { LoadingGrid, StateBlock } from '../components/StateBlock';
import { useAsync } from '../hooks/useAsync';
import type { Category, FeaturedProducts } from '../types/catalog';
import { formatRating } from '../utils/format';

function LeafIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21c6-3.5 8-8.5 7.5-15.5C13 5.5 8 7.5 5.5 12.5c-1.6 3.3-.3 6.7 2.5 8 .9.4 2.7.6 4 .5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M12 21c0-6 2.5-10 7-14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3 5 5.8v5.3c0 4.6 3 7.8 7 9.4 4-1.6 7-4.8 7-9.4V5.8L12 3Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="m9.3 11.8 2 2 3.6-3.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3.5 12h17M12 3.5c-5.5 5.5-5.5 11.5 0 17 5.5-5.5 5.5-11.5 0-17Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RecycleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m8.5 5.5 2-3 2 3M7 9l-3 5h4m8.5-8.5 3 5h-4m-2 5.5-2 3-2-3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20s-7-4.3-8.5-9C2.6 8 4.6 5 7.7 5c1.8 0 3.3 1 4.3 2.3C13 6 14.5 5 16.3 5c3.1 0 5.1 3 4.2 6-1.5 4.7-8.5 9-8.5 9Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const INGREDIENTS = [
  {
    name: 'Trà xanh',
    description: 'Giàu chất chống oxy hóa, làm dịu và bảo vệ da.',
    image: '/images/ingredient-tea.webp',
  },
  {
    name: 'Lô hội',
    description: 'Cấp ẩm sâu, làm mát và phục hồi da.',
    image: '/images/ingredient-aloe.webp',
  },
  {
    name: 'Rau má',
    description: 'Làm dịu kích ứng, tăng cường tái tạo da.',
    image: '/images/ingredient-centella.webp',
  },
  {
    name: 'Tinh dầu thiên nhiên',
    description: 'Nuôi dưỡng da, mang lại cảm giác thư giãn tự nhiên.',
    image: '/images/ingredient-oil.webp',
  },
];

const TESTIMONIALS = [
  {
    quote:
      'Da mình nhạy cảm nhưng dùng DRDO thấy rất dịu nhẹ, không kích ứng. Cảm giác da khỏe và sáng hơn sau vài tuần!',
    name: 'Nguyễn Thảo My',
    rating: 5.0,
  },
  {
    quote:
      'Mình rất thích bảng thành phần tự nhiên và bao bì thân thiện môi trường. Vừa chăm sóc da vừa góp phần bảo vệ hành tinh, thật ý nghĩa!',
    name: 'Trần Phương Linh',
    rating: 4.9,
  },
  {
    quote:
      'Sản phẩm có mùi hương thiên nhiên dễ chịu, kết cấu mỏng nhẹ, thấm nhanh. DRDO thực sự là lựa chọn đáng tin cậy!',
    name: 'Lê Minh Anh',
    rating: 4.8,
  },
];

const COMMITMENTS = [
  { icon: <RecycleIcon />, title: 'Bao bì tái chế', text: 'Giảm thiểu rác thải nhựa' },
  { icon: <LeafIcon />, title: 'Không thử nghiệm', text: 'trên động vật' },
  { icon: <GlobeIcon />, title: 'Thành phần tự nhiên', text: 'có nguồn gốc rõ ràng' },
  { icon: <HeartIcon />, title: 'Vì cộng đồng', text: 'và môi trường xanh hơn' },
];

const MAX_STARS = 5;

function Stars({ value }: { value: number }) {
  const filled = Math.min(MAX_STARS, Math.max(0, Math.round(value)));
  return (
    <span className="stars" aria-label={`${formatRating(value)} trên 5 sao`}>
      <span aria-hidden="true">
        {'★'.repeat(filled)}
        {'☆'.repeat(MAX_STARS - filled)}
      </span>
    </span>
  );
}

export function HomePage() {
  const featured = useAsync<FeaturedProducts>(async () => (await fetchFeaturedProducts()).data, []);
  const categories = useAsync<Category[]>(async () => (await fetchCategories()).data, []);
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const target = document.querySelector(location.hash);
      target?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location.hash]);

  const heroProducts = (featured.data?.bestSellers ?? []).slice(0, 4);
  const newArrivals = (featured.data?.newArrivals ?? []).slice(0, 4);
  const topDiscount = Math.max(0, ...(featured.data?.onSale ?? []).map((p) => p.discountPercent));

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <div className="hero__content">
            <p className="eyebrow">Thiên nhiên cho làn da khỏe đẹp</p>
            <h1>Chăm sóc da dịu lành từ thiên nhiên</h1>
            <p className="hero__lead">
              DRDO mang đến giải pháp chăm sóc da an toàn, lành tính và thân thiện với môi trường. Vì một làn
              da khỏe mạnh và một hành tinh xanh hơn mỗi ngày.
            </p>
            <div className="hero__cta">
              <Link className="button button--primary button--lg" to="/products">
                Mua ngay
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <a className="button button--outline button--lg" href="#ingredients">
                Khám phá
                <LeafIcon />
              </a>
            </div>
            <ul className="hero__trust">
              <li>
                <span className="trust-icon">
                  <LeafIcon />
                </span>
                Thành phần
                <br />
                tự nhiên
              </li>
              <li>
                <span className="trust-icon">
                  <ShieldIcon />
                </span>
                An toàn
                <br />
                cho mọi loại da
              </li>
              <li>
                <span className="trust-icon">
                  <GlobeIcon />
                </span>
                Thân thiện
                <br />
                với môi trường
              </li>
            </ul>
          </div>
          <div className="hero__media">
            <img
              src="/images/hero.webp"
              alt="Bộ sản phẩm chăm sóc da DRDO với toner trà xanh, serum và kem dưỡng đặt trên đá tự nhiên cùng lá xanh"
              loading="eager"
            />
          </div>
        </div>
      </section>

      <BannerStrip />

      <section className="section section--ivory" id="featured">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Sản phẩm nổi bật</p>
              <h2>Lựa chọn yêu thích từ DRDO</h2>
            </div>
            <Link className="section-heading__link" to="/products">
              Xem tất cả
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
          {featured.status === 'loading' ? <LoadingGrid count={4} /> : null}
          {featured.status === 'error' ? (
            <StateBlock
              title="Không tải được sản phẩm"
              description={featured.error?.message}
              actionLabel="Thử lại"
              onAction={featured.reload}
            />
          ) : null}
          {featured.status === 'success' && heroProducts.length === 0 ? (
            <StateBlock
              title="Chưa có sản phẩm nào"
              description="Vui lòng quay lại sau khi cửa hàng cập nhật hàng mới."
            />
          ) : null}
          {heroProducts.length > 0 ? <ProductGrid products={heroProducts} /> : null}
        </div>
      </section>

      <section className="section section--cream" id="categories">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Danh mục sản phẩm</p>
              <h2>Mua sắm theo nhu cầu của làn da</h2>
            </div>
            <Link className="section-heading__link" to="/products">
              Xem tất cả
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
          {categories.status === 'loading' ? (
            <div className="category-grid" aria-busy="true" aria-live="polite">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="category-card category-card--skeleton">
                  <div className="skeleton skeleton--line" />
                  <div className="skeleton skeleton--line skeleton--short" />
                </div>
              ))}
            </div>
          ) : null}
          {categories.status === 'error' ? (
            <StateBlock
              title="Không tải được danh mục"
              description={categories.error?.message}
              actionLabel="Thử lại"
              onAction={categories.reload}
            />
          ) : null}
          {categories.status === 'success' && (categories.data?.length ?? 0) === 0 ? (
            <StateBlock
              title="Chưa có danh mục nào"
              description="Danh mục sẽ hiển thị khi được cập nhật vào cửa hàng."
            />
          ) : null}
          {categories.status === 'success' && (categories.data?.length ?? 0) > 0 ? (
            <div className="category-grid">
              {(categories.data ?? []).map((category) => (
                <Link
                  key={category.id}
                  className="category-card"
                  to={`/products?category=${category.slug}`}
                >
                  <h3>
                    {category.name}
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </h3>
                  {category.description ? <p>{category.description}</p> : null}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="section section--sage" id="ingredients">
        <div className="container ingredients">
          <div className="ingredients__intro">
            <p className="eyebrow">Tinh hoa thiên nhiên</p>
            <h2>Thành phần lành tính, tốt cho làn da và hành tinh</h2>
          </div>
          <ul className="ingredients__list">
            {INGREDIENTS.map((item) => (
              <li key={item.name} className="ingredient">
                <span className="ingredient__image">
                  <img src={item.image} alt="" loading="lazy" />
                </span>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
              </li>
            ))}
          </ul>
          <blockquote className="ingredients__quote">
            <p>“Làn da khỏe đẹp bắt đầu từ những điều tự nhiên nhất”</p>
            <LeafIcon />
          </blockquote>
        </div>
      </section>

      <section className="section section--ivory promo">
        <div className="container promo__inner">
          <div className="promo__banner">
            <div className="promo__content">
              <p className="eyebrow">Bộ sưu tập bán chạy</p>
              <h2>
                Dịu lành hôm nay
                <br />
                Cho làn da tươi sáng ngày mai
              </h2>
              <p>
                Khám phá bộ sản phẩm được yêu thích nhất từ DRDO với thành phần thiên nhiên và hiệu quả vượt
                trội.
              </p>
              <Link className="button button--primary" to="/products?sort=popular">
                Khám phá ngay
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
            <div className="promo__media">
              <img
                src="/images/promo.webp"
                alt="Bộ sản phẩm DRDO bán chạy đặt trên đá với lá xanh tươi"
                loading="lazy"
              />
              {topDiscount > 0 ? (
                <span className="promo__badge">
                  Ưu đãi
                  <strong>-{topDiscount}%</strong>
                  Cho set đầy đủ
                </span>
              ) : null}
            </div>
          </div>
          <aside className="promo__panel">
            <img src="/images/nature-panel.webp" alt="Lá xanh với giọt sương" loading="lazy" />
            <blockquote>
              <p>
                “Vẻ đẹp thật sự là sự hài hòa giữa con người và thiên nhiên.”
              </p>
              <cite>— DRDO</cite>
            </blockquote>
          </aside>
        </div>
      </section>

      {newArrivals.length > 0 ? (
        <section className="section section--sage">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Hàng mới về</p>
                <h2>Vừa cập bến DRDO</h2>
              </div>
              <Link className="section-heading__link" to="/products?sort=newest">
                Xem tất cả
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
            <ProductGrid products={newArrivals} />
          </div>
        </section>
      ) : null}

      <section className="section section--cream testimonials">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Khách hàng nói gì về DRDO?</p>
              <h2>Những làn da hạnh phúc</h2>
              <p className="section-heading__note">Nội dung minh họa</p>
            </div>
          </div>
          <ul className="testimonials__list">
            {TESTIMONIALS.map((item) => (
              <li key={item.name} className="testimonial">
                <p className="testimonial__quote">“{item.quote}”</p>
                <div className="testimonial__author">
                  <span className="testimonial__avatar" aria-hidden="true">
                    {item.name
                      .split(' ')
                      .map((part) => part[0])
                      .slice(-2)
                      .join('')}
                  </span>
                  <div>
                    <p className="testimonial__name">{item.name}</p>
                    <p className="testimonial__rating">
                      <Stars value={item.rating} /> {formatRating(item.rating)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section section--ivory commitment" id="commitment">
        <div className="container commitment__inner">
          <div className="commitment__media">
            <img src="/images/commitment-left.webp" alt="Đôi tay nâng một mầm cây xanh" loading="lazy" />
            <p className="commitment__media-caption">
              Vì một
              <br />
              hành tinh xanh hơn
            </p>
          </div>
          <div className="commitment__content">
            <p className="eyebrow">Cam kết từ DRDO</p>
            <h2>
              Làm đẹp bền vững
              <br />
              cho thế hệ mai sau
            </h2>
            <p>
              Chúng tôi tin rằng vẻ đẹp thật sự đến từ sự hài hòa với thiên nhiên. DRDO cam kết sử dụng bao
              bì thân thiện môi trường, thành phần an toàn và quy trình sản xuất bền vững.
            </p>
            <ul className="commitment__items">
              {COMMITMENTS.map((item) => (
                <li key={item.title}>
                  <span className="trust-icon">{item.icon}</span>
                  <p>
                    <strong>{item.title}</strong>
                    <br />
                    {item.text}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div className="commitment__media">
            <img src="/images/commitment-right.webp" alt="Rừng xanh trong sương sớm" loading="lazy" />
            <p className="commitment__media-caption">
              Cùng nhau
              <br />
              vì những điều tốt đẹp hơn
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
