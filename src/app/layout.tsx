import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mission: Possible — Code Blue",
  description: "Design an Earth observation satellite and explore its trade-offs.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:bg-card focus:p-3" href="#main-content">
          Skip to content
        </a>
        <header className="border-b border-border">
          <div className="mx-auto flex min-h-16 max-w-6xl items-center px-5 sm:px-8">
            <Link className="font-semibold tracking-tight" href="/">
              Mission: Possible <span className="ml-2 text-primary">Code Blue</span>
            </Link>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-20">
          {children}
        </main>
      </body>
    </html>
  );
}
