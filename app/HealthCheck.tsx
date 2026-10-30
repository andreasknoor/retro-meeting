"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function HealthCheck() {
  const ping = useQuery(api.health.ping);

  if (ping === undefined) {
    return <p className="text-muted-foreground">Connecting to backend…</p>;
  }
  return <p className="text-emerald-700">✓ Backend connected</p>;
}
