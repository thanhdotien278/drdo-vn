import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchAddresses } from '../api/addresses';
import { createOrder, previewOrder } from '../api/orders';
import { ApiRequestError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { StateBlock } from '../components/StateBlock';
import { useCart } from '../cart/CartContext';
import { useAsync } from '../hooks/useAsync';
import type { Address, OrderPreview, PaymentMethod } from '../types/commerce';
import { formatVnd } from '../utils/format';
import { PAYMENT_METHOD_LABELS } from '../utils/labels';

const PAYMENT_METHODS: PaymentMethod[] = ['cod', 'bank_transfer', 'momo_manual'];

const EMPTY_SHIPPING = {
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  ward: '',
  district: '',
  province: '',
};

export function CheckoutPage() {
  const { user } = useAuth();
  const { cart, refresh } = useCart();
  const navigate = useNavigate();

  const addresses = useAsync<Address[]>(async () => (await fetchAddresses()).data, []);
  const preview = useAsync<OrderPreview>(async () => (await previewOrder()).data, []);

  // Epic 8 — loyalty points. `appliedPoints` is the last server-validated
  // amount; `previewOverride` holds the re-preview result after applying.
  const [pointsInput, setPointsInput] = useState('');
  const [appliedPoints, setAppliedPoints] = useState(0);
  const [previewOverride, setPreviewOverride] = useState<OrderPreview | null>(null);
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [applyingPoints, setApplyingPoints] = useState(false);

  // Epic 9 — coupon. `appliedCoupon` is the last server-validated code; the
  // totals' `couponRef` snapshot is the source of truth after each preview.
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const [addressMode, setAddressMode] = useState<'saved' | 'new'>('saved');
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [shipping, setShipping] = useState(EMPTY_SHIPPING);
  const [saveAddress, setSaveAddress] = useState(false);
  const [contactEmail, setContactEmail] = useState(user?.email ?? '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loading =
    addresses.status === 'loading' || preview.status === 'loading';
  const loadError = addresses.status === 'error' ? addresses.error : preview.error;
  const emptyCart =
    preview.status === 'error' &&
    preview.error instanceof ApiRequestError &&
    preview.error.code === 'CART_EMPTY';

  const effectiveAddressId = useMemo(() => {
    const list = addresses.data ?? [];
    if (selectedAddressId && list.some((address) => address.id === selectedAddressId)) {
      return selectedAddressId;
    }
    return (list.find((address) => address.isDefault) ?? list[0])?.id ?? null;
  }, [addresses.data, selectedAddressId]);

  const effectiveMode = addressMode === 'saved' && (addresses.data ?? []).length === 0 ? 'new' : addressMode;

  async function applyPoints(points: number) {
    setPointsError(null);
    setApplyingPoints(true);
    try {
      const { data } = await previewOrder({
        pointsToRedeem: points,
        couponCode: appliedCoupon ?? undefined,
      });
      setPreviewOverride(data);
      setAppliedPoints(data.loyalty.pointsToRedeem);
    } catch (err) {
      setPointsError(
        err instanceof ApiRequestError ? err.message : 'Không áp dụng được điểm. Vui lòng thử lại.',
      );
    } finally {
      setApplyingPoints(false);
    }
  }

  async function applyCoupon(code: string): Promise<boolean> {
    setCouponError(null);
    setApplyingCoupon(true);
    try {
      const { data } = await previewOrder({
        pointsToRedeem: appliedPoints,
        couponCode: code || undefined,
      });
      setPreviewOverride(data);
      setAppliedCoupon(data.totals.couponRef?.code ?? null);
      return true;
    } catch (err) {
      setCouponError(
        err instanceof ApiRequestError ? err.message : 'Không áp dụng được mã. Vui lòng thử lại.',
      );
      return false;
    } finally {
      setApplyingCoupon(false);
    }
  }

  function handleApplyCoupon() {
    const code = couponInput.trim();
    if (!code) {
      setCouponError('Vui lòng nhập mã giảm giá');
      return;
    }
    void applyCoupon(code);
  }

  function handleApplyPoints() {
    const points = Number(pointsInput.trim());
    if (!Number.isInteger(points) || points < 0) {
      setPointsError('Số điểm không hợp lệ');
      return;
    }
    void applyPoints(points);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    // A value typed but never "applied" must not be silently dropped: honor
    // the dirty input and let the server strictly validate it.
    const typed = pointsInput.trim() === '' ? null : Number(pointsInput.trim());
    const submittedPoints =
      typed !== null && Number.isInteger(typed) && typed >= 0 ? typed : appliedPoints;
    // Same dirty-input rule as points: a typed-but-unapplied code is sent and
    // strictly validated by the server rather than silently dropped.
    const submittedCoupon = couponInput.trim() !== '' ? couponInput.trim() : appliedCoupon;
    setSubmitting(true);
    try {
      const { data: order } = await createOrder({
        paymentMethod,
        contactEmail: contactEmail.trim() || undefined,
        notesCustomer: notes.trim() || undefined,
        pointsToRedeem: submittedPoints > 0 ? submittedPoints : undefined,
        couponCode: submittedCoupon ?? undefined,
        ...(effectiveMode === 'saved' && effectiveAddressId
          ? { addressId: effectiveAddressId }
          : { shipping, saveAddress }),
      });
      await refresh();
      // If the customer opted in to saving the address but the best-effort
      // write failed, carry a flag so the order page can say so.
      navigate(`/orders/${order.orderNo}`, {
        replace: true,
        state:
          saveAddress && order.addressSaved !== true ? { addressSaveFailed: true } : undefined,
      });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Không đặt được đơn hàng. Vui lòng thử lại.');
      await refresh();
      // Re-run the preview so totals/loyalty reflect the post-failure state.
      if (submittedPoints > 0 || submittedCoupon) {
        const { data } = await previewOrder({
          pointsToRedeem: submittedPoints,
          couponCode: submittedCoupon ?? undefined,
        }).catch(() => ({ data: null }));
        if (data) {
          setPreviewOverride(data);
          setAppliedCoupon(data.totals.couponRef?.code ?? null);
          setAppliedPoints(data.loyalty.pointsToRedeem);
        } else {
          // The re-preview failed too — fall back to the reloaded base
          // preview so no stale override or ghost apply state remains.
          setPreviewOverride(null);
          setAppliedCoupon(null);
          setAppliedPoints(0);
          preview.reload();
        }
      } else {
        setPreviewOverride(null);
        setAppliedCoupon(null);
        setAppliedPoints(0);
        preview.reload();
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container page">
        <StateBlock title="Đang tải thông tin thanh toán…" />
      </div>
    );
  }

  if (emptyCart) {
    return (
      <div className="page-container page">
        <StateBlock
          title="Giỏ hàng đang trống"
          description="Thêm sản phẩm vào giỏ trước khi thanh toán."
        />
        <p className="cart-empty__cta">
          <Link className="button button--primary" to="/products">
            Tiếp tục mua sắm
          </Link>
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page-container page">
        <StateBlock
          title="Không tải được thông tin thanh toán"
          description={loadError.message}
          actionLabel="Thử lại"
          onAction={() => {
            addresses.reload();
            preview.reload();
          }}
        />
      </div>
    );
  }

  const effectivePreview = previewOverride ?? preview.data;
  const totals = effectivePreview?.totals;
  const loyalty = effectivePreview?.loyalty;

  return (
    <div className="page-container page checkout-page">
      <h1>Thanh toán</h1>

      <form className="checkout-layout" onSubmit={handleSubmit}>
        <div className="checkout-main">
          <section className="checkout-panel" aria-labelledby="shipping-heading">
            <h2 id="shipping-heading">Địa chỉ giao hàng</h2>

            {(addresses.data ?? []).length > 0 ? (
              <div className="address-options" role="radiogroup" aria-label="Địa chỉ đã lưu">
                {addresses.data!.map((address) => (
                  <label key={address.id} className="address-option">
                    <input
                      type="radio"
                      name="addressMode"
                      checked={effectiveMode === 'saved' && effectiveAddressId === address.id}
                      onChange={() => {
                        setAddressMode('saved');
                        setSelectedAddressId(address.id);
                      }}
                    />
                    <span className="address-option__body">
                      <strong>
                        {address.fullName}
                        {address.isDefault ? <span className="badge-inline">Mặc định</span> : null}
                      </strong>
                      <span className="muted">
                        {address.phone} · {address.line1}
                        {address.line2 ? `, ${address.line2}` : ''}, {address.ward},{' '}
                        {address.district}, {address.province}
                      </span>
                    </span>
                  </label>
                ))}
                <label className="address-option">
                  <input
                    type="radio"
                    name="addressMode"
                    checked={effectiveMode === 'new'}
                    onChange={() => setAddressMode('new')}
                  />
                  <span className="address-option__body">
                    <strong>Nhập địa chỉ mới</strong>
                  </span>
                </label>
              </div>
            ) : null}

            {effectiveMode === 'new' ? (
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="ship-name">Họ tên người nhận</label>
                  <input
                    id="ship-name"
                    required
                    value={shipping.fullName}
                    onChange={(event) => setShipping({ ...shipping, fullName: event.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="ship-phone">Số điện thoại</label>
                  <input
                    id="ship-phone"
                    required
                    value={shipping.phone}
                    onChange={(event) => setShipping({ ...shipping, phone: event.target.value })}
                  />
                </div>
                <div className="form-field form-field--wide">
                  <label htmlFor="ship-line1">Địa chỉ</label>
                  <input
                    id="ship-line1"
                    required
                    value={shipping.line1}
                    onChange={(event) => setShipping({ ...shipping, line1: event.target.value })}
                  />
                </div>
                <div className="form-field form-field--wide">
                  <label htmlFor="ship-line2">Địa chỉ bổ sung (không bắt buộc)</label>
                  <input
                    id="ship-line2"
                    value={shipping.line2}
                    onChange={(event) => setShipping({ ...shipping, line2: event.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="ship-ward">Phường/Xã</label>
                  <input
                    id="ship-ward"
                    required
                    value={shipping.ward}
                    onChange={(event) => setShipping({ ...shipping, ward: event.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="ship-district">Quận/Huyện</label>
                  <input
                    id="ship-district"
                    required
                    value={shipping.district}
                    onChange={(event) => setShipping({ ...shipping, district: event.target.value })}
                  />
                </div>
                <div className="form-field form-field--wide">
                  <label htmlFor="ship-province">Tỉnh/Thành phố</label>
                  <input
                    id="ship-province"
                    required
                    value={shipping.province}
                    onChange={(event) => setShipping({ ...shipping, province: event.target.value })}
                  />
                </div>
                <label className="checkbox form-field--wide">
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(event) => setSaveAddress(event.target.checked)}
                  />
                  Lưu địa chỉ này cho lần sau
                </label>
              </div>
            ) : null}

            <div className="form-field checkout-contact">
              <label htmlFor="contact-email">Email liên hệ</label>
              <input
                id="contact-email"
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="order-notes">Ghi chú (không bắt buộc)</label>
              <textarea
                id="order-notes"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </section>

          <section className="checkout-panel" aria-labelledby="payment-heading">
            <h2 id="payment-heading">Phương thức thanh toán</h2>
            <div className="address-options" role="radiogroup" aria-label="Phương thức thanh toán">
              {PAYMENT_METHODS.map((method) => (
                <label key={method} className="address-option">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === method}
                    onChange={() => setPaymentMethod(method)}
                  />
                  <span className="address-option__body">{PAYMENT_METHOD_LABELS[method]}</span>
                </label>
              ))}
            </div>
            <p className="muted">
              Đơn hàng được tạo ở trạng thái chưa thanh toán; DRDO xác nhận thanh toán thủ công sau khi
              nhận được tiền.
            </p>
          </section>

          <section className="checkout-panel" aria-labelledby="coupon-heading">
            <h2 id="coupon-heading">Mã giảm giá</h2>
            <div className="form-field">
              <label htmlFor="coupon-code">Nhập mã giảm giá</label>
              <input
                id="coupon-code"
                value={couponInput}
                maxLength={50}
                placeholder="Ví dụ: DRDO10"
                onChange={(event) => setCouponInput(event.target.value)}
              />
            </div>
            <div className="admin-form__actions">
              <button
                type="button"
                className="button button--outline"
                disabled={applyingCoupon || applyingPoints}
                onClick={handleApplyCoupon}
              >
                {applyingCoupon ? 'Đang áp dụng…' : 'Áp dụng mã'}
              </button>
              {appliedCoupon ? (
                <button
                  type="button"
                  className="link-button"
                  disabled={applyingCoupon || applyingPoints}
                  onClick={() => {
                    // Clear the input only once the removal preview
                    // succeeded — a failed removal must not leave a ghost
                    // coupon that resubmits.
                    void applyCoupon('').then((ok) => {
                      if (ok) setCouponInput('');
                    });
                  }}
                >
                  Gỡ mã
                </button>
              ) : null}
            </div>
            {couponError ? (
              <p className="error-text" role="alert">
                {couponError}
              </p>
            ) : null}
            {appliedCoupon ? <p className="muted">Đang dùng mã {appliedCoupon}.</p> : null}
          </section>

          <section className="checkout-panel" aria-labelledby="loyalty-heading">
            <h2 id="loyalty-heading">Điểm thưởng</h2>
            {loyalty ? (
              <>
                <p className="muted">
                  Hạng {loyalty.tierName} · Số dư {loyalty.balance.toLocaleString('vi-VN')} điểm
                  {loyalty.maxRedeemablePoints > 0
                    ? ` · Có thể dùng tối đa ${loyalty.maxRedeemablePoints.toLocaleString('vi-VN')} điểm cho đơn này`
                    : ''}
                </p>
                <div className="form-field">
                  <label htmlFor="points-to-redeem">Số điểm muốn dùng (bội số của 100)</label>
                  <input
                    id="points-to-redeem"
                    type="number"
                    min={0}
                    step={100}
                    value={pointsInput}
                    onChange={(event) => setPointsInput(event.target.value)}
                    disabled={loyalty.maxRedeemablePoints === 0}
                  />
                </div>
                <div className="admin-form__actions">
                  <button
                    type="button"
                    className="button button--outline"
                    disabled={
                      applyingPoints || applyingCoupon || loyalty.maxRedeemablePoints === 0
                    }
                    onClick={handleApplyPoints}
                  >
                    {applyingPoints ? 'Đang áp dụng…' : 'Áp dụng điểm'}
                  </button>
                  {appliedPoints > 0 ? (
                    <button
                      type="button"
                      className="link-button"
                      disabled={applyingPoints || applyingCoupon}
                      onClick={() => {
                        setPointsInput('');
                        void applyPoints(0);
                      }}
                    >
                      Bỏ dùng điểm
                    </button>
                  ) : null}
                </div>
                {pointsError ? (
                  <p className="error-text" role="alert">
                    {pointsError}
                  </p>
                ) : null}
                {appliedPoints > 0 ? (
                  <p className="muted">Đang dùng {appliedPoints.toLocaleString('vi-VN')} điểm.</p>
                ) : null}
              </>
            ) : (
              <p className="muted">Đăng nhập để xem và dùng điểm thưởng.</p>
            )}
          </section>
        </div>

        <aside className="cart-summary">
          <h2>Đơn hàng</h2>
          <ul className="checkout-items">
            {(cart?.items ?? []).map((item) => (
              <li key={item.id}>
                <span>
                  {item.product?.name ?? 'Sản phẩm'} × {item.qty}
                </span>
                <span>{formatVnd(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          {totals ? (
            <dl className="summary-rows">
              <div className="summary-row">
                <dt>Tạm tính</dt>
                <dd>{formatVnd(totals.subtotal)}</dd>
              </div>
              {totals.discountAmount > 0 ? (
                <div className="summary-row">
                  <dt>
                    Giảm giá
                    {totals.couponRef ? ` (${totals.couponRef.code})` : ''}
                  </dt>
                  <dd>-{formatVnd(totals.discountAmount)}</dd>
                </div>
              ) : null}
              {totals.pointsDiscountAmount > 0 ? (
                <div className="summary-row">
                  <dt>Điểm thưởng ({totals.pointsRedeemed.toLocaleString('vi-VN')} điểm)</dt>
                  <dd>-{formatVnd(totals.pointsDiscountAmount)}</dd>
                </div>
              ) : null}
              <div className="summary-row">
                <dt>Phí vận chuyển</dt>
                <dd>
                  {loyalty?.freeShippingApplied ? 'Miễn phí' : formatVnd(totals.shippingFee)}
                </dd>
              </div>
              {loyalty?.freeShippingApplied ? (
                <p className="muted">Miễn phí vận chuyển theo hạng {loyalty.tierName}.</p>
              ) : null}
              <div className="summary-row summary-row--total">
                <dt>Tổng cộng</dt>
                <dd>{formatVnd(totals.grandTotal)}</dd>
              </div>
            </dl>
          ) : null}

          {error ? (
            <p className="error-text" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="button button--primary button--lg button--full"
            disabled={submitting || applyingCoupon || applyingPoints}
          >
            {submitting ? 'Đang đặt hàng…' : 'Đặt hàng'}
          </button>
        </aside>
      </form>
    </div>
  );
}
