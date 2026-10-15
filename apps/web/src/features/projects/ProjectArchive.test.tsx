import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ArchiveBanner, ArchiveError } from './ProjectArchive';

describe('ArchiveBanner (static render)', () => {
  it('announces read-only mode as a status with an unarchive button', () => {
    const html = renderToStaticMarkup(<ArchiveBanner onUnarchive={() => undefined} isPending={false} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('Proyecto archivado — solo lectura');
    expect(html).toMatch(/<button[^>]*>Desarchivar<\/button>/);
  });

  it('disables unarchive while the request is pending', () => {
    const html = renderToStaticMarkup(<ArchiveBanner onUnarchive={() => undefined} isPending />);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Desarchivar/);
  });
});

describe('ArchiveError (static render)', () => {
  it('renders nothing without error and an alert with the server message otherwise', () => {
    expect(renderToStaticMarkup(<ArchiveError error={null} />)).toBe('');
    const html = renderToStaticMarkup(<ArchiveError error={new Error('Hay tareas en curso')} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('Hay tareas en curso');
  });
});
