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
      className={`prose prose-sm prose-invert max-w-none min-w-0 [overflow-wrap:anywhere] prose-headings:font-semibold prose-a:text-indigo-300 prose-code:before:content-none prose-code:after:content-none prose-code:rounded prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5 prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800 ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
