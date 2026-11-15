import Link from "next/link";
import { describeDesignChanges } from "@/lib/story/events";
import type { SavedAttempt } from "./session";
import { comparableAttempts } from "./history-model";

const delivery = (a: SavedAttempt) =>
  a.result.firstDeliveryHours === null ? "no delivery" : `${a.result.firstDeliveryHours} h`;

/** Explicit "Attempt 2 vs 1: changed radio UHF → X-band; delivery 9.1 h → 3.2 h". */
export function AttemptComparison({
  attempt,
  comparison,
  history,
  compare,
  onCompareChange,
  resultHref,
}: {
  attempt: SavedAttempt;
  comparison?: SavedAttempt;
  history: SavedAttempt[];
  compare: string;
  onCompareChange: (id: string) => void;
  resultHref: (id: string) => string;
}) {
  const ordered = [...history].sort((a, b) => a.at.localeCompare(b.at));
  const number = (a: SavedAttempt) => ordered.findIndex((x) => x.id === a.id) + 1;
  const changes = comparison ? describeDesignChanges(comparison.design, attempt.design) : [];
  const scoreDelta = comparison ? attempt.result.score.total - comparison.result.score.total : 0;
  return (
    <section className="panel history" aria-labelledby="compare-heading">
      <h2 id="compare-heading">Compare with a different design</h2>
      <label className="field">
        Compare with
        <select value={compare} onChange={(e) => onCompareChange(e.target.value)}>
          <option value="">Previous comparable attempt</option>
          {history
            .filter((a) => comparableAttempts(attempt, a))
            .map((a) => (
              <option key={a.id} value={a.id}>
                Attempt {number(a)} · {new Date(a.at).toLocaleString("en-US")} · {a.result.score.total.toFixed(1)}
              </option>
            ))}
        </select>
      </label>
      {comparison ? (
        <div>
          <h3>
            Attempt {number(attempt)} vs {number(comparison)}
          </h3>
          <p>
            {changes.length ? (
              <>
                You changed: <strong>{changes.join("; ")}</strong>.
              </>
            ) : (
              "Same design both times."
            )}
          </p>
          <ul>
            <li>
              Data delivered: {delivery(comparison)} → {delivery(attempt)}
            </li>
            <li>
              Hazard zones found: {comparison.result.cells.filter((c) => c.truth > 0.5 && c.detected).length} →{" "}
              {attempt.result.cells.filter((c) => c.truth > 0.5 && c.detected).length}
            </li>
            <li>
              Score: {comparison.result.score.total.toFixed(1)} → {attempt.result.score.total.toFixed(1)} (
              {scoreDelta >= 0 ? "+" : ""}
              {scoreDelta.toFixed(1)} points)
            </li>
          </ul>
        </div>
      ) : (
        <p>
          Complete another attempt with the same mission, engine version and constraints to see exactly what your
          changes did.
        </p>
      )}
      <h3>All attempts</h3>
      <ol>
        {[...ordered].reverse().map((a) => (
          <li key={a.id} value={number(a)}>
            <Link href={resultHref(a.id)}>
              Attempt {number(a)} · {new Date(a.at).toLocaleString("en-US")} · {a.result.score.total.toFixed(1)}/100 ·
              delivery {delivery(a)}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
