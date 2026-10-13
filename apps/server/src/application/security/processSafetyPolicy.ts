interface UnsafePattern {
  pattern: RegExp;
  reason: string;
}

const STOP_YOUR_OWN =
  'Stop only the processes you started, by their PID (e.g. `cmd & echo $! > /tmp/my.pid` and later `kill $(cat /tmp/my.pid)`).';

const UNSAFE_PATTERNS: readonly UnsafePattern[] = [
  {
    pattern: /\b(pkill|killall)\b/,
    reason:
      '`pkill`/`killall` match processes by name across the whole machine, including the Agent Fleet app itself.',
  },
  {
    pattern: /\bkill\b[^;&|\n]*\s(-1|0)(\s|$)/,
    reason: '`kill -1` / `kill 0` signal every process you can reach.',
  },
  {
    pattern: /\bkill\b[^;&|\n]*\$\(\s*(lsof|fuser|pgrep|pidof|ss|netstat)\b/,
    reason: 'Killing whatever holds a port or matches a name can stop processes that are not yours.',
  },
  {
    pattern: /\b(lsof|pgrep|pidof)\b[^;&\n]*\|\s*xargs\s+(-\S+\s+)*kill\b/,
    reason: 'Piping process searches into `kill` can stop processes that are not yours.',
  },
  {
    pattern: /\bfuser\b[^;&|\n]*\s-k/,
    reason: '`fuser -k` kills every process using a file or port, not just yours.',
  },
  {
    pattern: /\bkill-port\b/,
    reason: '`kill-port` stops whatever process holds the port, not just yours.',
  },
];

/**
 * Agents share the machine with the app that runs them. Returns why a shell command could stop
 * processes the agent did not start (null when the command looks safe).
 */
export function findUnsafeProcessCommand(command: string): string | null {
  const match = UNSAFE_PATTERNS.find(({ pattern }) => pattern.test(command));
  return match ? `${match.reason} ${STOP_YOUR_OWN}` : null;
}
