/** Three-star progress badge. Purely visual; pair with a text/aria label. */
export default function Stars({
  count,
  size = "1rem",
}: {
  count: number;
  size?: string;
}) {
  return (
    <span className="stars" style={{ fontSize: size }} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < count ? "is-on" : undefined}>
          ★
        </span>
      ))}
    </span>
  );
}
