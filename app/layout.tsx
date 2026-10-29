import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
      <body className="flex min-h-full flex-col">
        <ConvexClientProvider>{children}</ConvexClientProvider>
        <footer className="px-4 py-6 text-center text-xs text-muted-foreground">
          v{process.env.NEXT_PUBLIC_APP_VERSION}
        </footer>
      </body>
    </html>
  );
}
