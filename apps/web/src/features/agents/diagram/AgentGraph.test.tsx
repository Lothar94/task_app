// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { activityFixture, agentFixture } from '../agentTestData';
import { AgentGraph } from './AgentGraph';

const lead = agentFixture({ id: 'lead', name: 'Conde', role: 'CTO', collaboratorIds: ['dev', 'qa'] });
const dev = agentFixture({ id: 'dev', name: 'Lara', role: 'Backend' });
const qa = agentFixture({ id: 'qa', name: 'Vega', role: 'QA', enabled: false });
const team = [lead, dev, qa];
const longTitle = 'Refactorizar la capa de persistencia completa del módulo de facturación';
const activity = activityFixture({
  agents: [
    {
      agentId: 'dev',
      state: 'working',
      activeTasks: 1,
      currentTask: { taskId: 's1', projectId: 'p', number: 7, title: longTitle },
    },
    {
      agentId: 'lead',
      state: 'delegating',
      activeTasks: 1,
      currentTask: { taskId: 't1', projectId: 'p', number: 6, title: 'Facturación' },
    },
  ],
  delegations: [{ fromAgentId: 'lead', toAgentId: 'dev', taskId: 's1' }],
});

const node = (id: string) => document.querySelector<SVGGElement>(`[data-agent-id="${id}"]`)!;
const edges = () => [...document.querySelectorAll('path[d^="M"]')];
const svgWidth = () => Number(document.querySelector('svg[role="img"]')?.getAttribute('width'));

afterEach(cleanup);

describe('AgentGraph live state', () => {
  it('gives a working agent a halo and a clipped "EN CURSO" chip with the full title in its name', () => {
    render(<AgentGraph agents={team} activity={activity} selectedId={null} onSelect={vi.fn()} />);
    const working = node('dev');
    expect(working.dataset.liveState).toBe('working');
    expect(working.querySelector('rect')?.getAttribute('class')).toMatch(/stroke-success.*drop-shadow/);
    const chip = working.querySelector('[data-live-chip] text')?.textContent ?? '';
    expect(chip.startsWith('EN CURSO: Refactorizar')).toBe(true);
    expect(chip.endsWith('…')).toBe(true);
    expect(working.getAttribute('aria-label')).toContain(`trabajando, en curso: ${longTitle}`);
    expect(working.querySelector('title')?.textContent).toContain(longTitle);
    expect(node('qa').querySelector('[data-live-chip]')).toBeNull();
  });

  it('animates delegation edges only under motion-safe and leaves the others static', () => {
    render(<AgentGraph agents={team} activity={activity} onSelect={vi.fn()} />);
    const live = edges().filter((edge) => edge.hasAttribute('data-live'));
    expect(live).toHaveLength(1);
    const liveClass = live[0]!.getAttribute('class') ?? '';
    expect(liveClass).toContain('motion-safe:animate-march');
    expect(liveClass).toContain('stroke-accent');
    expect(liveClass.split(' ')).not.toContain('animate-march');
    const idle = edges().find((edge) => !edge.hasAttribute('data-live'));
    expect(idle?.getAttribute('class')).not.toContain('animate');
  });

  it('marks disabled agents', () => {
    render(<AgentGraph agents={team} onSelect={vi.fn()} />);
    expect(node('qa').textContent).toContain('Desactivado');
    expect(node('qa').getAttribute('aria-label')).toContain('desactivado');
    expect(node('dev').textContent).not.toContain('Desactivado');
  });
});

describe('AgentGraph zoom', () => {
  it('has no zoom controls unless zoomable', () => {
    render(<AgentGraph agents={team} onSelect={vi.fn()} />);
    expect(screen.queryByRole('group', { name: 'Zoom del diagrama' })).toBeNull();
  });

  it('zooms in and out between 50% and 200% and fits back to the container', async () => {
    const user = userEvent.setup();
    render(<AgentGraph agents={team} zoomable onSelect={vi.fn()} />);
    const fitWidth = svgWidth();
    expect(screen.getByRole('status', { name: 'Zoom actual' }).textContent).toBe('100%');
    await user.click(screen.getByRole('button', { name: 'Acercar' }));
    expect(screen.getByRole('status').textContent).toBe('125%');
    expect(svgWidth()).toBeCloseTo(fitWidth * 1.25);
    for (let i = 0; i < 5; i++) await user.click(screen.getByRole('button', { name: 'Acercar' }));
    expect(screen.getByRole('status').textContent).toBe('200%');
    expect((screen.getByRole('button', { name: 'Acercar' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Encajar al ancho' }));
    expect(screen.getByRole('status').textContent).toBe('100%');
    expect(screen.getByRole('button', { name: 'Encajar al ancho' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Alejar' }));
    await user.click(screen.getByRole('button', { name: 'Alejar' }));
    expect(screen.getByRole('status').textContent).toBe('50%');
    expect((screen.getByRole('button', { name: 'Alejar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('responds to + - 0 keys from inside the diagram', () => {
    render(<AgentGraph agents={team} zoomable onSelect={vi.fn()} />);
    fireEvent.keyDown(node('dev'), { key: '+' });
    expect(screen.getByRole('status').textContent).toBe('125%');
    fireEvent.keyDown(node('dev'), { key: '-' });
    fireEvent.keyDown(node('dev'), { key: '-' });
    expect(screen.getByRole('status').textContent).toBe('75%');
    fireEvent.keyDown(node('dev'), { key: '0' });
    expect(screen.getByRole('status').textContent).toBe('100%');
  });
});
