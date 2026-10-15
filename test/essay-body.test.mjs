import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/shared/essay-body.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { imageMarkup, parseEssayBody, essayImageUrls } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("uploaded essay images can be inserted, rendered, and found for access checks", () => {
  for (const prefix of ["media", "uploads"]) {
    const url = `/api/assets/${prefix}/display/64780591-e04b-4bdb-b12f-13696e701cd2.webp`;
    const body = `Before\n\n${imageMarkup(url, "Local photo")}\n\nAfter`;
    assert.deepEqual(parseEssayBody(body), [
      { type: "text", text: "Before" },
      { type: "image", url, caption: "Local photo" },
      { type: "text", text: "After" },
    ]);
    assert.deepEqual(essayImageUrls(body), [url]);
  }
});

test("essay images reject local file URLs, external URLs, and paths outside display assets", () => {
  for (const url of [
    "file:///C:/Pictures/photo.webp", "blob:https://example.com/photo", "data:image/webp;base64,abc",
    "https://example.com/photo.webp", "//example.com/photo.webp",
    "/api/assets/media/original/photo.webp", "/api/assets/media/display/../photo.webp",
    "/api/assets/media/display/photo.webp?other", "/api/assets/media/display/photo.webp#other",
  ]) {
    assert.throws(() => imageMarkup(url), /图片地址无效/);
    assert.deepEqual(essayImageUrls(`![photo](${url})`), []);
  }
});
