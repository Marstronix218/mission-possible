"use client";
import { useRef, useState, type PointerEvent, type RefObject } from "react";
import type { SatelliteDesign } from "@/types/game";
import styles from "./gameplay.module.css";

/** Lightweight geometric 3D model: six CSS faces, physical wings and a replaceable payload. */
export function SatelliteWorkbench({
  design,
  attaching = false,
  targetRef,
}: {
  design: SatelliteDesign;
  attaching?: boolean;
  targetRef?: RefObject<HTMLDivElement | null>;
}) {
  const [rotation, setRotation] = useState(-25);
  const drag = useRef<{ x: number; rotation: number } | null>(null);
  const sensor = design.instruments[0];
  const wing =
    design.solar === "solar_l" ? 170 : design.solar === "solar_s" ? 100 : 140;

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("input")) return;
    drag.current = { x: event.clientX, rotation };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function rotate(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setRotation(
      drag.current.rotation + (event.clientX - drag.current.x) * 0.65,
    );
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const sensorClass =
    sensor === "sar" || sensor === "pr"
      ? styles.sensorRadar
      : sensor === "tir" || sensor === "pmw"
        ? styles.sensorThermal
        : styles.sensorOptical;

  return (
    <div
      ref={targetRef}
      className={`${styles.workbench} ${styles.interactiveWorkbench} ${attaching ? styles.highlight : ""}`}
      aria-label="Satellite workbench"
      onPointerDown={startDrag}
      onPointerMove={rotate}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
    >
      <div
        className={styles.satellite}
        role="img"
        aria-label={`Assembled satellite${sensor ? ` with ${sensor} sensor` : ", empty sensor attachment point"}`}
        style={{ transform: `rotateX(-18deg) rotateY(${rotation}deg)` }}
      >
        {["front", "back", "left", "right", "top", "bottom"].map((face) => (
          <div key={face} className={`${styles.face} ${styles[face]}`}>
            {face === "front" && sensor && (
              <span className={`${styles.sensorLens} ${sensorClass}`} />
            )}
          </div>
        ))}
        <div
          className={`${styles.panel} ${styles.wingLeft}`}
          style={{ width: wing, left: -wing - 5 }}
        />
        <div
          className={`${styles.panel} ${styles.wingRight}`}
          style={{ width: wing }}
        />
        <div className={styles.dish} />
      </div>
      {(!sensor || attaching) && (
        <span className={styles.attachment}>
          {attaching ? "Release to attach" : "Sensor mount"}
        </span>
      )}
      <label className={styles.controls}>
        <span>Drag to inspect</span>
        <input
          aria-label="Rotate satellite"
          type="range"
          min="-180"
          max="180"
          value={Math.max(-180, Math.min(180, rotation))}
          onChange={(e) => setRotation(Number(e.target.value))}
        />
      </label>
    </div>
  );
}

export function SensorArt({ id }: { id: string }) {
  return (
    <span className={styles.sensorArt} aria-hidden="true">
      <svg viewBox="0 0 100 80">
        <defs>
          <linearGradient id={`metal-${id}`} x2="1" y2="1">
            <stop stopColor="#d4e2e8" />
            <stop offset="1" stopColor="#3c5365" />
          </linearGradient>
        </defs>
        <path d="M20 20L65 10L83 24L40 36Z" fill="#b5c7d2" />
        <path d="M20 20L40 36V70L20 54Z" fill="#526c7a" />
        <path d="M40 36L83 24V58L40 70Z" fill={`url(#metal-${id})`} />
        {id === "sar" || id === "pr" ? (
          <path
            d="M43 40L78 30V54L43 63Z"
            fill="#849aab"
            stroke="#e0e9ed"
            strokeWidth="2"
          />
        ) : (
          <ellipse
            cx="61"
            cy="48"
            rx="13"
            ry="15"
            fill="#0b1e2d"
            stroke="#d1e3eb"
            strokeWidth="4"
          />
        )}
      </svg>
    </span>
  );
}
