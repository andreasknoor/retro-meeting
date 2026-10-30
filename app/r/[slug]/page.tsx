import type { Metadata } from "next";
import { Suspense } from "react";
import { RetroLoading, RetroScreen } from "@/components/retro/RetroScreen";

// Retros are private; keep them out of search engines.
export const metadata: Metadata = { title: "Retro · Retro Meeting", robots: { index: false } };

// Not async: the params promise is awaited inside Suspense so the shell stays static.
export default function RetroPage({ params }: PageProps<"/r/[slug]">) {
  return (
    <Suspense fallback={<RetroLoading />}>
      {params.then(({ slug }) => (
        <RetroScreen slug={slug} />
      ))}
    </Suspense>
  );
}
