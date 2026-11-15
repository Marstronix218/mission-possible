"use client";
import { useEffect, useId, useRef, useState } from "react";
import { usePlayerName } from "./player-name";
import { PlayerNameForm } from "./PlayerNameForm";

/** Header chip showing the remembered pilot name, with an edit dialog. */
export function PlayerChip() {
  const name = usePlayerName();
  const [editing, setEditing] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = dialog.current;
    if (editing && el && !el.open) el.showModal();
  }, [editing]);

  if (!name) return null;
  const close = () => {
    dialog.current?.close();
    setEditing(false);
    trigger.current?.focus();
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="btn-pop btn-pop--ghost btn-pop--sm"
        aria-label={`Pilot: ${name}. Change pilot name`}
        onClick={() => setEditing(true)}
      >
        <span aria-hidden="true">🧑‍🚀</span>
        <span className="hidden max-w-[10rem] truncate sm:inline">
          Pilot: {name}
        </span>
        <span aria-hidden="true">✎</span>
      </button>
      {editing && (
        <dialog
          ref={dialog}
          aria-labelledby={titleId}
          className="panel form-panel"
          style={{
            margin: "auto",
            color: "inherit",
            width: "min(520px, 92vw)",
          }}
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
        >
          <h2 id={titleId} className="mt-0 font-display">
            Change pilot name
          </h2>
          <p>
            Your leaderboard name updates the next time a mission result loads.
          </p>
          <PlayerNameForm
            key={name}
            initial={name}
            submitLabel="Save name"
            onSaved={close}
          />
          <button
            type="button"
            className="btn-pop btn-pop--ghost btn-pop--sm"
            onClick={close}
          >
            Cancel
          </button>
        </dialog>
      )}
    </>
  );
}
