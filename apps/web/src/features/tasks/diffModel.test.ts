import { describe, expect, it } from 'vitest';
import { parseUnifiedDiff } from './diffModel';

const MODIFIED = `diff --git a/src/a.ts b/src/a.ts
index 111..222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,2 @@
 keep
-old
+new
\\ No newline at end of file
diff --git a/img.png b/img.png
new file mode 100644
index 000..333
Binary files /dev/null and b/img.png differ
`;

describe('parseUnifiedDiff', () => {
  it('returns no files for an empty patch', () => {
    expect(parseUnifiedDiff('')).toEqual([]);
  });

  it('parses several files with hunks and typed lines', () => {
    const [first, second] = parseUnifiedDiff(MODIFIED);

    expect(first?.path).toBe('src/a.ts');
    expect(first?.hunks).toHaveLength(1);
    expect(first?.hunks[0]?.lines.map((line) => line.kind)).toEqual(['context', 'del', 'add', 'meta']);
    expect(second?.path).toBe('img.png');
  });

  it('keeps the "No newline at end of file" marker as a meta line', () => {
    const lines = parseUnifiedDiff(MODIFIED)[0]?.hunks[0]?.lines ?? [];

    expect(lines.at(-1)).toEqual({ kind: 'meta', text: '\\ No newline at end of file' });
  });

  it('flags binary files and records new-file header lines', () => {
    const binary = parseUnifiedDiff(MODIFIED)[1];

    expect(binary?.isBinary).toBe(true);
    expect(binary?.hunks).toEqual([]);
    expect(binary?.meta).toContain('new file mode 100644');
  });

  it('handles renames with the new path and the old path', () => {
    const [file] = parseUnifiedDiff(
      'diff --git a/old.ts b/new.ts\nsimilarity index 90%\nrename from old.ts\nrename to new.ts\n@@ -1 +1 @@\n-a\n+b\n',
    );

    expect(file?.path).toBe('new.ts');
    expect(file?.oldPath).toBe('old.ts');
    expect(file?.hunks[0]?.lines).toHaveLength(2);
  });

  it('uses the old path for deleted files', () => {
    const [file] = parseUnifiedDiff(
      'diff --git a/gone.ts b/gone.ts\ndeleted file mode 100644\n--- a/gone.ts\n+++ /dev/null\n@@ -1 +0,0 @@\n-x\n',
    );

    expect(file?.path).toBe('gone.ts');
  });
});
