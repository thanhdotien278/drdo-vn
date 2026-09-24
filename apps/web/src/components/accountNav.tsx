import type { ComponentType, SVGProps } from 'react';

export type AccountNavIcon = ComponentType<SVGProps<SVGSVGElement>>;

function ProfileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.5 19.5c1-3.2 3.4-4.8 6.5-4.8s5.5 1.6 6.5 4.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function OrdersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="m4.5 8 7.5-4 7.5 4v8l-7.5 4-7.5-4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="m4.5 8 7.5 4 7.5-4M12 12v8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function HeartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 20.3C6 16.5 3 13.3 3 9.7 3 7 5 5 7.6 5c1.8 0 3.4 1 4.4 2.5C13 6 14.6 5 16.4 5 19 5 21 7 21 9.7c0 3.6-3 6.8-9 10.6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AddressIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 21.5s-6.8-5.6-6.8-11a6.8 6.8 0 1 1 13.6 0c0 5.4-6.8 11-6.8 11Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10.3" r="2.4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function LoyaltyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="m12 4.6 2.2 4.4 4.9.7-3.6 3.5.9 4.9-4.4-2.3-4.4 2.3.9-4.9-3.6-3.5 4.9-.7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LogoutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M9.5 21H5.8A1.8 1.8 0 0 1 4 19.2V4.8A1.8 1.8 0 0 1 5.8 3h3.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="m15.5 16.5 4-4.5-4-4.5M19.5 12H9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface AccountNavItem {
  to: string;
  label: string;
  Icon: AccountNavIcon;
}

/** Shared customer-account destinations — used by the header user menu and the account sidebar. */
export const ACCOUNT_NAV_ITEMS: AccountNavItem[] = [
  { to: '/account', label: 'Hồ sơ của tôi', Icon: ProfileIcon },
  { to: '/orders', label: 'Đơn hàng của tôi', Icon: OrdersIcon },
  { to: '/wishlist', label: 'Yêu thích', Icon: HeartIcon },
  { to: '/addresses', label: 'Địa chỉ giao hàng', Icon: AddressIcon },
  { to: '/loyalty', label: 'Hạng thành viên', Icon: LoyaltyIcon },
];
