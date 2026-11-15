"use client";
import { useId, useState } from "react";
import { nicknameSchema } from "@/components/results/contracts";
import { savePlayerName } from "./player-name";

/** Shared pilot-name form for the first-mission gate and the header chip. */
export function PlayerNameForm({
  initial = "",
  submitLabel,
  onSaved,
}: {
  initial?: string;
  submitLabel: string;
  onSaved?: (name: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  const inputId = useId();
  const errorId = useId();
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = nicknameSchema.safeParse(value);
        if (!parsed.success) {
          const length = value.trim().length;
          setError(
            length < 2
              ? "Use at least 2 characters."
              : length > 24
                ? "Use 24 characters or fewer."
                : (parsed.error.issues[0]?.message ?? "Choose another name."),
          );
          return;
        }
        try {
          onSaved?.(savePlayerName(parsed.data));
        } catch {
          setError("Could not save that name. Try another one.");
        }
      }}
    >
      <label className="field" htmlFor={inputId}>
        Pilot name
      </label>
      <input
        id={inputId}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError("");
        }}
        autoComplete="nickname"
        autoFocus
        minLength={2}
        maxLength={24}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      <p className="muted">
        2–24 letters, numbers, spaces, hyphens or underscores. Use a nickname,
        not your real name or email. It appears on the public leaderboard.
      </p>
      {error && (
        <p id={errorId} className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="btn-pop">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
