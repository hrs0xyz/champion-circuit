import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
  asChild?: false;
};

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  const variantClass =
    variant === 'primary' ? 'btn-primary' : variant === 'secondary' ? 'btn-secondary' : 'btn-ghost';
  return (
    <button type="button" className={`btn ${variantClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
