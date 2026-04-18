import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export const revalidate = 60;
export const metadata = {
  title: 'Deaf-friendly businesses — PAH',
  description: 'Browse businesses that have booked ASL interpreters through PAH. Ratings come from Deaf clients who had a verified booking.',
};

export default async function BusinessDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; state?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const supabase = svc();

  let query = supabase
    .from('organizations')
    .select('id, name, org_type, city, state, public_slug, avg_rating, rating_count')
    .order('rating_count', { ascending: false });

  if (sp.type) query = query.eq('org_type', sp.type);
  if (sp.state) query = query.eq('state', sp.state.toUpperCase());
  if (sp.q) query = query.ilike('name', `%${sp.q}%`);

  const { data: orgs } = await query.limit(100);
  const list = (orgs ?? []);

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200/70 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
            PAH
          </Link>
          <div className="flex gap-2">
            <Link href="/login" className="text-sm font-medium text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg">
              Log in
            </Link>
            <Link href="/signup" className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-1.5 rounded-lg">
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <header className="mb-8">
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight">
            Deaf-friendly businesses
          </h1>
          <p className="text-slate-600 mt-2 max-w-2xl">
            These businesses have booked ASL interpreters through PAH. Ratings come from
            Deaf clients who attended a verified appointment — no anonymous drive-by
            reviews.
          </p>
        </header>

        {/* Filters — basic for now */}
        <form className="flex flex-wrap gap-2 mb-6" action="/businesses">
          <input
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="Search by name"
            className="flex-1 min-w-[200px] px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <select
            name="type"
            defaultValue={sp.type ?? ''}
            className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm"
          >
            <option value="">All types</option>
            <option value="medical">Medical</option>
            <option value="legal">Legal</option>
            <option value="educational">Educational</option>
            <option value="government">Government</option>
            <option value="corporate">Corporate</option>
          </select>
          <input
            name="state"
            defaultValue={sp.state ?? ''}
            placeholder="State (e.g. TX)"
            maxLength={2}
            className="w-24 px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm uppercase"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium"
          >
            Filter
          </button>
        </form>

        {list.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <p className="font-semibold text-slate-900">No businesses found</p>
            <p className="text-sm text-slate-600 mt-1">Try different filters or check back soon.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((o) => (
              <Link
                key={o.id}
                href={`/businesses/${o.public_slug ?? o.id}`}
                className="block bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-slate-300 hover:shadow-md transition-all"
              >
                <div className="font-semibold text-slate-900">{o.name}</div>
                <div className="text-sm text-slate-600 capitalize mt-0.5">
                  {o.org_type.replace(/_/g, ' ')}
                  {o.city && ` · ${o.city}`}
                  {o.state && `, ${o.state}`}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {o.rating_count && o.rating_count > 0 ? (
                    <>
                      <span className="text-amber-500 font-semibold">
                        ★ {Number(o.avg_rating ?? 0).toFixed(1)}
                      </span>
                      <span className="text-xs text-slate-600">
                        ({o.rating_count} review{o.rating_count === 1 ? '' : 's'})
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">No reviews yet</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
