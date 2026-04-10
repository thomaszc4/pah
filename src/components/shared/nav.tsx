'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import type { UserRole } from '@/types';

interface NavLink {
  href: string;
  label: string;
}

const NAV_LINKS: Record<UserRole, NavLink[]> = {
  deaf_user: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/book', label: 'Book Interpreter' },
    { href: '/bookings', label: 'My Bookings' },
  ],
  interpreter: [
    { href: '/interpreter/dashboard', label: 'Dashboard' },
    { href: '/interpreter/jobs', label: 'Available Jobs' },
    { href: '/interpreter/schedule', label: 'Schedule' },
    { href: '/interpreter/earnings', label: 'Earnings' },
    { href: '/interpreter/certifications', label: 'Certifications' },
  ],
  business_admin: [
    { href: '/business/dashboard', label: 'Dashboard' },
    { href: '/business/book', label: 'Book Interpreter' },
    { href: '/business/bookings', label: 'Bookings' },
    { href: '/business/billing', label: 'Billing' },
    { href: '/business/team', label: 'Team' },
  ],
};

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('roles, full_name')
        .eq('id', user.id)
        .single();
      if (data) {
        setUserName(data.full_name);
        if (data.roles && data.roles.length > 0) {
          setRole(data.roles[0] as UserRole);
        }
      }
    });
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  const links = role ? NAV_LINKS[role] : [];
  const initials = (userName || '')
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-6 sm:gap-8">
            <Link
              href="/"
              className="flex items-center gap-2 font-semibold tracking-tight text-slate-900 text-lg"
            >
              PAH
              <span className="hidden sm:inline text-xs font-medium text-slate-400 border-l border-slate-200 pl-2">
                finally, in ASL
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-0.5">
              {links.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {userName && (
              <div className="hidden sm:flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-semibold flex items-center justify-center shadow-sm"
                  aria-label={userName}
                >
                  {initials || 'U'}
                </div>
                <span className="text-sm font-medium text-slate-700">{userName}</span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-slate-500 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
