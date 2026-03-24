import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      app: path.resolve(__dirname, "./app"),
      components: path.resolve(__dirname, "./components"),
      lib: path.resolve(__dirname, "./lib"),
    },
  },
});
