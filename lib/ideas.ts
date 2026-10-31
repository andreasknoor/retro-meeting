// Board ordering (§4.5): creation order until the Vote phase is over, then by votes (ties by creation).

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

type Votable = { id: string; column: string; votedByMe: boolean };

/**
 * Mirrors votes.toggle for optimistic updates: cast, move within the column, or take back.
 * Only `votedByMe` changes; counts are hidden while voting (v1.7).
 */
export function applyVoteToggle<T extends Votable>(ideas: readonly T[], ideaId: string): T[] {
  const target = ideas.find((i) => i.id === ideaId);
  if (!target) return [...ideas];
  const retract = target.votedByMe;
  return ideas.map((i) => {
    if (i.id === ideaId) return { ...i, votedByMe: !retract };
    if (!retract && i.column === target.column && i.votedByMe) return { ...i, votedByMe: false };
    return i;
  });
}
