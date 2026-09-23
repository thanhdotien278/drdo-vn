import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiRequestError } from '../api/client';
import {
  createReview,
  deleteReview,
  fetchMyReview,
  fetchProductReviews,
  updateReview,
} from '../api/reviews';
import { useAuth } from '../auth/AuthContext';
import { useAsync } from '../hooks/useAsync';
import type { MyReviewState, Review, ReviewStatus } from '../types/engagement';
import type { PageMeta } from '../types/catalog';
import { formatRating } from '../utils/format';
import { Pagination } from './Pagination';
import { StateBlock } from './StateBlock';

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

const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: 'Đang chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Bị từ chối',
};

interface ReviewFormProps {
  initial?: Review | null;
  submitting: boolean;
  onSubmit: (rating: number, comment: string) => void;
  onCancel?: () => void;
}

function ReviewForm({ initial, submitting, onSubmit, onCancel }: ReviewFormProps) {
  const [rating, setRating] = useState(initial?.rating ?? 5);
  const [comment, setComment] = useState(initial?.comment ?? '');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(rating, comment.trim());
  }

  return (
    <form className="review-form" onSubmit={handleSubmit}>
      <div className="form-field">
        <label htmlFor="review-rating">Đánh giá của bạn</label>
        <div className="review-form__stars" role="radiogroup" aria-label="Chọn số sao">
          {Array.from({ length: MAX_STARS }, (_, index) => index + 1).map((value) => (
            <button
              key={value}
              type="button"
              className={value <= rating ? 'review-form__star review-form__star--on' : 'review-form__star'}
              onClick={() => setRating(value)}
              aria-pressed={value === rating}
              aria-label={`${value} sao`}
            >
              ★
            </button>
          ))}
        </div>
        <select
          id="review-rating"
          className="visually-hidden"
          value={rating}
          onChange={(event) => setRating(Number(event.target.value))}
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="review-comment">Nhận xét (không bắt buộc)</label>
        <textarea
          id="review-comment"
          rows={3}
          maxLength={2000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm…"
        />
      </div>
      <div className="admin-form__actions">
        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? 'Đang gửi…' : initial ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}
        </button>
        {onCancel ? (
          <button type="button" className="link-button" onClick={onCancel}>
            Hủy
          </button>
        ) : null}
      </div>
      {initial?.status === 'approved' ? (
        <p className="muted">Đánh giá sau khi sửa sẽ được duyệt lại trước khi hiển thị.</p>
      ) : null}
    </form>
  );
}

/**
 * Stories 7.3/7.4 — approved reviews plus the signed-in customer's own
 * review editor. Pending/rejected reviews never render in the public list.
 */
export function ProductReviews({ productId }: { productId: string }) {
  const { user } = useAuth();
  const isCustomer = Boolean(user?.roles.includes('customer'));
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reviews = useAsync<{ items: Review[]; meta: PageMeta }>(
    async () => {
      const result = await fetchProductReviews(productId, page);
      return { items: result.data, meta: result.meta as PageMeta };
    },
    [productId, page],
  );

  const mine = useAsync<MyReviewState>(
    async () => (isCustomer ? (await fetchMyReview(productId)).data : { review: null, eligible: false }),
    [productId, isCustomer],
  );

  async function run(action: () => Promise<unknown>) {
    setSubmitting(true);
    setError(null);
    try {
      await action();
      setEditing(false);
      reviews.reload();
      mine.reload();
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : 'Thao tác thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  const myReview = mine.data?.review ?? null;
  const eligible = mine.data?.eligible ?? false;

  return (
    <section className="detail-block reviews" aria-label="Đánh giá sản phẩm">
      <h2>Đánh giá từ khách hàng</h2>

      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}

      {isCustomer && mine.status === 'success' ? (
        <div className="review-mine">
          {myReview && !editing ? (
            <article className="review review--mine">
              <div className="review__header">
                <Stars value={myReview.rating} />
                <span className={`status status--${myReview.status === 'approved' ? 'delivered' : myReview.status === 'rejected' ? 'cancelled' : 'pending'}`}>
                  {STATUS_LABELS[myReview.status]}
                </span>
              </div>
              {myReview.comment ? <p className="review__comment">{myReview.comment}</p> : null}
              <div className="admin-table__actions">
                <button type="button" className="link-button" onClick={() => setEditing(true)}>
                  Sửa đánh giá
                </button>
                <button
                  type="button"
                  className="link-button link-button--danger"
                  disabled={submitting}
                  onClick={() => {
                    if (!window.confirm('Xóa đánh giá này?')) return;
                    void run(() => deleteReview(myReview.id));
                  }}
                >
                  Xóa
                </button>
              </div>
            </article>
          ) : myReview && editing ? (
            <ReviewForm
              initial={myReview}
              submitting={submitting}
              onSubmit={(rating, comment) =>
                void run(() => updateReview(myReview.id, { rating, comment }))
              }
              onCancel={() => setEditing(false)}
            />
          ) : eligible ? (
            <ReviewForm
              submitting={submitting}
              onSubmit={(rating, comment) =>
                void run(() => createReview(productId, { rating, comment }))
              }
            />
          ) : (
            <p className="muted">Bạn có thể đánh giá sau khi mua sản phẩm này.</p>
          )}
        </div>
      ) : null}

      {!user ? (
        <p className="muted">
          <Link to="/login">Đăng nhập</Link> để viết đánh giá nếu bạn đã mua sản phẩm này.
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
        <p className="muted">Chưa có đánh giá nào cho sản phẩm này.</p>
      ) : (
        <>
          <ul className="review-list">
            {reviews.data!.items.map((review) => (
              <li key={review.id} className="review">
                <div className="review__header">
                  <strong>{review.authorName || 'Khách hàng'}</strong>
                  <Stars value={review.rating} />
                </div>
                {review.comment ? <p className="review__comment">{review.comment}</p> : null}
                <p className="review__date muted">
                  {new Date(review.createdAt).toLocaleDateString('vi-VN')}
                </p>
              </li>
            ))}
          </ul>
          {reviews.data ? <Pagination meta={reviews.data.meta} onPageChange={setPage} /> : null}
        </>
      )}
    </section>
  );
}
