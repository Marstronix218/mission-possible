import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import DemoBanner from "@/components/results/DemoBanner";
import { currentCollection } from "@/lib/collections";
import ClassroomMenu from "./_components/ClassroomMenu";
import "./globals.css";

const BRAND = "MISSION: POSSIBLE";
const description =
  "Design a satellite, simulate its mission, and compare what it sees with real NASA Earth observations. CODE BLUE is the first mission collection.";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${BRAND} — Code Blue`,
    template: `%s · ${BRAND}`,
  },
  description,
  applicationName: BRAND,
  openGraph: {
    type: "website",
    siteName: BRAND,
    title: `${BRAND} — Code Blue`,
    description,
    images: [
      {
        url: "/brand/mission-possible-og.png",
        width: 1200,
        height: 630,
        alt: "MISSION: POSSIBLE emblem with the CODE BLUE collection badge",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND} — Code Blue`,
    description,
    images: ["/brand/mission-possible-og.png"],
  },
};

export const viewport: Viewport = { themeColor: "#0b1838" };

function CollectionChip() {
  return (
    <span
      className="collection-chip"
      style={
        { "--collection": currentCollection.accent } as React.CSSProperties
      }
    >
      <span className="collection-chip__label">Collection</span>
      <span className="sr-only">: </span>
      {currentCollection.name}
    </span>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <header className="site-header">
          <div className="brand-lockup">
            <Link className="brand" href="/map" aria-label={`${BRAND} home`}>
              <Image
                className="brand-mark"
                src="/brand/mission-possible-mark.svg"
                alt=""
                width={44}
                height={44}
                priority
                unoptimized
              />
              <Image
                className="brand-wordmark"
                src="/brand/mission-possible-wordmark.svg"
                alt=""
                width={491}
                height={40}
                priority
                unoptimized
              />
            </Link>
            <CollectionChip />
          </div>
          <nav aria-label="Main">
            <ClassroomMenu />
            <Link className="btn-pop btn-pop--sm" href="/map">
              <span aria-hidden="true">▶</span>{" "}
              <span className="play-label">Play</span>
            </Link>
          </nav>
        </header>
        <DemoBanner />
        {children}
        <footer className="site-footer">
          <div className="footer-brand">
            <Image
              src="/brand/mission-possible-wordmark.svg"
              alt={BRAND}
              width={491}
              height={40}
              unoptimized
            />
            <span>
              Now playing:{" "}
              <strong style={{ color: currentCollection.accent }}>
                {currentCollection.name}
              </strong>{" "}
              · Training game built on NASA Earth data
            </span>
          </div>
          <nav aria-label="Classroom">
            <Link href="/classroom">Join a class</Link>
            <Link href="/teacher">Teacher</Link>
            <Link href="/leaderboard">Rankings</Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
