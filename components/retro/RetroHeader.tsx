"use client";

import { toast } from "sonner";
import { formatShortDate } from "@/lib/format";
import { retroUrl } from "@/lib/slug";

type Props = {
  slug: string;
  name: string;
  subtitle: string | null;
  date: string;
  lengthMin: number;
  facilitator: string;
};

export function RetroHeader({ slug, name, subtitle, date, lengthMin, facilitator }: Props) {
  async function copyLink() {
    const link = retroUrl(window.location.origin, slug);
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied");
    } catch {
      toast(link, { description: "Copy this link to share the retro." });
    }
  }

  return (
    <header className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-6 px-4 py-7">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2.5 text-xs font-semibold tracking-[0.14em] uppercase opacity-80">
            <span>Retro</span>
            <button
              type="button"
              onClick={copyLink}
              className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] tracking-wider hover:bg-white/25"
            >
              ⧉ Copy link
            </button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight break-words sm:text-4xl">{name}</h1>
          {subtitle && <p className="mt-1 text-lg opacity-85">{subtitle}</p>}
        </div>
        <dl className="flex flex-wrap gap-y-3">
          <Meta label="Date" value={formatShortDate(date)} first />
          <Meta label="Length" value={`${lengthMin} minutes`} />
          <Meta label="Facilitator" value={facilitator} />
        </dl>
      </div>
    </header>
  );
}

function Meta({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <div
      className={
        first
          ? "pr-4 whitespace-nowrap sm:border-l-2 sm:border-white/35 sm:px-5"
          : "border-l-2 border-white/35 px-4 whitespace-nowrap sm:px-5"
      }
    >
      <dt className="text-[11px] font-semibold tracking-[0.14em] uppercase opacity-75">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}
