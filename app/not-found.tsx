import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Page not found</CardTitle>
          <CardDescription>This page does not exist. Retros are opened with their link, e.g. /r/k7f3q9xa.</CardDescription>
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
