import { Suspense } from "react";
import { UsernameGate } from "@/components/player/UsernameGate";

export default function MissionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      {/* The gate reads the classroom query; it renders nothing until known. */}
      <Suspense fallback={null}>
        <UsernameGate />
      </Suspense>
    </>
  );
}
