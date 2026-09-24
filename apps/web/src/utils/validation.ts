/**
 * Vietnamese-friendly phone check shared by profile/address forms.
 * Accepts optional +84/84 prefix and common separators; the first digit
 * after the prefix must be non-zero so obvious duds like 0000000000 fail.
 * Empty string is treated as valid (field is optional) — callers decide
 * requiredness.
 */
const VN_PHONE_PATTERN = /^(?:\+?84|0)[1-9]\d{8,9}$/;

export function isValidVnPhone(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '') {
    return true;
  }
  return VN_PHONE_PATTERN.test(trimmed.replace(/[\s.\-()]/g, ''));
}
