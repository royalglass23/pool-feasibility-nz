import "server-only";

import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

const MINIMUM_PASSWORD_CHARACTERS = 14;
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 5;
const SALT_BYTES = 16;
const DERIVED_KEY_BYTES = 64;

export async function hashStaffPassword(password: string): Promise<string> {
  assertStaffPasswordPolicy(password);

  const salt = randomBytes(SALT_BYTES);
  const derivedKey = await derivePasswordKey(password, salt);
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

export async function verifyStaffPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const parsed = parseEncodedHash(encodedHash);
  if (!parsed) return false;

  const actual = await derivePasswordKey(password, parsed.salt);
  return (
    actual.length === parsed.expected.length &&
    timingSafeEqual(actual, parsed.expected)
  );
}

export function assertStaffPasswordPolicy(password: string): void {
  if (Array.from(password).length < MINIMUM_PASSWORD_CHARACTERS) {
    throw new Error(
      `Staff passwords must contain at least ${MINIMUM_PASSWORD_CHARACTERS} characters.`,
    );
  }
}

async function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      DERIVED_KEY_BYTES,
      {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: 64 * 1024 * 1024,
      },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });
}

function parseEncodedHash(
  encodedHash: string,
): { salt: Buffer; expected: Buffer } | null {
  const [algorithm, n, r, p, salt, derivedKey, ...extra] = encodedHash.split("$");
  if (
    algorithm !== "scrypt" ||
    n !== String(SCRYPT_N) ||
    r !== String(SCRYPT_R) ||
    p !== String(SCRYPT_P) ||
    !salt ||
    !derivedKey ||
    extra.length > 0
  ) {
    return null;
  }

  try {
    const decodedSalt = Buffer.from(salt, "base64url");
    const decodedKey = Buffer.from(derivedKey, "base64url");
    if (
      decodedSalt.length !== SALT_BYTES ||
      decodedKey.length !== DERIVED_KEY_BYTES ||
      decodedSalt.toString("base64url") !== salt ||
      decodedKey.toString("base64url") !== derivedKey
    ) {
      return null;
    }
    return { salt: decodedSalt, expected: decodedKey };
  } catch {
    return null;
  }
}
