'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, History, Settings2 } from 'lucide-react';

import { cn } from '@/lib/utils';

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/history', label: 'Historial', icon: History },
  { href: '/settings', label: 'Ajustes', icon: Settings2 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="border-b bg-card/95 backdrop-blur lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between gap-4 px-4 py-3 lg:block lg:p-5">
        <Link href="/dashboard" className="block">
          <p className="text-sm font-semibold text-muted-foreground">Ingenieria de Software</p>
          <h1 className="text-lg font-semibold">Smart Office IoT</h1>
        </Link>

        <nav className="flex gap-1 lg:mt-8 lg:flex-col">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
