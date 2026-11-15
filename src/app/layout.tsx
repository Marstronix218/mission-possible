import type { Metadata } from "next";
import Link from "next/link";
import DemoBanner from "@/components/results/DemoBanner";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { Fredoka, Nunito } from "next/font/google";

const display = Fredoka({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display-face", display: "swap" });
const body = Nunito({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-body", display: "swap" });
export const metadata: Metadata = {
  title: "Mission: Possible — Code Blue",
  description: "Design a satellite. Protect your community.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
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
            <Link href="/map">Missions</Link>
            <Link href="/classroom">Join class</Link>
            <Link href="/teacher">Teacher</Link>
            <Link href="/leaderboard">Rankings</Link>
          </nav>
        </header>
        <DemoBanner />
        {children}
        <footer>
          MISSION: POSSIBLE / CODE BLUE{" "}
          <span>
            Training scenarios. Real satellite trade-offs. Your city is counting on
            you.
          </span>
        </footer>
      </body>
    </html>
  );
}
