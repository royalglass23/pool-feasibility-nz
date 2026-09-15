import "server-only";

import catalogue from "@/modules/providers/linz/auckland-dem-tile-catalogue.json";
import {
  isAucklandDemTileCatalogue,
  type AucklandDemTileCatalogue,
} from "@/modules/providers/linz/resolve-auckland-dem-tile";

export function parseAucklandDemTileCatalogue(
  value: unknown,
): AucklandDemTileCatalogue {
  if (!isAucklandDemTileCatalogue(value)) {
    throw new Error("Invalid Auckland DEM tile catalogue.");
  }
  return value;
}

export const aucklandDemTileCatalogue =
  parseAucklandDemTileCatalogue(catalogue);
