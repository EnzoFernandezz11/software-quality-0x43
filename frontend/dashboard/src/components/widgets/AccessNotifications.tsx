'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ShieldCheck, ShieldX, X } from 'lucide-react';

import { formatMode } from '@/lib/utils';
import type { AccessEvent } from '@/hooks/useAccessMonitoring';

/* ═══════════════════════════════════════════════════════════
   Error Toast — slides in from the right, shakes, auto-dismiss
   ═══════════════════════════════════════════════════════════ */

function ErrorToast({
  onDismiss,
}: {
  event: AccessEvent;
  onDismiss: () => void;
}) {
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onDismiss, 300);
    }, 4000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className={isExiting ? 'access-toast-exit' : 'access-toast-enter'}
      style={{
        backgroundColor: 'var(--color-danger-bg)',
        border: '1px solid var(--color-danger-fg)',
        borderRadius: '0.75rem',
        padding: '0.875rem 1rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        maxWidth: '22rem',
        width: '100%',
        boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Auto-dismiss progress bar */}
      <div
        className="access-toast-progress"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '3px',
          backgroundColor: 'var(--color-danger-fg)',
          borderRadius: '0 0 0 0.75rem',
          opacity: 0.5,
        }}
      />

      {/* Icon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '2.25rem',
          height: '2.25rem',
          borderRadius: '0.625rem',
          backgroundColor: 'var(--color-danger-fg)',
          color: 'white',
          flexShrink: 0,
          boxShadow: '0 2px 8px oklch(0.40 0.16 25 / 0.3)',
        }}
      >
        <ShieldX className="size-4" />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          className="card-title"
          style={{ fontSize: '0.8rem', color: 'var(--color-danger-fg)' }}
        >
          Código incorrecto
        </p>
        <p
          className="kpi-detail"
          style={{
            color: 'var(--color-danger-fg)',
            opacity: 0.8,
            marginTop: '2px',
          }}
        >
          Acceso denegado — Intento registrado
        </p>
      </div>

      {/* Close */}
      <button
        onClick={handleDismiss}
        aria-label="Cerrar notificación"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.25rem',
          color: 'var(--color-danger-fg)',
          opacity: 0.5,
          flexShrink: 0,
          borderRadius: '0.375rem',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = '0.5';
        }}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Success Modal — centered overlay with mode transition
   ═══════════════════════════════════════════════════════════ */

function SuccessModal({
  event,
  onDismiss,
}: {
  event: AccessEvent;
  onDismiss: () => void;
}) {
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onDismiss, 350);
    }, 6000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    setTimeout(onDismiss, 350);
  };

  return (
    <div
      className={isExiting ? 'access-modal-exit' : 'access-modal-enter'}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'oklch(0 0 0 / 40%)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        padding: '1rem',
      }}
      onClick={handleDismiss}
    >
      <div
        className={isExiting ? '' : 'access-modal-card-enter'}
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--card)',
          borderRadius: '1.125rem',
          border: '1px solid var(--border)',
          maxWidth: '24rem',
          width: '100%',
          overflow: 'hidden',
          boxShadow:
            '0 24px 64px rgba(0,0,0,0.18), 0 8px 20px rgba(0,0,0,0.1)',
          position: 'relative',
        }}
      >
        {/* Gradient accent bar */}
        <div
          style={{
            height: '4px',
            background:
              'linear-gradient(135deg, var(--title-accent-from), var(--title-accent-to))',
          }}
        />

        <div style={{ padding: '2rem 1.5rem 1.5rem' }}>
          {/* Icon */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '1.25rem',
            }}
          >
            <div
              className="access-success-icon"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '3.75rem',
                height: '3.75rem',
                borderRadius: '1.125rem',
                background:
                  'linear-gradient(135deg, var(--title-accent-from), var(--title-accent-to))',
                color: 'white',
                boxShadow: '0 6px 20px oklch(0.50 0.18 265 / 0.35)',
              }}
            >
              <ShieldCheck className="size-7" />
            </div>
          </div>

          {/* Title */}
          <h3
            className="card-title"
            style={{
              textAlign: 'center',
              fontSize: '1.15rem',
              marginBottom: '0.375rem',
            }}
          >
            Modo actualizado
          </h3>
          <p
            className="kpi-detail"
            style={{ textAlign: 'center', marginBottom: '1.5rem' }}
          >
            Autenticación exitosa — El modo de sala ha cambiado
          </p>

          {/* Mode transition display */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              padding: '1.125rem 1rem',
              backgroundColor: 'var(--muted)',
              borderRadius: '0.875rem',
              marginBottom: '1.5rem',
              border: '1px solid var(--border)',
            }}
          >
            {/* Old mode */}
            <div style={{ textAlign: 'center', flex: 1 }}>
              <p
                className="section-label"
                style={{ fontSize: '0.55rem', marginBottom: '0.375rem' }}
              >
                Anterior
              </p>
              <p
                className="kpi-value"
                style={{
                  fontSize: '1.05rem',
                  color: 'var(--muted-foreground)',
                }}
              >
                {formatMode(event.oldMode)}
              </p>
            </div>

            {/* Animated arrow */}
            <div
              className="access-arrow-bounce"
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '2rem',
                height: '2rem',
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)',
                boxShadow: '0 2px 8px oklch(0.50 0.18 265 / 0.2)',
              }}
            >
              <ArrowRight className="size-4" />
            </div>

            {/* New mode */}
            <div style={{ textAlign: 'center', flex: 1 }}>
              <p
                className="section-label"
                style={{ fontSize: '0.55rem', marginBottom: '0.375rem' }}
              >
                Nuevo
              </p>
              <p
                className="kpi-value"
                style={{
                  fontSize: '1.05rem',
                  background:
                    'linear-gradient(135deg, var(--title-accent-from), var(--title-accent-to))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {formatMode(event.newMode)}
              </p>
            </div>
          </div>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="access-dismiss-btn"
            style={{
              display: 'block',
              width: '100%',
              padding: '0.7rem 1rem',
              borderRadius: '0.625rem',
              border: 'none',
              background:
                'linear-gradient(135deg, var(--title-accent-from), var(--title-accent-to))',
              color: 'white',
              fontSize: '0.8rem',
              fontWeight: 700,
              fontFamily:
                'var(--font-jakarta), "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
              letterSpacing: '-0.01em',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 10px oklch(0.50 0.18 265 / 0.3)',
            }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Container — renders error toasts + success modal
   ═══════════════════════════════════════════════════════════ */

export function AccessNotifications({
  events,
  onDismiss,
}: {
  events: AccessEvent[];
  onDismiss: (id: string) => void;
}) {
  const errorEvents = events.filter((e) => e.type === 'failure');
  const successEvents = events.filter((e) => e.type === 'success');
  const latestSuccess = successEvents.length > 0
    ? successEvents[successEvents.length - 1]
    : null;

  return (
    <>
      {/* Error toasts — stacked in top-right corner (max 3 visible) */}
      {errorEvents.length > 0 && (
        <div
          id="access-error-toasts"
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            zIndex: 90,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.625rem',
            pointerEvents: 'none',
          }}
        >
          {errorEvents.slice(-3).map((event) => (
            <div key={event.id} style={{ pointerEvents: 'auto' }}>
              <ErrorToast
                event={event}
                onDismiss={() => onDismiss(event.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Success modal — shows the latest mode transition */}
      {latestSuccess && (
        <SuccessModal
          key={latestSuccess.id}
          event={latestSuccess}
          onDismiss={() => onDismiss(latestSuccess.id)}
        />
      )}
    </>
  );
}
