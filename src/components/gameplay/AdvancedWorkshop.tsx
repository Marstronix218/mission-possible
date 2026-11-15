"use client";
import Link from "next/link";
import { useEffect } from "react";
import type { Mission } from "@/types/game";
import { SatelliteDesigner } from "@/components/designer/satellite-designer";
import { modeKey } from "./beginner-model";
import styles from "./gameplay.module.css";
export default function AdvancedWorkshop({
  mission,
  fix,
}: {
  mission: Mission;
  fix?: string | string[];
}) {
  useEffect(() => {
    try {
      localStorage.setItem(modeKey(mission.slug), "advanced");
    } catch {}
  }, [mission.slug]);
  return (
    <>
      <div className={styles.row}>
        <p>Advanced Mode · Full engineering workshop</p>
        <Link
          className={styles.secondary}
          href={`/mission/${mission.slug}/design`}
          onClick={() => {
            try {
              localStorage.setItem(modeKey(mission.slug), "beginner");
            } catch {}
          }}
        >
          Explorer Mode
        </Link>
      </div>
      <SatelliteDesigner mission={mission} fix={fix} />
    </>
  );
}
