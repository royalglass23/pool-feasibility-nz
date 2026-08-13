import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TerrainReportPrototype } from "@/components/prototype/terrain-report-prototype";

export const metadata = {
  title: "Prototype: 3D aerial report | Pool Lab",
};

export default function ThreeDimensionalAerialReportPrototypePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <Suspense fallback={<PrototypeLoadingState />}>
      <TerrainReportPrototype />
    </Suspense>
  );
}

function PrototypeLoadingState() {
  return (
    <main className="grid min-h-[calc(100vh-4rem)] place-items-center bg-[#e8efec] text-[#16312e]">
      <p className="font-mono text-xs tracking-[0.18em] uppercase">
        Preparing terrain study…
      </p>
    </main>
  );
}
