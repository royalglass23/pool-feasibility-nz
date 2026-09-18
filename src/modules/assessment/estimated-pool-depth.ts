import { z } from "zod";

export const DEFAULT_ESTIMATED_POOL_DEPTH_METRES = 1.5;
export const estimatedPoolDepthSchema = z.number().finite().positive().max(2);

export function parseEstimatedPoolDepth(value: string): number | null {
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null;
  const depth = Number(value);
  return estimatedPoolDepthSchema.safeParse(depth).success ? depth : null;
}
