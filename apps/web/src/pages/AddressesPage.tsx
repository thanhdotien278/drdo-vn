import { useState } from 'react';
import {
  createAddress,
  deleteAddress,
  fetchAddresses,
  setDefaultAddress,
  updateAddress,
} from '../api/addresses';
import { ApiRequestError } from '../api/client';
import { AddressForm } from '../components/AddressForm';
import { StateBlock } from '../components/StateBlock';
import { useAsync } from '../hooks/useAsync';
import type { Address } from '../types/commerce';

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
