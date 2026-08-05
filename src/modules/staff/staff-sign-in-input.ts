import "server-only";

const MAX_USERNAME_LENGTH = 64;
const MAX_PASSWORD_LENGTH = 1_024;

export function parseStaffSignInInput(input: {
  username: string;
  password: string;
}): { username: string; password: string } | null {
  if (
    input.username.length === 0 ||
    input.username.length > MAX_USERNAME_LENGTH ||
    input.password.length === 0 ||
    input.password.length > MAX_PASSWORD_LENGTH
  ) {
    return null;
  }
  return input;
}
