export interface PoolScenarioConfig {
  id: "compact";
  label: "Compact";
  version: string;
  shell: {
    lengthMetres: number;
    widthMetres: number;
  };
  constructionAllowanceMetres: number;
  rotationsDegrees: readonly number[];
  placementGridMetres: number;
  maximumTestedPlacements: number;
  maximumCandidates: number;
}

export const compactPoolScenario: PoolScenarioConfig = {
  id: "compact",
  label: "Compact",
  version: "compact-screening-v1",
  shell: {
    lengthMetres: 5,
    widthMetres: 3,
  },
  constructionAllowanceMetres: 1,
  rotationsDegrees: [0, 45, 90, 135],
  placementGridMetres: 0.5,
  maximumTestedPlacements: 4_000,
  maximumCandidates: 3,
};
