// buildpad-backend-file: supabase
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
/**
 * Surface tokens for the Role assignment screens, mapped onto the app's design tokens
 * (`--ds-*` in app/globals.css) so the screens follow the app's theme.
 */

import type { CSSProperties } from 'react';

export const COLORS = {
  ink: 'var(--ds-gray-900, #1e293b)',
  body: 'var(--ds-gray-600, #64748b)',
  muted: 'var(--ds-gray-500, #94a3b8)',
  border: 'var(--ds-gray-300, #e2e8f0)',
  surface: 'var(--ds-gray-100, #f8fafc)',
  primary: 'var(--ds-primary, #6366f1)',
  primaryBg: 'var(--ds-primary-100, #e0e7ff)',
  danger: 'var(--ds-danger, #ef4444)',
} as const;

const pill: CSSProperties = {
  padding: '9px 18px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export const primaryPillButton: CSSProperties = {
  ...pill,
  border: `1px solid ${COLORS.primary}`,
  background: COLORS.primary,
  color: '#fff',
};

export const secondaryPillButton: CSSProperties = {
  ...pill,
  border: `1px solid ${COLORS.border}`,
  background: '#fff',
  color: COLORS.ink,
};

export const tableWrap: CSSProperties = {
  border: `1px solid ${COLORS.border}`,
  borderRadius: 12,
  overflow: 'hidden',
  background: '#fff',
};

export const tableHead = (columns: string): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: columns,
  gap: 12,
  padding: '10px 16px',
  background: COLORS.surface,
  color: COLORS.muted,
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.4px',
});

export const tableRow = (columns: string, clickable = false): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: columns,
  gap: 12,
  alignItems: 'center',
  padding: '14px 16px',
  borderTop: `1px solid ${COLORS.border}`,
  cursor: clickable ? 'pointer' : 'default',
});

export const emptyState: CSSProperties = {
  color: COLORS.body,
  fontSize: 13,
  textAlign: 'center',
};

/** The small text-link button used inside banners. */
export const rowAction: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: COLORS.primary,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  textDecoration: 'underline',
};
