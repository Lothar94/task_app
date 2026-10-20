export type DiffLineKind = 'add' | 'del' | 'context' | 'meta';

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface DiffFile {
  /** New path (old path for deletions). */
  path: string;
  oldPath: string | null;
  isBinary: boolean;
  /** Extra header lines such as "new file mode" or "rename from". */
  meta: string[];
  hunks: DiffHunk[];
}

const stripPrefix = (path: string) => path.replace(/^[ab]\//, '');

function parseHeaderPaths(line: string): { oldPath: string; path: string } {
  const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
  return { oldPath: match?.[1] ?? '', path: match?.[2] ?? line };
}

function lineKind(line: string): DiffLineKind {
  if (line.startsWith('+')) return 'add';
  if (line.startsWith('-')) return 'del';
  if (line.startsWith('\\')) return 'meta'; // "\ No newline at end of file"
  return 'context';
}

/** Parses `git diff` output into files, hunks and typed lines; an empty patch gives no files. */
export function parseUnifiedDiff(patch: string): DiffFile[] {
  const files: DiffFile[] = [];
  let file: DiffFile | undefined;
  let hunk: DiffHunk | undefined;
  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --git ')) {
      const { oldPath, path } = parseHeaderPaths(line);
      file = { path, oldPath: oldPath === path ? null : oldPath, isBinary: false, meta: [], hunks: [] };
      files.push(file);
      hunk = undefined;
    } else if (!file) {
      continue;
    } else if (line.startsWith('@@')) {
      hunk = { header: line, lines: [] };
      file.hunks.push(hunk);
    } else if (hunk) {
      if (line === '') continue;
      hunk.lines.push({ kind: lineKind(line), text: line });
    } else if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) {
      file.isBinary = true;
    } else if (line.startsWith('rename to ')) {
      file.path = line.slice('rename to '.length);
      file.meta.push(line);
    } else if (line.startsWith('+++ ')) {
      const target = line.slice(4);
      if (target !== '/dev/null') file.path = stripPrefix(target);
    } else if (line.startsWith('--- ')) {
      const source = line.slice(4);
      if (source !== '/dev/null' && file.oldPath !== null) file.oldPath = stripPrefix(source);
    } else if (line !== '' && !line.startsWith('index ')) {
      file.meta.push(line);
    }
  }
  return files;
}
