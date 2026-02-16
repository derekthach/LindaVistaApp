import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const variantClass: Record<Variant, string> = {
  primary: 'btn btn-primary',
  secondary: 'btn btn-secondary',
  ghost: 'btn btn-ghost',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

export default function Button({
  variant = 'secondary',
  type = 'button',
  disabled = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const classes = [variantClass[variant], className].filter(Boolean).join(' ');
  return (
    <button type={type} disabled={disabled} className={classes} {...rest}>
      {children}
    </button>
  );
}
