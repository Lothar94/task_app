import { useState } from 'react';

function readChoice<T extends string>(key: string, options: readonly T[], fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return options.find((option) => option === stored) ?? fallback;
  } catch {
    return fallback;
  }
}

/** A UI preference remembered in this browser; works without storage too. */
export function useStoredChoice<T extends string>(key: string, options: readonly T[], fallback: T) {
  const [choice, setChoice] = useState(() => readChoice(key, options, fallback));
  const update = (next: T) => {
    setChoice(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      // Storage unavailable (private mode, blocked site data): keep the choice for this session only.
    }
  };
  return [choice, update] as const;
}
