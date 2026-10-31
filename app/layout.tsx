import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Retro Meeting",
  description: "Real-time team retrospectives: keep, fix, try.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background">
        <nav className="border-b bg-card">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5">
            <span className="flex items-baseline gap-2">
              <Link href="/" className="font-bold tracking-tight">
                Retro Meeting
              </Link>
              <span className="text-xs text-muted-foreground">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
            </span>
            <Link href="/new" className="text-sm font-semibold text-primary">
              + New retro
            </Link>
          </div>
        </nav>
        <ConvexClientProvider>
          <ConnectionBanner />
          <div className="flex-1">{children}</div>
        </ConvexClientProvider>
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
