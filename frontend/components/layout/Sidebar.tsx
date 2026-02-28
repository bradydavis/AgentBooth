'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/history', label: 'Call History' },
  { href: '/dashboard/settings', label: 'Settings' },
  { href: '/upgrade', label: 'Upgrade' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r bg-white flex flex-col">
      <div className="p-6 border-b">
        <h1 className="font-bold text-lg">AgentBooth</h1>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'block px-3 py-2 rounded-md text-sm transition-colors',
              pathname === item.href
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
