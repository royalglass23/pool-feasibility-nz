export const POOL_LAYOUT_CATALOGUE = [
  { id: "plunge", name: "Plunge", lengthMetres: 4, widthMetres: 2.4 },
  { id: "compact", name: "Compact", lengthMetres: 6.5, widthMetres: 3 },
  { id: "slimline", name: "Slimline", lengthMetres: 8, widthMetres: 3 },
  { id: "family", name: "Family", lengthMetres: 8, widthMetres: 4 },
  { id: "large", name: "Large", lengthMetres: 10, widthMetres: 4.4 },
  { id: "custom", name: "Custom", lengthMetres: 6.5, widthMetres: 3 },
] as const;

export type PoolLayoutId = (typeof POOL_LAYOUT_CATALOGUE)[number]["id"];

export const CUSTOM_POOL_DIMENSION_LIMITS = {
  length: { min: 2, max: 20 },
  width: { min: 1.5, max: 10 },
  step: 0.1,
} as const;

export function validateCustomPoolDimensions(
  lengthMetres: number,
  widthMetres: number,
): { lengthMetres: number; widthMetres: number } | null {
  if (
    !isStepValue(lengthMetres, CUSTOM_POOL_DIMENSION_LIMITS.step) ||
    !isStepValue(widthMetres, CUSTOM_POOL_DIMENSION_LIMITS.step) ||
    lengthMetres < CUSTOM_POOL_DIMENSION_LIMITS.length.min ||
    lengthMetres > CUSTOM_POOL_DIMENSION_LIMITS.length.max ||
    widthMetres < CUSTOM_POOL_DIMENSION_LIMITS.width.min ||
    widthMetres > CUSTOM_POOL_DIMENSION_LIMITS.width.max
  ) {
    return null;
  }
  return { lengthMetres, widthMetres };
}

function isStepValue(value: number, step: number): boolean {
  return (
    Number.isFinite(value) &&
    Math.abs(value / step - Math.round(value / step)) < 1e-8
  );
}
