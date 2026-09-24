import { useState, type FormEvent } from 'react';
import type { Address } from '../types/commerce';

export interface AddressFormValues {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  ward: string;
  district: string;
  province: string;
}

const EMPTY_FORM: AddressFormValues = {
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  ward: '',
  district: '',
  province: '',
};

const FIELD_AUTOCOMPLETE: Record<keyof AddressFormValues, string> = {
  fullName: 'name',
  phone: 'tel',
  line1: 'address-line1',
  line2: 'address-line2',
  ward: 'address-level3',
  district: 'address-level2',
  province: 'address-level1',
};

interface AddressFormProps {
  initial?: Address;
  submitting: boolean;
  onSubmit: (values: AddressFormValues) => void;
  onCancel: () => void;
}

/** Shared saved-address form — used by the address book and the profile page. */
export function AddressForm({ initial, submitting, onSubmit, onCancel }: AddressFormProps) {
  const [values, setValues] = useState<AddressFormValues>(
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
    key: keyof AddressFormValues,
    options: { required?: boolean; wide?: boolean } = {},
  ) => (
    <div className={options.wide ? 'form-field form-field--wide' : 'form-field'}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        required={options.required !== false}
        autoComplete={FIELD_AUTOCOMPLETE[key]}
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
