// Test-only third-party boundary. Never loaded by the deployed application.
import { appendFileSync } from "node:fs";
const originalFetch = globalThis.fetch;
const counts = new Map();
globalThis.fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  if (url.hostname === "api.resend.com" && url.pathname === "/emails") {
    appendFileSync(process.env.INPUT_SECURITY_MAIL_CAPTURE, `${init.body}\n`);
    return Response.json({ id: "isolated-security-email" });
  }
  if (url.hostname === "redis.input-security.invalid") {
    const execute = (command) => {
      const [op, , keyCount, ...args] = command;
      if (
        !["eval", "evalsha"].includes(String(op).toLowerCase()) ||
        Number(keyCount) !== 3 ||
        args.length !== 7
      )
        throw new Error("UNEXPECTED_REDIS_COMMAND");
      const [key, previousKey, , limit, now, windowMs, increment] = args;
      const current = counts.get(key) ?? 0;
      const previous = Math.floor(
        (counts.get(previousKey) ?? 0) *
          (1 - (Number(now) % Number(windowMs)) / Number(windowMs)),
      );
      if (current + previous >= Number(limit))
        return { result: [-1, Number(limit)] };
      counts.set(key, current + Number(increment));
      return {
        result: [
          Number(limit) - current - Number(increment) - previous,
          Number(limit),
        ],
      };
    };
    const command = JSON.parse(init.body);
    return Response.json(
      url.pathname === "/pipeline" ? command.map(execute) : execute(command),
    );
  }
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
    throw new Error("EXTERNAL_NETWORK_DISABLED_FOR_SECURITY_TEST");
  return originalFetch(input, init);
};
