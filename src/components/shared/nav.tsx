'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useRef, useState } from 'react';
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
    { href: '/preferences', label: 'Preferences' },
  ],
  interpreter: [
    { href: '/interpreter/dashboard', label: 'Dashboard' },
    { href: '/interpreter/feed', label: 'Feed' },
    { href: '/interpreter/jobs', label: 'My Jobs' },
    { href: '/interpreter/profile', label: 'Profile' },
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
  platform_admin: [
    { href: '/admin', label: 'Admin' },
    { href: '/admin/certifications', label: 'Certifications' },
    { href: '/admin/business-requests', label: 'Business requests' },
  ],
};

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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
        const roles = (data.roles ?? []) as UserRole[];
        setIsAdmin(roles.includes('platform_admin'));
        // Pick primary non-admin role first; fall back to platform_admin if that's all they have.
        const primary = roles.find((r) => r !== 'platform_admin') ?? roles[0];
        if (primary) setRole(primary);
      }
    });
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Click-outside and escape to close
  useEffect(() => {
    if (!mobileOpen) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [mobileOpen]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  const roleLinks = role ? NAV_LINKS[role] : [];
  const links =
    isAdmin && role !== 'platform_admin'
      ? [...roleLinks, { href: '/admin', label: 'Admin' }]
      : roleLinks;
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
              <span className="hidden sm:inline text-xs font-medium text-slate-600 border-l border-slate-200 pl-2">
                finally, in ASL
              </span>
            </Link>
            {/* Desktop links */}
            <div className="hidden md:flex items-center gap-0.5">
              {links.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {userName && (
              <div className="hidden sm:flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-semibold flex items-center justify-center shadow-sm"
                  aria-hidden="true"
                >
                  {initials || 'U'}
                </div>
                <span className="text-sm font-medium text-slate-800">{userName}</span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="hidden md:inline-block text-sm font-medium text-slate-700 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Log out
            </button>
            {/* Mobile menu toggle */}
            {role && (
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                aria-expanded={mobileOpen}
                aria-controls="mobile-nav-panel"
                aria-label="Toggle navigation menu"
                className="md:hidden w-10 h-10 inline-flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
              >
                {mobileOpen ? (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile panel */}
      {mobileOpen && role && (
        <div
          ref={panelRef}
          id="mobile-nav-panel"
          className="md:hidden border-t border-slate-200 bg-white shadow-lg animate-fade-in"
        >
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            {userName && (
              <div className="flex items-center gap-3 pb-3 mb-2 border-b border-slate-100">
                <div
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-sm font-semibold flex items-center justify-center shadow-sm"
                  aria-hidden="true"
                >
                  {initials || 'U'}
                </div>
                <div className="text-sm font-medium text-slate-900">{userName}</div>
              </div>
            )}
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              className="w-full text-left block px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
