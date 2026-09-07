'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { getRoomConfig, getSecurityAudits } from '@/services/sensors.service';
import type { AccessAudit, RoomConfig, RoomMode } from '@/types/sensor.types';

/* ── Mode cycle (mirrors backend auth_controller.py) ── */
const MODE_CYCLE: Record<RoomMode, RoomMode> = {
  Normal: 'Meeting',
  Meeting: 'Energy Saving',
  'Energy Saving': 'Normal',
};

export type AccessEventType = 'success' | 'failure';

export interface AccessEvent {
  /** Unique key for React rendering & dismissal. */
  id: string;
  type: AccessEventType;
  audit: AccessAudit;
  /** Mode *before* the successful auth (only on success). */
  oldMode?: RoomMode;
  /** Mode *after* the successful auth (only on success). */
  newMode?: RoomMode;
  timestamp: number;
}

export interface UseAccessMonitoringResult {
  /** Active notification events (auto-dismissed or manually dismissed). */
  events: AccessEvent[];
  /** Latest audit rows from the security-logs endpoint. */
  latestAudits: AccessAudit[];
  /** Latest room config (kept in sync every poll cycle). */
  latestConfig: RoomConfig | null;
  /** Remove a specific event by id (e.g. user clicks dismiss). */
  dismissEvent: (id: string) => void;
}

/**
 * Polls `/api/dashboard/security-logs` and `/api/config` every `intervalMs` ms.
 *
 * On first load the hook seeds its internal "seen" set without emitting events.
 * On subsequent polls it detects new audit entries and fires `AccessEvent`s:
 * - `failure` — a PIN attempt failed (toast notification).
 * - `success` — a PIN attempt succeeded; includes the mode transition
 *   computed from the deterministic cycle `Normal → Meeting → Energy Saving → …`.
 */
export function useAccessMonitoring(intervalMs = 3000): UseAccessMonitoringResult {
  const [events, setEvents] = useState<AccessEvent[]>([]);
  const [latestAudits, setLatestAudits] = useState<AccessAudit[]>([]);
  const [latestConfig, setLatestConfig] = useState<RoomConfig | null>(null);

  const seenIdsRef = useRef<Set<number>>(new Set());
  const currentModeRef = useRef<RoomMode | null>(null);
  const initialLoadRef = useRef(true);

  useEffect(() => {
    let mounted = true;

    async function poll() {
      try {
        const [audits, config] = await Promise.all([
          getSecurityAudits(),
          getRoomConfig(),
        ]);

        if (!mounted) return;

        setLatestAudits(audits);
        setLatestConfig(config);

        /* ── First load: seed state without firing events ── */
        if (initialLoadRef.current) {
          for (const audit of audits) {
            seenIdsRef.current.add(audit.id);
          }
          currentModeRef.current = config.current_mode;
          initialLoadRef.current = false;
          return;
        }

        /* ── Detect new audit entries ── */
        const newAudits = audits
          .filter((a) => !seenIdsRef.current.has(a.id))
          .sort((a, b) => a.id - b.id); // process chronologically

        if (newAudits.length === 0) {
          // Keep mode in sync even without new audits (e.g. settings page change)
          currentModeRef.current = config.current_mode;
          return;
        }

        const incoming: AccessEvent[] = [];

        for (const audit of newAudits) {
          seenIdsRef.current.add(audit.id);

          if (audit.is_success) {
            const oldMode = currentModeRef.current ?? 'Normal';
            const newMode = MODE_CYCLE[oldMode] ?? 'Meeting';
            currentModeRef.current = newMode;

            incoming.push({
              id: `access-${audit.id}-${Date.now()}`,
              type: 'success',
              audit,
              oldMode,
              newMode,
              timestamp: Date.now(),
            });
          } else {
            incoming.push({
              id: `access-${audit.id}-${Date.now()}`,
              type: 'failure',
              audit,
              timestamp: Date.now(),
            });
          }
        }

        if (incoming.length > 0) {
          setEvents((prev) => [...prev, ...incoming]);
        }
      } catch {
        // Silently skip polling errors — the main sensor poller already shows errors.
      }
    }

    void poll();
    const intervalId = window.setInterval(poll, intervalMs);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [intervalMs]);

  const dismissEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { events, latestAudits, latestConfig, dismissEvent };
}
