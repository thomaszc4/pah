import { cn } from '@/lib/utils/cn';

export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-slate-200 shadow-sm',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-6 py-4 border-b border-slate-100', className)}>
      {children}
    </div>
  );
}

export function CardBody({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6', className)}>{children}</div>;
}
