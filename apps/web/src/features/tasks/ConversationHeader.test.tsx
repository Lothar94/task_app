import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ConversationHeader } from './ConversationHeader';

const render = (isExpanded: boolean, canToggleTools = true) =>
  renderToStaticMarkup(
    <ConversationHeader
      isExpanded={isExpanded}
      onToggleExpanded={vi.fn()}
      canToggleTools={canToggleTools}
      onExpandTools={vi.fn()}
      onCollapseTools={vi.fn()}
    />,
  );

describe('ConversationHeader (static render)', () => {
  it('offers to expand while collapsed, with aria-pressed=false', () => {
    const html = render(false);

    expect(html).toContain('aria-label="Expandir conversación"');
    expect(html).toContain('aria-pressed="false"');
  });

  it('offers to collapse while expanded, with aria-pressed=true', () => {
    const html = render(true);

    expect(html).toContain('aria-label="Contraer conversación"');
    expect(html).toContain('aria-pressed="true"');
  });

  it('disables the tool-call controls when there are no tool calls', () => {
    const html = render(false, false);

    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
});
