import type { ReactNode } from 'react';

type PageContainerProps = {
  children: ReactNode;
  narrow?: boolean;
  className?: string;
};

export function PageContainer({ children, narrow, className = '' }: PageContainerProps) {
  return <div className={`section-inner${narrow ? ' narrow' : ''} ${className}`.trim()}>{children}</div>;
}
