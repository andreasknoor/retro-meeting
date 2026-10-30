"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseRetroLink } from "@/lib/slug";

export function OpenLinkForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function open(e: React.FormEvent) {
    e.preventDefault();
    const slug = parseRetroLink(value);
    if (!slug) {
      setError("That doesn't look like a retro link.");
      return;
    }
    router.push(`/r/${slug}`);
  }

  return (
    <form onSubmit={open} className="grid gap-2">
      <Label htmlFor="retro-link">Have a link?</Label>
      <div className="flex gap-2">
        <Input
          id="retro-link"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="https://…/r/k7f3q9xa"
          aria-invalid={error !== null}
        />
        <Button type="submit" variant="outline">
          Open
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
