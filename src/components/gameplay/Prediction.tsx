"use client";

import { useSyncExternalStore } from "react";
import type { Mission, SimResult } from "@/types/game";

export type Prediction = "on-time" | "late-or-none";
const key = (id: string) => `mission-possible:prediction:${id}`;
const subscribe = () => () => {};
const serverSnapshot = () => null;

export function savePrediction(id: string, prediction: Prediction | null) {
  if (!prediction) return;
  try {
    localStorage.setItem(key(id), prediction);
  } catch {
    // Optional comparison must never prevent saving a mission result.
  }
}

function readPrediction(id: string): Prediction | null {
  try {
    const value = localStorage.getItem(key(id));
    return value === "on-time" || value === "late-or-none" ? value : null;
  } catch {
    return null;
  }
}

export function PredictionComparison({ id, mission, result }: {
  id: string;
  mission: Mission;
  result: SimResult;
}) {
  const prediction = useSyncExternalStore(subscribe, () => readPrediction(id), serverSnapshot);
  if (!prediction) return null;

  const hours = result.firstDeliveryHours;
  const deadline = mission.targetResponseHours;
  // The engine reports a rounded delivery time. Compare the same value shown to the player.
  const onTime = hours !== null && hours <= deadline;
  const matched = onTime === (prediction === "on-time");

  return (
    <section className="panel" aria-labelledby="prediction-comparison">
      <h2 id="prediction-comparison">Prediction check</h2>
      <p>You expected {prediction === "on-time" ? "a delivery within" : "no delivery within"} {deadline} hours.</p>
      <p>{hours === null ? "No target detection reached Earth." : `The first target detection reached Earth after ${hours} hours.`}</p>
      <p>{matched ? "The result matched your prediction." : "The result differed from your prediction."}</p>
    </section>
  );
}
