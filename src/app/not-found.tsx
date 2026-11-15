import Link from "next/link";
export default function NotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="grid place-items-center text-center"
    >
      <div className="max-w-md">
        <svg
          viewBox="0 0 120 120"
          width="140"
          height="140"
          aria-hidden="true"
          className="anim-float mx-auto mb-4"
        >
          <circle
            cx="60"
            cy="60"
            r="34"
            fill="#3a86ff"
            stroke="#070a24"
            strokeWidth="4"
          />
          <path
            d="M40 50c8-6 14 2 22-2s10 8 18 6M38 70c10 4 16-4 26 0"
            fill="none"
            stroke="#8bf05a"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <ellipse
            cx="60"
            cy="60"
            rx="54"
            ry="16"
            fill="none"
            stroke="#ffd23f"
            strokeWidth="3"
            strokeDasharray="6 8"
            transform="rotate(-18 60 60)"
          />
          <text
            x="60"
            y="30"
            textAnchor="middle"
            fontSize="22"
            fontWeight="700"
            fill="#ff5c8a"
          >
            ?
          </text>
        </svg>
        <h1>Lost in space!</h1>
        <p className="mb-8 text-lg">That mission isn&apos;t on our radar.</p>
        <Link className="btn-pop btn-pop--lg" href="/map">
          <span aria-hidden="true">🌍</span> Back to Earth
        </Link>
      </div>
    </main>
  );
}
