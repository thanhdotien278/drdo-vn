import type { AddressDocument } from '../../models/Address.js';

export interface AddressDto {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  ward: string;
  district: string;
  province: string;
  isDefault: boolean;
}

export function toAddressDto(address: AddressDocument): AddressDto {
  return {
    id: String(address._id),
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2 ?? '',
    ward: address.ward,
    district: address.district,
    province: address.province,
    isDefault: address.isDefault ?? false,
  };
}
