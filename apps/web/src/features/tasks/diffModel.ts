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

/** `--- a/x` / `+++ b/x` lines refine the paths; `/dev/null` (added/deleted file) is ignored. */
function applyPathLine(file: DiffFile, line: string): void {
  const path = line.slice(4);
  if (path === '/dev/null') return;
  if (line.startsWith('+++ ')) file.path = stripPrefix(path);
  else if (file.oldPath !== null) file.oldPath = stripPrefix(path);
}

/** Applies one pre-hunk header line (mode, rename, ---/+++, binary marker) to its file. */
function applyHeaderLine(file: DiffFile, line: string): void {
  if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) {
    file.isBinary = true;
  } else if (line.startsWith('+++ ') || line.startsWith('--- ')) {
    applyPathLine(file, line);
  } else if (line.startsWith('rename to ')) {
    file.path = line.slice('rename to '.length);
    file.meta.push(line);
  } else if (line !== '' && !line.startsWith('index ')) {
    file.meta.push(line);
  }
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
    } else if (file && line.startsWith('@@')) {
      hunk = { header: line, lines: [] };
      file.hunks.push(hunk);
    } else if (file && hunk) {
      if (line !== '') hunk.lines.push({ kind: lineKind(line), text: line });
    } else if (file) {
      applyHeaderLine(file, line);
    }
  }
  return files;
}
