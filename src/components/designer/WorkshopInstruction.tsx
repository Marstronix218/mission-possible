"use client";
import { useEffect, useRef } from "react";
import type { Mission } from "@/types/game";
import { workshopDecisions } from "./workshop-flow";
import styles from "./workshop-instruction.module.css";
/** A conceptual explanation, never a simulated observation or orbital prediction. */
export function WorkshopInstruction({
  mission,
  index,
  onContinue,
  onBack,
}: {
  mission: Mission;
  index: number;
  onContinue: () => void;
  onBack: () => void;
}) {
  const step = workshopDecisions[index];
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus();
    window.scrollTo({ top: 0 });
  }, [index]);
  const sensor = step.slot === "instruments",
    power = step.slot === "solar",
    battery = step.slot === "battery",
    memory = step.slot === "storage",
    orbit = step.slot === "orbit",
    radio = step.slot === "comm" || step.slot === "groundStations";
  const target =
    mission.category === "wildfire"
      ? "wildfire heat and smoke"
      : mission.category === "heat"
        ? "surface heat"
        : mission.category.replaceAll("-", " ");
  return (
    <section
      className={styles.screen}
      aria-labelledby="workshop-instruction-title"
    >
      <p className={styles.kicker}>
        {mission.city} / WORKSHOP · {index + 1} OF {workshopDecisions.length}
      </p>
      <ol className={styles.progress} aria-label="Workshop progress">
        {workshopDecisions.map((d, i) => (
          <li key={d.slot} aria-current={i === index ? "step" : undefined}>
            <span>{i + 1}</span>
            <span className="sr-only">{d.title}</span>
          </li>
        ))}
      </ol>
      <h1 id="workshop-instruction-title" tabIndex={-1} ref={title}>
        {step.title}
      </h1>
      <p className={styles.task}>{step.task}</p>
      <svg
        className={styles.diagram}
        viewBox="0 0 680 280"
        role="img"
        aria-label={
          sensor
            ? `Concept: satellite sensor observing ${target} in ${mission.city}`
            : step.title + " concept diagram"
        }
      >
        <defs>
          <radialGradient id="tutorial-earth">
            <stop stopColor="#3d797d" />
            <stop offset="1" stopColor="#102c4a" />
          </radialGradient>
          <linearGradient id="tutorial-panel">
            <stop stopColor="#3764a2" />
            <stop offset="1" stopColor="#142a52" />
          </linearGradient>
        </defs>
        <path
          d="M-10 285 Q190 102 420 285"
          fill="url(#tutorial-earth)"
          stroke="#86aebb"
          strokeWidth="2"
        />
        <path
          d="M45 251L98 223 128 239 176 209 198 225 240 212 275 251"
          fill="#719c77"
          opacity=".65"
        />
        <g className={orbit ? styles.orbiting : undefined}>
          <path
            d="M148 77h112v40H148zM310 77h112v40H310z"
            fill="url(#tutorial-panel)"
            stroke="#8294ae"
            strokeWidth="2"
          />
          {[160, 180, 200, 220, 240, 322, 342, 362, 382, 402].map((x) => (
            <path key={x} d={`M${x} 78v38`} stroke="#8ca3c3" opacity=".5" />
          ))}
          <path
            d="M263 66l44 10v48l-44-8z"
            fill="#bdac81"
            stroke="#dcd4b8"
            strokeWidth="2"
          />
          <path
            d="M263 66l16-11 44 10-16 11M307 76l16-11v48l-16 11"
            fill="#7e8791"
            stroke="#bac2c6"
          />
          <circle
            cx="282"
            cy="118"
            r="9"
            fill="#0d2231"
            stroke="#cfdae1"
            strokeWidth="3"
          />
        </g>
        {sensor && (
          <>
            <path
              d="M282 130L165 234 247 236Z"
              fill="#edac6155"
              stroke="#f2c383"
              strokeDasharray="7 5"
            />
            {mission.category === "wildfire" ? (
              <path
                d="M191 230q-12-14 3-25 3 9 7 5 11 13 0 21"
                fill="#e5a363"
              />
            ) : (
              <g
                stroke={mission.category === "heat" ? "#e5a363" : "#9fcbd4"}
                fill="none"
                strokeWidth="3"
              >
                <path d="M185 233q-7-8 0-16t0-16M200 233q-7-8 0-16t0-16M215 233q-7-8 0-16t0-16" />
              </g>
            )}
            <text x="360" y="181" fill="#ecf2f4" fontSize="18">
              {mission.category === "wildfire"
                ? "Heat ≠ visible light"
                : `Observe ${target}`}
            </text>
            <text x="360" y="209" fill="#a6bec7" fontSize="15">
              Sensor choice changes what can be detected.
            </text>
          </>
        )}
        {power && (
          <>
            <circle cx="70" cy="53" r="24" fill="#f5da8d" />
            <path
              className={styles.flow}
              d="M100 55L150 88M98 73L150 103"
              stroke="#f5da8d"
              strokeWidth="4"
              strokeDasharray="8 8"
            />
            <path
              className={styles.flow}
              d="M418 97H555"
              stroke="#b2ddb1"
              strokeWidth="4"
              strokeDasharray="10 8"
            />
            <text x="447" y="78" fill="#edf5f5" fontSize="20">
              Electricity
            </text>
            <text x="439" y="134" fill="#b1c8d0" fontSize="16">
              Power must meet demand.
            </text>
          </>
        )}
        {battery && (
          <>
            <path
              d="M440 50h140v75H440zM580 75h10v25h-10"
              fill="none"
              stroke="#d4e1e5"
              strokeWidth="4"
            />
            <rect
              className={styles.charge}
              x="449"
              y="59"
              width="121"
              height="57"
              fill="#a3ccaa"
            />
            <text x="429" y="158" fill="#edf5f5" fontSize="18">
              Charge → eclipse power
            </text>
            <path
              d="M315 180a70 70 0 0 0 90 72 77 77 0 0 1-90-72"
              fill="#8eabc0"
            />
          </>
        )}
        {memory && (
          <>
            <rect
              x="457"
              y="44"
              width="100"
              height="94"
              rx="6"
              fill="#354a5c"
              stroke="#b3c8d0"
              strokeWidth="3"
            />
            {[0, 1, 2].map((i) => (
              <rect
                key={i}
                x="470"
                y={57 + i * 24}
                width="73"
                height="12"
                fill="#9abcc4"
              />
            ))}
            <path
              className={styles.flow}
              d="M326 118Q405 180 455 100"
              fill="none"
              stroke="#a9dfdb"
              strokeWidth="3"
              strokeDasharray="8 8"
            />
            <text x="423" y="193" fill="#eaf2f4" fontSize="18">
              Collect → store → transmit
            </text>
          </>
        )}
        {radio && (
          <>
            <path
              className={styles.flow}
              d="M299 130L432 225"
              stroke="#8ed5df"
              strokeWidth="3"
              strokeDasharray="8 8"
            />
            <path
              d="M410 212q28 38 56-5M438 227v26m-16 0h32"
              stroke="#ccdbe0"
              strokeWidth="4"
              fill="none"
            />
            <text x="420" y="169" fill="#edf5f5" fontSize="18">
              Contact window
            </text>
            <text x="420" y="193" fill="#b2c8d0" fontSize="15">
              A radio needs a station in view.
            </text>
          </>
        )}
        {orbit && (
          <>
            <ellipse
              cx="221"
              cy="215"
              rx="187"
              ry="89"
              stroke="#a7d5de"
              strokeDasharray="5 5"
              fill="none"
              transform="rotate(-15 221 215)"
            />
            <path d="M280 131L189 228 248 238Z" fill="#93cbd344" />
            <text x="431" y="179" fill="#edf5f5" fontSize="18">
              Path → footprint → target
            </text>
            <text x="431" y="206" fill="#b2c8d0" fontSize="15">
              An orbit is a repeated path.
            </text>
          </>
        )}
        {step.slot === "review" && (
          <>
            <path
              d="M465 87l23 23 48-52"
              fill="none"
              stroke="#b5dfb1"
              strokeWidth="7"
            />
            <text x="420" y="165" fill="#edf5f5" fontSize="18">
              Check, then experiment.
            </text>
          </>
        )}
      </svg>
      <p className={styles.caption}>
        Concept diagram · {mission.city} training mission · not a NASA
        observation or calculated flight path
      </p>
      <ul className={styles.concepts}>
        {step.concepts.map((c, i) => (
          <li key={c}>
            <span aria-hidden="true">{["◎", "↔", "✓"][i]}</span>
            {c}
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        <button onClick={onBack} className={styles.back}>
          ← Back
        </button>
        <button onClick={onContinue} className={styles.continue}>
          CONTINUE →
        </button>
      </div>
    </section>
  );
}
