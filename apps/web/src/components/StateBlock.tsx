interface StateBlockProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function StateBlock({ title, description, actionLabel, onAction }: StateBlockProps) {
  return (
    <div className="state-block" role="status">
      <p className="state-block__title">{title}</p>
      {description ? <p className="state-block__description">{description}</p> : null}
      {actionLabel && onAction ? (
        <button type="button" className="button button--outline" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function LoadingGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="product-grid" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="product-card product-card--skeleton">
          <div className="skeleton skeleton--image" />
          <div className="skeleton skeleton--line" />
          <div className="skeleton skeleton--line skeleton--short" />
        </div>
      ))}
    </div>
  );
}
