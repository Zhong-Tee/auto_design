/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, dependencies = {}, globals = {}) {
  const exports = {};
  const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  vm.runInNewContext(outputText, {
    exports, require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unmocked dependency ${name}`);
      return dependencies[name];
    }, Buffer, AbortController, AbortSignal, Error, Date,
    console: { info() {}, error() {} }, ...globals,
  });
  return exports;
}

function job() {
  return { id: "job-1", user_id: "owner-1", worker_token: "lease-1", status: "processing",
    order_number: "ORD-1", prompt_used: "original prompt", model: "saved-model",
    quality: "medium", size: "1024x1024", uploaded_image_url: "https://input.test/image.png" };
}

function processor(row, generate, upload = async () => "https://output.test/image.png") {
  const writes = [], keys = [], intervals = [];
  const database = {
    from(table) {
      if (table === "app_settings") return { select: async () => ({ data: [], error: null }) };
      let payload;
      const filters = {};
      let executed;
      const execute = () => {
        if (executed) return executed;
        const owns = Object.entries(filters).every(([key, value]) => row[key] === value);
        if (owns) { writes.push(payload); Object.assign(row, payload); }
        return executed = Promise.resolve({ data: owns ? { id: row.id } : null, error: null });
      };
      const query = {
        update(value) { payload = value; return query; },
        eq(key, value) { filters[key] = value; return query; },
        select() { return query; }, maybeSingle: execute,
        then(resolve, reject) { return execute().then(resolve, reject); },
      };
      return query;
    },
  };
  const processorModule = load("src/lib/process-generation.ts", {
    "@/lib/supabase/admin": { createAdminClient: () => database },
    "@/lib/openai": { generateImage: (params) => generate(params, intervals) },
    "@/lib/storage": {
      fetchImageFromUrl: async () => Buffer.from("input"),
      uploadImage: async (key, ...args) => { keys.push(key); return upload(key, ...args); },
    },
    "@/lib/cost": { buildPricingSettings: () => ({}), calculateCost: () => ({ costUsd: 1, costThb: 35 }) },
  }, {
    setInterval: (callback) => { intervals.push(callback); return 1; }, clearInterval() {},
    setTimeout: () => 2, clearTimeout() {},
  });
  return { run: () => processorModule.processGenerationJob({ ...row }), writes, keys };
}

async function image(params) {
  await params.onAttempt(1);
  return { imageBuffer: Buffer.from("image"), model: params.model,
    usage: { input_text_tokens: 1, input_image_tokens: 2, output_image_tokens: 3, total_tokens: 6 } };
}

async function testOwnership() {
  const row = job();
  const worker = processor(row, image);
  await worker.run();
  assert.equal(row.status, "success");
  assert.equal(row.model, "saved-model");
  assert.equal(row.worker_token, null);
  assert.deepEqual(worker.writes.filter((write) => write.processing_step).map((write) => write.processing_step),
    ["loading", "generating", "saving", "completed"]);
  assert.equal(worker.keys[0], "outputs/owner-1/job-1/lease-1.png");

  for (const stage of ["generating", "saving", "replaced-lease", "heartbeat"]) {
    const cancelled = job();
    const revoke = () => Object.assign(cancelled, stage === "replaced-lease"
      ? { worker_token: "lease-2", status: "processing" }
      : { worker_token: null, status: "cancelled" });
    const test = processor(cancelled, async (params, intervals) => {
      const result = await image(params);
      if (stage !== "saving") revoke();
      if (stage === "heartbeat") { await intervals[0](); params.signal.throwIfAborted(); }
      return result;
    }, async () => { revoke(); return "https://output.test/abandoned.png"; });
    await test.run();
    assert.equal(cancelled.status, stage === "replaced-lease" ? "processing" : "cancelled", stage);
    assert.equal(cancelled.output_image_url, undefined, stage);
    if (stage !== "saving") assert.equal(test.keys.length, 0, stage);
  }
}

async function testRetry() {
  for (const [status, expected] of [[400, 1], [401, 1], [429, 2], [503, 2], [undefined, 1]]) {
    let calls = 0, options;
    class SDK {
      constructor(opts) { options = opts; }
      images = { generate: async () => { calls++; throw Object.assign(new Error(`failure-${calls}`), { status }); } };
    }
    const { generateImage } = load("src/lib/openai.ts", {
      openai: { __esModule: true, default: SDK },
      "@/lib/cost": {}, "@/lib/image-models": { DEFAULT_IMAGE_MODEL: "test" },
      "@/lib/image-background": { resolveImageBackground: () => "auto" },
    }, {
      process: { env: { OPENAI_API_KEY: "offline" } },
      setTimeout: (callback) => { queueMicrotask(callback); return 1; }, clearTimeout() {},
    });
    await assert.rejects(() => generateImage({ prompt: "test", width: 1024, height: 1024, quality: "medium" }));
    assert.equal(calls, expected, `status=${status}`);
    assert.equal(options.maxRetries, 0);
    assert.equal(options.timeout, 600000);
  }
}

function testClientState() {
  const queue = load("src/lib/generate-queue.ts", { "@/lib/order-filename": { sanitizeOrderNumber: (value) => value } });
  const item = { id: "request", status: "processing", startedAt: "2026-10-10T07:00:00Z" };
  assert.equal(queue.applyGenerationStatus(item, { generationId: "job", status: "pending" }).status, "pending");
  assert.equal(queue.getQueueStepLabel({ ...item, generationId: "job", step: "saving" }), "กำลังบันทึกภาพ");
  const done = queue.applyGenerationStatus(item, {
    generationId: "job", status: "success", outputImageUrl: "https://output.test/image.png",
    completedAt: "2026-10-10T07:00:30Z", createdAt: item.startedAt,
  });
  assert.equal(queue.getQueueElapsedMs(done, Date.parse("2026-10-10T08:00:00Z")), 30000,
    "Delayed polling must not inflate the authoritative completion time");
  assert.equal(queue.applyGenerationStatus(item, { generationId: "job", status: "cancelled" }).status, "cancelled");
}

async function testCancellationAuth() {
  let adminCalls = 0;
  const route = load("src/app/api/generate/[id]/route.ts", {
    "next/server": { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    "@/lib/order-filename": {},
    "@/lib/supabase/server": { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: "other-user" } } }) },
      from: () => ({ select() { return this; }, eq() { return this; },
        maybeSingle: async () => ({ data: { user_id: "owner", status: "processing" } }) }),
    }) },
    "@/lib/supabase/admin": { createAdminClient: () => { adminCalls++; throw new Error("Unauthorized mutation"); } },
  });
  assert.equal((await route.DELETE(null, { params: Promise.resolve({ id: "job" }) })).status, 403);
  assert.equal(adminCalls, 0);
}

async function testIdempotentSubmit() {
  const requestId = "00000000-0000-4000-8000-000000000001";
  const payload = { requestId, orderNumber: "ORD-1", texts: [], artStyleId: requestId,
    uploadedImageUrl: "https://input.test/image.png" };
  for (const concurrent of [false, true]) {
    let inserts = 0;
    const existing = { id: "same-job", request_id: requestId, status: "processing", order_number: "ORD-1" };
    const database = {
      auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
      from() {
        const query = {
          select() { return query; }, eq() { return query; }, in() { return query; },
          maybeSingle: async () => ({ data: concurrent ? null : existing, error: null }),
          limit: async () => ({ data: [existing], error: null }),
          insert() { inserts++; throw new Error("A duplicate request must not insert"); },
        };
        return query;
      },
    };
    const route = load("src/app/api/generate/route.ts", {
      "next/server": { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
      zod: require("zod"),
      "@/lib/supabase/server": { createClient: async () => database },
      "@/lib/prompt": {}, "@/lib/shapes": {}, "@/lib/image-models": {},
      "@/lib/order-filename": { sanitizeOrderNumber: (value) => value },
    });
    const result = await route.POST({ json: async () => payload });
    assert.equal(result.status, 200);
    assert.equal(result.body.generationId, "same-job");
    assert.equal(inserts, 0);
  }
}

async function main() {
  await testOwnership();
  await testRetry();
  testClientState();
  await testCancellationAuth();
  await testIdempotentSubmit();
  console.log("PASS: successful processing, cancellation during API/upload, stale worker fencing, heartbeat abort, selective bounded retries, accurate timers, cancellation authorization, and idempotent/concurrent submissions");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
