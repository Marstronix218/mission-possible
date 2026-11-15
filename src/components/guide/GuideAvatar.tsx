// "Nova", an original helmeted mission-guide companion in brand navy and gold.
// Decorative only: everything Nova says is real text in the speech bubble.
export type GuideMood = "neutral" | "happy" | "thinking";

export function GuideAvatar({ mood }: { mood: GuideMood }) {
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true" focusable="false">
      {/* antenna */}
      <path d="M40 14V5" stroke="#ffd23f" strokeWidth="3" strokeLinecap="round" />
      <circle cx="40" cy="5" r="4" fill="#ffd23f" stroke="#07121b" strokeWidth="1.5" />
      {/* shoulders / suit */}
      <path d="M14 80c2-14 12-20 26-20s24 6 26 20z" fill="#1a2266" stroke="#07121b" strokeWidth="2.5" />
      <path d="M33 62h14l-2 8h-10z" fill="#ffd23f" stroke="#07121b" strokeWidth="2" />
      {/* helmet */}
      <circle cx="40" cy="38" r="26" fill="#22307a" stroke="#07121b" strokeWidth="3" />
      <circle cx="40" cy="38" r="23" fill="none" stroke="#ffd23f" strokeWidth="2.5" opacity="0.9" />
      <rect x="20" y="25" width="40" height="27" rx="13" fill="#07121b" />
      <path d="M25 30c4-3 9-4 14-4" stroke="#8ed5dc" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      {/* face */}
      {mood === "happy" ? (
        <>
          <path d="M29 40q4-5 8 0M43 40q4-5 8 0" stroke="#cbf36b" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M34 45q6 5 12 0" stroke="#cbf36b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      ) : mood === "thinking" ? (
        <>
          <circle cx="33" cy="39" r="3.2" fill="#8ed5dc" />
          <circle cx="47" cy="39" r="3.2" fill="#8ed5dc" />
          <path d="M43 33l8-2" stroke="#8ed5dc" strokeWidth="2" strokeLinecap="round" />
          <circle cx="41" cy="46.5" r="2" fill="#8ed5dc" />
        </>
      ) : (
        <>
          <circle cx="33" cy="39" r="3.2" fill="#8ed5dc" />
          <circle cx="47" cy="39" r="3.2" fill="#8ed5dc" />
          <path d="M35 45q5 3 10 0" stroke="#8ed5dc" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      )}
      {/* ear lights */}
      <rect x="11" y="33" width="6" height="11" rx="3" fill="#ffd23f" stroke="#07121b" strokeWidth="1.5" />
      <rect x="63" y="33" width="6" height="11" rx="3" fill="#ffd23f" stroke="#07121b" strokeWidth="1.5" />
    </svg>
  );
}
