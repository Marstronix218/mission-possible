"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { Mission } from "@/types/game";
import { neutralObstacle } from "@/components/gameplay/beginner-model";
import styles from "./planning.module.css";
export function EnvelopeLetter({
  mission,
  onExplore,
}: {
  mission?: Mission;
  onExplore?: () => void;
}) {
  const [opened, setOpened] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  return (
    <section
      className={styles.letterScene}
      aria-label={
        mission ? `Mission letter from ${mission.city}` : "Welcome to Code Blue"
      }
    >
      <p className={styles.incoming}>
        Incoming{" "}
        {mission ? `mission / ${mission.city}` : "message / Mission operations"}
      </p>
      <button
        autoFocus={!mission}
        disabled={opened}
        aria-hidden={opened}
        tabIndex={opened ? -1 : 0}
        className={`${styles.envelope} ${opened ? styles.envelopeOpened : ""}`}
        onClick={() => {
          setOpened(true);
          requestAnimationFrame(() => heading.current?.focus());
        }}
        aria-label={
          mission
            ? `Open mission envelope from ${mission.city}`
            : "Open welcome envelope"
        }
      >
        <span className={styles.flap} />
        <span className={styles.seal}>CB</span>
        <span className={styles.envelopeText}>
          {mission ? `From ${mission.city}` : "To our next mission designer"}
        </span>
      </button>
      {!opened && <p>Click the envelope to open your letter.</p>}
      <div hidden={!opened} className={styles.paper}>
        <p>Dear Mission Designer,</p>
        <h2 ref={heading} tabIndex={-1}>
          {mission
            ? `${mission.city} needs your eyes in space.`
            : "Welcome to CODE BLUE."}
        </h2>
        <p>
          {mission
            ? mission.objective.en
            : "Your mission: build an Earth-observation satellite and help a community understand its changing environment."}
        </p>
        <p>
          {mission
            ? `${neutralObstacle(mission)} We need your first useful observations within ${mission.targetResponseHours} hours.`
            : "Choose a place on the map. Compare parts, plan your orbit, then launch and discover what your satellite can see."}
        </p>
        <p className={styles.signature}>
          — {mission ? `${mission.city} research team` : "Mission Operations"}
          <br />
          <small>Fictional educational mission request</small>
        </p>
        {mission ? (
          <Link href={`/mission/${mission.slug}/design`}>ACCEPT MISSION →</Link>
        ) : (
          <button onClick={onExplore}>EXPLORE THE U.S. →</button>
        )}
      </div>
    </section>
  );
}
export function WelcomeLetter() {
  const [open, setOpen] = useState(true);
  const [letterKey, setLetterKey] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialogRef.current?.open) dialogRef.current?.showModal();
    if (!open && dialogRef.current?.open) dialogRef.current.close();
  }, [open]);
  function dismiss() {
    setOpen(false);
  }
  return (
    <>
      <button
        className={styles.welcomeButton}
        onClick={() => {
          setLetterKey((k) => k + 1);
          setOpen(true);
        }}
      >
        ✉ Mission welcome
      </button>
      <dialog
        ref={dialogRef}
        className={styles.modal}
        aria-label="Welcome mission letter"
        onCancel={(e) => {
          e.preventDefault();
          dismiss();
        }}
        onClose={() => {
          if (open) dismiss();
        }}
      >
        <button
          className={styles.close}
          onClick={dismiss}
          aria-label="Close welcome letter"
        >
          ×
        </button>
        <EnvelopeLetter key={letterKey} onExplore={dismiss} />
      </dialog>
    </>
  );
}
