import { fileURLToPath } from "node:url";

const config = {
  plugins: {
    "@tailwindcss/postcss": {
      // All application templates live in src. Avoid scanning generated output
      // and the shared dependency junction in isolated build copies.
      base: fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
};

export default config;
