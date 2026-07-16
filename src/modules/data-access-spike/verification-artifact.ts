import { isAbsolute, relative, resolve } from "node:path";

const officialAddressIdPattern = /^\d{1,20}$/;

export function resolveAerialVerificationPath(
  addressId: string,
  outputDirectory = resolve("output", "playwright"),
): string {
  if (!officialAddressIdPattern.test(addressId)) {
    throw new Error("VERIFICATION_ARTIFACT_ID_INVALID");
  }

  const resolvedOutputDirectory = resolve(outputDirectory);
  const screenshotPath = resolve(
    resolvedOutputDirectory,
    `${addressId}-aerial-alignment.png`,
  );
  const pathWithinOutputDirectory = relative(
    resolvedOutputDirectory,
    screenshotPath,
  );

  if (
    pathWithinOutputDirectory.startsWith("..") ||
    isAbsolute(pathWithinOutputDirectory)
  ) {
    throw new Error("VERIFICATION_ARTIFACT_PATH_OUTSIDE_OUTPUT_DIRECTORY");
  }

  return screenshotPath;
}
