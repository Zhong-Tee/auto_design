import { loadEnvConfig } from "@next/env";
import { setTimeout as delay } from "node:timers/promises";

loadEnvConfig(process.cwd());

async function main() {
  const { claimGenerationJobs } = await import("../src/lib/generation-queue");
  const { processGenerationJob } = await import("../src/lib/process-generation");
  const active = new Set<Promise<void>>();
  let stopping = false;
  process.on("SIGINT", () => { stopping = true; });
  process.on("SIGTERM", () => { stopping = true; });
  process.on("message", (message) => { if (message === "shutdown") stopping = true; });
  console.info("[queue-worker] ready; concurrency=2; graceful shutdown waits for active jobs");
  while (!stopping) {
    try {
      const jobs = await claimGenerationJobs();
      for (const job of jobs) {
        const task = processGenerationJob(job)
          .catch((error) => console.error(`[queue-worker] job ${job.id} failed`, error))
          .finally(() => active.delete(task));
        active.add(task);
      }
    } catch (error) {
      console.error("[queue-worker] queue unavailable; check migration 012 and database connection", error);
    }
    if (!stopping) await delay(2500);
  }
  await Promise.allSettled(active);
  console.info("[queue-worker] stopped");
  if (process.connected) process.disconnect();
}

main().catch((error) => {
  console.error("[queue-worker] fatal", error);
  process.exitCode = 1;
  if (process.connected) process.disconnect();
});
