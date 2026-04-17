import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-slate-900 hover:bg-slate-800 text-white shadow-sm disabled:bg-slate-400 disabled:cursor-not-allowed',
  secondary:
    'bg-white border border-slate-300 hover:bg-slate-50 text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed',
  destructive:
    'bg-rose-600 hover:bg-rose-700 text-white shadow-sm disabled:bg-rose-300 disabled:cursor-not-allowed',
  ghost:
    'text-slate-700 hover:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-medium transition-colors',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  );
});
