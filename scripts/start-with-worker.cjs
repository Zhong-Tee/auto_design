/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require("node:child_process");
const mode = process.argv[2] === "dev" ? "dev" : "start";
const web = spawn(process.execPath, [require.resolve("next/dist/bin/next"), mode, ...process.argv.slice(3)], { stdio: "inherit" });
const worker = spawn(process.execPath, ["--import", "tsx", "scripts/queue-worker.ts"], { stdio: ["inherit", "inherit", "inherit", "ipc"] });
let stopping = false;
function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  web.kill(signal);
  if (worker.connected) worker.send("shutdown");
  else worker.kill(signal);
}
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop());
for (const child of [web, worker]) {
  child.on("error", (error) => { console.error(error); stop(); process.exitCode = 1; });
  child.on("exit", (code) => { if (!stopping) { process.exitCode = code || 1; stop(); } });
}
