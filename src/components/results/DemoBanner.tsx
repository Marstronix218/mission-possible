"use client";
import Link from "next/link";
import { useState } from "react";
import { isMockMode } from "@/lib/data-mode";
import { resetDemo } from "./mock-storage";
export default function DemoBanner() {
  const [message, setMessage] = useState("");
  if (!isMockMode) return null;
  return (
    <aside aria-label="Demo mode">
      <details className="demo-banner">
        <summary>Local practice · progress saved in this browser</summary>
        <div className="actions">
          <span className="chip chip--solid">
            <strong>DEMO</strong>
          </span>
          <span>
            Sample class code <b className="join-code">ORBIT1</b>
            <span className="sr-only">
              {" "}
              — fictional classmates, browser-local classrooms, real simulation
              scores
            </span>
          </span>
          <div className="actions">
            <Link href="/classroom">Student ↗</Link>
            <Link href="/teacher">Teacher ↗</Link>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "Reset only the local mock classroom data and restore fictional sample players?",
                  )
                ) {
                  try {
                    resetDemo();
                    setMessage(
                      "Demo reset. Reload a dashboard to refresh its view.",
                    );
                  } catch {
                    setMessage("Could not reset browser storage.");
                  }
                }
              }}
            >
              Reset demo
            </button>
          </div>
          {message && <p role="status">{message}</p>}
        </div>
      </details>
    </aside>
  );
}
