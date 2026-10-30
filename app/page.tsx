import Link from "next/link";
import { OpenLinkForm } from "@/components/retro/OpenLinkForm";
import { RecentRetros } from "@/components/retro/RecentRetros";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-12">
      <section className="py-12">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Run a retro in minutes.</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Create a retro and share the link. Participants join without signing up and add ideas,
          vote and agree on actions in real time.
        </p>
      </section>
      <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Your recent retros</CardTitle>
            <CardDescription>
              Retros you created or opened on this device. Retros are private: only people with the
              link can open them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecentRetros />
          </CardContent>
        </Card>
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-xl">Start</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            <Link href="/new" className={buttonVariants({ size: "lg" })}>
              + New retro
            </Link>
            <OpenLinkForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
