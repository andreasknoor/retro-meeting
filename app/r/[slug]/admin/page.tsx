import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminScreen } from "@/components/admin/AdminScreen";

export const metadata: Metadata = { title: "Admin · Retro Meeting", robots: { index: false } };

export default function AdminPage({ params }: PageProps<"/r/[slug]/admin">) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-3xl px-4 py-16 text-muted-foreground">Loading…</p>}>
      {params.then(({ slug }) => (
        <AdminScreen slug={slug} />
      ))}
    </Suspense>
  );
}
