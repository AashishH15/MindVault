import { spawn } from "node:child_process";
import process from "node:process";

const args = new Set(process.argv.slice(2));
const fixFromArgs = args.has("--fix");
const fixFromNpmArgv = (() => {
  // Some npm environments (notably on Windows) may not forward `-- <args>`
  // to the underlying command consistently. As a fallback, inspect npm's argv.
  const raw = process.env.npm_config_argv;
  if (!raw) {
    return false;
  }
  try {
    const parsed = JSON.parse(raw);
    return Boolean(
      parsed &&
      parsed.original &&
      Array.isArray(parsed.original) &&
      parsed.original.includes("--fix")
    );
  } catch {
    return raw.includes("--fix");
  }
})();
const fix = fixFromArgs || fixFromNpmArgv;
const help = args.has("--help") || args.has("-h");

if (help) {
  // Keep this intentionally short and copy-paste friendly.
  console.log(`MindVault preflight checks

Usage:
  npm run preflight
  npm run preflight -- --fix

What it runs:
  - Prettier + ESLint + TypeScript (UI)
  - cargo fmt/clippy/test (core)
`);
  process.exit(0);
}

function run(command, { cwd } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      stdio: "inherit",
      shell: true,
      env: process.env,
    });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

const steps = [
  {
    name: fix ? "prettier (write)" : "prettier (check)",
    cmd: fix ? "npx prettier --write ." : "npx prettier --check .",
  },
  {
    name: fix ? "eslint (fix)" : "eslint",
    cmd: fix ? "npx eslint . --fix" : "npx eslint .",
  },
  { name: "tsc (noEmit)", cmd: "npx tsc --noEmit" },
  {
    name: fix ? "cargo fmt" : "cargo fmt (check)",
    cmd: fix
      ? "cargo fmt --manifest-path core/Cargo.toml"
      : "cargo fmt --manifest-path core/Cargo.toml -- --check",
  },
  {
    name: "cargo clippy",
    cmd: "cargo clippy --manifest-path core/Cargo.toml -- -D warnings",
  },
  { name: "cargo test", cmd: "cargo test --manifest-path core/Cargo.toml" },
];

for (const step of steps) {
   
  console.log(`\n==> ${step.name}`);
  const code = await run(step.cmd);
  if (code !== 0) {
     
    console.error(`\nPreflight failed: ${step.name}`);
    process.exit(code);
  }
}

 
console.log("\nPreflight passed.");
