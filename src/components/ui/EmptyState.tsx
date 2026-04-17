import Link from 'next/link';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  cta?: string;
  ctaHref?: string;
  icon?: React.ReactNode;
}

export function EmptyState({ title, subtitle, cta, ctaHref, icon }: EmptyStateProps) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
      {icon && <div className="flex justify-center mb-3 text-slate-400">{icon}</div>}
      <p className="font-semibold text-slate-900">{title}</p>
      {subtitle && <p className="text-sm text-slate-600 mt-1 max-w-sm mx-auto">{subtitle}</p>}
      {cta && ctaHref && (
        <Link
          href={ctaHref}
          className="inline-block mt-4 text-sm font-medium text-blue-700 hover:text-blue-800 underline underline-offset-4"
        >
          {cta} →
        </Link>
      )}
    </div>
  );
}
