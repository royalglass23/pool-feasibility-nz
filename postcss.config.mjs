import { resolve } from "node:path";

const config = {
  plugins: {
    "@tailwindcss/postcss": {
      // All application templates live in src. Avoid scanning generated output
      // and the shared dependency junction in isolated build copies.
      base: resolve(process.cwd(), "src"),
    },
  },
};

export default config;
