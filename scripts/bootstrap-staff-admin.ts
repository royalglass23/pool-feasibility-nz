import "dotenv/config";

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { getDb } from "../src/db/client";
import { provisionStaffAdmin } from "../src/db/repositories/staff-auth-repository";
import { prepareStaffAdminProvisioning } from "../src/modules/staff/staff-admin-bootstrap";
import { questionHidden } from "./staff-admin-prompt";

async function main() {
  const prompt = createInterface({ input, output });
  try {
    const username = await prompt.question("Staff Admin username: ");
    const password = await questionHidden(prompt, "Staff Admin password: ");
    const passwordConfirmation = await questionHidden(
      prompt,
      "Confirm Staff Admin password: ",
    );
    await prepareStaffAdminProvisioning({
      username,
      password,
      passwordConfirmation,
      provision: (admin) => provisionStaffAdmin(getDb(), admin),
    });
    output.write("Staff Admin provisioned.\n");
  } finally {
    prompt.close();
  }
}

void main().catch((error: unknown) => {
  output.write(
    `${error instanceof Error ? error.message : "Unable to provision Staff Admin."}\n`,
  );
  process.exitCode = 1;
});
