import { z } from "zod";

export const poolLayoutSchema = z
  .object({
    lengthMetres: z.number().finite().min(2).max(20),
    widthMetres: z.number().finite().min(1.5).max(10),
    rotationDegrees: z.number().finite().min(-360).max(360),
    position: z.tuple([
      z.number().finite().min(160).max(180),
      z.number().finite().min(-48).max(-33),
    ]),
  })
  .strict();
