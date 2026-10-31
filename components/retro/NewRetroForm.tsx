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
import { columnMeta, FREE_VOTES, type Template, TEMPLATE_LABELS, TEMPLATES } from "@/convex/lib/columns";
import { ICEBREAKER_MAX_LENGTH, randomIcebreaker } from "@/convex/lib/icebreakers";
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
  // The Check-in phase is optional and off by default (v1.13).
  const [enabled, setEnabled] = useState<Phase[]>(PHASES.filter((p) => p !== "checkin"));
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [adminControlsPhases, setAdminControlsPhases] = useState(true);
  const [template, setTemplate] = useState<Template>("keep_fix_try");
  const [freeVoting, setFreeVoting] = useState(false);
  const [votesPerPerson, setVotesPerPerson] = useState<number>(FREE_VOTES.default);
  const [ownQuestion, setOwnQuestion] = useState<string | null>(null);
  // Drawn when the Check-in phase is ticked (not while rendering, so the prerendered page and the
  // browser agree), shown in the form and saved exactly as shown.
  const [randomQuestion, setRandomQuestion] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const agenda = calcAgenda(lengthMin, enabled);
  const passwordsMatch = password2.length > 0 && password === password2;

  function togglePhase(phase: Phase) {
    if (phase === "checkin" && randomQuestion === null) setRandomQuestion(randomIcebreaker());
    setEnabled((cur) => (cur.includes(phase) ? cur.filter((p) => p !== phase) : [...cur, phase]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const withCheckIn = enabled.includes("checkin");
    const input = {
      name,
      subtitle,
      date,
      lengthMin,
      facilitator,
      enabledPhases: enabled,
      password,
      votesPerPerson: freeVoting && enabled.includes("vote") ? votesPerPerson : undefined,
      // A random catalog question is drawn here, so the creator could already see it on the page.
      icebreaker: withCheckIn ? (ownQuestion ?? randomQuestion ?? undefined) : undefined,
    };
    const problems = validateRetroInput(input);
    if (password.length >= LIMITS.passwordMin && password !== password2) problems.push("Passwords do not match.");
    setErrors(problems);
    if (problems.length > 0) return;

    setSubmitting(true);
    try {
      // Server action: creates the retro and logs us in as admin (HTTP-only cookie).
      const result = await createRetro({ ...input, adminControlsPhases, template });
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
                  {phase === "checkin" && <span className="text-muted-foreground">(optional)</span>}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="grid gap-2 sm:col-span-2">
            <legend className="mb-2 text-sm font-medium">Format</legend>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <Button key={t} type="button" variant={template === t ? "default" : "outline"} aria-pressed={template === t} onClick={() => setTemplate(t)}>
                  {TEMPLATE_LABELS[t]}
                </Button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Columns: {Object.values(columnMeta(template)).map((c) => `${c.label} (${c.question})`).join(" · ")}
            </p>
          </fieldset>

          {enabled.includes("vote") && (
            <fieldset className="grid gap-2 sm:col-span-2">
              <legend className="mb-2 text-sm font-medium">Voting</legend>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" name="voting" className="accent-primary" checked={!freeVoting} onChange={() => setFreeVoting(false)} />
                One vote per column
              </label>
              <label className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                <input type="radio" name="voting" className="accent-primary" checked={freeVoting} onChange={() => setFreeVoting(true)} />
                Votes to spend freely, at most one per idea:
                <Input
                  type="number"
                  aria-label="Votes per person"
                  className="h-8 w-20"
                  min={FREE_VOTES.min}
                  max={FREE_VOTES.max}
                  value={votesPerPerson}
                  disabled={!freeVoting}
                  onChange={(e) => setVotesPerPerson(Number(e.target.value))}
                />
              </label>
              <p className="text-sm text-muted-foreground">
                Rule of thumb: about the square root of the number of ideas you expect (e.g. 25 ideas → 5 votes).
              </p>
            </fieldset>
          )}

          {enabled.includes("checkin") && (
            <fieldset className="grid gap-2 sm:col-span-2">
              <legend className="mb-2 text-sm font-medium">Check-in question</legend>
              <p className="text-sm text-muted-foreground">
                In the Check-in phase everyone writes a short answer. The question can still be changed on the retro page.
              </p>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" name="checkin" className="accent-primary" checked={ownQuestion === null} onChange={() => setOwnQuestion(null)} />
                A random question from the catalog
              </label>
              {ownQuestion === null && randomQuestion && (
                <div className="ml-6 flex flex-wrap items-center gap-3 rounded-xl border-[1.5px] border-primary/40 bg-secondary/40 px-4 py-3">
                  <p className="min-w-0 flex-1 text-base font-semibold" aria-label="Drawn check-in question">
                    {randomQuestion}
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setRandomQuestion(randomIcebreaker(randomQuestion))}>
                    Another question
                  </Button>
                </div>
              )}
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" name="checkin" className="accent-primary" checked={ownQuestion !== null} onChange={() => setOwnQuestion("")} />
                My own question
              </label>
              {ownQuestion !== null && (
                <Input
                  aria-label="Check-in question"
                  placeholder="e.g. One word for the last sprint?"
                  maxLength={ICEBREAKER_MAX_LENGTH}
                  value={ownQuestion}
                  onChange={(e) => setOwnQuestion(e.target.value)}
                />
              )}
            </fieldset>
          )}

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
