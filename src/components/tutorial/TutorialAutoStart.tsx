"use client";
import { useEffect } from "react";
import { openTutorial, useTutorialSeen } from "./tutorial-state";

/**
 * Opens the How-to-Play tour once for first-time players. Returning players
 * (finished or skipped before) are never shown it again uninvited.
 */
export function TutorialAutoStart() {
  const seen = useTutorialSeen();
  useEffect(() => {
    if (seen === false) openTutorial();
  }, [seen]);
  return null;
}
