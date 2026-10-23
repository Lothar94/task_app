// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NOW } from './planUsageFixtures';
import { UsageBar } from './UsageBar';

afterEach(cleanup);

const mount = (utilization: number, resetsAt: string | null = '2026-10-23T14:15:00.000Z') =>
  render(<UsageBar label="Sesión (5 h)" window={{ utilization, resetsAt }} now={NOW} />);

describe('UsageBar', () => {
  it('exposes the rounded value as a meter', () => {
    mount(85.6);
    const meter = screen.getByRole('meter', { name: 'Sesión (5 h)' });
    expect(meter.getAttribute('aria-valuenow')).toBe('86');
    expect(meter.getAttribute('aria-valuemin')).toBe('0');
    expect(meter.getAttribute('aria-valuemax')).toBe('100');
    expect(screen.getByText('86 %')).toBeTruthy();
  });

  it('shows when the window resets', () => {
    mount(10);
    expect(screen.getByText('se reinicia en 2 h 15 min')).toBeTruthy();
  });

  it('omits the reset label when unknown', () => {
    mount(10, null);
    expect(screen.queryByText(/se reinicia/)).toBeNull();
  });

  it.each([
    [20, 'ok', 'bg-success'],
    [75, 'warning', 'bg-warning'],
    [95, 'critical', 'bg-danger'],
  ])('%s %% is %s and filled with %s', (utilization, level, fillClass) => {
    mount(utilization);
    const meter = screen.getByRole('meter');
    expect(meter.getAttribute('data-level')).toBe(level);
    expect(meter.firstElementChild?.className).toContain(fillClass);
    expect((meter.firstElementChild as HTMLElement).style.width).toBe(`${utilization}%`);
  });
});
