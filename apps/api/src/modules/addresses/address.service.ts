import { Types } from 'mongoose';
import { z } from 'zod';
import { AddressModel, type AddressDocument } from '../../models/Address.js';
import { ApiError } from '../../utils/apiError.js';
import { parseInput } from '../../utils/validate.js';
import { toAddressDto, type AddressDto } from './address.dto.js';

/** Story 3.3 — saved shipping addresses; no postal code (FR-09.6). */
const addressBodySchema = z.object({
  fullName: z.string().trim().min(2, 'Vui lòng nhập họ tên').max(120),
  phone: z.string().trim().min(8, 'Số điện thoại không hợp lệ').max(20),
  line1: z.string().trim().min(1, 'Vui lòng nhập địa chỉ').max(200),
  line2: z.string().trim().max(200).optional().default(''),
  ward: z.string().trim().min(1, 'Vui lòng nhập phường/xã').max(120),
  district: z.string().trim().min(1, 'Vui lòng nhập quận/huyện').max(120),
  province: z.string().trim().min(1, 'Vui lòng nhập tỉnh/thành phố').max(120),
  isDefault: z.boolean().optional(),
});

export async function listAddresses(userId: string): Promise<AddressDto[]> {
  const addresses = await AddressModel.find({ userId })
    .sort({ isDefault: -1, createdAt: 1 })
    .exec();
  return addresses.map(toAddressDto);
}

async function findOwned(userId: string, addressId: string): Promise<AddressDocument> {
  if (!Types.ObjectId.isValid(addressId)) {
    throw ApiError.notFound('Không tìm thấy địa chỉ');
  }
  const address = await AddressModel.findOne({ _id: addressId, userId }).exec();
  if (!address) {
    throw ApiError.notFound('Không tìm thấy địa chỉ');
  }
  return address;
}

async function clearDefaults(userId: string): Promise<void> {
  await AddressModel.updateMany({ userId, isDefault: true }, { $set: { isDefault: false } }).exec();
}

export async function createAddress(userId: string, input: unknown): Promise<AddressDto> {
  const data = parseInput(addressBodySchema, input);
  const existingCount = await AddressModel.countDocuments({ userId }).exec();
  const makeDefault = data.isDefault === true || existingCount === 0;
  if (makeDefault) {
    await clearDefaults(userId);
  }
  const address = await AddressModel.create({
    userId,
    fullName: data.fullName,
    phone: data.phone,
    line1: data.line1,
    line2: data.line2,
    ward: data.ward,
    district: data.district,
    province: data.province,
    isDefault: makeDefault,
  });
  return toAddressDto(address);
}

export async function updateAddress(
  userId: string,
  addressId: string,
  input: unknown,
): Promise<AddressDto> {
  const data = parseInput(addressBodySchema.partial(), input);
  const address = await findOwned(userId, addressId);

  if (data.isDefault === true) {
    await clearDefaults(userId);
  }

  for (const field of ['fullName', 'phone', 'line1', 'line2', 'ward', 'district', 'province'] as const) {
    if (data[field] !== undefined) {
      address[field] = data[field];
    }
  }
  if (data.isDefault !== undefined) {
    address.isDefault = data.isDefault;
  }
  await address.save();
  return toAddressDto(address);
}

export async function deleteAddress(userId: string, addressId: string): Promise<void> {
  if (!Types.ObjectId.isValid(addressId)) {
    throw ApiError.notFound('Không tìm thấy địa chỉ');
  }
  const address = await AddressModel.findOneAndDelete({ _id: addressId, userId }).exec();
  if (!address) {
    throw ApiError.notFound('Không tìm thấy địa chỉ');
  }
  if (address.isDefault) {
    const next = await AddressModel.findOne({ userId }).sort({ createdAt: 1 }).exec();
    if (next) {
      next.isDefault = true;
      await next.save();
    }
  }
}

export async function setDefaultAddress(userId: string, addressId: string): Promise<AddressDto> {
  const address = await findOwned(userId, addressId);
  await clearDefaults(userId);
  address.isDefault = true;
  await address.save();
  return toAddressDto(address);
}
