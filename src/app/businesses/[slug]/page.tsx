import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { RATING_ATTRIBUTES } from '@/types';

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export const revalidate = 60;

export default async function BusinessPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = svc();

  // Slug may be actual slug OR the raw UUID for backwards compatibility
  const orgQuery = supabase
    .from('organizations')
    .select(`
      id, name, org_type, city, state, website, address_line1, public_slug,
      avg_rating, rating_count, accessibility_summary
    `);

  const { data: org } = await (slug.includes('-') && slug.length !== 36
    ? orgQuery.eq('public_slug', slug).maybeSingle()
    : orgQuery.eq('id', slug).maybeSingle());

  if (!org) return notFound();

  const { data: ratings } = await supabase
    .from('organization_ratings')
    .select('id, overall_rating, attributes, review_text, business_response, business_response_at, created_at')
    .eq('organization_id', org.id)
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
    .limit(50);

  // Aggregate attribute percentages (how many reviews flagged each)
  const attrSummary: Record<string, { yes: number; total: number }> = {};
  for (const r of ratings ?? []) {
    const attrs = (r.attributes ?? {}) as Record<string, boolean>;
    for (const { key } of RATING_ATTRIBUTES) {
      attrSummary[key] = attrSummary[key] ?? { yes: 0, total: 0 };
      if (key in attrs) {
        attrSummary[key].total += 1;
        if (attrs[key]) attrSummary[key].yes += 1;
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200/70 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
            PAH
          </Link>
          <Link
            href="/businesses"
            className="text-sm text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg"
          >
            ← All businesses
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 mb-6">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-600">
            {org.org_type.replace(/_/g, ' ')}
          </div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight mt-1">{org.name}</h1>
          <div className="text-sm text-slate-700 mt-2">
            {org.address_line1 ? `${org.address_line1}, ` : ''}
            {org.city}
            {org.state && `, ${org.state}`}
          </div>
          <div className="mt-4 flex items-center gap-3">
            {org.rating_count && org.rating_count > 0 ? (
              <>
                <span className="text-2xl text-amber-500 font-semibold">
                  ★ {Number(org.avg_rating ?? 0).toFixed(1)}
                </span>
                <span className="text-sm text-slate-600">
                  {org.rating_count} review{org.rating_count === 1 ? '' : 's'} from Deaf clients
                </span>
              </>
            ) : (
              <span className="text-sm text-slate-600">
                No reviews yet
              </span>
            )}
          </div>
          {org.website && (
            <a
              href={org.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-sm font-medium text-blue-700 hover:text-blue-800 underline underline-offset-4"
            >
              Visit website →
            </a>
          )}
        </div>

        {(ratings?.length ?? 0) > 0 && (
          <>
            {/* Attribute summary */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                What Deaf clients say about this place
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {RATING_ATTRIBUTES.map((attr) => {
                  const s = attrSummary[attr.key];
                  if (!s || s.total === 0) return null;
                  const pct = Math.round((s.yes / s.total) * 100);
                  const goodSignal = attr.positive ? pct : 100 - pct;
                  const color =
                    goodSignal >= 70
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : goodSignal >= 40
                      ? 'text-slate-700 bg-slate-50 border-slate-200'
                      : 'text-rose-700 bg-rose-50 border-rose-200';
                  return (
                    <div key={attr.key} className={`flex justify-between items-center border rounded-xl px-3 py-2 text-sm ${color}`}>
                      <span>{attr.label}</span>
                      <span className="font-semibold">{pct}%</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Percentages reflect the share of reviews where each attribute was endorsed.
              </p>
            </div>

            {/* Individual reviews */}
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Reviews</h2>
            <div className="space-y-4">
              {ratings!.map((r) => (
                <div key={r.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-amber-500 font-semibold">
                      {'★'.repeat(r.overall_rating)}
                      <span className="text-slate-300">{'★'.repeat(5 - r.overall_rating)}</span>
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(r.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </span>
                  </div>
                  {r.review_text && (
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{r.review_text}</p>
                  )}
                  {r.business_response && (
                    <div className="mt-3 pl-4 border-l-2 border-slate-200">
                      <div className="text-xs font-semibold text-slate-700">
                        Response from {org.name}
                      </div>
                      <p className="text-sm text-slate-700 mt-0.5">{r.business_response}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
