import {
  type AgentSearchHit,
  type ProjectSearchHit,
  SEARCH_LIMITS,
  type SearchResultsDto,
  type TaskSearchHit,
} from '@fleet/shared';

type Rank = 'exact' | 'prefix' | 'contains';

const RANK_ORDER: Record<Rank, number> = { exact: 0, prefix: 1, contains: 2 };

/** "61", "#61", "tarea 61" or "task 61" (any case). */
const TASK_NUMBER_QUERY = /^(?:#|(?:tarea|task)\s+)?(\d+)$/i;

interface Candidate<Hit> {
  hit: Hit;
  createdAt: Date;
}

export interface SearchCorpus {
  projects: Candidate<ProjectSearchHit>[];
  tasks: Candidate<TaskSearchHit>[];
  agents: Candidate<AgentSearchHit>[];
}

/** Lowercases and strips diacritics so "Café" and "cafe" compare equal. */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export function parseTaskNumber(query: string): number | null {
  const match = TASK_NUMBER_QUERY.exec(query.trim());
  return match?.[1] ? Number(match[1]) : null;
}

function rankText(text: string, needle: string): Rank | null {
  const normalized = normalizeText(text);
  if (normalized === needle) return 'exact';
  if (normalized.startsWith(needle)) return 'prefix';
  return normalized.includes(needle) ? 'contains' : null;
}

function bestRank(ranks: (Rank | null)[]): Rank | null {
  const found = ranks.filter((rank): rank is Rank => rank !== null);
  return found.sort((a, b) => RANK_ORDER[a] - RANK_ORDER[b])[0] ?? null;
}

function rankAndCap<Hit>(
  candidates: Candidate<Hit>[],
  rankOf: (hit: Hit) => Rank | null,
  limit: number,
): Hit[] {
  return candidates
    .flatMap((candidate) => {
      const rank = rankOf(candidate.hit);
      return rank ? [{ ...candidate, rank }] : [];
    })
    .sort(
      (a, b) =>
        RANK_ORDER[a.rank] - RANK_ORDER[b.rank] || b.createdAt.getTime() - a.createdAt.getTime(),
    )
    .slice(0, limit)
    .map(({ hit }) => hit);
}

/**
 * Case- and accent-insensitive search over already loaded entities. Exact matches (task number,
 * exact name) rank first, then prefix, then contains; ties go to the most recent.
 */
export function matchSearch(
  corpus: SearchCorpus,
  rawQuery: string,
  limit: number = SEARCH_LIMITS.defaultPerGroup,
): SearchResultsDto {
  const query = rawQuery.trim();
  if (query.length === 0) return { query, projects: [], tasks: [], agents: [] };

  const needle = normalizeText(query);
  const taskNumber = parseTaskNumber(query);
  return {
    query,
    projects: rankAndCap(corpus.projects, (project) => rankText(project.name, needle), limit),
    tasks: rankAndCap(
      corpus.tasks,
      (task) => (task.number === taskNumber ? 'exact' : rankText(task.title, needle)),
      limit,
    ),
    agents: rankAndCap(
      corpus.agents,
      (agent) => bestRank([rankText(agent.name, needle), rankText(agent.role, needle)]),
      limit,
    ),
  };
}
