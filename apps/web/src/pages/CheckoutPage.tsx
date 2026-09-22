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

  const [addressMode, setAddressMode] = useState<'saved' | 'new'>('saved');
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [shipping, setShipping] = useState(EMPTY_SHIPPING);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data: order } = await createOrder({
        paymentMethod,
        contactEmail: contactEmail.trim() || undefined,
        notesCustomer: notes.trim() || undefined,
        ...(effectiveMode === 'saved' && effectiveAddressId
          ? { addressId: effectiveAddressId }
          : { shipping }),
      });
      await refresh();
      navigate(`/orders/${order.orderNo}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Không đặt được đơn hàng. Vui lòng thử lại.');
      await refresh();
      preview.reload();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <StateBlock title="Đang tải thông tin thanh toán…" />
      </div>
    );
  }

  if (emptyCart) {
    return (
      <div className="page">
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
      <div className="page">
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

  const totals = preview.data?.totals;

  return (
    <div className="page checkout-page">
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
              <div className="summary-row">
                <dt>Phí vận chuyển</dt>
                <dd>{formatVnd(totals.shippingFee)}</dd>
              </div>
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
            disabled={submitting}
          >
            {submitting ? 'Đang đặt hàng…' : 'Đặt hàng'}
          </button>
        </aside>
      </form>
    </div>
  );
}
