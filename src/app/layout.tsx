import type { Metadata, Viewport } from "next";
import Link from "next/link";
import DemoBanner from "@/components/results/DemoBanner";
import ClassroomMenu from "./_components/ClassroomMenu";
import "./globals.css";
export const metadata: Metadata = {
  title: "Mission: Possible — Code Blue",
  description: "Earth is in danger. Build a satellite. Save the mission.",
};
export const viewport: Viewport = { themeColor: "#070a24" };

function LogoMark() {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
      <rect
        x="2"
        y="12"
        width="9"
        height="8"
        rx="1.5"
        fill="#2de2e6"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="21"
        y="12"
        width="9"
        height="8"
        rx="1.5"
        fill="#2de2e6"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="11"
        y="10"
        width="10"
        height="12"
        rx="3"
        fill="#fff"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M16 10V5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle
        cx="16"
        cy="4"
        r="2"
        fill="#ff5c8a"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
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
          <Link
            className="brand"
            href="/map"
            aria-label="Mission: Possible, Code Blue — home"
          >
            <span className="brand-icon">
              <LogoMark />
            </span>
            <span className="brand-text">
              MISSION: POSSIBLE
              <br />
              <small>CODE BLUE</small>
            </span>
          </Link>
          <nav aria-label="Main">
            <ClassroomMenu />
            <Link className="btn-pop btn-pop--sm" href="/map">
              <span aria-hidden="true">▶</span> Play
            </Link>
          </nav>
        </header>
        <DemoBanner />
        {children}
        <footer className="site-footer">
          <span>
            <strong className="font-display text-foreground">CODE BLUE</strong>{" "}
            · Training game built on NASA Earth data
          </span>
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
