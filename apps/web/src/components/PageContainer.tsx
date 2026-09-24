import type { ReactNode } from 'react';

type PageContainerTag = 'div' | 'article' | 'section';

/**
 * Shared horizontal page frame — same max-width and gutters as the header,
 * footer and home sections (see `.page-container` / `.container` in global.css).
 */
export function PageContainer({
  as: Tag = 'div',
  className,
  children,
}: {
  as?: PageContainerTag;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={className ? `page-container ${className}` : 'page-container'}>{children}</Tag>
  );
}
