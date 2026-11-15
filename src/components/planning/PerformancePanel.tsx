import {
  categoryLabel,
  installedIds,
  optionName,
  performanceAxes,
  tradeOffNotes,
  type PerfCategory,
  type PerfContext,
} from "./component-performance";
import {
  ComponentRadar,
  seriesStyle,
  type RadarSeries,
} from "./ComponentRadar";

export function RadarLegend({
  installed,
  alternative,
}: {
  installed?: string;
  alternative?: string;
}) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs">
      {installed && (
        <li className="inline-flex items-center gap-1.5">
          <svg width="26" height="10" aria-hidden="true">
            <line
              x1="1"
              y1="5"
              x2="25"
              y2="5"
              stroke={seriesStyle.installed.stroke}
              strokeWidth="3"
            />
            <circle
              cx="13"
              cy="5"
              r="3.5"
              fill={seriesStyle.installed.stroke}
            />
          </svg>
          <span>
            <b>Installed</b> (solid): {installed}
          </span>
        </li>
      )}
      {alternative && (
        <li className="inline-flex items-center gap-1.5">
          <svg width="26" height="10" aria-hidden="true">
            <line
              x1="1"
              y1="5"
              x2="25"
              y2="5"
              stroke={seriesStyle.alternative.stroke}
              strokeWidth="3"
              strokeDasharray="6 4"
            />
            <rect
              x="9.5"
              y="1.5"
              width="7"
              height="7"
              fill={seriesStyle.alternative.stroke}
            />
          </svg>
          <span>
            <b>Alternative</b> (dashed): {alternative}
          </span>
        </li>
      )}
    </ul>
  );
}

export const RADAR_CAPTION =
  "The chart shows relative component characteristics within this category, not your mission score. A bigger polygon does not mean a better mission.";

/**
 * Installed vs. previewed (hovered/focused) option for one category, with axis
 * definitions, actual values and mission-specific trade-off notes.
 */
export function PerformancePanel({
  category,
  preview,
  ctx,
}: {
  category: PerfCategory;
  preview: string | null;
  ctx: PerfContext;
}) {
  const installed = installedIds(category, ctx.design);
  const alt =
    preview && !(category !== "instruments" && installed.includes(preview))
      ? preview
      : null;
  const series: RadarSeries[] = [
    ...installed.map((id) => ({
      name: optionName(category, id),
      kind: "installed" as const,
      axes: performanceAxes(category, id, ctx),
    })),
    ...(alt && !installed.includes(alt)
      ? [
          {
            name: optionName(category, alt),
            kind: "alternative" as const,
            axes: performanceAxes(category, alt, ctx),
          },
        ]
      : []),
  ].filter((s) => s.axes.length > 0);
  const focus = alt ?? installed[0] ?? null;
  // With nothing previewed, describe an installed sensor as fitted (not its removal).
  const notes = !focus
    ? []
    : !alt && category === "instruments"
      ? tradeOffNotes(category, focus, {
          ...ctx,
          design: {
            ...ctx.design,
            instruments: ctx.design.instruments.filter((id) => id !== focus),
          },
        })
      : tradeOffNotes(category, focus, ctx);
  const axes = series[0]?.axes ?? [];
  const title = categoryLabel[category];
  const installedNames = installed
    .map((id) => optionName(category, id))
    .join(", ");
  const altName =
    alt && !installed.includes(alt) ? optionName(category, alt) : undefined;

  return (
    <section
      aria-label={`${title} performance comparison`}
      className="rounded-[var(--radius)] border-2 border-border bg-space-900/70 p-3 text-sm"
    >
      <h3 className="!m-0 font-display text-base font-bold !tracking-normal">
        {title}: compare characteristics
      </h3>
      {series.length === 0 ? (
        <p className="mt-2 text-muted-foreground">
          Nothing installed yet. Hover over or focus a card to see its
          characteristics here.
        </p>
      ) : (
        <>
          <div className="mt-2">
            <RadarLegend
              installed={installedNames || undefined}
              alternative={altName}
            />
          </div>
          <ComponentRadar
            series={series}
            label={`${title}: ${series.map((s) => s.name).join(" vs ")}`}
          />
        </>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        {RADAR_CAPTION} Hover over or focus a card to compare it with what is
        installed.
      </p>
      {notes.length > 0 && focus && (
        <div
          aria-live="polite"
          className="mt-2 rounded-xl border-2 border-pop-yellow/50 bg-space-950/60 p-2.5"
        >
          <p className="!m-0 text-xs font-black tracking-wider text-pop-yellow">
            TRADE-OFFS FOR THIS MISSION · {optionName(category, focus)}
          </p>
          <ul className="!mt-1 mb-0 list-disc pl-4">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
      {axes.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer font-bold">
            What the axes mean
          </summary>
          <dl className="mt-1 grid gap-1.5">
            {axes.map((axis, i) => (
              <div key={axis.id}>
                <dt className="font-bold">
                  <abbr title={axis.formula} className="no-underline">
                    {axis.label}
                  </abbr>
                </dt>
                <dd className="m-0 text-muted-foreground">
                  {axis.meaning}{" "}
                  <span className="font-mono text-xs text-foreground">
                    {series
                      .map(
                        (s) =>
                          `${s.name}: ${s.axes[i]?.actual} (${Math.round(s.axes[i]?.value ?? 0)})`,
                      )
                      .join(" · ")}
                  </span>
                  <br />
                  <span className="text-xs">Formula: {axis.formula}</span>
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </section>
  );
}
