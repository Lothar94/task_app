// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { totals } from './dashboardFixtures';
import { Headline } from './Headline';

afterEach(cleanup);

describe('Headline', () => {
  it('shows cost with cache savings, success rate and agent time per task', () => {
    render(<Headline totals={totals()} previous={null} />);
    expect(screen.getByText('según tarifas de la API')).toBeTruthy();
    expect(screen.getByText('Ahorro caché').nextSibling?.textContent).toMatch(/^−30,00/);
    expect(screen.getByText('80 %')).toBeTruthy();
    // 600 s over 10 tasks.
    expect(screen.getByText('Promedio/tarea').nextSibling?.textContent).toBe('1 min');
    expect(screen.getByText('12 ejecuciones')).toBeTruthy();
  });

  it('hides every delta without a previous period', () => {
    render(<Headline totals={totals()} previous={null} />);
    expect(screen.queryByText(/vs periodo ant\./)).toBeNull();
  });

  it('shows a delta on every tile against the previous period', () => {
    const previous = totals({
      completed: 4,
      failed: 4,
      successRate: 0.5,
      totalTokens: 21_000,
      costUsd: 8,
      agentTimeMs: 400_000,
    });
    render(<Headline totals={totals()} previous={previous} />);
    const deltas = screen.getAllByText(/vs periodo ant\./).map((node) => node.textContent);
    expect(deltas).toEqual([
      '+100 % vs periodo ant.',
      '−50 % vs periodo ant.',
      '+30 pts vs periodo ant.',
      '−50 % vs periodo ant.',
      '+25 % vs periodo ant.',
      '+50 % vs periodo ant.',
    ]);
  });

  it('hides the delta whose base is zero', () => {
    render(<Headline totals={totals()} previous={totals({ failed: 0 })} />);
    expect(screen.getAllByText(/vs periodo ant\./)).toHaveLength(5);
  });
});
