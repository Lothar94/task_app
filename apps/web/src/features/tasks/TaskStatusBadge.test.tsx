import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { STATUS_PRESENTATION, TaskStatusBadge } from './TaskStatusBadge';

describe('STATUS_PRESENTATION', () => {
  it('maps task states to chip tones', () => {
    expect(STATUS_PRESENTATION.completed.tone).toBe('success');
    expect(STATUS_PRESENTATION.running).toEqual({ tone: 'info', pulse: true });
    expect(STATUS_PRESENTATION.waiting_subtasks.tone).toBe('warning');
    expect(STATUS_PRESENTATION.queued.tone).toBe('warning');
    expect(STATUS_PRESENTATION.failed.tone).toBe('danger');
    expect(STATUS_PRESENTATION.cancelled.tone).toBe('neutral');
  });

  it('only pulses the running state', () => {
    const pulsing = Object.entries(STATUS_PRESENTATION).filter(([, p]) => 'pulse' in p && p.pulse);
    expect(pulsing.map(([status]) => status)).toEqual(['running']);
  });
});

describe('TaskStatusBadge', () => {
  it('always renders the status text and hides the decorative dot', () => {
    const html = renderToStaticMarkup(<TaskStatusBadge status="running" />);
    expect(html).toContain('Trabajando');
    expect(html).toContain('aria-hidden="true"');
  });

  it('renders no dot for settled states', () => {
    expect(renderToStaticMarkup(<TaskStatusBadge status="completed" />)).not.toContain('aria-hidden');
  });
});
