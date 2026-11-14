import type { Metadata } from "next";
import Link from "next/link";
import DemoBanner from "@/components/results/DemoBanner";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "Mission: Possible — Code Blue",
  description: "Design a satellite. Protect your community.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <header className="site-header">
          <Link className="brand" href="/map">
            <span className="brand-icon">✳</span> MISSION: POSSIBLE{" "}
            <small>CODE BLUE</small>
          </Link>
          <nav aria-label="Main">
            <Link href="/map">Mission map</Link>
            <Link href="/classroom">Join class</Link>
            <Link href="/teacher">Teacher</Link>
            <Link href="/leaderboard">Rankings</Link>
          </nav>
        </header>
        <DemoBanner />
        {children}
        <footer>
          MISSION: POSSIBLE / CODE BLUE{" "}
          <span>Learn through exploration. Build for your community.</span>
        </footer>
      </body>
    </html>
  );
}
