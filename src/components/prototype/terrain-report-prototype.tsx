"use client";

// Three variants of a 3D aerial report, switchable via ?variant=, on the
// development-only /prototype/3d-aerial-report route.

import { useEffect, useRef } from "react";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import { AlertTriangle, Compass, Layers3, Mountain, Ruler } from "lucide-react";
import maplibregl, {
  type LayerSpecification,
  type StyleSpecification,
} from "maplibre-gl";
import { useSearchParams } from "next/navigation";
import {
  PrototypeSwitcher,
  type PrototypeVariant,
} from "@/components/prototype/prototype-switcher";

const ADDRESS = "135 Fiddlers Hill Road, Puhoi";
const MAP_CENTER: [number, number] = [174.64675, -36.52442];

const VARIANTS = [
  { key: "A", name: "Terrain first" },
  { key: "B", name: "Survey comparison" },
  { key: "C", name: "Decision dossier" },
] as const satisfies readonly PrototypeVariant[];

const PARCEL: Feature<Polygon> = {
  type: "Feature",
  properties: { name: "Lot 2 DP 489596" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [174.645488267, -36.5239597320973],
        [174.645501683, -36.5239844990973],
        [174.645561067, -36.5240941820972],
        [174.6469437, -36.5233323990973],
        [174.647394117, -36.5231308490973],
        [174.648177833, -36.5240182320972],
        [174.648214083, -36.5242026490973],
        [174.6481121, -36.5244679820973],
        [174.647099733, -36.5249444320973],
        [174.6463575, -36.5251137160973],
        [174.645548817, -36.5247651490972],
        [174.6452451, -36.5244145660973],
        [174.64520815, -36.5242923490973],
        [174.64544445, -36.5241596490973],
        [174.645376067, -36.5240333990973],
        [174.64536265, -36.5240086160973],
        [174.64527485, -36.5238465320973],
        [174.645118117, -36.5233221320973],
        [174.645237633, -36.5232423660973],
        [174.645407417, -36.5238104490973],
        [174.645488267, -36.5239597320973],
      ],
    ],
  },
};

const POOL = rectangleFeature([174.64586, -36.52405], 6.5, 3, 18, {
  kind: "pool",
});
const CONSTRUCTION = rectangleFeature([174.64586, -36.52405], 9.5, 6, 18, {
  kind: "construction",
});

export function TerrainReportPrototype() {
  const searchParams = useSearchParams();
  const requested = searchParams.get("variant")?.toUpperCase();
  const current = VARIANTS.some((variant) => variant.key === requested)
    ? (requested as PrototypeVariant["key"])
    : "A";

  return (
    <>
      {current === "A" && <VariantA />}
      {current === "B" && <VariantB />}
      {current === "C" && <VariantC />}
      <PrototypeSwitcher variants={VARIANTS} current={current} />
    </>
  );
}

export function VariantA() {
  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[#102523] text-white">
      <TerrainMap
        className="absolute inset-0"
        pitch={64}
        bearing={-26}
        zoom={17.15}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(7,27,24,0.84)_0%,rgba(7,27,24,0.32)_36%,transparent_62%),linear-gradient(0deg,rgba(7,27,24,0.72)_0%,transparent_34%)]" />
      <div className="relative z-10 flex min-h-[calc(100vh-4rem)] flex-col justify-between px-5 py-6 sm:px-9 sm:py-8 lg:px-12">
        <PrototypeHeader label="Terrain-first report study" inverse />
        <section
          className="max-w-lg pb-24 lg:pb-12"
          aria-labelledby="variant-a-heading"
        >
          <p className="font-mono text-xs tracking-[0.2em] text-[#a9d5c8] uppercase">
            Preliminary property view
          </p>
          <h1
            id="variant-a-heading"
            className="mt-4 font-['Bahnschrift_Condensed','Arial_Narrow',Arial,sans-serif] text-5xl leading-[0.92] font-semibold tracking-[-0.035em] sm:text-7xl"
          >
            Read the land before placing the pool.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-white/76">
            The tilted aerial view exposes the steep rural terrain. The parcel
            and indicative pool remain pinned to the same mapped coordinates.
          </p>
          <div className="mt-7 grid max-w-md grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/18 bg-white/18 sm:grid-cols-4">
            <Metric label="Parcel" value="3.57 ha" />
            <Metric label="Pool" value="6.5 × 3.0 m" />
            <Metric label="Rotation" value="18°" />
            <Metric label="Status" value="Needs checking" caution />
          </div>
        </section>
      </div>
      <MapLegend className="absolute right-5 bottom-24 z-20 sm:right-9 lg:bottom-8" />
    </main>
  );
}

export function VariantB() {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#e8efec] px-4 pt-6 pb-28 text-[#17312e] sm:px-7 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <PrototypeHeader label="Paired evidence study" />
        <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_18rem]">
          <MapPanel eyebrow="Perspective / context" title="Terrain view">
            <TerrainMap
              className="h-[430px] min-h-[55vh]"
              pitch={62}
              bearing={-28}
              zoom={17.1}
            />
          </MapPanel>
          <MapPanel eyebrow="Plan / measurement" title="Top-down view">
            <TerrainMap
              className="h-[430px] min-h-[55vh]"
              pitch={0}
              bearing={0}
              zoom={17.45}
              topDown
            />
          </MapPanel>
          <aside className="border-t border-[#aac0b8] pt-5 xl:border-t-0 xl:border-l xl:pt-2 xl:pl-6">
            <p className="font-mono text-[0.68rem] tracking-[0.16em] text-[#607870] uppercase">
              Why both views
            </p>
            <h1 className="mt-3 font-['Bahnschrift_Condensed','Arial_Narrow',Arial,sans-serif] text-4xl leading-[0.95] font-semibold tracking-[-0.025em]">
              Context on the left. Accuracy on the right.
            </h1>
            <p className="mt-4 text-sm leading-6 text-[#516a63]">
              Perspective makes the slope legible. The plan view remains the
              authoritative place to judge boundaries and dimensions.
            </p>
            <dl className="mt-7 divide-y divide-[#bfd0ca] border-y border-[#bfd0ca]">
              <EvidenceRow term="Address" detail={ADDRESS} />
              <EvidenceRow term="Parcel" detail="Lot 2 DP 489596" />
              <EvidenceRow term="Mapped area" detail="35,693 m²" />
              <EvidenceRow term="Confidence" detail="Boundary confirmed" />
            </dl>
            <div className="mt-6 flex gap-3 rounded-xl bg-[#d7e5df] p-4 text-sm leading-5">
              <AlertTriangle
                className="mt-0.5 size-5 shrink-0 text-[#a5610c]"
                aria-hidden="true"
              />
              <p>
                <b>Needs checking:</b> the shown pool position is illustrative
                and has not been checked against every constraint.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export function VariantC() {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#112a27] px-4 pt-5 pb-28 text-[#edf5f1] sm:px-7 lg:px-9">
      <div className="mx-auto max-w-[1500px]">
        <PrototypeHeader label="Decision dossier study" inverse />
        <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-white/14 bg-[#17332f] shadow-[0_32px_90px_rgba(0,0,0,0.22)]">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_23rem]">
            <section
              className="relative min-h-[520px] lg:min-h-[720px]"
              aria-labelledby="variant-c-heading"
            >
              <TerrainMap
                className="absolute inset-0"
                pitch={68}
                bearing={-42}
                zoom={17.05}
              />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,rgba(8,29,26,0.86),transparent_42%)]" />
              <div className="absolute right-4 bottom-5 left-4 grid gap-3 sm:right-6 sm:bottom-6 sm:left-6 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <p className="font-mono text-[0.68rem] tracking-[0.16em] text-[#b7dbcf] uppercase">
                    Property orientation
                  </p>
                  <h1
                    id="variant-c-heading"
                    className="mt-2 max-w-3xl font-['Bahnschrift_Condensed','Arial_Narrow',Arial,sans-serif] text-4xl leading-none font-semibold tracking-[-0.025em] sm:text-5xl"
                  >
                    A steep site changes the first conversation.
                  </h1>
                </div>
                <div className="rounded-lg border border-white/16 bg-[#102523]/80 px-3 py-2 font-mono text-[0.68rem] tracking-[0.1em] uppercase backdrop-blur">
                  Bearing 318° · Pitch 68°
                </div>
              </div>
            </section>
            <aside className="border-t border-white/12 bg-[#eaf1ee] p-5 text-[#17312e] sm:p-7 lg:border-t-0 lg:border-l">
              <p className="font-mono text-[0.68rem] tracking-[0.16em] text-[#687c75] uppercase">
                Preliminary reading
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.025em]">
                What this view changes
              </h2>
              <div className="mt-6 space-y-6">
                <Finding
                  icon={<Mountain />}
                  title="Slope becomes visible"
                  text="Terrain context is easier to understand than on the current flat image."
                />
                <Finding
                  icon={<Ruler />}
                  title="Dimensions stay top-down"
                  text="Pool size and setbacks still need the plan view for reliable measurement."
                />
                <Finding
                  icon={<Layers3 />}
                  title="Evidence stays separate"
                  text="Aerial appearance does not replace survey, service, or Council checks."
                />
              </div>
              <div className="mt-8 border-t border-[#b9cbc4] pt-6">
                <p className="text-xs font-bold tracking-[0.12em] text-[#8e570e] uppercase">
                  Needs checking
                </p>
                <p className="mt-2 text-sm leading-6 text-[#536a63]">
                  Confirm usable level area, access route, retaining
                  implications, and every mapped constraint before recommending
                  a location.
                </p>
              </div>
              <div className="mt-7 rounded-xl bg-[#17312e] p-4 text-white">
                <p className="font-mono text-[0.65rem] tracking-[0.14em] text-[#a9d5c8] uppercase">
                  Indicative layout
                </p>
                <p className="mt-2 text-lg font-semibold">6.5 × 3.0 m · 18°</p>
                <p className="mt-1 text-xs leading-5 text-white/68">
                  Placement shown for visual comparison only.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}

function TerrainMap({
  className,
  pitch,
  bearing,
  zoom,
  topDown = false,
}: {
  className: string;
  pitch: number;
  bearing: number;
  zoom: number;
  topDown?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const overlays: FeatureCollection = {
      type: "FeatureCollection",
      features: [PARCEL, CONSTRUCTION, POOL],
    };
    const layers: LayerSpecification[] = [
      { id: "aerial", type: "raster", source: "aerial" },
      {
        id: "parcel-fill",
        type: "fill",
        source: "overlays",
        filter: ["==", ["get", "name"], "Lot 2 DP 489596"],
        paint: { "fill-color": "#8ee1ca", "fill-opacity": 0.08 },
      },
      {
        id: "parcel-line",
        type: "line",
        source: "overlays",
        filter: ["==", ["get", "name"], "Lot 2 DP 489596"],
        paint: { "line-color": "#f8fffc", "line-width": 3 },
      },
      {
        id: "construction-line",
        type: "line",
        source: "overlays",
        filter: ["==", ["get", "kind"], "construction"],
        paint: {
          "line-color": "#f0a13b",
          "line-width": 3,
          "line-dasharray": [2, 2],
        },
      },
      {
        id: "pool-fill",
        type: "fill",
        source: "overlays",
        filter: ["==", ["get", "kind"], "pool"],
        paint: { "fill-color": "#20b7d8", "fill-opacity": 0.88 },
      },
      {
        id: "pool-line",
        type: "line",
        source: "overlays",
        filter: ["==", ["get", "kind"], "pool"],
        paint: { "line-color": "#e9fbff", "line-width": 3 },
      },
    ];
    const style: StyleSpecification = {
      version: 8,
      sources: {
        aerial: {
          type: "raster",
          tiles: ["/prototype-assets/aerial/{z}/{x}/{y}.webp"],
          tileSize: 256,
          minzoom: 17,
          maxzoom: 17,
          attribution:
            '<a href="https://www.linz.govt.nz/products-services/data/linz-basemaps">Aerial imagery © LINZ CC BY 4.0</a>',
        },
        terrain: {
          type: "raster-dem",
          tiles: ["/prototype-assets/terrain/{z}/{x}/{y}.png"],
          tileSize: 256,
          minzoom: 17,
          maxzoom: 17,
          encoding: "mapbox",
        },
        overlays: { type: "geojson", data: overlays },
      },
      layers,
      ...(topDown ? {} : { terrain: { source: "terrain", exaggeration: 1 } }),
    };

    const map = new maplibregl.Map({
      container,
      style,
      center: MAP_CENTER,
      zoom,
      pitch,
      bearing,
      maxPitch: 80,
      attributionControl: { compact: true },
      canvasContextAttributes: { antialias: true },
    });
    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "top-right",
    );
    map.addControl(
      new maplibregl.ScaleControl({ unit: "metric" }),
      "bottom-left",
    );

    return () => map.remove();
  }, [bearing, pitch, topDown, zoom]);

  return (
    <div className={`relative overflow-hidden bg-[#294741] ${className}`}>
      <div
        ref={containerRef}
        className="absolute inset-0"
        aria-label={
          topDown
            ? "Top-down LINZ aerial plan"
            : "Tilted LINZ 3D aerial terrain"
        }
      />
      <div className="pointer-events-none absolute top-3 left-3 rounded-md border border-white/20 bg-[#102523]/82 px-2.5 py-1.5 font-mono text-[0.62rem] tracking-[0.12em] text-white uppercase backdrop-blur">
        {topDown ? "Plan view · north up" : "3D terrain · elevation 1×"}
      </div>
      <div className="pointer-events-none absolute bottom-7 left-3 rounded-md bg-[#102523]/82 px-2 py-1 font-mono text-[0.58rem] tracking-[0.08em] text-white/90 uppercase backdrop-blur">
        Prototype · indicative placement
      </div>
    </div>
  );
}

function PrototypeHeader({
  label,
  inverse = false,
}: {
  label: string;
  inverse?: boolean;
}) {
  return (
    <header
      className={`flex items-start justify-between gap-4 ${inverse ? "text-white" : "text-[#17312e]"}`}
    >
      <div>
        <div className="flex items-center gap-2 font-mono text-[0.65rem] font-bold tracking-[0.16em] uppercase">
          <span
            className={`size-2 rounded-full ${inverse ? "bg-[#77d6bd]" : "bg-[#147566]"}`}
          />
          Prototype · not production
        </div>
        <p
          className={`mt-2 text-sm ${inverse ? "text-white/66" : "text-[#607870]"}`}
        >
          {label}
        </p>
      </div>
      <div className="max-w-[15rem] text-right">
        <p className="text-sm font-bold">{ADDRESS}</p>
        <p
          className={`mt-1 font-mono text-[0.62rem] tracking-[0.08em] uppercase ${inverse ? "text-white/58" : "text-[#6a7f78]"}`}
        >
          Lot 2 DP 489596 · Auckland
        </p>
      </div>
    </header>
  );
}

function Metric({
  label,
  value,
  caution = false,
}: {
  label: string;
  value: string;
  caution?: boolean;
}) {
  return (
    <div className="bg-[#102523]/76 px-3 py-3 backdrop-blur-sm">
      <p className="font-mono text-[0.58rem] tracking-[0.11em] text-white/54 uppercase">
        {label}
      </p>
      <p
        className={`mt-1 text-xs font-bold ${caution ? "text-[#ffc56f]" : "text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}

function MapLegend({ className }: { className: string }) {
  return (
    <div
      className={`rounded-xl border border-white/18 bg-[#102523]/82 p-3 text-[0.68rem] text-white shadow-xl backdrop-blur ${className}`}
    >
      <p className="font-mono tracking-[0.12em] text-white/58 uppercase">
        Map key
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-2">
          <i className="h-0.5 w-5 bg-white" /> Parcel
        </span>
        <span className="inline-flex items-center gap-2">
          <i className="size-3 bg-[#20b7d8]" /> Pool
        </span>
        <span className="inline-flex items-center gap-2">
          <i className="h-0.5 w-5 border-t-2 border-dashed border-[#f0a13b]" />
          Working area
        </span>
      </div>
    </div>
  );
}

function MapPanel({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[1.15rem] border border-[#b7c9c2] bg-white shadow-[0_16px_45px_rgba(28,62,55,0.1)]">
      <div className="flex items-end justify-between gap-4 border-b border-[#d4e0dc] px-4 py-3">
        <div>
          <p className="font-mono text-[0.6rem] tracking-[0.13em] text-[#72877f] uppercase">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-bold">{title}</h2>
        </div>
        {title === "Terrain view" ? (
          <Mountain className="size-5 text-[#257b6d]" />
        ) : (
          <Compass className="size-5 text-[#257b6d]" />
        )}
      </div>
      {children}
    </section>
  );
}

function EvidenceRow({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="py-3">
      <dt className="font-mono text-[0.58rem] tracking-[0.11em] text-[#71867f] uppercase">
        {term}
      </dt>
      <dd className="mt-1 text-sm font-bold">{detail}</dd>
    </div>
  );
}

function Finding({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="grid grid-cols-[2.25rem_1fr] gap-3">
      <div className="grid size-9 place-items-center rounded-full bg-[#d6e6df] text-[#176f61] [&>svg]:size-4">
        {icon}
      </div>
      <div>
        <h3 className="font-bold">{title}</h3>
        <p className="mt-1 text-sm leading-5 text-[#5b7069]">{text}</p>
      </div>
    </div>
  );
}

function rectangleFeature(
  center: [number, number],
  lengthMetres: number,
  widthMetres: number,
  rotationDegrees: number,
  properties: Record<string, string>,
): Feature<Polygon> {
  const radians = (rotationDegrees * Math.PI) / 180;
  const halfLength = lengthMetres / 2;
  const halfWidth = widthMetres / 2;
  const metresPerLongitude = 111_320 * Math.cos((center[1] * Math.PI) / 180);
  const corners: [number, number][] = [
    [-halfLength, -halfWidth],
    [halfLength, -halfWidth],
    [halfLength, halfWidth],
    [-halfLength, halfWidth],
  ].map(([forward, side]) => {
    const east = forward * Math.sin(radians) + side * Math.cos(radians);
    const north = forward * Math.cos(radians) - side * Math.sin(radians);
    return [center[0] + east / metresPerLongitude, center[1] + north / 111_320];
  });
  corners.push(corners[0]);
  return {
    type: "Feature",
    properties,
    geometry: { type: "Polygon", coordinates: [corners] },
  };
}
