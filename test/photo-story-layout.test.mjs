import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(new URL("../src/shared/photo-story-layout.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { buildPhotoStoryRows, buildPhotoStorySections, photoAspectRatio } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const photo = (id, width = 1200, height = 1800) => ({ id, width, height });

test("empty and single-photo stories have a natural layout", () => {
  assert.deepEqual(buildPhotoStoryRows([]), []);
  assert.equal(buildPhotoStoryRows([photo(1)])[0].kind, "portrait");
  assert.equal(buildPhotoStoryRows([photo(1, 1800, 1200)])[0].kind, "single");
  assert.equal(buildPhotoStoryRows([photo(1, 1200, 1200)])[0].kind, "single");
});

test("opening landscape stands alone, while subsequent adjacent photos pair in order", () => {
  const photos = [photo(1, 1800, 1200), photo(2), photo(3), photo(4, 1800, 1200), photo(5)];
  const rows = buildPhotoStoryRows(photos);
  assert.deepEqual(rows.map(row => row.kind), ["single", "pair", "pair"]);
  assert.deepEqual(rows.map(row => row.items.map(item => item.photo.id)), [[1], [2, 3], [4, 5]]);
  assert.deepEqual(rows.flatMap(row => row.items.map(item => item.index)), [0, 1, 2, 3, 4]);
});

test("all-portrait and all-landscape stories handle odd endings without changing order", () => {
  assert.deepEqual(buildPhotoStoryRows(Array.from({length: 5}, (_, i) => photo(i))).map(row => row.kind), ["pair", "pair", "portrait"]);
  const rows = buildPhotoStoryRows(Array.from({length: 4}, (_, i) => photo(i, 1800, 1200)));
  assert.deepEqual(rows.map(row => row.kind), ["single", "pair", "single"]);
});

test("panoramas flush an unpaired neighbour and never share a row", () => {
  const photos = [photo(1), photo(2, 2400, 1200), photo(3, 3600, 1200), photo(4), photo(5)];
  const rows = buildPhotoStoryRows(photos);
  assert.deepEqual(rows.map(row => row.items.map(item => item.photo.id)), [[1], [2], [3], [4, 5]]);
  assert.deepEqual(rows.map(row => row.kind), ["portrait", "single", "single", "pair"]);
  assert.equal(buildPhotoStoryRows([photo(1), photo(2, 2399, 1200)])[0].kind, "pair");
});

test("mixed ratios produce equal-height columns without cropping at desktop and tablet widths", () => {
  const [row] = buildPhotoStoryRows([photo(1), photo(2, 1800, 1200)]);
  for (const width of [728, 960, 1200]) {
    const sum = row.items.reduce((total, item) => total + item.aspectRatio, 0);
    const height = (width - 24) / sum;
    const widths = row.items.map(item => height * item.aspectRatio);
    assert.ok(Math.abs(widths[0] + widths[1] + 24 - width) < 0.000001);
    row.items.forEach((item, i) => assert.ok(Math.abs(widths[i] / height - item.photo.width / item.photo.height) < 0.000001));
  }
});

test("invalid dimensions fall back to a safe square frame", () => {
  for (const [width, height] of [[0, 1200], [1200, 0], [-1, 1200], [Infinity, 1], [1, NaN]]) {
    assert.equal(photoAspectRatio({ width, height }), 1);
  }
});

test("large stories keep every original object exactly once and do not mutate input", () => {
  const photos = Object.freeze(Array.from({length: 1000}, (_, i) => Object.freeze(photo(i, i % 9 === 0 ? 3600 : i % 2 ? 1200 : 1800, 1200))));
  const rows = buildPhotoStoryRows(photos);
  const items = rows.flatMap(row => row.items);
  assert.equal(items.length, photos.length);
  items.forEach((item, i) => { assert.equal(item.photo, photos[i]); assert.equal(item.index, i); });
  assert.ok(rows.every(row => row.items.length <= 2));
});

test("chapter boundaries flush rows while global indices and photo order remain continuous", () => {
  const photos = Array.from({length: 7}, (_, i) => photo(`p${i}`));
  const chapters = [{id:'b',beforePhotoId:'p3',title:'Second',body:''},{id:'a',beforePhotoId:'p1',title:'First',body:''}];
  const sections = buildPhotoStorySections(photos, chapters);
  assert.deepEqual(sections.map(section => section.chapter?.id), [undefined, 'a', 'b']);
  assert.deepEqual(sections.flatMap(section => section.rows.flatMap(row => row.items.map(item => item.index))), [0,1,2,3,4,5,6]);
  assert.deepEqual(sections.map(section => section.rows.flatMap(row => row.items.map(item => item.photo.id))), [['p0'],['p1','p2'],['p3','p4','p5','p6']]);
});

test("blank chapters do not alter the pure-photo layout and chapters follow their anchor after reordering", () => {
  const photos = [photo('p1'),photo('p2'),photo('p3')];
  assert.deepEqual(buildPhotoStorySections(photos,[{id:'blank',beforePhotoId:'p2',title:' ',body:'\n'}])[0].rows,buildPhotoStoryRows(photos));
  const sections = buildPhotoStorySections([photos[2],photos[0],photos[1]],[{id:'a',beforePhotoId:'p3',title:'Chapter',body:''}]);
  assert.equal(sections[0].chapter.id,'a');assert.equal(sections[0].rows[0].items[0].photo.id,'p3');
});
