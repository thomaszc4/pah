import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/ui';
import ReviewModerationCard from './ReviewModerationCard';

export default async function AdminReviewsPage() {
  const supabase = await createClient();

  const { data: reviews } = await supabase
    .from('organization_ratings')
    .select(`
      id, overall_rating, review_text, attributes, is_visible, flagged_for_review,
      admin_action, admin_notes, created_at,
      organization:organizations(id, name),
      rated_by_profile:profiles!organization_ratings_rated_by_fkey(full_name, email)
    `)
    .eq('flagged_for_review', true)
    .order('created_at', { ascending: true });

  const items = (reviews ?? []) as unknown as Array<{
    id: string;
    overall_rating: number;
    review_text: string | null;
    attributes: Record<string, boolean>;
    is_visible: boolean;
    admin_action: string | null;
    admin_notes: string | null;
    created_at: string;
    organization: { id: string; name: string } | null;
    rated_by_profile: { full_name: string; email: string } | null;
  }>;

  return (
    <div>
      <PageHeader
        title="Flagged reviews"
        subtitle={`${items.length} awaiting moderation`}
      />

      {items.length === 0 ? (
        <EmptyState
          title="No flagged reviews"
          subtitle="Users or businesses can flag a review as inappropriate. Flagged items show up here for you to moderate."
        />
      ) : (
        <div className="space-y-4">
          {items.map((r) => (
            <ReviewModerationCard
              key={r.id}
              review={{
                id: r.id,
                organization_id: r.organization?.id ?? '',
                organization_name: r.organization?.name ?? 'Unknown',
                rater_name: r.rated_by_profile?.full_name ?? 'Unknown',
                rater_email: r.rated_by_profile?.email ?? '',
                overall_rating: r.overall_rating,
                review_text: r.review_text,
                is_visible: r.is_visible,
                admin_action: r.admin_action,
                admin_notes: r.admin_notes,
                created_at: r.created_at,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
