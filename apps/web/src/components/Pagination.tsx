import type { PageMeta } from '../types/catalog';

interface PaginationProps {
  meta: PageMeta;
  onPageChange: (page: number) => void;
}

export function Pagination({ meta, onPageChange }: PaginationProps) {
  if (meta.totalPages <= 1) {
    return null;
  }

  const pages = Array.from({ length: meta.totalPages }, (_, index) => index + 1).filter(
    (page) => page === 1 || page === meta.totalPages || Math.abs(page - meta.page) <= 1,
  );

  return (
    <nav className="pagination" aria-label="Phân trang sản phẩm">
      <button
        type="button"
        className="button button--outline"
        onClick={() => onPageChange(meta.page - 1)}
        disabled={!meta.hasPrevPage}
      >
        Trước
      </button>
      <ul className="pagination__pages">
        {pages.map((page, index) => (
          <li key={page}>
            {index > 0 && page - pages[index - 1] > 1 ? <span className="pagination__gap">…</span> : null}
            <button
              type="button"
              className={page === meta.page ? 'pagination__page pagination__page--active' : 'pagination__page'}
              aria-current={page === meta.page ? 'page' : undefined}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="button button--outline"
        onClick={() => onPageChange(meta.page + 1)}
        disabled={!meta.hasNextPage}
      >
        Sau
      </button>
    </nav>
  );
}
