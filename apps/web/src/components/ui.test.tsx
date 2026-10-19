import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StatTile } from './StatTile';
import { Card, PageHeader, SegmentedControl, StatusChip } from './ui';

describe('StatusChip', () => {
  it('renders the pulsing dot only when asked, hidden from assistive tech', () => {
    const pulsing = renderToStaticMarkup(
      <StatusChip tone="info" pulse>
        Activa
      </StatusChip>,
    );
    expect(pulsing).toContain('motion-safe:animate-pulse');
    expect(pulsing).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<StatusChip tone="info">Activa</StatusChip>)).not.toContain('animate-pulse');
  });
});

describe('StatTile', () => {
  it('renders unit, footer and tone bar when provided', () => {
    const html = renderToStaticMarkup(
      <StatTile label="Resueltas" value="106" unit="tareas" footer="hoy" tone="good" />,
    );
    expect(html).toContain('Resueltas');
    expect(html).toContain('tareas');
    expect(html).toContain('hoy');
    expect(html).toContain('--status-good');
  });

  it('omits the tone bar by default', () => {
    expect(renderToStaticMarkup(<StatTile label="Total" value={3} />)).not.toContain('w-1 ');
  });
});

describe('Card and PageHeader', () => {
  it('stay backwards compatible without the new props', () => {
    expect(renderToStaticMarkup(<Card title="Hola">x</Card>)).toContain('Hola');
    expect(renderToStaticMarkup(<PageHeader title="Proyectos" />)).toContain('Proyectos');
  });

  it('render breadcrumb, badge and card meta', () => {
    expect(renderToStaticMarkup(<PageHeader title="T" breadcrumb="Flota" badge={<b>beta</b>} />)).toContain(
      'Flota',
    );
    expect(
      renderToStaticMarkup(
        <Card title="C" icon={<i />} meta="3 items">
          x
        </Card>,
      ),
    ).toContain('3 items');
  });
});

describe('SegmentedControl', () => {
  it('shows optional counts', () => {
    const html = renderToStaticMarkup(
      <SegmentedControl
        label="Filtro"
        value="a"
        onChange={() => {}}
        options={[{ value: 'a', label: 'Todas', count: 7 }]}
      />,
    );
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('>7<');
  });
});
