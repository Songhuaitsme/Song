import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = (await readFile(new URL("../src/storage/media-store.ts", import.meta.url), "utf8")).replace(/^import .*;\s*$/gm, "");
let moduleId = 0;
async function mediaStore(bucket, db) {
  globalThis.__uploadTestBucket = bucket;
  globalThis.__uploadTestDb = db;
  const prelude = "const env = { BUCKET: globalThis.__uploadTestBucket }; const database = globalThis.__uploadTestDb; const getDatabase = () => database;\n";
  const compiled = ts.transpileModule(prelude + source + `\n// ${moduleId++}`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}
const input = () => ({ original: new File(["original bytes"], "photo.jpg", { type: "image/jpeg" }), display: new File(["display bytes"], "photo.webp", { type: "image/webp" }), width: 800, height: 600 });

test("single uploads store both files concurrently and save the original checksum", async () => {
  const uploads = [], release = [];
  let saved;
  const { storeMedia } = await mediaStore({ put: (key, body) => { uploads.push({ key, body }); return new Promise(resolve => release.push(resolve)); } }, {
    prepare: () => ({ bind: (...values) => ({ run: async () => { saved = values; } }) }),
  });
  const operation = storeMedia(input());
  const deadline = Date.now() + 1000;
  while (uploads.length < 2 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal(uploads.length, 2);
  assert.equal(Buffer.from(uploads[0].body).toString(), "original bytes");
  release.forEach(resolve => resolve({}));
  const result = await operation;
  assert.equal(result.checksum, createHash("sha256").update("original bytes").digest("hex"));
  assert.equal(saved[7], result.checksum);
  assert.equal(saved[12], "private");
});

test("a failed database write removes both newly uploaded files", async () => {
  const stored = [], deleted = [];
  const { storeMedia } = await mediaStore({ put: async key => { stored.push(key); return {}; }, delete: async keys => deleted.push(...keys) }, {
    prepare: () => ({ bind: () => ({ run: async () => { throw new Error("database failed"); } }) }),
  });
  await assert.rejects(storeMedia(input()), /database failed/);
  assert.deepEqual(deleted.sort(), stored.sort());
});

test("direct upload completion verifies both files before recording a private asset", async () => {
  const original = new TextEncoder().encode("original bytes"), display = new TextEncoder().encode("display bytes");
  const hash = bytes => createHash("sha256").update(bytes).digest("hex");
  let recorded;
  const { finishDirectUpload } = await mediaStore({ get: async key => {
    const bytes = key === "original" ? original : display;
    return { size: bytes.length, httpMetadata: { contentType: key === "original" ? "image/jpeg" : "image/webp" }, arrayBuffer: async () => bytes.buffer };
  } }, { prepare: () => ({ bind: (...values) => ({ run: async () => { recorded = values; } }) }) });
  const result = await finishDirectUpload({ id: "asset", originalKey: "original", displayKey: "display", size: original.length, displaySize: display.length, checksum: hash(original), displayChecksum: hash(display), fileName: "photo.jpg", mimeType: "image/jpeg", width: 800, height: 600, assignment: "series:one" });
  assert.equal(result.id, "asset");
  assert.equal(recorded[12], "private");
  assert.equal(recorded[7], hash(original));
});

test("shared compressed media is read and verified once with both URLs using the display asset", async () => {
  const bytes = new TextEncoder().encode("compressed webp"), reads = [], digests = [];
  let recorded;
  const hash = createHash("sha256").update(bytes).digest("hex");
  const { finishDirectUpload } = await mediaStore({ get: async key => {
    reads.push(key);
    return { size: bytes.length, httpMetadata: { contentType: "image/webp" }, arrayBuffer: async () => { digests.push(key); return bytes.buffer; } };
  } }, { prepare: () => ({ bind: (...values) => ({ run: async () => { recorded = values; } }) }) });
  const result = await finishDirectUpload({ id: "asset", originalKey: "media/display/shared.webp", displayKey: "media/display/shared.webp", size: bytes.length, displaySize: bytes.length, checksum: hash, displayChecksum: hash, fileName: "photo.webp", mimeType: "image/webp", width: 800, height: 600, assignment: "series:one" });
  assert.equal(result.originalUrl, result.imageUrl);
  assert.deepEqual(reads, ["media/display/shared.webp"]);
  assert.deepEqual(digests, reads);
  assert.equal(recorded[1], recorded[2]);
  assert.equal(recorded[12], "private");
});

test("a concurrent duplicate registration returns the existing asset and removes only the redundant object", async () => {
  const bytes = new TextEncoder().encode("compressed webp"), deleted = [];
  const hash = createHash("sha256").update(bytes).digest("hex");
  const existing = { id: "existing", display_url: "/api/assets/media/display/existing.webp", original_url: "/api/assets/media/display/existing.webp" };
  const { finishDirectUpload } = await mediaStore({
    get: async () => ({ size: bytes.length, httpMetadata: { contentType: "image/webp" }, arrayBuffer: async () => bytes.buffer }),
    delete: async keys => deleted.push(...keys),
  }, { prepare: () => ({ bind: () => ({ run: async () => ({ meta: { changes: 0 } }), first: async () => existing }) }) });
  const result = await finishDirectUpload({ id: "new", originalKey: "media/display/new.webp", displayKey: "media/display/new.webp", size: bytes.length, displaySize: bytes.length, checksum: hash, displayChecksum: hash, fileName: "photo.webp", mimeType: "image/webp", width: 100, height: 100, assignment: "unassigned" });
  assert.equal(result.id, "existing"); assert.equal(result.imageUrl, existing.display_url);
  assert.deepEqual(deleted, ["media/display/new.webp"]);
});
