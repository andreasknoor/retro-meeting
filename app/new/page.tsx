import type { Metadata } from "next";
import Link from "next/link";
import { NewRetroForm } from "@/components/retro/NewRetroForm";

export const metadata: Metadata = { title: "New retro · Retro Meeting" };

export default function NewRetroPage() {
  return (
    <main className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-8">
      <Link href="/" className="text-sm font-semibold text-primary">
        ← Back
      </Link>
      <NewRetroForm />
    </main>
  );
}
