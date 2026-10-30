import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PHASE_LABELS } from "@/convex/lib/agenda";
import { phaseIndex, schedule } from "@/convex/lib/phases";
import { formatOffset } from "@/lib/timer";
import { cn } from "@/lib/utils";
import type { Retro } from "./types";

export function AgendaCard({ retro }: { retro: Retro }) {
  const current = phaseIndex(retro.state, retro.enabledPhases);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{retro.lengthMin}-minute agenda</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-1">
          {schedule(retro.enabledPhases, retro.agenda).map((row, i) => (
            <li
              key={row.phase}
              aria-current={i === current ? "step" : undefined}
              className={cn(
                "grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 rounded-lg px-3 py-2.5",
                i === current && "bg-secondary font-semibold",
                i < current && "text-muted-foreground",
              )}
            >
              <span className="font-bold text-primary tabular-nums">{formatOffset(row.startMin)}</span>
              <span className={cn(i < current && "line-through")}>{PHASE_LABELS[row.phase]}</span>
              <span className="text-sm text-muted-foreground">{row.minutes} min</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
