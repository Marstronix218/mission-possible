import { Suspense } from "react";
import { UsernameGate } from "@/components/player/UsernameGate";
import { TutorialAutoStart } from "@/components/tutorial/TutorialAutoStart";

export default function MissionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      {/* First-time players see How to Play first; the pilot-name gate waits for it. */}
      <TutorialAutoStart />
      {/* The gate reads the classroom query; it renders nothing until known. */}
      <Suspense fallback={null}>
        <UsernameGate />
      </Suspense>
    </>
  );
}
