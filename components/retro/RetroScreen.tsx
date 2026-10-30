"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useEffect } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { forgetRetro, rememberRetro } from "@/lib/recentRetros";
import { RetroHeader } from "./RetroHeader";

export function RetroScreen({ slug }: { slug: string }) {
  const retro = useQuery(api.retros.getBySlug, { slug });

  useEffect(() => {
    if (retro) rememberRetro(slug);
    else if (retro === null) forgetRetro(slug);
  }, [retro, slug]);

  if (retro === undefined) return <RetroLoading />;
  if (retro === null) return <RetroNotFound />;

  return (
    <>
      <RetroHeader {...retro} />
      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Board coming soon</CardTitle>
            <CardDescription>
              Phases, pulse check, idea board and action items arrive in the next releases.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    </>
  );
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
