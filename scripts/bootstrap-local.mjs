import { spawnSync } from "node:child_process";

import * as nextEnv from "@next/env";

import { localBootstrapConfig } from "./local-bootstrap-target.mjs";

const { loadEnvConfig } = nextEnv.default ?? nextEnv;
loadEnvConfig(process.cwd());

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

try {
  const config = localBootstrapConfig(process.env);
  run("python", ["-m", "cli.bootstrap_local"], { cwd: "backend" });

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
