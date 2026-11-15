import { Fragment } from "react";
import type { Ranking } from "@/components/results/contracts";

/**
 * Ranking table that marks the player's own row with text, not only color.
 * `entry_id` is the rank; a row whose rank jumps (the player's own row below
 * the top list) gets a separator so the gap is explicit.
 */
export function LeaderboardTable({
  rows,
  caption = "Highest score per player · ties go to the earliest achievement",
  mission,
  difficulty,
  emptyText = "No scores yet. Launch a mission to set the first score.",
}: {
  rows: Ranking[];
  caption?: string;
  /** Adds a Mission column (the same for every row in one scope). */
  mission?: string;
  /** Adds a Difficulty column (the same for every row in one scope). */
  difficulty?: string;
  emptyText?: string;
}) {
  const columns = 5 + (mission ? 1 : 0) + (difficulty ? 1 : 0);
  return (
    <div className="table-scroll">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Pilot</th>
            <th scope="col">Best score</th>
            {mission && <th scope="col">Mission</th>}
            {difficulty && <th scope="col">Difficulty</th>}
            <th scope="col">Attempts</th>
            <th scope="col">Improvement</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <Fragment key={r.entry_id}>
              {i > 0 && r.entry_id > rows[i - 1].entry_id + 1 && (
                <tr aria-hidden="true">
                  <td colSpan={columns} className="text-center">
                    ⋯
                  </td>
                </tr>
              )}
              <tr
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
                <td>#{r.entry_id}</td>
                <th scope="row">
                  {r.nickname}
                  {r.mine && (
                    <strong className="ml-2 font-display">★ You</strong>
                  )}
                </th>
                <td>{Number(r.score).toFixed(1)}</td>
                {mission && <td>{mission}</td>}
                {difficulty && <td>{difficulty}</td>}
                <td>{r.attempts}</td>
                <td>+{Number(r.improvement).toFixed(1)}</td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
      {!rows.length && <p>{emptyText}</p>}
    </div>
  );
}
