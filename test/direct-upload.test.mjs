import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { AwsClient } from "aws4fetch";

globalThis.__directUploadAwsClient = AwsClient;
const source = (await readFile(new URL("../src/storage/direct-upload.ts", import.meta.url), "utf8")).replace('import { AwsClient } from "aws4fetch";', 'const AwsClient = globalThis.__directUploadAwsClient;');
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { createDirectUpload, readDirectUploadTicket } = await import(`data:text/javascript;base64,${Buffer.from(compile(source)).toString("base64")}`);
const config = { R2_ACCESS_KEY_ID: "example-access-key", R2_SECRET_ACCESS_KEY: "example-secret-key-do-not-publish", R2_ACCOUNT_ID: "a".repeat(32), R2_BUCKET_NAME: "song-media" };
const secret = "session-signing-key-".repeat(4);
const metadata = { fileName: "摄影.png", mimeType: "image/png", size: 100, displaySize: 20, checksum: "b".repeat(64), displayChecksum: "c".repeat(64), width: 800, height: 600, assignment: "series:one" };

test("direct uploads issue short-lived URLs for new objects with signed content types", async () => {
  const result = await createDirectUpload(config, metadata, secret);
  const payload = await readDirectUploadTicket(result.ticket, secret);
  assert.equal(payload.fileName, metadata.fileName);
  assert.equal(payload.assignment, "series:one");
  for (const value of [result.originalUploadUrl, result.displayUploadUrl]) {
    const url = new URL(value);
    assert.equal(url.hostname, `${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
    assert.equal(url.searchParams.get("X-Amz-Expires"), "600");
    assert.equal(url.searchParams.get("X-Amz-SignedHeaders"), "content-type;host");
    assert.match(url.searchParams.get("X-Amz-Signature"), /^[a-f0-9]{64}$/);
  }
  assert.ok(!JSON.stringify(result).includes(config.R2_SECRET_ACCESS_KEY));
});

test("modified, expired, and differently signed upload tickets cannot register files", async () => {
  const now = Date.now();
  const result = await createDirectUpload(config, metadata, secret, now);
  const [body, signature] = result.ticket.split(".");
  await assert.rejects(readDirectUploadTicket((body[0] === "a" ? "b" : "a") + body.slice(1) + "." + signature, secret), /无效/);
  await assert.rejects(readDirectUploadTicket(result.ticket, secret, now + 600001), /过期/);
  await assert.rejects(readDirectUploadTicket(result.ticket, "different-session-secret-".repeat(3)), /无效/);
  await assert.rejects(createDirectUpload(config, { ...metadata, size: 26 * 1024 * 1024 }, secret), /25MB/);
});

test("browser sends image bytes to storage without app credentials, then registers the ticket", async t => {
  const clientSource = await readFile(new URL("../src/frontend/upload-media.ts", import.meta.url), "utf8");
  const { uploadMediaMultipart } = await import(`data:text/javascript;base64,${Buffer.from(compile(clientSource)).toString("base64")}`);
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, request) => {
    calls.push({ url, request });
    if (url === "/api/upload/direct") {
      const body = JSON.parse(request.body);
      if (body.action === "init") {
        assert.match(body.checksum, /^[a-f0-9]{64}$/);
        assert.match(body.displayChecksum, /^[a-f0-9]{64}$/);
        return Response.json({ enabled: true, ticket: "ticket", originalUploadUrl: "https://storage.test/original", displayUploadUrl: "https://storage.test/display" });
      }
      assert.deepEqual(body, { action: "complete", ticket: "ticket" });
      return Response.json({ id: "asset", imageUrl: "/display.webp", originalUrl: "/original.png" });
    }
    assert.equal(request.method, "PUT");
    assert.equal(request.credentials, "omit");
    assert.equal(request.headers["x-csrf-token"], undefined);
    assert.ok(request.body instanceof Blob);
    return new Response(null, { status: 200 });
  });
  const result = await uploadMediaMultipart({ original: new File(["image"], "a.png", { type: "image/png" }), display: new Blob(["webp"], { type: "image/webp" }), width: 800, height: 600, csrfToken: "csrf" });
  assert.equal(result.id, "asset");
  assert.deepEqual(calls.map(x => x.url), ["/api/upload/direct", "https://storage.test/original", "https://storage.test/display", "/api/upload/direct"]);
});
