import { Link } from 'react-router-dom';
import { fetchCategories, fetchFeaturedProducts } from '../api/catalog';
import { ProductGrid } from '../components/ProductCard';
import { LoadingGrid, StateBlock } from '../components/StateBlock';
import { useAsync } from '../hooks/useAsync';
import type { Category, FeaturedProducts, ProductListItem } from '../types/catalog';

function Section({
  title,
  description,
  products,
}: {
  title: string;
  description: string;
  products: ProductListItem[];
}) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="home-section">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <Link className="button button--outline" to="/san-pham">
          Xem tất cả
        </Link>
      </div>
      <ProductGrid products={products.slice(0, 4)} />
    </section>
  );
}

export function HomePage() {
  const featured = useAsync<FeaturedProducts>(async () => (await fetchFeaturedProducts()).data, []);
  const categories = useAsync<Category[]>(async () => (await fetchCategories()).data, []);

  return (
    <>
      <section className="hero">
        <div className="hero__content">
          <p className="hero__eyebrow">Chăm sóc da khoa học</p>
          <h1>Làn da khỏe bắt đầu từ sản phẩm phù hợp</h1>
          <p className="hero__lead">
            DrDo.vn tuyển chọn sữa rửa mặt, toner, serum, kem dưỡng và chống nắng chính hãng cho từng loại da
            Việt Nam.
          </p>
          <Link className="button button--primary button--lg" to="/san-pham">
            Khám phá sản phẩm
          </Link>
        </div>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <div>
            <h2>Danh mục nổi bật</h2>
            <p>Chọn theo từng bước trong chu trình dưỡng da.</p>
          </div>
        </div>
        {categories.status === 'loading' ? <p className="muted">Đang tải danh mục…</p> : null}
        {categories.status === 'error' ? (
          <StateBlock
            title="Không tải được danh mục"
            description={categories.error?.message}
            actionLabel="Thử lại"
            onAction={categories.reload}
          />
        ) : null}
        {categories.status === 'success' && (categories.data?.length ?? 0) === 0 ? (
          <StateBlock title="Chưa có danh mục nào" description="Danh mục sẽ hiển thị khi được thêm vào hệ thống." />
        ) : null}
        <div className="category-grid">
          {(categories.data ?? []).map((category) => (
            <Link key={category.id} className="category-card" to={`/san-pham?category=${category.slug}`}>
              <h3>{category.name}</h3>
              <p>{category.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {featured.status === 'loading' ? <LoadingGrid count={4} /> : null}
      {featured.status === 'error' ? (
        <StateBlock
          title="Không tải được sản phẩm"
          description={featured.error?.message}
          actionLabel="Thử lại"
          onAction={featured.reload}
        />
      ) : null}
      {featured.status === 'success' &&
      (featured.data?.bestSellers.length ?? 0) === 0 &&
      (featured.data?.newArrivals.length ?? 0) === 0 ? (
        <StateBlock title="Chưa có sản phẩm nào" description="Vui lòng quay lại sau khi cửa hàng cập nhật hàng mới." />
      ) : null}

      {featured.data ? (
        <>
          <Section
            title="Bán chạy nhất"
            description="Được khách hàng DrDo mua nhiều nhất."
            products={featured.data.bestSellers}
          />
          <Section
            title="Đang giảm giá"
            description="Ưu đãi có hạn cho các sản phẩm chọn lọc."
            products={featured.data.onSale}
          />
          <Section
            title="Mới về"
            description="Những sản phẩm vừa được bổ sung vào cửa hàng."
            products={featured.data.newArrivals}
          />
        </>
      ) : null}
    </>
  );
}
