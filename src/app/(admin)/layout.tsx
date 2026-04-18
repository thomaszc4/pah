import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/shared/nav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('roles')
    .eq('id', user.id)
    .single();

  if (!profile?.roles?.includes('platform_admin')) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Nav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
            Platform admin
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mb-6">
          <AdminTab href="/admin" label="Overview" />
          <AdminTab href="/admin/certifications" label="Certifications" />
          <AdminTab href="/admin/business-requests" label="Business requests" />
          <AdminTab href="/admin/reviews" label="Flagged reviews" />
        </div>
        {children}
      </div>
    </div>
  );
}

function AdminTab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
    >
      {label}
    </Link>
  );
}
