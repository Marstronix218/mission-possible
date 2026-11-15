"use client";
import { useRef, useState } from "react";
import styles from "./planning.module.css";
export const partDragEvent = "codeblue:part-drag";
export interface PartDragDetail {
  phase: "move" | "end" | "cancel";
  slot: string;
  id: string;
  x: number;
  y: number;
}
export function PartDragHandle({
  slot,
  id,
  name,
  onSelect,
  disabled = false,
}: {
  slot: string;
  id: string;
  name: string;
  onSelect: () => void;
  disabled?: boolean;
}) {
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  function emit(phase: PartDragDetail["phase"], x: number, y: number) {
    window.dispatchEvent(
      new CustomEvent<PartDragDetail>(partDragEvent, {
        detail: { phase, slot, id, x, y },
      }),
    );
  }
  return (
    <>
      <button
        type="button"
        className={styles.dragHandle}
        disabled={disabled}
        aria-label={`Pick up ${name}; drag to its mount or press Enter to install`}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          origin.current = { x: e.clientX, y: e.clientY };
          moved.current = false;
        }}
        onPointerMove={(e) => {
          if (!origin.current) return;
          if (
            Math.hypot(
              e.clientX - origin.current.x,
              e.clientY - origin.current.y,
            ) > 8
          )
            moved.current = true;
          if (moved.current) {
            setPointer({ x: e.clientX, y: e.clientY });
            emit("move", e.clientX, e.clientY);
          }
        }}
        onPointerUp={(e) => {
          if (moved.current) emit("end", e.clientX, e.clientY);
          origin.current = null;
          setPointer(null);
        }}
        onPointerCancel={() => {
          origin.current = null;
          setPointer(null);
          moved.current = true;
          emit("cancel", 0, 0);
        }}
        onClick={() => {
          if (!moved.current) onSelect();
          moved.current = false;
        }}
      >
        ⠿ Pick up / attach
      </button>
      {pointer && (
        <span
          className={styles.dragGhost}
          style={{ left: pointer.x + 12, top: pointer.y - 32 }}
        >
          {name}
        </span>
      )}
    </>
  );
}
