// 12 characters since v1.3; retros created before have 8.
export const SLUG = /^(?:[a-z0-9]{8}|[a-z0-9]{12})$/;

/** Accepts a full retro link ("https://…/r/k7f3q9xa"), a path ("/r/k7f3q9xa") or a bare slug. */
export function parseRetroLink(input: string): string | null {
  const value = input.trim();
  const fromPath = value.match(/\/r\/([a-z0-9]{12}|[a-z0-9]{8})(?:[/?#]|$)/i);
  const slug = (fromPath ? fromPath[1] : value).toLowerCase();
  return SLUG.test(slug) ? slug : null;
}

export function retroUrl(origin: string, slug: string): string {
  return `${origin}/r/${slug}`;
}
