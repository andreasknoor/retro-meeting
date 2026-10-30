"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { api } from "@/convex/_generated/api";
import { formatLongDate } from "@/lib/format";
import { parseRecent, readRecentRaw, subscribeRecent } from "@/lib/recentRetros";

export function RecentRetros() {
  // null on the server: localStorage only exists in the browser.
  const raw = useSyncExternalStore(subscribeRecent, readRecentRaw, () => null);
  const slugs = useMemo(() => (raw === null ? null : parseRecent(raw)), [raw]);

  const retros = useQuery(api.retros.getManyBySlugs, slugs && slugs.length > 0 ? { slugs } : "skip");

  if (slugs === null || (slugs.length > 0 && retros === undefined)) {
    return <p className="py-4 text-sm text-muted-foreground">Loading…</p>;
  }
  if (slugs.length === 0 || retros?.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        No retros on this device yet. Create one or open a link.
      </div>
    );
  }
  return (
    <ul className="divide-y">
      {retros!.map((r) => (
        <li key={r.slug}>
          <Link
            href={`/r/${r.slug}`}
            className="group flex items-center justify-between gap-3 py-3"
          >
            <span>
              <span className="block font-semibold group-hover:text-primary">{r.name}</span>
              <span className="text-sm text-muted-foreground">
                {formatLongDate(r.date)} · {r.facilitator}
              </span>
            </span>
            <span className="text-sm text-muted-foreground">/r/{r.slug} →</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
