"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type RefObject,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { SatelliteDesign } from "@/types/game";
import { partsCatalog } from "@/lib/sim";
import {
  partDragEvent,
  type PartDragDetail,
} from "@/components/planning/PartDragHandle";
import styles from "./gameplay.module.css";
function PhysicalPart({
  className,
  style,
  label,
  onRemove,
  children,
}: {
  className: string;
  style?: CSSProperties;
  label: string;
  onRemove?: () => void;
  children?: ReactNode;
}) {
  return onRemove ? (
    <button
      className={className}
      style={{ ...style, pointerEvents: "auto" }}
      onClick={onRemove}
      aria-label={`Remove ${label}`}
      title={`Remove ${label}`}
    >
      {children}
    </button>
  ) : (
    <div className={className} style={style} role="img" aria-label={label}>
      {children}
    </div>
  );
}
/** Six faces and removable modules share the same 3D transform, not a decorative screenshot. */
export function SatelliteWorkbench({
  design,
  attaching = false,
  targetRef,
  onAttach,
  onRemove,
}: {
  design: SatelliteDesign;
  attaching?: boolean;
  targetRef?: RefObject<HTMLDivElement | null>;
  onAttach?: (slot: string, id: string) => void;
  onRemove?: (slot: string, id: string) => void;
}) {
  const [rotation, setRotation] = useState(-25);
  const rotationDrag = useRef<{ x: number; rotation: number } | null>(null);
  function startRotation(event: PointerEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      (event.target as HTMLElement).closest("input,button,a,label")
    )
      return;
    rotationDrag.current = { x: event.clientX, rotation };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function rotate(event: PointerEvent<HTMLDivElement>) {
    if (rotationDrag.current)
      setRotation(
        rotationDrag.current.rotation +
          (event.clientX - rotationDrag.current.x) * 0.65,
      );
  }
  function stopRotation(event: PointerEvent<HTMLDivElement>) {
    rotationDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const [openBody, setOpenBody] = useState(false);
  const [drag, setDrag] = useState<PartDragDetail | null>(null);
  const localRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const wing =
    design.solar === "solar_l" ? 170 : design.solar === "solar_s" ? 100 : 140;
  useEffect(() => {
    if (!onAttach) return;
    function receive(event: Event) {
      const d = (event as CustomEvent<PartDragDetail>).detail;
      if (!d) return;
      if (d.phase === "move") {
        setDrag(d);
        return;
      }
      setDrag(null);
      if (d.phase !== "end") return;
      const bounds = [
        localRef.current?.getBoundingClientRect(),
        dockRef.current?.getBoundingClientRect(),
      ];
      if (
        bounds.some(
          (b) =>
            b &&
            b.width > 0 &&
            d.x >= b.left &&
            d.x <= b.right &&
            d.y >= b.top &&
            d.y <= b.bottom,
        )
      )
        onAttach?.(d.slot, d.id);
    }
    window.addEventListener(partDragEvent, receive);
    return () => window.removeEventListener(partDragEvent, receive);
  }, [onAttach]);
  const remove = (slot: string, id: string) =>
    onRemove ? () => onRemove(slot, id) : undefined;
  const payloadNames = design.instruments.map(
    (id) => partsCatalog.instruments.find((p) => p.id === id)?.name ?? id,
  );
  return (
    <div
      ref={(el) => {
        localRef.current = el;
        if (targetRef) targetRef.current = el;
      }}
      className={`${styles.workbench} ${styles.interactiveWorkbench} ${attaching || drag ? styles.highlight : ""}`}
      onPointerDown={startRotation}
      onPointerMove={rotate}
      onPointerUp={stopRotation}
      onPointerCancel={stopRotation}
      aria-label="Satellite workbench"
    >
      <div
        className={styles.satellite}
        role="group"
        aria-label={`Satellite assembly: ${payloadNames.join(", ") || "no sensor installed"}`}
        style={{ transform: `rotateX(-18deg) rotateY(${rotation}deg)` }}
      >
        {["front", "back", "left", "right", "top", "bottom"].map((face) => (
          <div
            key={face}
            className={`${styles.face} ${styles[face]}`}
            style={
              openBody
                ? { background: "#12304088", borderStyle: "dashed" }
                : undefined
            }
          >
            {face === "front" &&
              design.instruments.map((id, i) => (
                <PhysicalPart
                  key={id}
                  className={`${styles.sensorLens} ${id === "sar" || id === "pr" ? styles.sensorRadar : id === "tir" || id === "pmw" ? styles.sensorThermal : styles.sensorOptical}`}
                  label={payloadNames[i]}
                  onRemove={remove("instruments", id)}
                  style={
                    design.instruments.length > 1
                      ? {
                          inset: "auto",
                          width: 36,
                          height: 36,
                          left: 8 + (i % 2) * 48,
                          top: 8 + Math.floor(i / 2) * 50,
                          borderWidth: 5,
                        }
                      : undefined
                  }
                />
              ))}
          </div>
        ))}
        {design.solar && (
          <>
            <PhysicalPart
              className={`${styles.panel} ${styles.wingLeft}`}
              style={{ width: wing, left: -wing - 5 }}
              label={`${design.solar} solar array`}
              onRemove={remove("solar", design.solar)}
            />
            <PhysicalPart
              className={`${styles.panel} ${styles.wingRight}`}
              style={{ width: wing }}
              label={`${design.solar} solar array`}
              onRemove={remove("solar", design.solar)}
            />
          </>
        )}
        {design.comm && (
          <PhysicalPart
            className={design.comm === "uhf" ? styles.rod : styles.dish}
            label={`${design.comm} radio and antenna`}
            onRemove={remove("comm", design.comm)}
            style={
              design.comm !== "uhf"
                ? {
                    width:
                      design.comm === "ka_band"
                        ? 65
                        : design.comm === "x_band"
                          ? 50
                          : 35,
                  }
                : undefined
            }
          />
        )}
        {openBody && (
          <>
            {design.battery && (
              <PhysicalPart
                className={styles.internalBattery}
                label={design.battery}
                onRemove={remove("battery", design.battery)}
                style={{
                  width:
                    design.battery === "battery_l"
                      ? 65
                      : design.battery === "battery_m"
                        ? 48
                        : 32,
                }}
              >
                <span>BAT</span>
              </PhysicalPart>
            )}
            {design.storage && (
              <PhysicalPart
                className={styles.internalStorage}
                label={design.storage}
                onRemove={remove("storage", design.storage)}
              >
                <span>{design.storage.replace("storage_", "")} GB</span>
              </PhysicalPart>
            )}
          </>
        )}
      </div>
      {(attaching || drag) && (
        <span className={styles.attachment}>
          {drag ? `${drag.slot} mount` : "Sensor mount"}
          <br />
          Release to attach
        </span>
      )}
      {drag &&
        createPortal(
          <div ref={dockRef} className={styles.mobileMount} role="status">
            ◇ {drag.slot} mount
            <br />
            <strong>Release to snap in</strong>
          </div>,
          document.body,
        )}
      <div className={styles.controls}>
        <label>
          Inspect{" "}
          <input
            aria-label="Rotate satellite"
            type="range"
            min="-180"
            max="180"
            value={Math.max(-180, Math.min(180, rotation))}
            onChange={(e) => setRotation(Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          onClick={() => setOpenBody(!openBody)}
          aria-pressed={openBody}
        >
          {openBody ? "Close body" : "Open body"}
        </button>
      </div>
    </div>
  );
}
export function SensorArt({ id }: { id: string }) {
  const gradientId = `metal-${id}-${useId().replaceAll(":", "")}`;
  return (
    <span className={styles.sensorArt} aria-hidden="true">
      <svg viewBox="0 0 100 80">
        <defs>
          <linearGradient id={gradientId} x2="1" y2="1">
            <stop stopColor="#d4e2e8" />
            <stop offset="1" stopColor="#3c5365" />
          </linearGradient>
        </defs>
        <path d="M20 20L65 10L83 24L40 36Z" fill="#b5c7d2" />
        <path d="M20 20L40 36V70L20 54Z" fill="#526c7a" />
        <path d="M40 36L83 24V58L40 70Z" fill={`url(#${gradientId})`} />
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
