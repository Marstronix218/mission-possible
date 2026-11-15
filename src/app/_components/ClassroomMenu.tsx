"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

const items = [
  {
    href: "/classroom",
    label: "Join a class",
    icon: "🎒",
    tile: "var(--pop-lime)",
  },
  { href: "/teacher", label: "Teacher", icon: "🍎", tile: "var(--pop-pink)" },
  {
    href: "/leaderboard",
    label: "Rankings",
    icon: "🏆",
    tile: "var(--pop-yellow)",
  },
];

/** Compact disclosure that holds the secondary classroom routes. */
export default function ClassroomMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const isOpen = open;

  useEffect(() => {
    if (!isOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  return (
    <div className="menu" ref={root}>
      <button
        ref={toggle}
        type="button"
        className="btn-pop btn-pop--ghost btn-pop--sm"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setOpen(!isOpen)}
      >
        <span aria-hidden="true">🎓</span>
        <span className="hidden sm:inline">Classroom</span>
        <span className="sr-only sm:hidden">Classroom menu</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          width="12"
          height="12"
          className={"transition-transform " + (isOpen ? "rotate-180" : "")}
        >
          <path
            d="M2 4l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {isOpen && (
        <ul id={panelId} className="menu-panel">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                style={{ "--tile": item.tile } as React.CSSProperties}
                aria-current={pathname === item.href ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
