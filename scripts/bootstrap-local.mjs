import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import * as nextEnv from "@next/env";

import { localBootstrapConfig } from "./local-bootstrap-target.mjs";

const { loadEnvConfig } = nextEnv.default ?? nextEnv;
loadEnvConfig(process.cwd());

const pythonCandidates =
  process.platform === "win32"
    ? [resolve(".venv", "Scripts", "python.exe"), resolve("backend", ".venv", "Scripts", "python.exe")]
    : [resolve(".venv", "bin", "python"), resolve("backend", ".venv", "bin", "python")];
const pythonExecutable = pythonCandidates.find(existsSync);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

try {
  const config = localBootstrapConfig(process.env);
  if (!pythonExecutable) {
    throw new Error("MathSmart could not find a Python virtual environment.");
  }
  run(pythonExecutable, ["-m", "cli.bootstrap_local"], { cwd: "backend" });

  if (process.env.LOCAL_SEED_DEMO_DATA === "true") {
    run(process.execPath, ["scripts/seed-demo.mjs"], {
      env: {
        ...process.env,
        E2E_TEACHER_ADMIN_EMAIL: config.LOCAL_TEACHER_ADMIN_EMAIL,
        E2E_TEACHER_ADMIN_PASSWORD: config.LOCAL_TEACHER_ADMIN_PASSWORD,
      },
    });
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
