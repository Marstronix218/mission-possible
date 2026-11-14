"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, cloud, backendAvailable, isMockMode, token } from "./cloud";
import {
  selectDemoActor,
  newDemoStudent,
  demoUpdateEvent,
} from "./mock-storage";
import type { Classroom, Ranking } from "./contracts";
import { playableMissions } from "./missions";
import type { SatelliteDesign, SimResult } from "@/types/game";
type CloudAttempt = {
  id: string;
  user_id: string;
  mission_slug: string;
  score_total: number;
  created_at: string;
  design: SatelliteDesign;
  result: SimResult;
};
type StudentData = {
  members: { user_id: string; nickname: string }[];
  attempts: CloudAttempt[];
};
function Setup() {
  return (
    <section className="panel">
      <h2>Connect your classroom backend</h2>
      <p>
        Classrooms use Supabase authentication, access rules, and
        server-verified scores. This environment has no configured Supabase
        project.
      </p>
      <p>
        Set the environment variables and apply the migration described in
        SETUP.md. Local solo missions remain playable.
      </p>
      <Link className="primary" href="/map">
        Explore solo missions ↗
      </Link>
    </section>
  );
}
function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="error">
      {message}
    </p>
  ) : null;
}
export function RankingTable({ rows }: { rows: Ranking[] }) {
  return (
    <div className="table-scroll">
      <table>
        <caption>
          Highest score per player · ties go to the earliest achievement
        </caption>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Nickname</th>
            <th>Best score</th>
            <th>Attempts</th>
            <th>Improvement</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.entry_id}>
              <td>{i + 1}</td>
              <th scope="row">{r.nickname}</th>
              <td>{Number(r.score).toFixed(1)}</td>
              <td>{r.attempts}</td>
              <td>+{Number(r.improvement).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p>No submissions yet. Launch a mission to set the first score.</p>
      )}
    </div>
  );
}
export function JoinClass() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState<Classroom | null>(null);
  async function join(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      if (isMockMode) selectDemoActor("student");
      setJoined(
        await api<Classroom>("joinClass", {
          code: String(data.get("code")).trim().toUpperCase(),
          nickname: String(data.get("nickname")).trim(),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main>
      <div className="eyebrow">CLASSROOM / STUDENT</div>
      <h1>
        One challenge.
        <br />
        <em>Many ideas.</em>
      </h1>
      <p>
        Join with a class code and a nickname. No student email or real name is
        needed.
      </p>
      {isMockMode && (
        <div className="actions">
          <button
            onClick={() => {
              newDemoStudent();
              setJoined(null);
              setError("");
            }}
          >
            Use another demo student
          </button>
        </div>
      )}
      {!backendAvailable ? (
        <Setup />
      ) : joined ? (
        <section className="panel">
          <h2>You joined {joined.name}</h2>
          <Link className="primary" href={"/classroom/" + joined.id}>
            Open class mission ↗
          </Link>
        </section>
      ) : (
        <form className="panel form-panel" onSubmit={join}>
          {isMockMode && (
            <p className="notice">
              Use code <strong>ORBIT1</strong> to join the sample classroom. All
              sample players are fictional.
            </p>
          )}
          <label className="field">
            Class code
            <input
              name="code"
              required
              minLength={6}
              maxLength={6}
              autoComplete="off"
              pattern="[A-Za-z0-9]{6}"
              placeholder={isMockMode ? "ORBIT1" : "A1B2C3"}
            />
          </label>
          <label className="field">
            Nickname
            <input
              name="nickname"
              required
              minLength={2}
              maxLength={24}
              autoComplete="off"
              placeholder="OrbitExplorer"
            />
          </label>
          <ErrorMessage message={error} />
          <button className="primary" disabled={busy}>
            {busy ? "Joining…" : "Join classroom →"}
          </button>
        </form>
      )}
    </main>
  );
}
export function ClassDashboard({ id }: { id: string }) {
  const [c, setC] = useState<Classroom | null>(null);
  const [rows, setRows] = useState<Ranking[]>([]);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const [now, setNow] = useState(0);
  const refresh = useCallback(async () => {
    try {
      const classroom = await api<Classroom>("classroom", { id });
      const ranking = await api<Ranking[]>("ranking", {
        missionSlug: classroom.mission_slug,
        classroomId: id,
      });
      setC(classroom);
      setNow(Date.now());
      setRows(ranking);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load class.");
    }
  }, [id]);
  useEffect(() => {
    if (!backendAvailable) return;
    let active = true;
    let channel: ReturnType<ReturnType<typeof cloud>["channel"]> | undefined;
    const tick = () => {
      if (active) void refresh();
    };
    if (isMockMode) {
      Promise.resolve().then(tick);
      window.addEventListener(demoUpdateEvent, tick);
      window.addEventListener("storage", tick);
      return () => {
        active = false;
        window.removeEventListener(demoUpdateEvent, tick);
        window.removeEventListener("storage", tick);
      };
    }
    void token()
      .then(() => {
        if (!active) return;
        tick();
        channel = cloud()
          .channel("classroom:" + id)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "classroom_updates",
              filter: "classroom_id=eq." + id,
            },
            tick,
          )
          .subscribe((status) => {
            if (active) setLive(status === "SUBSCRIBED");
          });
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    const timer = setInterval(tick, 10000);
    return () => {
      active = false;
      clearInterval(timer);
      if (channel) void cloud().removeChannel(channel);
    };
  }, [id, refresh]);
  return (
    <main>
      <div className="eyebrow">CLASSROOM MISSION</div>
      <h1>{c?.name ?? "Your classroom"}</h1>
      {!backendAvailable ? (
        <Setup />
      ) : (
        <>
          <ErrorMessage message={error} />
          {c && (
            <>
              <section className="panel">
                <h2>
                  {
                    playableMissions.find((m) => m.slug === c.mission_slug)
                      ?.city
                  }
                </h2>
                <p>
                  Budget ${c.budget_m}M · Mass {c.mass_kg} kg ·{" "}
                  {c.max_attempts ?? "Unlimited"} attempts
                </p>
                <p>
                  {c.deadline
                    ? "Deadline: " +
                      new Date(c.deadline).toLocaleString("en-US", {
                        timeZoneName: "short",
                      })
                    : "No deadline"}
                </p>
                {c.is_active &&
                (!c.deadline || Date.parse(c.deadline) > now) ? (
                  <Link
                    className="primary"
                    href={
                      "/mission/" + c.mission_slug + "/brief?classroom=" + id
                    }
                  >
                    Start class mission ↗
                  </Link>
                ) : (
                  <p>This classroom is closed.</p>
                )}
              </section>
              <section className="panel history">
                <div className="section-heading">
                  <h2>Class ranking</h2>
                  <span>
                    {isMockMode
                      ? "Browser-local demo updates"
                      : live
                        ? "Live updates connected"
                        : "Refreshing every 10 seconds"}
                  </span>
                </div>
                <RankingTable rows={rows} />
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
export function GlobalRanking({
  initialMission = "los-angeles",
  classroomId,
}: {
  initialMission?: string;
  classroomId?: string;
}) {
  const [slug, setSlug] = useState(
    playableMissions.some((m) => m.slug === initialMission)
      ? initialMission
      : "los-angeles",
  );
  const [publicNickname, setPublicNickname] = useState("");
  const [notice, setNotice] = useState("");
  async function publishNickname(nickname: string | null) {
    setError("");
    try {
      await api("setNickname", { nickname });
      setNotice(
        nickname
          ? "Your standard-condition scores are public under this nickname."
          : "Your scores are hidden from the global ranking.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update nickname.");
    }
  }
  const [rows, setRows] = useState<Ranking[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!isMockMode) return;
    let active = true;
    api<Ranking[]>("ranking", { missionSlug: slug, classroomId })
      .then((data) => {
        if (active) {
          setRows(data);
          setError("");
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "Could not load demo ranking.",
          );
      });
    return () => {
      active = false;
    };
  }, [slug, classroomId]);
  async function load(next = slug) {
    setLoading(true);
    setError("");
    try {
      setRows(
        await api<Ranking[]>("ranking", { missionSlug: next, classroomId }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load ranking.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <main>
      <div className="eyebrow">
        {classroomId ? "CLASSROOM" : "GLOBAL"} / LEADERBOARD
      </div>
      <h1>
        Better designs.
        <br />
        <em>Shared discoveries.</em>
      </h1>
      <p>
        Compare the same mission and engine version only. Custom class
        conditions stay in their class ranking.
      </p>
      {!backendAvailable ? (
        <Setup />
      ) : (
        <section className="panel">
          <label className="field">
            Mission
            <select
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setRows([]);
              }}
            >
              {playableMissions.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.city} · {m.category}
                </option>
              ))}
            </select>
          </label>
          <button className="primary" disabled={loading} onClick={() => load()}>
            {loading ? "Loading…" : "Load ranking"}
          </button>
          <ErrorMessage message={error} />
          {!classroomId && (
            <section>
              <h2>Choose whether to appear publicly</h2>
              <p>
                Publishing a nickname makes your standard-condition solo scores
                visible. Use a nickname, not your real name or email.
              </p>
              <label className="field">
                Public nickname
                <input
                  value={publicNickname}
                  onChange={(e) => setPublicNickname(e.target.value)}
                  minLength={2}
                  maxLength={24}
                />
              </label>
              <div className="actions">
                <button onClick={() => publishNickname(publicNickname)}>
                  Publish my nickname & scores
                </button>
                <button onClick={() => publishNickname(null)}>
                  Hide my global scores
                </button>
              </div>
              {notice && <p role="status">{notice}</p>}
            </section>
          )}
          <RankingTable rows={rows} />
        </section>
      )}
    </main>
  );
}
export function TeacherDashboard({ authError }: { authError?: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(
    authError
      ? "The sign-in link is invalid or expired. Request a new magic link."
      : "",
  );
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [selected, setSelected] = useState<Classroom | null>(null);
  const [students, setStudents] = useState<StudentData | null>(null);
  const [busy, setBusy] = useState(false);
  const scoringLocked = Boolean(selected && students?.attempts.length);
  useEffect(() => {
    if (!isMockMode) return;
    let active = true;
    Promise.resolve()
      .then(async () => {
        selectDemoActor("teacher");
        const data = await api<Classroom[]>("listClasses");
        if (active) setClasses(data);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "Could not load demo classrooms.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function list() {
    setError("");
    try {
      if (isMockMode) selectDemoActor("teacher");
      setClasses(await api<Classroom[]>("listClasses"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load classes.");
    }
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error } = await cloud().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + "/teacher" },
      });
      if (error) throw error;
      setMessage(
        "Check your email for the sign-in link, then load your classes.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send link.");
    } finally {
      setBusy(false);
    }
  }
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const settings = {
        name: String(f.get("name")),
        mission_slug: scoringLocked
          ? selected!.mission_slug
          : String(f.get("mission")),
        budget_m: Number(f.get("budget")),
        mass_kg: Number(f.get("mass")),
        max_attempts: f.get("attempts") ? Number(f.get("attempts")) : null,
        deadline: f.get("deadline")
          ? new Date(String(f.get("deadline"))).toISOString()
          : null,
      };
      if (selected) {
        await api("updateClass", { id: selected.id, settings });
      } else await api("createClass", { settings });
      setSelected(null);
      await list();
      setMessage("Class settings saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save class.");
    } finally {
      setBusy(false);
    }
  }
  async function action(c: Classroom, operation: "rotate" | "archive") {
    setError("");
    try {
      await api("updateClass", { id: c.id, operation });
      await list();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update class.");
    }
  }
  async function inspect(c: Classroom) {
    setSelected(c);
    setStudents(null);
    setError("");
    try {
      setStudents(await api<StudentData>("students", { id: c.id }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load students.");
    }
  }
  function exportCSV() {
    if (!students) return;
    const quote = (v: unknown) =>
      '"' +
      String(v)
        .replace(/^[=+@-]/, "'")
        .replaceAll('"', '""') +
      '"';
    const rows = [
      ["nickname", "score", "date", "instruments"],
      ...students.attempts.map((a) => [
        students.members.find((m) => m.user_id === a.user_id)?.nickname ??
          "Removed student",
        a.score_total,
        a.created_at,
        a.design.instruments.join(" + "),
      ]),
    ];
    const blob = new Blob(
      [rows.map((row) => row.map(quote).join(",")).join("\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "classroom-attempts.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <main>
      <div className="eyebrow">CLASSROOM / TEACHER</div>
      <h1>
        Turn experiments
        <br />
        <em>into understanding.</em>
      </h1>
      {!backendAvailable ? (
        <Setup />
      ) : (
        <>
          <ErrorMessage message={error} />
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
          {isMockMode ? (
            <section className="panel">
              <h2>Demo teacher dashboard</h2>
              <p>
                You are roleplaying the sample teacher. There is no real
                account, email sign-in, or authentication in this mode.
              </p>
              <button onClick={list}>Reload demo classes</button>
            </section>
          ) : (
            <>
              {" "}
              <section className="panel">
                <h2>Teacher sign-in</h2>
                <form onSubmit={login} className="inline-form">
                  <label className="field">
                    Teacher email
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                  <button disabled={busy}>Send magic link</button>
                  <button type="button" onClick={list}>
                    Load my classes
                  </button>
                </form>
              </section>
            </>
          )}
          <div className="two-column">
            <form
              key={selected?.id ?? "new"}
              className="panel"
              onSubmit={create}
            >
              <h2>
                {selected ? "Edit " + selected.name : "Create a classroom"}
              </h2>
              {scoringLocked && (
                <p className="notice">
                  Mission, budget, and mass are locked after the first attempt.
                  Create a new class for a different assignment.
                </p>
              )}
              <label className="field">
                Class name
                <input
                  name="name"
                  required
                  maxLength={80}
                  defaultValue={selected?.name}
                />
              </label>
              <label className="field">
                Mission
                <select
                  name="mission"
                  disabled={scoringLocked}
                  defaultValue={selected?.mission_slug ?? "los-angeles"}
                >
                  {playableMissions.map((m) => (
                    <option key={m.slug} value={m.slug}>
                      {m.city}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Budget ($M)
                <input
                  name="budget"
                  readOnly={scoringLocked}
                  type="number"
                  required
                  min={80}
                  max={1000}
                  defaultValue={selected?.budget_m ?? 250}
                />
              </label>
              <label className="field">
                Mass (kg)
                <input
                  name="mass"
                  readOnly={scoringLocked}
                  type="number"
                  required
                  min={150}
                  max={1500}
                  defaultValue={selected?.mass_kg ?? 500}
                />
              </label>
              <label className="field">
                Attempt limit (blank for unlimited)
                <input
                  name="attempts"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={selected?.max_attempts ?? ""}
                />
              </label>
              <label className="field">
                Deadline (your local time, blank for none)
                <input
                  name="deadline"
                  type="datetime-local"
                  defaultValue={
                    selected?.deadline
                      ? new Date(
                          Date.parse(selected.deadline) -
                            new Date(selected.deadline).getTimezoneOffset() *
                              60000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? "Saving…" : "Save classroom"}
              </button>
              {selected && (
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setStudents(null);
                  }}
                >
                  Cancel editing
                </button>
              )}
            </form>
            <section className="panel">
              <h2>Your classrooms</h2>
              {!classes.length && (
                <p>
                  Load your classes after signing in, or create your first
                  class.
                </p>
              )}
              {classes.map((c) => (
                <article className="feedback" key={c.id}>
                  <h3>
                    {c.name} {c.is_active ? "" : "(archived)"}
                  </h3>
                  <p>
                    Join code:{" "}
                    <strong className="join-code">{c.join_code}</strong>
                  </p>
                  <div className="actions">
                    <Link href={"/classroom/" + c.id}>Open ranking ↗</Link>
                    <button onClick={() => inspect(c)}>
                      Settings & students
                    </button>
                    <button onClick={() => action(c, "rotate")}>
                      Regenerate code
                    </button>
                    <button
                      disabled={!c.is_active}
                      onClick={() => action(c, "archive")}
                    >
                      Archive
                    </button>
                  </div>
                </article>
              ))}
            </section>
          </div>
          {students && selected && (
            <section className="panel history">
              <div className="section-heading">
                <h2>{selected.name} · Students & history</h2>
                <button onClick={exportCSV}>Export CSV</button>
              </div>
              {students.members.map((m) => (
                <article className="feedback" key={m.user_id}>
                  <h3>{m.nickname}</h3>
                  <button
                    onClick={async () => {
                      try {
                        await api("removeStudent", {
                          id: selected.id,
                          userId: m.user_id,
                        });
                        await inspect(selected);
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : "Could not remove student.",
                        );
                      }
                    }}
                  >
                    Remove from class
                  </button>
                  <ol>
                    {students.attempts
                      .filter((a) => a.user_id === m.user_id)
                      .map((a) => (
                        <li key={a.id}>
                          {Number(a.score_total).toFixed(1)}/100 ·{" "}
                          {new Date(a.created_at).toLocaleString("en-US", {
                            timeZoneName: "short",
                          })}
                          <details>
                            <summary>View satellite design</summary>
                            <pre>{JSON.stringify(a.design, null, 2)}</pre>
                          </details>
                        </li>
                      ))}
                  </ol>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
