import { useState, type FormEvent } from 'react';
import {
  createAddress,
  deleteAddress,
  fetchAddresses,
  setDefaultAddress,
  updateAddress,
} from '../api/addresses';
import { ApiRequestError } from '../api/client';
import { StateBlock } from '../components/StateBlock';
import { useAsync } from '../hooks/useAsync';
import type { Address } from '../types/commerce';

const EMPTY_FORM = {
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  ward: '',
  district: '',
  province: '',
};

interface AddressFormProps {
  initial?: Address;
  submitting: boolean;
  onSubmit: (values: typeof EMPTY_FORM) => void;
  onCancel: () => void;
}

function AddressForm({ initial, submitting, onSubmit, onCancel }: AddressFormProps) {
  const [values, setValues] = useState(
    initial
      ? {
          fullName: initial.fullName,
          phone: initial.phone,
          line1: initial.line1,
          line2: initial.line2,
          ward: initial.ward,
          district: initial.district,
          province: initial.province,
        }
      : EMPTY_FORM,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(values);
  }

  const field = (
    id: string,
    label: string,
    key: keyof typeof EMPTY_FORM,
    options: { required?: boolean; wide?: boolean } = {},
  ) => (
    <div className={options.wide ? 'form-field form-field--wide' : 'form-field'}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        required={options.required !== false}
        value={values[key]}
        onChange={(event) => setValues({ ...values, [key]: event.target.value })}
      />
    </div>
  );

  return (
    <form className="form-grid address-form" onSubmit={handleSubmit}>
      {field('addr-name', 'Họ tên người nhận', 'fullName')}
      {field('addr-phone', 'Số điện thoại', 'phone')}
      {field('addr-line1', 'Địa chỉ', 'line1', { wide: true })}
      {field('addr-line2', 'Địa chỉ bổ sung (không bắt buộc)', 'line2', { required: false, wide: true })}
      {field('addr-ward', 'Phường/Xã', 'ward')}
      {field('addr-district', 'Quận/Huyện', 'district')}
      {field('addr-province', 'Tỉnh/Thành phố', 'province', { wide: true })}
      <div className="address-form__actions">
        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? 'Đang lưu…' : initial ? 'Lưu thay đổi' : 'Thêm địa chỉ'}
        </button>
        <button type="button" className="button button--outline" onClick={onCancel} disabled={submitting}>
          Huỷ
        </button>
      </div>
    </form>
  );
}

export function AddressesPage() {
  const addresses = useAsync<Address[]>(async () => (await fetchAddresses()).data, []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setSubmitting(true);
    try {
      await action();
      setCreating(false);
      setEditingId(null);
      addresses.reload();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Thao tác không thành công.');
    } finally {
      setSubmitting(false);
    }
  }

  if (addresses.status === 'loading') {
    return <StateBlock title="Đang tải địa chỉ…" />;
  }

  if (addresses.status === 'error') {
    return (
      <StateBlock
        title="Không tải được sổ địa chỉ"
        description={addresses.error?.message}
        actionLabel="Thử lại"
        onAction={addresses.reload}
      />
    );
  }

  const list = addresses.data ?? [];

  return (
    <div className="addresses-page">
      <h1>Sổ địa chỉ</h1>

      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}

      {list.length === 0 && !creating ? (
        <StateBlock
          title="Chưa có địa chỉ nào"
          description="Lưu địa chỉ giao hàng để thanh toán nhanh hơn."
        />
      ) : null}

      <ul className="address-list">
        {list.map((address) => (
          <li key={address.id} className="address-card">
            {editingId === address.id ? (
              <AddressForm
                initial={address}
                submitting={submitting}
                onSubmit={(values) => void run(() => updateAddress(address.id, values))}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <>
                <div className="address-card__body">
                  <p>
                    <strong>{address.fullName}</strong>
                    {address.isDefault ? <span className="badge-inline">Mặc định</span> : null}
                  </p>
                  <p className="muted">{address.phone}</p>
                  <p className="muted">
                    {address.line1}
                    {address.line2 ? `, ${address.line2}` : ''}, {address.ward}, {address.district},{' '}
                    {address.province}
                  </p>
                </div>
                <div className="address-card__actions">
                  {!address.isDefault ? (
                    <button
                      type="button"
                      className="link-button"
                      disabled={submitting}
                      onClick={() => void run(() => setDefaultAddress(address.id))}
                    >
                      Đặt làm mặc định
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="link-button"
                    disabled={submitting}
                    onClick={() => {
                      setCreating(false);
                      setEditingId(address.id);
                    }}
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    className="link-button link-button--danger"
                    disabled={submitting}
                    onClick={() => {
                      if (window.confirm('Xoá địa chỉ này?')) {
                        void run(() => deleteAddress(address.id));
                      }
                    }}
                  >
                    Xoá
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {creating ? (
        <div className="address-card">
          <AddressForm
            submitting={submitting}
            onSubmit={(values) => void run(() => createAddress(values))}
            onCancel={() => setCreating(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          className="button button--outline"
          onClick={() => {
            setEditingId(null);
            setCreating(true);
          }}
        >
          + Thêm địa chỉ mới
        </button>
      )}
    </div>
  );
}
