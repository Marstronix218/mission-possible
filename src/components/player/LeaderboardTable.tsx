import type { Ranking } from "@/components/results/contracts";

/** Ranking table that marks the player's own row with text, not only color. */
export function LeaderboardTable({
  rows,
  caption = "Highest score per player · ties go to the earliest achievement",
}: {
  rows: Ranking[];
  caption?: string;
}) {
  return (
    <div className="table-scroll">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Pilot</th>
            <th scope="col">Best score</th>
            <th scope="col">Attempts</th>
            <th scope="col">Improvement</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.entry_id}
              aria-current={r.mine ? "true" : undefined}
              style={
                r.mine
                  ? {
                      background: "#ffd23f24",
                      outline: "2px solid var(--pop-yellow)",
                      outlineOffset: -2,
                    }
                  : undefined
              }
            >
              <td>{r.entry_id}</td>
              <th scope="row">
                {r.nickname}
                {r.mine && <strong className="ml-2 font-display">★ You</strong>}
              </th>
              <td>{Number(r.score).toFixed(1)}</td>
              <td>{r.attempts}</td>
              <td>+{Number(r.improvement).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p>No scores yet. Launch a mission to set the first score.</p>
      )}
    </div>
  );
}
