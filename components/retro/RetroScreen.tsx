"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { PHASE_LABELS } from "@/convex/lib/agenda";
import { forgetRetro, rememberRetro } from "@/lib/recentRetros";
import { AgendaCard } from "./AgendaCard";
import { PhaseBar } from "./PhaseBar";
import { RetroHeader } from "./RetroHeader";
import type { Retro } from "./types";

export function RetroScreen({ slug }: { slug: string }) {
  const retro = useQuery(api.retros.getBySlug, { slug });

  useEffect(() => {
    if (retro) rememberRetro(slug);
    else if (retro === null) forgetRetro(slug);
  }, [retro, slug]);

  usePhaseChangeToast(retro?.state);

  if (retro === undefined) return <RetroLoading />;
  if (retro === null) return <RetroNotFound />;

  return (
    <>
      <RetroHeader {...retro} />
      <PhaseBar retro={retro} />
      <main className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_1.25fr]">
          <AgendaCard retro={retro} />
        </div>
      </main>
    </>
  );
}

/** Tells everyone when the phase changes (it may have been switched by someone else). */
function usePhaseChangeToast(state: Retro["state"] | undefined) {
  const previous = useRef(state);
  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    if (before === undefined || state === undefined || before === state) return;
    if (state === "finished") toast("Retro finished");
    else if (state === "not_started") toast("Retro reset · all data kept");
    else toast(`Phase changed to ${PHASE_LABELS[state]}`);
  }, [state]);
}

export function RetroLoading() {
  return (
    <div className="bg-primary/90" aria-busy="true">
      <div className="mx-auto max-w-7xl px-4 py-10 text-primary-foreground/80">Loading retro…</div>
    </div>
  );
}

function RetroNotFound() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Retro not found</CardTitle>
          <CardDescription>The link may be wrong, or the retro was deleted.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Go to start page
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
