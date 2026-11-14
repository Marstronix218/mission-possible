import Link from "next/link";
export default function NotFound() {
  return (
    <main>
      <h1>Mission unavailable</h1>
      <p>The MVP demo supports Los Angeles, Houston, and Phoenix.</p>
      <Link href="/map">Return to mission map</Link>
    </main>
  );
}
