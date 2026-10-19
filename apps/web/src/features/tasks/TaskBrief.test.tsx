import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TaskBrief } from './TaskBrief';
import { taskLabel } from './taskLabel';

const render = (description: string) =>
  renderToStaticMarkup(<TaskBrief task={{ number: 7, title: 'Arreglar login', description }} />);

describe('TaskBrief (static render)', () => {
  it('shows the task label and title as heading', () => {
    expect(render('x')).toContain(`${taskLabel(7)}: Arreglar login`);
  });

  it('renders the description', () => {
    const html = render('Detalle **importante**');

    expect(html).toContain('importante');
    expect(html).not.toContain('Sin descripción.');
  });

  it.each(['', '   \n '])('shows placeholder for empty description %j', (description) => {
    expect(render(description)).toContain('Sin descripción.');
  });
});
