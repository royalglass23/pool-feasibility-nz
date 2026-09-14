import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadAucklandSlopeDemo } from "@/modules/terrain/load-auckland-slope-demo";

export const metadata: Metadata = {
  title: "Prototype: Terrain slope | PoolReady",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TerrainSlopeDemoPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const demo = await loadAucklandSlopeDemo();

  if (demo.status === "needs_checking") {
    return (
      <main className="grid min-h-[calc(100vh-4rem)] place-items-center bg-[#eaf1ef] px-5 py-16 text-[#16312e]">
        <section className="w-full max-w-3xl border-t-4 border-[#de6f32] bg-[#f7faf9] p-7 shadow-[0_22px_70px_rgba(22,49,46,0.12)] sm:p-10">
          <p className="font-mono text-xs tracking-[0.18em] text-[#47706a] uppercase">
            Terrain study · local prototype
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em]">
            Slope needs checking
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-[#46645f]">
            The live terrain sample could not produce a trustworthy result. No
            slope value is shown when the elevation evidence is incomplete.
          </p>
          <ul className="mt-6 border-y border-[#b8cbc7] py-4 text-sm text-[#294d48]">
            {demo.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <a
            className="mt-7 inline-flex min-h-11 items-center bg-[#103f45] px-5 font-semibold text-white outline-offset-4 hover:bg-[#0d6268] focus-visible:outline-2 focus-visible:outline-[#de6f32]"
            href="/prototype/terrain-slope"
          >
            Try again
          </a>
        </section>
      </main>
    );
  }

  const { slope } = demo;
  const bearing = slope.downhillBearingDegrees ?? 0;
  const direction = slope.downhillDirection ?? "level";

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#eaf1ef] px-5 py-10 text-[#16312e] sm:px-8 sm:py-16">
      <section className="mx-auto max-w-6xl">
        <header className="grid gap-8 border-b border-[#9bb7b1] pb-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <p className="font-mono text-xs tracking-[0.18em] text-[#47706a] uppercase">
              Terrain study · local prototype
            </p>
            <h1
              aria-label="Read the ground, not the contours"
              className="mt-4 max-w-3xl text-4xl leading-[0.98] font-semibold tracking-[-0.045em] sm:text-6xl"
            >
              Read the ground,
              <br />
              not the contours
            </h1>
          </div>
          <div className="border-l-2 border-[#de6f32] pl-5 text-sm leading-6 text-[#46645f]">
            <p className="font-semibold text-[#16312e]">
              Fixed 20 × 20 m demo window
            </p>
            <p>
              Live bare-earth elevation data, calculated when this page loads.
              This is not your selected property.
            </p>
          </div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <section className="relative min-h-[420px] overflow-hidden bg-[#103f45] p-6 text-white sm:p-9">
            <TerrainField bearing={bearing} />
            <div className="relative z-10 flex h-full min-h-[350px] flex-col justify-between">
              <div className="flex items-start justify-between gap-6">
                <span className="border border-white/30 bg-[#103f45]/80 px-3 py-2 font-mono text-[11px] tracking-[0.16em] uppercase backdrop-blur">
                  Live DEM sample
                </span>
                <span className="font-mono text-xs text-[#b9d5d0]">
                  {demo.dimensions[0]} × {demo.dimensions[1]} cells
                </span>
              </div>

              <div className="max-w-lg">
                <p className="font-mono text-xs tracking-[0.18em] text-[#b9d5d0] uppercase">
                  Average slope
                </p>
                <div className="mt-1 flex items-end gap-5">
                  <strong className="text-[clamp(5rem,16vw,9rem)] leading-[0.78] font-semibold tracking-[-0.08em] tabular-nums">
                    {slope.averageSlopeDegrees.toFixed(1)}°
                  </strong>
                  <span className="mb-1 border-b border-[#de6f32] pb-1 text-lg font-semibold">
                    Falls {direction}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <aside className="grid content-start gap-px bg-[#9bb7b1]">
            <Metric
              label="Steeper ground"
              value={`${slope.upperSlopeDegrees.toFixed(1)}°`}
              detail="Upper-end slope across the sampled cells"
            />
            <Metric
              label="Estimated fall"
              value={`${slope.estimatedFallMetres.toFixed(2)} m`}
              detail="Approximate height change across the window"
            />
            <Metric
              label="Direction"
              value={direction}
              detail={`${bearing.toFixed(0)}° bearing from north`}
            />
          </aside>
        </div>

        <footer className="mt-6 grid gap-5 border-t border-[#9bb7b1] pt-6 text-sm text-[#46645f] md:grid-cols-[1fr_auto] md:items-start">
          <div>
            <p className="font-semibold text-[#16312e]">
              Indicative, not a site survey
            </p>
            <p className="mt-1 max-w-3xl leading-6">
              This prototype demonstrates the calculation pipeline using a fixed
              Auckland sample. It does not yet follow the pool drawn in Property
              Check.
            </p>
          </div>
          <div className="font-mono text-xs leading-5 md:text-right">
            <p>{demo.validCells} valid 1 m cells</p>
            <p>{demo.durationMs.toLocaleString("en-NZ")} ms provider read</p>
            <a
              className="text-[#0d6268] underline decoration-[#de6f32] underline-offset-4"
              href={demo.source.datasetIdentifier}
              rel="noreferrer"
              target="_blank"
            >
              {demo.source.dataset}
            </a>
          </div>
        </footer>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="bg-[#f7faf9] p-6 sm:p-7">
      <p className="font-mono text-[11px] tracking-[0.15em] text-[#55736e] uppercase">
        {label}
      </p>
      <p className="mt-2 text-4xl font-semibold tracking-[-0.045em] tabular-nums">
        {value}
      </p>
      <p className="mt-2 text-sm leading-5 text-[#55736e]">{detail}</p>
    </div>
  );
}

function TerrainField({ bearing }: { bearing: number }) {
  return (
    <svg
      aria-label="Contour field with the calculated downhill direction"
      className="absolute inset-0 h-full w-full"
      role="img"
      viewBox="0 0 720 480"
    >
      <defs>
        <pattern
          height="24"
          id="terrain-grid"
          patternUnits="userSpaceOnUse"
          width="24"
        >
          <path
            d="M 24 0 L 0 0 0 24"
            fill="none"
            stroke="#d6e8e4"
            strokeOpacity="0.08"
          />
        </pattern>
        <marker
          id="fall-arrow"
          markerHeight="8"
          markerWidth="8"
          orient="auto"
          refX="7"
          refY="4"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="#de6f32" />
        </marker>
      </defs>
      <rect fill="url(#terrain-grid)" height="480" width="720" />
      <g fill="none" stroke="#b9d5d0" strokeOpacity="0.28" strokeWidth="2">
        <path d="M-40 74 C120 4 182 154 336 88 S590 28 780 110" />
        <path d="M-30 130 C102 68 214 208 358 142 S600 88 760 166" />
        <path d="M-20 190 C122 132 208 260 370 204 S602 146 760 230" />
        <path d="M-30 258 C96 192 224 334 388 274 S606 212 770 296" />
        <path d="M-20 334 C120 260 238 404 400 344 S610 284 780 364" />
        <path d="M-30 414 C112 338 252 478 420 420 S630 354 780 432" />
      </g>
      <g transform={`rotate(${bearing} 534 210)`}>
        <circle
          cx="534"
          cy="210"
          fill="#103f45"
          r="8"
          stroke="#de6f32"
          strokeWidth="3"
        />
        <line
          markerEnd="url(#fall-arrow)"
          stroke="#de6f32"
          strokeWidth="4"
          x1="534"
          x2="534"
          y1="210"
          y2="322"
        />
      </g>
    </svg>
  );
}
