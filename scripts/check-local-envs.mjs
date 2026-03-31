#!/usr/bin/env node

import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const scopeArg = process.argv.find((arg) => arg.startsWith("--scope="));
const scope = scopeArg?.split("=")[1] ?? "root";

if (
  process.env.CI === "true" ||
  process.env.CI === "1" ||
  process.env.GITHUB_ACTIONS === "true" ||
  process.env.SKIP_LOCAL_ENV_CHECK === "1"
) {
  process.exit(0);
}

const requiredFilesByScope = {
  root: [
    {
      file: "backend/.env",
      reason: "required for the Medusa backend dev server",
    },
    {
      file: "storefront/.env.local",
      reason: "required for the storefront dev server",
    },
  ],
  backend: [
    {
      file: ".env",
      reason: "required for the Medusa backend dev server",
    },
  ],
  storefront: [
    {
      file: ".env.local",
      reason: "required for the storefront dev server",
    },
  ],
};

const requiredFiles = requiredFilesByScope[scope];

if (!requiredFiles) {
  console.error(
    `[env-check] Unknown scope "${scope}". Expected one of: ${Object.keys(
      requiredFilesByScope,
    ).join(", ")}`,
  );
  process.exit(1);
}

const missingFiles = requiredFiles.filter(({ file }) => {
  return !existsSync(path.resolve(process.cwd(), file));
});

if (missingFiles.length === 0) {
  process.exit(0);
}

console.error("[env-check] Missing local environment file(s):");

for (const { file, reason } of missingFiles) {
  console.error(`- ${file} (${reason})`);
}

console.error("");
console.error(
  "[env-check] Copy the missing file(s) from your main checkout or create them from the corresponding .env.example before running the dev server.",
);

process.exit(1);
