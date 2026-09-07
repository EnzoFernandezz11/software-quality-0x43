'use client';

import { ShieldCheck, ShieldX } from 'lucide-react';

import { cn, formatDateTime, formatMode } from '@/lib/utils';
import type { ActivityFeedProps } from '@/types/sensor.types';

export function ActivityFeed({ audits }: ActivityFeedProps) {
  return (
    <section className="flex flex-col rounded-xl border border-border/40 bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="section-label">Strategy pattern: auth log</p>
          <h2 className="card-title mt-0.5">Bitácora de accesos</h2>
        </div>
        <span className="pill-badge">Strategy</span>
      </div>

      {audits.length > 0 ? (
        <div className="divide-y divide-border/50 overflow-y-auto" style={{ maxHeight: '18rem' }}>
          {audits.slice(0, 8).map((audit) => {
            const Icon = audit.is_success ? ShieldCheck : ShieldX;

            return (
              <div key={audit.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <span
                  className={cn(
                    'mt-0.5 rounded-md p-1.5',
                    audit.is_success
                      ? 'text-[var(--color-success-fg)]'
                      : 'text-[var(--color-danger-fg)]',
                  )}
                  style={{
                    backgroundColor: audit.is_success
                      ? 'var(--color-success-bg)'
                      : 'var(--color-danger-bg)',
                  }}
                >
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">
                    {audit.is_success ? 'Acceso concedido' : 'Acceso rechazado'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {audit.strategy_used} — {formatMode(audit.current_mode)}
                  </p>
                </div>
                <time className="text-right text-[10px] text-muted-foreground">
                  {formatDateTime(audit.created_at)}
                </time>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          Sin intentos registrados.
        </div>
      )}
    </section>
  );
}
