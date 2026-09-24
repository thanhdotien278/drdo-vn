import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiRequestError } from '../../api/client';
import type { staffReviewsApi } from '../../api/reviews';
import { useAsync } from '../../hooks/useAsync';
import type { PageMeta } from '../../types/catalog';
import type { ReviewStatus, StaffReview } from '../../types/engagement';
import { formatRating } from '../../utils/format';
import { Pagination } from '../Pagination';
import { StateBlock } from '../StateBlock';

type ReviewsApi = ReturnType<typeof staffReviewsApi>;

const STATUS_OPTIONS: Array<{ value: ReviewStatus | 'all'; label: string }> = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Bị từ chối' },
  { value: 'all', label: 'Tất cả' },
];

const STATUS_BADGE: Record<ReviewStatus, { className: string; label: string }> = {
  pending: { className: 'status status--pending', label: 'Chờ duyệt' },
  approved: { className: 'status status--delivered', label: 'Đã duyệt' },
  rejected: { className: 'status status--cancelled', label: 'Bị từ chối' },
};

/**
 * Story 7.4 — one moderation screen shared by `/employee/reviews` and
 * `/admin/reviews`, matching the StaffOrdersPage pattern.
 */
export function StaffReviewsPage({ title, api }: { title: string; api: ReviewsApi }) {
  const [status, setStatus] = useState<ReviewStatus | 'all'>('pending');
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);

  const reviews = useAsync<{ items: StaffReview[]; meta: PageMeta }>(
    () => api.fetchReviews({ status, page }),
    [status, page],
  );

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
      reviews.reload();
    } catch (error) {
      setActionError(error instanceof ApiRequestError ? error.message : 'Thao tác thất bại');
    }
  }

  function moderate(review: StaffReview, next: 'approved' | 'rejected') {
    const note =
      next === 'rejected' ? window.prompt('Lý do từ chối (không bắt buộc):') ?? undefined : undefined;
    void run(() => api.setStatus(review.id, next, note));
  }

  return (
    <div className="page-container page admin-page">
      <div className="admin-page__header">
        <h1>{title}</h1>
      </div>

      <div className="staff-toolbar">
        <div className="form-field">
          <label htmlFor="review-status-filter">Trạng thái</label>
          <select
            id="review-status-filter"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as typeof status);
              setPage(1);
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {actionError ? (
        <p className="error-text" role="alert">
          {actionError}
        </p>
      ) : null}

      {reviews.status === 'loading' ? (
        <StateBlock title="Đang tải đánh giá…" />
      ) : reviews.status === 'error' ? (
        <StateBlock
          title="Không tải được đánh giá"
          description={reviews.error?.message}
          actionLabel="Thử lại"
          onAction={reviews.reload}
        />
      ) : (reviews.data?.items.length ?? 0) === 0 ? (
        <StateBlock title="Không có đánh giá" description="Không có đánh giá nào ở trạng thái này." />
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Khách hàng</th>
                <th>Sao</th>
                <th>Nội dung</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {reviews.data!.items.map((review) => (
                <tr key={review.id}>
                  <td>
                    {review.product ? (
                      <Link to={`/products/${review.product.slug}`}>{review.product.name}</Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {review.customer ? (
                      <>
                        {review.customer.fullName}
                        <br />
                        <span className="muted">{review.customer.email}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{formatRating(review.rating)} ★</td>
                  <td className="admin-table__comment">{review.comment || '—'}</td>
                  <td>
                    <span className={STATUS_BADGE[review.status].className}>
                      {STATUS_BADGE[review.status].label}
                    </span>
                  </td>
                  <td>
                    <div className="admin-table__actions">
                      {review.status !== 'approved' ? (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => moderate(review, 'approved')}
                        >
                          Duyệt
                        </button>
                      ) : null}
                      {review.status !== 'rejected' ? (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => moderate(review, 'rejected')}
                        >
                          Từ chối
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="link-button link-button--danger"
                        onClick={() => {
                          if (!window.confirm('Xóa vĩnh viễn đánh giá này?')) return;
                          void run(() => api.remove(review.id));
                        }}
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {reviews.data && reviews.data.meta.totalPages > 1 ? (
            <Pagination meta={reviews.data.meta} onPageChange={setPage} />
          ) : null}
        </>
      )}
    </div>
  );
}
