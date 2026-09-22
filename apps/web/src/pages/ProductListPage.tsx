import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchBrands, fetchCategories, fetchProducts } from '../api/catalog';
import { Pagination } from '../components/Pagination';
import { ProductGrid } from '../components/ProductCard';
import { LoadingGrid, StateBlock } from '../components/StateBlock';
import { useAsync } from '../hooks/useAsync';
import type { Availability, Brand, Category, PageMeta, ProductListItem, ProductSort } from '../types/catalog';

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'price_asc', label: 'Giá tăng dần' },
  { value: 'price_desc', label: 'Giá giảm dần' },
  { value: 'popular', label: 'Bán chạy' },
];

const AVAILABILITY_OPTIONS: { value: Availability; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'in_stock', label: 'Còn hàng' },
  { value: 'out_of_stock', label: 'Hết hàng' },
];

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const keyword = searchParams.get('q') ?? '';
  const page = Number(searchParams.get('page') ?? '1');
  const sort = (searchParams.get('sort') as ProductSort | null) ?? 'newest';
  const availability = (searchParams.get('availability') as Availability | null) ?? 'all';
  const selectedCategories = useMemo(
    () => (searchParams.get('category') ?? '').split(',').filter(Boolean),
    [searchParams],
  );
  const selectedBrands = useMemo(() => (searchParams.get('brand') ?? '').split(',').filter(Boolean), [searchParams]);
  const minPrice = searchParams.get('minPrice') ?? '';
  const maxPrice = searchParams.get('maxPrice') ?? '';

  const [minPriceInput, setMinPriceInput] = useState(minPrice);
  const [maxPriceInput, setMaxPriceInput] = useState(maxPrice);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const categories = useAsync<Category[]>(async () => (await fetchCategories()).data, []);
  const brands = useAsync<Brand[]>(async () => (await fetchBrands()).data, []);
  const products = useAsync<{ items: ProductListItem[]; meta: PageMeta }>(
    () =>
      fetchProducts({
        page,
        limit: 12,
        q: keyword || undefined,
        category: selectedCategories.join(',') || undefined,
        brand: selectedBrands.join(',') || undefined,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        availability,
        sort,
      }),
    [page, keyword, selectedCategories.join(','), selectedBrands.join(','), minPrice, maxPrice, availability, sort],
  );

  function updateParams(changes: Record<string, string | undefined>, resetPage = true) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === '') {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    if (resetPage) {
      next.delete('page');
    }
    setSearchParams(next);
  }

  function handlePriceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateParams({ minPrice: minPriceInput, maxPrice: maxPriceInput });
  }

  function clearFilters() {
    setMinPriceInput('');
    setMaxPriceInput('');
    setSearchParams(keyword ? new URLSearchParams({ q: keyword }) : new URLSearchParams());
  }

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedBrands.length > 0 ||
    Boolean(minPrice) ||
    Boolean(maxPrice) ||
    availability !== 'all';

  return (
    <div className={filtersOpen ? 'catalog-layout catalog-layout--filters-open' : 'catalog-layout'}>
      <div className="catalog-toolbar">
        <button
          type="button"
          className="button button--outline filters-toggle"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="16" height="16">
            <path d="M4 6h16M7 12h10m-7 6h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Bộ lọc
        </button>
      </div>
      <aside className="filters" aria-label="Bộ lọc sản phẩm">
        <div className="filters__header">
          <h2>Bộ lọc</h2>
          {hasActiveFilters ? (
            <button type="button" className="link-button" onClick={clearFilters}>
              Xoá bộ lọc
            </button>
          ) : null}
        </div>

        <fieldset className="filter-group">
          <legend>Danh mục</legend>
          {(categories.data ?? []).map((category) => (
            <label key={category.id} className="checkbox">
              <input
                type="checkbox"
                checked={selectedCategories.includes(category.slug)}
                onChange={() =>
                  updateParams({ category: toggleValue(selectedCategories, category.slug).join(',') })
                }
              />
              <span>{category.name}</span>
            </label>
          ))}
          {categories.status === 'error' ? <p className="error-text">Không tải được danh mục.</p> : null}
        </fieldset>

        <fieldset className="filter-group">
          <legend>Thương hiệu</legend>
          {(brands.data ?? []).map((brand) => (
            <label key={brand.id} className="checkbox">
              <input
                type="checkbox"
                checked={selectedBrands.includes(brand.slug)}
                onChange={() => updateParams({ brand: toggleValue(selectedBrands, brand.slug).join(',') })}
              />
              <span>{brand.name}</span>
            </label>
          ))}
          {brands.status === 'error' ? <p className="error-text">Không tải được thương hiệu.</p> : null}
        </fieldset>

        <form className="filter-group" onSubmit={handlePriceSubmit}>
          <fieldset>
            <legend>Khoảng giá (VNĐ)</legend>
            <div className="price-inputs">
              <label>
                <span className="visually-hidden">Giá thấp nhất</span>
                <input
                  type="number"
                  min={0}
                  step={10000}
                  placeholder="Từ"
                  value={minPriceInput}
                  onChange={(event) => setMinPriceInput(event.target.value)}
                />
              </label>
              <label>
                <span className="visually-hidden">Giá cao nhất</span>
                <input
                  type="number"
                  min={0}
                  step={10000}
                  placeholder="Đến"
                  value={maxPriceInput}
                  onChange={(event) => setMaxPriceInput(event.target.value)}
                />
              </label>
            </div>
            <button type="submit" className="button button--outline button--full">
              Áp dụng
            </button>
          </fieldset>
        </form>

        <fieldset className="filter-group">
          <legend>Tình trạng</legend>
          {AVAILABILITY_OPTIONS.map((option) => (
            <label key={option.value} className="checkbox">
              <input
                type="radio"
                name="availability"
                checked={availability === option.value}
                onChange={() => updateParams({ availability: option.value === 'all' ? undefined : option.value })}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      </aside>

      <section className="catalog-results">
        <div className="catalog-results__header">
          <div>
            <h1>{keyword ? `Kết quả cho “${keyword}”` : 'Tất cả sản phẩm'}</h1>
            {products.data ? (
              <p className="muted">{products.data.meta.total} sản phẩm</p>
            ) : (
              <p className="muted">Đang tải…</p>
            )}
          </div>
          <label className="sort-control">
            <span>Sắp xếp</span>
            <select value={sort} onChange={(event) => updateParams({ sort: event.target.value })}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {products.status === 'loading' ? <LoadingGrid /> : null}

        {products.status === 'error' ? (
          <StateBlock
            title="Không tải được danh sách sản phẩm"
            description={products.error?.message}
            actionLabel="Thử lại"
            onAction={products.reload}
          />
        ) : null}

        {products.status === 'success' && products.data && products.data.items.length === 0 ? (
          <StateBlock
            title="Không tìm thấy sản phẩm phù hợp"
            description="Thử bỏ bớt bộ lọc hoặc tìm với từ khoá khác."
            actionLabel={hasActiveFilters ? 'Xoá bộ lọc' : undefined}
            onAction={hasActiveFilters ? clearFilters : undefined}
          />
        ) : null}

        {products.status === 'success' && products.data && products.data.items.length > 0 ? (
          <>
            <ProductGrid products={products.data.items} />
            <Pagination
              meta={products.data.meta}
              onPageChange={(nextPage) => {
                updateParams({ page: String(nextPage) }, false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </>
        ) : null}
      </section>
    </div>
  );
}
