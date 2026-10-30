"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { createRetro } from "@/app/actions/retro";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calcAgenda, LENGTH_PRESETS, PHASE_LABELS, PHASES, type Phase } from "@/convex/lib/agenda";
import { LIMITS, validateRetroInput } from "@/convex/lib/validation";
import { todayIso } from "@/lib/format";
import { rememberRetro } from "@/lib/recentRetros";
import { retroUrl } from "@/lib/slug";
import { cn } from "@/lib/utils";

export function NewRetroForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  // Today is only known in the browser; prerendering must not bake in the build date.
  const today = useSyncExternalStore(noopSubscribe, () => todayIso(), () => "");
  const [pickedDate, setDate] = useState<string | null>(null);
  const date = pickedDate ?? today;
  const [facilitator, setFacilitator] = useState("");
  const [lengthMin, setLengthMin] = useState<number>(30);
  const [enabled, setEnabled] = useState<Phase[]>([...PHASES]);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [adminControlsPhases, setAdminControlsPhases] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const agenda = calcAgenda(lengthMin, enabled);
  const passwordsMatch = password2.length > 0 && password === password2;

  function togglePhase(phase: Phase) {
    setEnabled((cur) => (cur.includes(phase) ? cur.filter((p) => p !== phase) : [...cur, phase]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = { name, subtitle, date, lengthMin, facilitator, enabledPhases: enabled, password };
    const problems = validateRetroInput(input);
    if (password.length >= LIMITS.passwordMin && password !== password2) problems.push("Passwords do not match.");
    setErrors(problems);
    if (problems.length > 0) return;

    setSubmitting(true);
    try {
      // Server action: creates the retro and logs us in as admin (HTTP-only cookie).
      const result = await createRetro({ ...input, adminControlsPhases });
      if (!result.ok) {
        setErrors([result.error]);
        setSubmitting(false);
        return;
      }
      const { slug } = result;
      rememberRetro(slug);
      const link = retroUrl(window.location.origin, slug);
      const copied = await navigator.clipboard?.writeText(link).then(
        () => true,
        () => false,
      );
      toast.success(copied ? "Retro created · link copied" : "Retro created");
      router.push(`/r/${slug}`);
    } catch {
      setErrors(["Something went wrong. Please try again."]);
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">New retro</CardTitle>
        <CardDescription>Everything except the admin password is visible to anyone with the link.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2" noValidate>
          <Field label="Name *" htmlFor="name" className="sm:col-span-2">
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.name} placeholder="e.g. Sprint 42 Retro" />
          </Field>
          <Field label="Goal / subtitle" htmlFor="subtitle" className="sm:col-span-2">
            <Input id="subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={LIMITS.subtitle} placeholder="e.g. What to keep, fix and try next sprint" />
          </Field>
          <Field label="Date *" htmlFor="date">
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Facilitator *" htmlFor="facilitator">
            <Input id="facilitator" value={facilitator} onChange={(e) => setFacilitator(e.target.value)} maxLength={LIMITS.facilitator} placeholder="Name" />
          </Field>

          <fieldset className="grid gap-2 sm:col-span-2">
            <legend className="mb-2 text-sm font-medium">Length</legend>
            <div className="flex flex-wrap gap-2">
              {LENGTH_PRESETS.map((len) => (
                <Button key={len} type="button" variant={lengthMin === len ? "default" : "outline"} aria-pressed={lengthMin === len} onClick={() => setLengthMin(len)}>
                  {len} min
                </Button>
              ))}
            </div>
          </fieldset>

          <fieldset className="grid gap-2 sm:col-span-2">
            <legend className="mb-2 text-sm font-medium">Phases</legend>
            <div className="flex flex-wrap gap-2">
              {PHASES.map((phase) => (
                <label key={phase} className="flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm has-disabled:cursor-default has-disabled:opacity-70">
                  <input type="checkbox" className="accent-primary" checked={enabled.includes(phase)} disabled={phase === "brainstorm"} onChange={() => togglePhase(phase)} />
                  {PHASE_LABELS[phase]}
                  {phase === "brainstorm" && <span className="text-muted-foreground">(required)</span>}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex cursor-pointer items-start gap-2.5 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="mt-0.5 accent-primary"
              checked={adminControlsPhases}
              onChange={(e) => setAdminControlsPhases(e.target.checked)}
            />
            <span>
              <span className="font-medium">Only the admin can switch phases</span>
              <span className="block text-muted-foreground">
                You are logged in as admin after creating the retro. Uncheck to let everyone with the link control the
                phases and the timer.
              </span>
            </span>
          </label>

          <div className="grid gap-2 sm:col-span-2">
            <span className="text-sm font-medium">Agenda (calculated, editable later in admin)</span>
            <ul className="flex flex-wrap gap-2" aria-label="Agenda preview">
              {PHASES.filter((p) => enabled.includes(p)).map((p) => (
                <li key={p} className="rounded-md bg-secondary px-2.5 py-1 text-sm font-medium text-secondary-foreground">
                  {PHASE_LABELS[p]} · {agenda[p]} min
                </li>
              ))}
            </ul>
          </div>

          <Field label={`Admin password * (min. ${LIMITS.passwordMin})`} htmlFor="password">
            <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Repeat password *" htmlFor="password2">
            {/* Re-checked on every keystroke; the check appears as soon as both entries match. */}
            <div className="flex items-center gap-2">
              <Input id="password2" type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
              <span className="grid size-6 shrink-0 place-items-center" aria-live="polite">
                {passwordsMatch && (
                  <span role="img" aria-label="Passwords match" className="grid size-6 place-items-center rounded-md bg-emerald-600 text-white">
                    <Check className="size-4" strokeWidth={3} />
                  </span>
                )}
              </span>
            </div>
          </Field>

          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 sm:col-span-2">
            ⚠ There is no password recovery. Without it you cannot change agenda times or delete this retro.
          </p>

          {errors.length > 0 && (
            <ul role="alert" className="list-inside list-disc rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">
              {errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          )}

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => router.push("/")}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create retro"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

const noopSubscribe = () => () => {};

function Field({ label, htmlFor, className, children }: { label: string; htmlFor: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
