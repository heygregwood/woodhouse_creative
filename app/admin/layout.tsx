'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/posts', label: 'Posts' },
  { href: '/admin/scheduling', label: 'Scheduling' },
  { href: '/admin/content-dealers', label: 'Content Dealers' },
  { href: '/admin/dealer-review', label: 'Dealer Review' },
  { href: '/admin/email-templates', label: 'Email Templates' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-page">
      {/* Header */}
      <header className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-8">
          {/* Logo Row */}
          <div className="flex items-center gap-3 py-4">
            <img
              src="/Logo/WOODHOUSE%20LOGO%20HORIZONTAL.png"
              alt="Woodhouse"
              className="h-10"
            />
          </div>
          {/* Tab Navigation */}
          <nav className="flex gap-6">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`pb-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-brand border-b-2 border-brand'
                      : 'text-text hover:text-brand'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Page Content */}
      <main>{children}</main>
    </div>
  );
}
