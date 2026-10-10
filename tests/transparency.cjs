const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const sharp = require("sharp");

// Exercise the real TypeScript modules with an offline OpenAI mock.
function load(file, dependencies, globals = {}) {
  const exports = {};
  const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  vm.runInNewContext(outputText, {
    exports,
    require: (name) => dependencies[name],
    Buffer,
    ...globals,
  });
  return exports;
}

async function main() {
  const background = load("src/lib/image-background.ts", { sharp });
  for (const prompt of ["พื้นหลังโปร่งใส", "ฉากหลังแบบโปร่งใส", "ไม่มีพื้นหลัง", "transparent background", "background: transparent", "without a background"]) {
    assert.equal(background.resolveImageBackground(prompt), "transparent", prompt);
  }
  for (const prompt of ["a transparent glass on a beach", "white background", "not transparent background", "do not use a transparent background", "ไม่ต้องการพื้นหลังโปร่งใส"]) {
    assert.equal(background.resolveImageBackground(prompt), "auto", prompt);
  }

  const transparent = await sharp(Buffer.from([255, 0, 0, 255, 0, 0, 0, 0]), {
    raw: { width: 2, height: 1, channels: 4 },
  }).png().toBuffer();
  const opaqueRgb = await sharp({ create: { width: 2, height: 1, channels: 3, background: "white" } }).png().toBuffer();
  const opaqueRgba = await sharp(opaqueRgb).ensureAlpha().png().toBuffer();
  const empty = await sharp({ create: { width: 2, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  await background.assertTransparentPng(transparent);
  for (const image of [opaqueRgb, opaqueRgba, empty]) {
    await assert.rejects(() => background.assertTransparentPng(image), /โปร่งใส/);
  }

  let output = transparent;
  const calls = [];
  class OpenAIMock {
    images = Object.fromEntries(["generate", "edit"].map((method) => [method, async (params) => {
      calls.push({ method, params });
      return { data: [{ b64_json: output.toString("base64") }], usage: {} };
    }]));
  }
  const { generateImage } = load("src/lib/openai.ts", {
    openai: { default: OpenAIMock, __esModule: true, toFile: async (buffer) => buffer },
    "@/lib/cost": { extractTokenUsage: () => ({ total_tokens: 0 }) },
    "@/lib/image-models": { DEFAULT_IMAGE_MODEL: "gpt-image-2" },
    "@/lib/image-background": background,
  }, { process: { env: { OPENAI_API_KEY: "offline-test-only" } }, setTimeout });
  const params = { prompt: "พื้นหลังโปร่งใส", width: 1024, height: 1024, quality: "medium" };
  const generated = await generateImage(params);
  assert.deepEqual(generated.imageBuffer, transparent);
  await generateImage({ ...params, inputImageBuffer: opaqueRgb });
  assert.deepEqual(calls.map((call) => call.method), ["generate", "edit"]);
  for (const call of calls) {
    assert.equal(call.params.background, "transparent");
    assert.equal(call.params.output_format, "png");
  }
  output = opaqueRgba;
  await assert.rejects(() => generateImage(params), /โปร่งใส/);
  await generateImage({ ...params, prompt: "white background" });
  assert.equal(calls.at(-1).params.background, "auto");
  await generateImage({ ...params, background: "opaque" });
  assert.equal(calls.at(-1).params.background, "opaque");
  console.log("PASS: prompt background detection, real PNG alpha validation, generate/edit requests, opaque-output rejection, and explicit overrides");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
