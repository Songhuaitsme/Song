import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

globalThis.__songAccessTestEnv = {};
const asModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const modules = new Map([
  ["react", asModule("export const cache = (callback) => callback;")],
  ["cloudflare:workers", asModule("export const env = globalThis.__songAccessTestEnv;")],
]);
async function loadSource(specifier) {
  if (modules.has(specifier)) return modules.get(specifier);
  assert.ok(specifier.startsWith("@/"));
  const source = await readFile(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url), "utf8");
  let compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  for (const match of compiled.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
    compiled = compiled.replace(match[0], `from ${JSON.stringify(await loadSource(match[1]))}`);
  }
  const url = asModule(compiled);
  modules.set(specifier, url);
  return url;
}
const { visitorContent } = await import(await loadSource("@/shared/content-access"));
const { defaultContent } = await import(await loadSource("@/shared/content-model"));
const store = await import(await loadSource("@/backend/content/content-store"));

test("uploaded essay images inherit the published essay access while unassigned media stays private", async () => {
  const url = "/api/assets/media/display/64780591-e04b-4bdb-b12f-13696e701cd2.webp";
  globalThis.__songAccessTestEnv.DB = {
    prepare() { return { bind() { return this; } }; },
    async batch() {
      return [
        { results: [] }, { results: [] },
        { results: [{ access: "public", body: `A photo\n\n![](${url})` }] },
        { results: [{ access: "private" }] },
      ];
    },
  };
  try {
    assert.equal(await store.getAssetAccess(url), "public");
    assert.equal(await store.getAssetAccess("/api/assets/media/display/unassigned.webp"), "private");
  } finally {
    delete globalThis.__songAccessTestEnv.DB;
  }
});

function fixture() {
  const result = structuredClone(defaultContent);
  for (const key of ["series", "essays", "favorites"]) {
    const base = result[key][0];
    result[key] = [
      { ...base, id: `${key}-private`, access: "private" },
      { ...base, id: `${key}-public`, access: "public" },
      { ...base, id: `${key}-draft`, access: "draft" },
      { ...base, id: `${key}-deleted`, access: "private", deletedAt: 0 },
    ];
  }
  result.favorites[0].url = "https://example.com/private-source-secret";
  return result;
}

function assertVisitor(content) {
  for (const key of ["series", "essays", "favorites"]) {
    assert.deepEqual(content[key].map((item) => item.id), [`${key}-private`, `${key}-public`]);
    assert.equal(content[key][0].title, defaultContent[key][0].title);
  }
  assert.equal(content.series[0].description, defaultContent.series[0].description);
  assert.equal(content.essays[0].excerpt, defaultContent.essays[0].excerpt);
  assert.equal(content.favorites[0].category, defaultContent.favorites[0].category);
  assert.equal(content.series[0].coverUrl, "");
  assert.deepEqual(content.series[0].photos, []);
  assert.equal(content.essays[0].body, "");
  for (const key of ["note", "imageUrl", "url"]) assert.equal(content.favorites[0][key], "");
  assert.deepEqual(content.series[1].photos, defaultContent.series[0].photos);
  assert.equal(content.essays[1].body, defaultContent.essays[0].body);
  assert.equal(content.favorites[1].note, defaultContent.favorites[0].note);
}

test("visitor metadata preserves order and summaries, removes private details and drafts without mutating content", () => {
  const content = fixture();
  const before = structuredClone(content);
  assertVisitor(visitorContent(content));
  assert.deepEqual(content, before);
});

test("fallback keeps private essay metadata for visitors and full text for the owner", async () => {
  delete globalThis.__songAccessTestEnv.DB;
  const visitor = await store.getSiteContent();
  const owner = await store.getSiteContent(true);
  const original = defaultContent.essays.find((item) => item.access === "private");
  assert.equal(visitor.essays.find((item) => item.id === original.id).body, "");
  assert.equal(visitor.essays.find((item) => item.id === original.id).excerpt, original.excerpt);
  assert.equal(owner.essays.find((item) => item.id === original.id).body, original.body);
});

test("database reads sanitize private data while owner reads remain complete", async () => {
  const content = fixture();
  const queries = [];
  const row = (item) => Object.fromEntries(Object.entries(item).map(([key, value]) => [
    key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value,
  ]));
  const photo = row({ ...content.series[0].photos[0], seriesId: "series-private" });
  const db = {
    prepare(sql) {
      const statement = {
        sql,
        bind(...args) { statement.args = args; return statement; },
        async first() {
          if (sql.includes("SELECT id FROM series")) return { id: "existing" };
          if (statement.args?.[0] === "access_v1_migrated") return { value: "done" };
          return null;
        },
      };
      return statement;
    },
    async batch(statements) {
      queries.push(...statements.map((item) => item.sql));
      return statements.map(({ sql }) => {
        if (sql.startsWith("SELECT p.*")) return { results: [photo] };
        const key = ["series", "essays", "favorites"].find((key) => sql.includes(`FROM ${key}`));
        assert.ok(key);
        const items = content[key].filter((item) => item.deletedAt == null &&
          (!sql.includes("access IN") || item.access !== "draft"));
        return { results: items.map(row) };
      });
    },
  };
  globalThis.__songAccessTestEnv.DB = db;
  try {
    const visitor = await store.getSiteContent();
    assert.equal(visitor.essays[0].body, "");
    assert.equal(visitor.series[0].coverUrl, "");
    assert.deepEqual(visitor.series[0].photos, []);
    assert.equal(visitor.favorites[0].note, "");
    assert.equal(visitor.favorites[0].imageUrl, "");
    assert.equal(visitor.favorites[0].url, "");
    assert.equal(visitor.essays[0].excerpt, content.essays[0].excerpt);
    assert.deepEqual(visitor.essays.map((item) => item.id), ["essays-private", "essays-public"]);
    assert.ok(queries.find((sql) => sql.startsWith("SELECT p.*")).includes("s.access='public'"));
    queries.length = 0;
    const owner = await store.getSiteContent(true);
    assert.equal(owner.essays[0].body, content.essays[0].body);
    assert.equal(owner.series[0].photos[0].imageUrl, photo.image_url);
    assert.equal(owner.favorites[0].note, content.favorites[0].note);
    assert.ok(owner.essays.some((item) => item.access === "draft"));
  } finally {
    delete globalThis.__songAccessTestEnv.DB;
  }
});
