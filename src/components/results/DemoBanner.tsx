"use client";
import Link from "next/link";
import { useState } from "react";
import { isMockMode } from "@/lib/data-mode";
import { resetDemo } from "./mock-storage";
export default function DemoBanner() {
  const [message, setMessage] = useState("");
  if (!isMockMode) return null;
  return (
    <aside className="demo-banner" aria-label="Demo mode">
      <div>
        <strong>MOCK DATA MODE</strong>
        <span>
          Fictional classmates · Browser-local classrooms · Real simulation
          scores · No Supabase requests
        </span>
        <span>
          Sample class code: <b>ORBIT1</b>
        </span>
      </div>
      <div className="actions">
        <Link href="/classroom">Try student flow ↗</Link>
        <Link href="/teacher">Try teacher flow ↗</Link>
        <button
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
    </aside>
  );
}
