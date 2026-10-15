import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/frontend/photo-upload-batch.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { uploadPhotoBatch } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const item = (id, file = new File(["image"], `${id}.jpg`, { type: "image/jpeg" })) => ({ id, file, state: "waiting", progress: 0 });
const display = { blob: new Blob(["display"], { type: "image/webp" }), width: 1200, height: 1800 };

test("a failed image does not interrupt the queue or change selection order", async () => {
  const saved = [], changes = [];
  const results = await uploadPhotoBatch([item("first"), item("broken"), item("last")], {
    seriesId: "series-1", startOrder: 27,
    prepare: async file => { if (file.name === "broken.jpg") throw new Error("Unreadable image"); return display; },
    upload: async (file, _, progress) => { progress(.5); return { id: file.name, imageUrl: `/display/${file.name}`, originalUrl: `/original/${file.name}` }; },
    save: async photo => saved.push(photo), onSaved: () => {}, onChange: change => changes.push(change),
  });
  assert.deepEqual(results.map(result => result.state), ["done", "error", "done"]);
  assert.deepEqual(saved.map(photo => [photo.id, photo.seriesId, photo.sortOrder]), [["first", "series-1", 28], ["last", "series-1", 30]]);
  assert.equal(saved[0].alt, "first");
  assert.equal(saved[0].width, 1200);
  assert.equal(results[1].error, "Unreadable image");
  assert.ok(changes.some(change => change.id === "last" && change.progress === 50));
});

test("retrying a save keeps uploaded media, stable photo IDs and reserved order", async () => {
  let uploads = 0, attempts = 0;
  const saved = new Map(), added = [];
  const options = {
    seriesId: "series-1", startOrder: 8, prepare: async () => display,
    upload: async () => { uploads++; return { id: "asset-1", imageUrl: "/display/1.webp", originalUrl: "/original/1.jpg" }; },
    save: async photo => {
      saved.set(photo.id, photo); // Simulate a committed write whose response was lost.
      if (++attempts === 1) throw new Error("Connection interrupted");
    },
    onChange: () => {}, onSaved: photo => added.push(photo),
  };
  const failed = await uploadPhotoBatch([item("stable-photo")], options);
  assert.equal(failed[0].state, "error");
  assert.equal(failed[0].photo.imageUrl, "/display/1.webp");
  const retried = await uploadPhotoBatch(failed, { ...options, startOrder: 50 });
  assert.equal(retried[0].state, "done");
  assert.equal(retried[0].photo.sortOrder, 9);
  assert.equal(uploads, 1);
  assert.equal(saved.size, 1);
  assert.deepEqual(added.map(photo => photo.id), ["stable-photo"]);
});

test("invalid types, empty and oversized files are rejected before decoding or uploading", async () => {
  let prepared = 0;
  const invalid = new File(["text"], "notes.txt", { type: "text/plain" });
  const empty = new File([], "empty.jpg", { type: "image/jpeg" });
  const large = new File([new Uint8Array(25 * 1024 * 1024 + 1)], "large.jpg", { type: "image/jpeg" });
  const results = await uploadPhotoBatch([item("invalid", invalid), item("empty", empty), item("large", large)], {
    seriesId: "series-1", startOrder: 0,
    prepare: async () => { prepared++; return display; },
    upload: async () => assert.fail("Invalid file must not upload"),
    save: async () => assert.fail("Invalid file must not save"),
    onChange: () => {}, onSaved: () => {},
  });
  assert.equal(prepared, 0);
  assert.deepEqual(results.map(result => result.state), ["error", "error", "error"]);
  assert.match(results[0].error, /JPEG/);
  assert.match(results[1].error, /为空/);
  assert.match(results[2].error, /25MB/);
});
