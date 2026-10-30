// Board ordering (§4.5): creation order until the Vote phase, then by votes (ties by creation).

type Sortable = { voteCount: number; createdAt: number };

export function sortIdeas<T extends Sortable>(ideas: readonly T[], byVotes: boolean): T[] {
  return [...ideas].sort((a, b) => (byVotes ? b.voteCount - a.voteCount : 0) || a.createdAt - b.createdAt);
}

/** The idea that gets the "Top in …" badge: first after sorting, only if it has votes. */
export function topIdea<T extends Sortable>(sorted: readonly T[], byVotes: boolean): T | null {
  return byVotes && sorted.length > 0 && sorted[0].voteCount > 0 ? sorted[0] : null;
}

const INITIALS_KEY = "retro:initials";

export function loadInitials(): string {
  try {
    return localStorage.getItem(INITIALS_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveInitials(initials: string): void {
  try {
    localStorage.setItem(INITIALS_KEY, initials);
  } catch {
    // Not remembered; harmless.
  }
}
