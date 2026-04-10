import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function CertificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: interpProfile } = await supabase
    .from('interpreter_profiles')
    .select('id, experience_tier, hourly_rate_cents, years_experience')
    .eq('user_id', user.id)
    .single();

  if (!interpProfile) redirect('/interpreter/onboarding');

  const { data: certs } = await supabase
    .from('certifications')
    .select('*')
    .eq('interpreter_id', interpProfile.id)
    .order('created_at', { ascending: false });

  const tierLabel: Record<string, string> = {
    provisional: 'Provisional',
    certified: 'Certified',
    advanced: 'Advanced',
    expert: 'Expert',
  };

  const statusStyles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    verified: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-800',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Certifications</h1>

      {/* Tier Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <h3 className="font-medium text-blue-800">Your Experience Tier</h3>
        <p className="text-lg font-bold text-blue-900 mt-1">
          {tierLabel[interpProfile.experience_tier] || 'Provisional'}
        </p>
        <p className="text-sm text-blue-600 mt-1">
          Based on {interpProfile.years_experience} years of experience and your certifications.
          Rate: ${(interpProfile.hourly_rate_cents / 100).toFixed(2)}/hr
        </p>
        <p className="text-xs text-blue-500 mt-2">
          Your tier is automatically calculated from your certifications and experience.
          Higher certifications and more experience = higher tier and pay.
        </p>
      </div>

      {/* Certs List */}
      {!certs || certs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-600 mb-2">No certifications uploaded</p>
          <p className="text-sm text-gray-600">
            Upload your certifications during onboarding to get verified.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {certs.map((cert) => (
            <div key={cert.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{cert.cert_type.replace(/_/g, ' ')}</h3>
                  {cert.cert_number && (
                    <p className="text-sm text-gray-600 mt-0.5">#{cert.cert_number}</p>
                  )}
                  {cert.issued_date && (
                    <p className="text-xs text-gray-600 mt-1">
                      Issued: {new Date(cert.issued_date).toLocaleDateString()}
                      {cert.expiry_date && ` — Expires: ${new Date(cert.expiry_date).toLocaleDateString()}`}
                    </p>
                  )}
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[cert.verification_status]}`}>
                  {cert.verification_status}
                </span>
              </div>
              {cert.document_url && (
                <a
                  href={cert.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline mt-2 inline-block"
                >
                  View document
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
