import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Mission: Possible — Code Blue",
  description:
    "Design a satellite. Understand the trade-offs. Protect your community.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
