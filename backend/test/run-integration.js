import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = path.join(backendDirectory, "docker-compose.test.yml");
const projectName = "netflix-clone-test";
const mongoTestUri = "mongodb://127.0.0.1:27018/netflix_clone_test";
const suites = [
  "recommendation.integration.test.js",
  "watch-history.api.test.js",
  "recommendation-feedback.api.test.js",
  "kids-restrictions.api.test.js",
  "playback-session.api.test.js",
];
const requestedSuites = process.argv.slice(2);
const selectedSuites = requestedSuites.length
  ? requestedSuites
  : suites;

if (selectedSuites.some((suite) => !suites.includes(suite))) {
  console.error(`Unknown integration suite. Choose one of: ${suites.join(", ")}`);
  process.exit(2);
}

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: backendDirectory,
    stdio: "inherit",
    ...options,
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
};

let exitCode = 1;
let started = false;
try {
  const upStatus = run("docker", [
    "compose", "-f", composeFile, "--project-name", projectName,
    "up", "--detach", "--wait", "--wait-timeout", "60",
  ]);
  if (upStatus !== 0) throw new Error(`Docker Compose failed to start the isolated MongoDB test service (${upStatus})`);
  started = true;

  const env = { ...process.env, MONGO_TEST_URI: mongoTestUri };
  exitCode = 0;
  for (const suite of selectedSuites) {
    const status = run(process.execPath, [path.join(backendDirectory, "test", suite)], { env });
    if (status !== 0) {
      exitCode = status;
      break;
    }
  }
} catch (error) {
  console.error(error.message);
  exitCode = 1;
} finally {
  if (started) {
    const downStatus = run("docker", [
      "compose", "-f", composeFile, "--project-name", projectName,
      "down", "--volumes", "--remove-orphans",
    ]);
    if (downStatus !== 0 && exitCode === 0) exitCode = downStatus;
  }
}

process.exitCode = exitCode;
