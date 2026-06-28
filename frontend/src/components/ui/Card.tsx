import type { HTMLAttributes, ReactNode } from 'react';

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  as?: 'article' | 'div';
  wide?: boolean;
  exclusive?: boolean;
};

export function Card({ children, className = '', as: Tag = 'article', wide, exclusive, ...props }: CardProps) {
  return (
    <Tag
      className={`card${wide ? ' card-wide' : ''}${exclusive ? ' card--exclusive' : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </Tag>
  );
}
