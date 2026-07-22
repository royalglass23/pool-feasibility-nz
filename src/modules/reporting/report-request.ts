import type { ReportAssessmentSnapshot } from "@/modules/reporting/report-assessment-snapshot";
import { SessionReportValidationError } from "@/modules/reporting/report-errors";
import { verifySessionReportToken } from "@/modules/reporting/report-token";

export interface SessionReportRequest {
  assessment: ReportAssessmentSnapshot;
  mapImageDataUrl: string;
}

const MAX_MAP_BYTES = 6_000_000;
const MAX_DECODED_MAP_BYTES = 4_500_000;
const MAX_MAP_DIMENSION = 4_096;
const PNG_DATA_URL_PREFIX = "data:image/png;base64,";
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function parseSessionReportRequest(
  value: unknown,
): SessionReportRequest {
  if (!value || typeof value !== "object") {
    throw new SessionReportValidationError("INVALID_REPORT");
  }
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).length !== 2 ||
    typeof input.reportToken !== "string" ||
    typeof input.mapImageDataUrl !== "string"
  ) {
    throw new SessionReportValidationError("INVALID_REPORT");
  }
  if (
    !input.mapImageDataUrl.startsWith(PNG_DATA_URL_PREFIX) ||
    input.mapImageDataUrl.length > MAX_MAP_BYTES ||
    !hasValidPngBytes(input.mapImageDataUrl.slice(PNG_DATA_URL_PREFIX.length))
  ) {
    throw new SessionReportValidationError("INVALID_MAP_IMAGE");
  }
  return {
    assessment: verifySessionReportToken(input.reportToken),
    mapImageDataUrl: input.mapImageDataUrl,
  };
}

function hasValidPngBytes(encoded: string): boolean {
  if (
    !encoded ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      encoded,
    )
  ) {
    return false;
  }
  const bytes = Buffer.from(encoded, "base64");
  if (
    bytes.length < 45 ||
    bytes.length > MAX_DECODED_MAP_BYTES ||
    !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    return false;
  }

  let offset = PNG_SIGNATURE.length;
  let sawHeader = false;
  let sawImageData = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = typeStart + 4;
    const crcOffset = dataStart + length;
    const nextOffset = crcOffset + 4;
    if (nextOffset > bytes.length) return false;
    const type = bytes.toString("ascii", typeStart, dataStart);
    if (!/^[A-Za-z]{4}$/.test(type)) return false;
    if (
      bytes.readUInt32BE(crcOffset) !==
      pngCrc32(bytes.subarray(typeStart, crcOffset))
    ) {
      return false;
    }
    if (!sawHeader) {
      if (type !== "IHDR" || length !== 13) return false;
      const width = bytes.readUInt32BE(dataStart);
      const height = bytes.readUInt32BE(dataStart + 4);
      const bitDepth = bytes[dataStart + 8];
      const colourType = bytes[dataStart + 9];
      const validDepths: Record<number, readonly number[]> = {
        0: [1, 2, 4, 8, 16],
        2: [8, 16],
        3: [1, 2, 4, 8],
        4: [8, 16],
        6: [8, 16],
      };
      if (
        width === 0 ||
        width > MAX_MAP_DIMENSION ||
        height === 0 ||
        height > MAX_MAP_DIMENSION ||
        !validDepths[colourType]?.includes(bitDepth) ||
        bytes[dataStart + 10] !== 0 ||
        bytes[dataStart + 11] !== 0 ||
        ![0, 1].includes(bytes[dataStart + 12])
      ) {
        return false;
      }
      sawHeader = true;
    } else if (type === "IHDR") {
      return false;
    }
    if (type === "IDAT") sawImageData = true;
    if (type === "IEND") {
      return length === 0 && sawImageData && nextOffset === bytes.length;
    }
    offset = nextOffset;
  }
  return false;
}

function pngCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export { SessionReportValidationError } from "@/modules/reporting/report-errors";
