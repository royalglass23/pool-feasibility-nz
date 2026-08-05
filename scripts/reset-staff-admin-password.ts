import "dotenv/config";

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { getDb } from "../src/db/client";
import { resetStaffAdminPassword } from "../src/db/repositories/staff-auth-repository";
import { hashStaffPassword } from "../src/modules/staff/staff-password";
import { questionHidden } from "./staff-admin-prompt";

async function main() {
  const prompt = createInterface({ input, output });
  try {
    const password = await questionHidden(prompt, "New Staff Admin password: ");
    const confirmation = await questionHidden(
      prompt,
      "Confirm new Staff Admin password: ",
    );
    if (password !== confirmation) {
      throw new Error("The Staff Admin passwords do not match.");
    }
    await resetStaffAdminPassword(getDb(), await hashStaffPassword(password));
    output.write("Staff Admin password reset. All Staff sessions were signed out.\n");
  } finally {
    prompt.close();
  }
}

void main().catch((error: unknown) => {
  output.write(
    `${error instanceof Error ? error.message : "Unable to reset Staff Admin password."}\n`,
  );
  process.exitCode = 1;
});
