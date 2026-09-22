import type { Address } from '../types/commerce';
import { apiRequest } from './client';

export interface AddressInput {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  ward: string;
  district: string;
  province: string;
  isDefault?: boolean;
}

export function fetchAddresses(): Promise<{ data: Address[] }> {
  return apiRequest<Address[]>('GET', '/addresses');
}

export function createAddress(input: AddressInput): Promise<{ data: Address }> {
  return apiRequest<Address>('POST', '/addresses', { body: input });
}

export function updateAddress(id: string, input: Partial<AddressInput>): Promise<{ data: Address }> {
  return apiRequest<Address>('PATCH', `/addresses/${id}`, { body: input });
}

export async function deleteAddress(id: string): Promise<void> {
  await apiRequest('DELETE', `/addresses/${id}`);
}

export function setDefaultAddress(id: string): Promise<{ data: Address }> {
  return apiRequest<Address>('PATCH', `/addresses/${id}/default`);
}
