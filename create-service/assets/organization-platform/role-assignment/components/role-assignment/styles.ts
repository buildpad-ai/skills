// buildpad-backend-file: supabase
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
/**
 * Role assignment form tokens: the small pieces of the rule form (labels, cards, pills),
 * on getFeedback's design tokens.
 */

import type { CSSProperties } from 'react';
import { COLORS } from './tokens';

/** The small uppercase label above a section ("RULE NAME", "INCLUDE", "ASSIGN THIS ROLE"). */
export const eyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.4px',
  color: COLORS.muted,
};

/** A bordered card, as the rule form sections. */
export const formCard: CSSProperties = {
  border: `1px solid ${COLORS.border}`,
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
  background: '#fff',
};

/** Muted text-link action. */
export const mutedLink: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: COLORS.body,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

/** Outlined pill, e.g. "+ Add inclusion". */
export const outlinePill: CSSProperties = {
  padding: '9px 16px',
  borderRadius: 999,
  border: `1px solid ${COLORS.primary}`,
  background: '#fff',
  color: COLORS.primary,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

/** Primary-coloured text link, e.g. "+ Add condition". */
export const addLink: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: COLORS.primary,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

/** "All" / "Any" segmented pill. */
export const modePill = (on: boolean): CSSProperties => ({
  padding: '5px 14px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  border: `1px solid ${on ? COLORS.primary : COLORS.border}`,
  background: on ? COLORS.primary : '#fff',
  color: on ? '#fff' : COLORS.ink,
});

/** One selectable card in a radio-style list (the role cards). */
export const radioCard = (on: boolean): CSSProperties => ({
  display: 'flex',
  gap: 12,
  alignItems: 'flex-start',
  textAlign: 'left',
  font: 'inherit',
  borderRadius: 8,
  padding: '10px 12px',
  cursor: 'pointer',
  border: 'none',
  background: on ? COLORS.primaryBg : 'transparent',
  width: '100%',
});

export const radioDot = (on: boolean): CSSProperties => ({
  flexShrink: 0,
  marginTop: 2,
  width: 16,
  height: 16,
  borderRadius: 999,
  boxSizing: 'border-box',
  border: on ? `5px solid ${COLORS.primary}` : `1.5px solid ${COLORS.muted}`,
  background: '#fff',
});

/** The pill the tester puts above a result. */
export const rolePill: CSSProperties = {
  display: 'inline-block',
  padding: '2px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  background: COLORS.primaryBg,
  color: 'var(--ds-primary-700, #4338ca)',
  justifySelf: 'start',
};

/** Mantine `styles` that make a Buildpad control match plain bordered fields. */
export const fieldStyles = {
  input: {
    border: '1px solid #c8c8c8',
    borderRadius: 8,
    fontSize: 13,
    color: COLORS.ink,
    minHeight: 'unset',
    height: 'auto',
    padding: '8px 10px',
  },
} as const;
