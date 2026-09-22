import { Link } from 'react-router-dom';

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

/**
 * Route seam for pages owned by later epics (cart, checkout, orders, auth).
 * Keeps navigation targets resolvable until the real pages land.
 */
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="state-block">
      <p className="state-block__title">{title}</p>
      <p className="state-block__description">
        {description ?? 'Tính năng đang được xây dựng và sẽ sớm ra mắt.'}
      </p>
      <Link className="button button--primary" to="/products">
        Tiếp tục mua sắm
      </Link>
    </div>
  );
}
