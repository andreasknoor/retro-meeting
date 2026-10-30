"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminDeleteRetro, adminLogin, adminLogout, adminSaveAgenda, adminSaveSettings, isAdmin } from "@/app/actions/admin";
import type { Retro } from "@/components/retro/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { type Agenda, calcAgenda, orderPhases, PHASE_LABELS } from "@/convex/lib/agenda";
import { forgetRetro } from "@/lib/recentRetros";

type Status = "checking" | "guest" | "admin";

export function AdminScreen({ slug }: { slug: string }) {
  const retro = useQuery(api.retros.getBySlug, { slug });
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;
    isAdmin(slug).then(
      (ok) => !cancelled && setStatus(ok ? "admin" : "guest"),
      () => !cancelled && setStatus("guest"),
    );
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (retro === undefined || status === "checking") {
    return <p className="mx-auto max-w-3xl px-4 py-16 text-muted-foreground">Loading…</p>;
  }
  if (retro === null) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
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
  return status === "admin" ? (
    <AdminPanel retro={retro} onLoggedOut={() => setStatus("guest")} />
  ) : (
    <LoginForm retro={retro} onLoggedIn={() => setStatus("admin")} />
  );
}

function LoginForm({ retro, onLoggedIn }: { retro: Retro; onLoggedIn: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await adminLogin(retro.slug, password);
    setBusy(false);
    if (result.ok) {
      toast.success("Logged in as admin");
      onLoggedIn();
    } else {
      setError(result.error);
      setPassword("");
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Admin area</CardTitle>
          <CardDescription>
            Enter the admin password for <strong>{retro.name}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex items-center justify-between">
              <Link href={`/r/${retro.slug}`} className="text-sm font-semibold text-primary">
                ← Back to retro
              </Link>
              <Button type="submit" disabled={busy || !password}>
                {busy ? "Checking…" : "Log in"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function AdminPanel({ retro, onLoggedOut }: { retro: Retro; onLoggedOut: () => void }) {
  const router = useRouter();
  const phases = orderPhases(retro.enabledPhases);
  // Unsaved edits; null shows the saved agenda, which also follows changes from other tabs.
  const [draft, setDraft] = useState<Agenda | null>(null);
  const agenda = draft ?? retro.agenda;
  const setAgenda = (update: (a: Agenda) => Agenda) => setDraft(update(agenda));
  const [confirmName, setConfirmName] = useState("");
  const total = phases.reduce((sum, p) => sum + (agenda[p] || 0), 0);
  const diff = total - retro.lengthMin;

  async function save() {
    const result = await adminSaveAgenda(retro.slug, agenda);
    if (result.ok) {
      setDraft(null);
      toast.success("Agenda times saved · updated for everyone");
    } else toast.error(result.error);
  }

  async function setPhaseControl(adminControlsPhases: boolean) {
    const result = await adminSaveSettings(retro.slug, adminControlsPhases);
    if (result.ok) toast.success(adminControlsPhases ? "Only you can switch phases now" : "Everyone can switch phases now");
    else toast.error(result.error);
  }

  async function remove() {
    const result = await adminDeleteRetro(retro.slug, confirmName);
    if (result.ok) {
      forgetRetro(retro.slug);
      toast("Retro deleted");
      router.push("/");
    } else {
      toast.error(result.error);
    }
  }

  async function logout() {
    await adminLogout(retro.slug);
    toast("Logged out");
    onLoggedOut();
  }

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-5 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/r/${retro.slug}`} className="text-sm font-semibold text-primary">
          ← Back to retro
        </Link>
        <div className="flex gap-2">
          <Link href="/new" className={buttonVariants({ variant: "outline" })}>
            + New retro
          </Link>
          <Button variant="ghost" onClick={() => void logout()}>
            Log out
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Admin · {retro.name}</CardTitle>
          <CardDescription>
            Session valid for 12 hours. As admin you can also delete any idea on the board.
          </CardDescription>
          <CardAction className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold tracking-wide text-amber-900 uppercase">
            Admin
          </CardAction>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Phase control</CardTitle>
          <CardDescription>
            Decide who may start phases, extend or end them, and reset the retro. Saved as soon as you change it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              className="accent-primary"
              checked={retro.adminControlsPhases}
              onChange={(e) => void setPhaseControl(e.target.checked)}
            />
            <span className="font-medium">Only the admin can switch phases</span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Agenda times</CardTitle>
          <CardDescription>
            Only the durations can be changed. Saved with “Save times”, then they apply to everyone, including the
            running phase’s timer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid">
            {phases.map((phase) => (
              <li key={phase} className="grid grid-cols-[1fr_7rem] items-center gap-3 border-t py-2.5">
                <Label htmlFor={`dur-${phase}`}>{PHASE_LABELS[phase]}</Label>
                <Input
                  id={`dur-${phase}`}
                  type="number"
                  min={1}
                  max={120}
                  className="text-right"
                  value={agenda[phase] || ""}
                  onChange={(e) => setAgenda((a) => ({ ...a, [phase]: Math.max(0, Math.round(Number(e.target.value) || 0)) }))}
                />
              </li>
            ))}
          </ul>
          <p className="flex justify-between border-t-2 border-foreground pt-3 font-bold">
            <span>Total</span>
            <span>
              {total} min of {retro.lengthMin} min
            </span>
          </p>
          {diff !== 0 && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
              ⚠ The agenda is {Math.abs(diff)} min {diff > 0 ? "longer" : "shorter"} than the retro. You can still save.
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            {draft && (
              <span className="mr-auto self-center text-sm text-muted-foreground">
                Unsaved changes
              </span>
            )}
            {draft && (
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Discard
              </Button>
            )}
            <Button variant="ghost" onClick={() => setDraft(calcAgenda(retro.lengthMin, retro.enabledPhases))}>
              Reset to defaults
            </Button>
            <Button disabled={!draft} onClick={() => void save()}>
              Save times
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="ring-destructive/30">
        <CardHeader>
          <CardTitle className="text-xl text-destructive">Delete retro</CardTitle>
          <CardDescription>
            Deletes the retro with all ideas, votes, pulse answers and action items. This cannot be undone. Type the
            retro name to confirm.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            aria-label="Retro name to confirm"
            placeholder={retro.name}
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            className="min-w-56 flex-1"
          />
          <Button variant="destructive" disabled={confirmName !== retro.name} onClick={() => void remove()}>
            Delete permanently
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
