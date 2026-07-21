const version = "pool-scenario-comparison-v1";
const placementRules = {
  constructionAllowanceMetres: 1,
  rotationsDegrees: [0, 45, 90, 135] as const,
  placementGridMetres: 0.5,
  maximumTestedPlacements: 4_000,
  maximumCandidates: 3,
};

const scenarioDefinitions = [
  {
    id: "compact",
    label: "Compact",
    kind: "anchor",
    version,
    shell: { lengthMetres: 5, widthMetres: 3 },
    ...placementRules,
  },
  {
    id: "compact-plus",
    label: "Compact Plus",
    kind: "intermediate",
    version,
    shell: { lengthMetres: 6, widthMetres: 3.25 },
    ...placementRules,
  },
  {
    id: "standard",
    label: "Standard",
    kind: "anchor",
    version,
    shell: { lengthMetres: 7, widthMetres: 3.5 },
    ...placementRules,
  },
  {
    id: "standard-plus",
    label: "Standard Plus",
    kind: "intermediate",
    version,
    shell: { lengthMetres: 8, widthMetres: 3.75 },
    ...placementRules,
  },
  {
    id: "large",
    label: "Large",
    kind: "anchor",
    version,
    shell: { lengthMetres: 9, widthMetres: 4 },
    ...placementRules,
  },
] as const;

export type PoolScenarioConfig = (typeof scenarioDefinitions)[number];
export type PoolScenarioId = PoolScenarioConfig["id"];

export const poolScenarioIds = scenarioDefinitions.map(
  (scenario) => scenario.id,
) as [PoolScenarioId, ...PoolScenarioId[]];

export const poolScenarioCatalogue = {
  version,
  scenarios: scenarioDefinitions,
} as const;

export const compactPoolScenario: PoolScenarioConfig = scenarioDefinitions[0];

export const poolLocationOptions = [
  { id: "any", label: "No preference" },
  { id: "front", label: "Front yard" },
  { id: "rear", label: "Rear yard" },
  { id: "side_yard", label: "Side yard" },
] as const;

export type PreferredPoolLocation = (typeof poolLocationOptions)[number]["id"];

export const poolLocationIds = poolLocationOptions.map(
  (location) => location.id,
) as [PreferredPoolLocation, ...PreferredPoolLocation[]];

export const frontageDirectionOptions = [
  { id: "north", label: "North-facing front boundary" },
  { id: "east", label: "East-facing front boundary" },
  { id: "south", label: "South-facing front boundary" },
  { id: "west", label: "West-facing front boundary" },
] as const;

export type PoolFrontageDirection =
  (typeof frontageDirectionOptions)[number]["id"];

export const frontageDirectionIds = frontageDirectionOptions.map(
  ({ id }) => id,
) as [PoolFrontageDirection, ...PoolFrontageDirection[]];
