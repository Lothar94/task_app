import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const COMPONENTS: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
  pre: ({ node: _node, ...props }) => <pre {...props} className="max-w-full overflow-x-auto" />,
  table: ({ node: _node, ...props }) => (
    <div className="max-w-full overflow-x-auto">
      <table {...props} />
    </div>
  ),
};

/** Renders agent output (GitHub-flavoured Markdown) with the app's typography. */
export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div
      className={`prose prose-sm dark:prose-invert max-w-none min-w-0 [overflow-wrap:anywhere] prose-headings:font-semibold prose-a:text-accent prose-code:before:content-none prose-code:after:content-none prose-code:rounded-none prose-code:bg-surface-raised prose-code:px-1 prose-code:py-0.5 prose-pre:bg-canvas prose-pre:text-fg prose-pre:rounded-none prose-pre:border prose-pre:border-line ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
