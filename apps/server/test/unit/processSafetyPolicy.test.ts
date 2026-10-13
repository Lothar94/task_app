import { describe, expect, it } from 'vitest';
import { findUnsafeProcessCommand } from '../../src/application/security/processSafetyPolicy.js';

describe('findUnsafeProcessCommand', () => {
  it.each([
    'pkill -f "vite"',
    'pkill -P $(cat /tmp/dev.pid); pkill -f vite',
    'killall node',
    'kill -9 -1',
    'kill 0',
    'kill $(lsof -t -i:5173)',
    'kill -9 $(pgrep -f tsx)',
    'lsof -ti:4100 | xargs kill -9',
    'pgrep node | xargs -r kill',
    'fuser -k 5173/tcp',
    'npx kill-port 5173',
  ])('blocks %s', (command) => {
    expect(findUnsafeProcessCommand(command)).toMatch(/Stop only the processes you started/);
  });

  it.each([
    'kill $(cat /tmp/dev.pid)',
    'kill -TERM 12345',
    'pnpm dev > /tmp/dev.log 2>&1 & echo $! > /tmp/dev.pid',
    'lsof -i :5173',
    'pgrep -f vite',
    'echo "skill level" && git commit -m "fix: killer feature"',
    'npm test',
  ])('allows %s', (command) => {
    expect(findUnsafeProcessCommand(command)).toBeNull();
  });
});
