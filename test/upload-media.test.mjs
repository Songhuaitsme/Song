import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/frontend/upload-media.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { uploadMediaMultipart } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const result = { id: "asset", imageUrl: "/display.webp", originalUrl: "/original.png" };
const input = (bytes = 100) => ({ original: new File([new Uint8Array(bytes)], "photo.png", { type: "image/png" }), display: new Blob(["webp"], { type: "image/webp" }), width: 800, height: 600, csrfToken: "csrf", assignment: "series:one" });

test("small photos use one request and retain the original file, dimensions, and assignment", async t => {
  const photo = input();
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url, request) => {
    if (url === "/api/upload/direct") return Response.json({ enabled: false });
    calls++;
    assert.equal(url, "/api/upload");
    assert.equal(request.headers["x-csrf-token"], "csrf");
    assert.ok(request.body instanceof FormData);
    assert.deepEqual(await request.body.get("original").arrayBuffer(), await photo.original.arrayBuffer());
    assert.equal(request.body.get("width"), "800");
    assert.equal(request.body.get("assignment"), "series:one");
    return Response.json(result);
  });
  assert.deepEqual(await uploadMediaMultipart(photo), result);
  assert.equal(calls, 1);
});

test("large photos overlap parts and submit completion parts in number order", async t => {
  let activeOriginal = 0, maxOriginal = 0;
  let completion;
  const progress = [];
  t.mock.method(globalThis, "fetch", async (url, request) => {
    if (request.method === "POST") {
      const body = JSON.parse(request.body);
      if (body.action === "init") return Response.json({ id: "asset", originalKey: "original", displayKey: "display", originalUploadId: "o", displayUploadId: "d" });
      completion = body;
      return Response.json(result);
    }
    const query = new URL(url, "https://test.local").searchParams;
    const partNumber = Number(query.get("partNumber"));
    const original = query.get("key") === "original";
    if (original) { activeOriginal++; maxOriginal = Math.max(maxOriginal, activeOriginal); }
    await new Promise(resolve => setTimeout(resolve, partNumber === 1 ? 20 : 1));
    if (original) activeOriginal--;
    return Response.json({ etag: `etag-${partNumber}`, partNumber });
  });
  await uploadMediaMultipart({ ...input(11 * 1024 * 1024), onProgress: p => progress.push(p) });
  assert.equal(maxOriginal, 2);
  assert.deepEqual(completion.originalParts.map(x => x.partNumber), [1, 2, 3]);
  assert.equal(completion.size, 11 * 1024 * 1024);
  assert.match(completion.checksum, /^[a-f0-9]{64}$/);
  assert.equal(progress.at(-1), 1);
  assert.ok(progress.every((value, index) => index === 0 || value >= progress[index - 1]));
});

test("browser upload progress updates before the server finishes saving", async t => {
  const savedXHR = globalThis.XMLHttpRequest;
  const progress = [];
  class FakeXHR {
    upload = {};
    status = 200;
    responseText = JSON.stringify(result);
    open(method, url) { assert.equal(method, "POST"); assert.equal(url, "/api/upload"); }
    setRequestHeader(name, value) { assert.equal(name, "x-csrf-token"); assert.equal(value, "csrf"); }
    send() {
      this.upload.onprogress({ lengthComputable: true, loaded: 40, total: 100 });
      assert.ok(progress.at(-1) > 0 && progress.at(-1) < 1);
      queueMicrotask(() => this.onload());
    }
  }
  globalThis.XMLHttpRequest = FakeXHR;
  t.after(() => { if (savedXHR === undefined) delete globalThis.XMLHttpRequest; else globalThis.XMLHttpRequest = savedXHR; });
  await uploadMediaMultipart({ ...input(), onProgress: value => progress.push(value) });
  assert.equal(progress.at(-1), 1);
});

test("an authorization failure is not retried or converted into another upload", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return Response.json({ error: "无权访问" }, { status: 403 }); });
  await assert.rejects(uploadMediaMultipart(input()), /无权访问/);
  assert.equal(calls, 1);
});

test("a failed part retries in its existing session without repeating successful parts", async t => {
  const attempts = new Map();
  let sessions = 0, completions = 0;
  t.mock.method(globalThis, "fetch", async (url, request) => {
    if (request.method === "POST") {
      const body = JSON.parse(request.body);
      if (body.action === "init") { sessions++; return Response.json({ id: "asset", originalKey: "original", displayKey: "display", originalUploadId: "o", displayUploadId: "d" }); }
      completions++;
      assert.deepEqual(body.originalParts.map(x => x.partNumber), [1, 2]);
      return Response.json(result);
    }
    const query = new URL(url, "https://test.local").searchParams;
    const key = `${query.get("key")}:${query.get("partNumber")}`;
    attempts.set(key, (attempts.get(key) ?? 0) + 1);
    if (key === "original:1" && attempts.get(key) === 1) return Response.json({ error: "temporary failure" }, { status: 502 });
    return Response.json({ etag: key, partNumber: Number(query.get("partNumber")) });
  });
  await uploadMediaMultipart(input(6 * 1024 * 1024));
  assert.equal(sessions, 1);
  assert.equal(completions, 1);
  assert.equal(attempts.get("original:1"), 2);
  assert.equal(attempts.get("original:2"), 1);
  assert.equal(attempts.get("display:1"), 1);
});
