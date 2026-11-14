"use client";
import {
  createDemoState,
  performDemoAction,
  demoTeacherId,
  type DemoState,
  type DemoContext,
} from "./mock-model";
export const demoStorageKey = "mission-possible:mock-data:v1";
export const demoUpdateEvent = "mission-possible:mock-updated";
const roleKey = "mission-possible:mock-role";
const studentKey = "mission-possible:mock-student";
export function selectDemoActor(role: "student" | "teacher") {
  sessionStorage.setItem(roleKey, role);
  if (role === "student" && !sessionStorage.getItem(studentKey))
    sessionStorage.setItem(studentKey, crypto.randomUUID());
}
export function newDemoStudent() {
  sessionStorage.setItem(studentKey, crypto.randomUUID());
  selectDemoActor("student");
}
export function resetDemo() {
  localStorage.removeItem(demoStorageKey);
  newDemoStudent();
  window.dispatchEvent(new Event(demoUpdateEvent));
}
function load(): DemoState {
  const raw = localStorage.getItem(demoStorageKey);
  if (!raw) return createDemoState();
  try {
    const state = JSON.parse(raw);
    if (
      state.version !== 1 ||
      !Array.isArray(state.classrooms) ||
      !Array.isArray(state.members) ||
      !Array.isArray(state.attempts) ||
      !state.profiles
    )
      throw new Error();
    return state;
  } catch {
    throw new Error(
      "The local demo data cannot be read. Use Reset demo to restore the sample classroom.",
    );
  }
}
export async function demoApi<T>(
  action: string,
  input: Record<string, unknown>,
): Promise<T> {
  const operation = () => {
    const role =
      sessionStorage.getItem(roleKey) === "teacher" ? "teacher" : "student";
    selectDemoActor(role);
    const ctx: DemoContext = {
      role,
      userId:
        role === "teacher"
          ? demoTeacherId
          : sessionStorage.getItem(studentKey)!,
      now: new Date().toISOString(),
      uuid: () => crypto.randomUUID(),
    };
    const state = load();
    const result = performDemoAction(state, action, input, ctx);
    localStorage.setItem(demoStorageKey, JSON.stringify(state));
    const mutations = [
      "attempt",
      "joinClass",
      "createClass",
      "updateClass",
      "removeStudent",
      "setNickname",
    ];
    if (mutations.includes(action))
      window.dispatchEvent(new Event(demoUpdateEvent));
    return structuredClone(result) as T;
  };
  try {
    return navigator.locks
      ? await navigator.locks.request(demoStorageKey, operation)
      : operation();
  } catch (error) {
    if (
      error instanceof DOMException &&
      ["QuotaExceededError", "SecurityError"].includes(error.name)
    )
      throw new Error(
        "Browser storage is unavailable or full. Enable local storage to use the demo.",
      );
    throw error;
  }
}
