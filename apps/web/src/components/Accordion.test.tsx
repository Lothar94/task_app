import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Accordion } from './Accordion';

describe('Accordion (static render)', () => {
  it('starts collapsed: aria-expanded is false and the body is not rendered', () => {
    const html = renderToStaticMarkup(<Accordion header="Detalle">Contenido</Accordion>);

    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('hidden');
    expect(html).not.toContain('Contenido');
  });

  it('renders the body and aria-expanded=true when open by default', () => {
    const html = renderToStaticMarkup(
      <Accordion header="Detalle" defaultOpen>
        Contenido
      </Accordion>,
    );

    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('Contenido');
  });

  it('links the toggle button to its body through aria-controls', () => {
    const html = renderToStaticMarkup(<Accordion header="Detalle">x</Accordion>);
    const id = /aria-controls="([^"]+)"/.exec(html)?.[1];

    expect(id).toBeTruthy();
    expect(html).toContain(`id="${id}"`);
  });

  it('is controlled by the open prop, ignoring defaultOpen', () => {
    const closed = renderToStaticMarkup(
      <Accordion header="Detalle" defaultOpen open={false}>
        Contenido
      </Accordion>,
    );
    const opened = renderToStaticMarkup(
      <Accordion header="Detalle" open>
        Contenido
      </Accordion>,
    );

    expect(closed).toContain('aria-expanded="false"');
    expect(closed).not.toContain('Contenido');
    expect(opened).toContain('aria-expanded="true"');
    expect(opened).toContain('Contenido');
  });
});
