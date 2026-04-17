import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/ui';
import { CERT_LABELS } from '@/types';
import type { CertificationType } from '@/types';
import CertReviewCard from './CertReviewCard';

export default async function AdminCertificationsPage() {
  const supabase = await createClient();

  const { data: certs } = await supabase
    .from('certifications')
    .select(`
      id, cert_type, cert_number, cert_category, cert_other_description,
      issued_date, expiry_date, document_url, verification_status, created_at,
      interpreter:interpreter_profiles(
        id,
        user_id,
        years_experience,
        specializations,
        bio,
        headline,
        profile_photo_url,
        profile:profiles!interpreter_profiles_user_id_fkey(full_name, email)
      )
    `)
    .eq('verification_status', 'pending')
    .order('created_at', { ascending: true });

  const certifications = (certs || []) as unknown as Array<{
    id: string;
    cert_type: CertificationType;
    cert_number: string | null;
    cert_category: string | null;
    cert_other_description: string | null;
    issued_date: string | null;
    expiry_date: string | null;
    document_url: string | null;
    created_at: string;
    interpreter: {
      id: string;
      user_id: string;
      years_experience: number;
      specializations: string[];
      bio: string | null;
      headline: string | null;
      profile_photo_url: string | null;
      profile: { full_name: string; email: string };
    } | null;
  }>;

  return (
    <div>
      <PageHeader
        title="Pending certifications"
        subtitle={`${certifications.length} awaiting review`}
      />

      {certifications.length === 0 ? (
        <EmptyState
          title="No pending certifications"
          subtitle="When interpreters upload certs, they'll appear here for review."
        />
      ) : (
        <div className="space-y-4">
          {certifications.map((cert) => (
            <CertReviewCard
              key={cert.id}
              cert={{
                id: cert.id,
                cert_type: cert.cert_type,
                cert_type_label: CERT_LABELS[cert.cert_type] || cert.cert_type,
                cert_number: cert.cert_number,
                cert_other_description: cert.cert_other_description,
                issued_date: cert.issued_date,
                expiry_date: cert.expiry_date,
                document_url: cert.document_url,
                submitted_at: cert.created_at,
                interpreter_name: cert.interpreter?.profile?.full_name ?? 'Unknown',
                interpreter_email: cert.interpreter?.profile?.email ?? '',
                interpreter_years: cert.interpreter?.years_experience ?? 0,
                interpreter_headline: cert.interpreter?.headline ?? null,
                interpreter_photo: cert.interpreter?.profile_photo_url ?? null,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
