import type { Interface } from "node:readline/promises";
import { stdout as output } from "node:process";

export async function questionHidden(
  prompt: Interface,
  question: string,
): Promise<string> {
  output.write(question);
  const interactivePrompt = prompt as unknown as {
    _writeToOutput: (value: string) => void;
  };
  const write = interactivePrompt._writeToOutput;
  interactivePrompt._writeToOutput = (value) => {
    if (value !== "\n" && value !== "\r\n") output.write("*");
  };
  try {
    return await prompt.question("");
  } finally {
    interactivePrompt._writeToOutput = write;
    output.write("\n");
  }
}
