import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership } = await supabase
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .single();

  if (!membership) redirect('/business/onboarding');

  const { data: members } = await supabase
    .from('organization_members')
    .select('id, role, created_at, profiles:user_id(full_name, email)')
    .eq('org_id', membership.org_id)
    .order('created_at', { ascending: true });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Team</h1>
        {membership.role === 'owner' && (
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Invite Member
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Name</th>
              <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Email</th>
              <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Role</th>
              <th className="text-left text-sm font-medium text-gray-600 px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {(members || []).map((m) => {
              const profile = m.profiles as unknown as Record<string, string> | null;
              return (
                <tr key={m.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-sm font-medium">{profile?.full_name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{profile?.email || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(m.created_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
