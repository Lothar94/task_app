import { describe, expect, it } from 'vitest';
import {
  formatResetLabel,
  formatUpdatedLabel,
  formatUsagePercent,
  subscriptionLabel,
  toPlanUsageView,
  unavailableReasonLabel,
  usageLevel,
} from './planUsageModel';
import { NOW, planUsage, unavailable } from './planUsageFixtures';

describe('usageLevel', () => {
  it.each([
    [0, 'ok'],
    [69.9, 'ok'],
    [70, 'warning'],
    [89.9, 'warning'],
    [90, 'critical'],
    [100, 'critical'],
  ])('%s %% is %s', (utilization, level) => {
    expect(usageLevel(utilization)).toBe(level);
  });
});

describe('formatUsagePercent', () => {
  it('rounds to an integer percent', () => {
    expect(formatUsagePercent(85.6)).toBe('86 %');
    expect(formatUsagePercent(0)).toBe('0 %');
  });
});

describe('formatResetLabel', () => {
  const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
  const minutes = (count: number) => count * 60_000;

  it('counts down hours and minutes within a day', () => {
    expect(formatResetLabel(at(minutes(135)), NOW)).toBe('se reinicia en 2 h 15 min');
    expect(formatResetLabel(at(minutes(120)), NOW)).toBe('se reinicia en 2 h');
    expect(formatResetLabel(at(minutes(45)), NOW)).toBe('se reinicia en 45 min');
  });

  it('rounds partial minutes up', () => {
    expect(formatResetLabel(at(30_000), NOW)).toBe('se reinicia en 1 min');
  });

  it('gives weekday, day and time when it is a day or more away', () => {
    expect(formatResetLabel(at(minutes(60 * 24 * 4)), NOW)).toMatch(/^se reinicia el [a-záéíóú]+ \d{1,2}, \d{2}:\d{2}$/);
  });

  it('says it resets now once the instant has passed', () => {
    expect(formatResetLabel(at(-1000), NOW)).toBe('se reinicia ahora');
  });

  it('is null when the reset is unknown or invalid', () => {
    expect(formatResetLabel(null, NOW)).toBeNull();
    expect(formatResetLabel('nope', NOW)).toBeNull();
  });
});

describe('formatUpdatedLabel', () => {
  it('is relative to now', () => {
    expect(formatUpdatedLabel('2026-10-23T11:57:00.000Z', NOW)).toBe('actualizado hace 3 minutos');
  });

  it('is null when never read', () => {
    expect(formatUpdatedLabel(null, NOW)).toBeNull();
  });
});

describe('copy', () => {
  it('explains every unavailable reason in Spanish', () => {
    expect(unavailableReasonLabel('no_credentials')).toBe('Sin sesión de Claude en esta máquina');
    expect(unavailableReasonLabel('expired_credentials')).toBe(
      'Credenciales de Claude caducadas: abre Claude Code para renovarlas',
    );
    expect(unavailableReasonLabel('upstream_error')).toBe('No se pudo consultar el uso de Claude');
  });

  it('capitalizes the subscription type', () => {
    expect(subscriptionLabel('max')).toBe('Plan Max');
  });
});

describe('toPlanUsageView', () => {
  it('is pending until there is an answer', () => {
    expect(toPlanUsageView(undefined, false)).toBeNull();
  });

  it('exposes an available snapshot', () => {
    const usage = planUsage();
    expect(toPlanUsageView(usage, false)).toEqual({ kind: 'available', usage });
  });

  it('carries the reason of an unavailable snapshot', () => {
    expect(toPlanUsageView(unavailable('no_credentials'), false)).toEqual({
      kind: 'unavailable',
      reason: 'no_credentials',
    });
  });

  it('treats a failed request as an upstream error', () => {
    expect(toPlanUsageView(undefined, true)).toEqual({ kind: 'unavailable', reason: 'upstream_error' });
  });
});
