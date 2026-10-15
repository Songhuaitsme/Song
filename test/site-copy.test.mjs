import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const settings = new Map();
globalThis.__songCopyTestEnv = {
  DB: {
    prepare(sql) {
      return {
        bind(key, value) {
          return {
            async first() {
              return sql.includes("site_settings") && settings.has(key) ? { value: settings.get(key) } : null;
            },
            async run() {
              assert.ok(sql.startsWith("INSERT INTO site_settings"));
              settings.set(key, value);
              return { success: true };
            },
          };
        },
      };
    },
  },
};

const asModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const modules = new Map([
  ["react", asModule("export const cache = (callback) => callback;")],
  ["cloudflare:workers", asModule("export const env = globalThis.__songCopyTestEnv;")],
]);

// Load the real TypeScript modules with only the Worker DB and React request
// cache substituted. This exercises the actual save/read path without touching
// the developer's local content or requiring the Cloudflare runtime.
async function loadSource(specifier) {
  if (modules.has(specifier)) return modules.get(specifier);
  assert.ok(specifier.startsWith("@/"), `Unexpected dependency: ${specifier}`);
  const source = await readFile(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url), "utf8");
  let compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  for (const match of compiled.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
    const dependency = await loadSource(match[1]);
    compiled = compiled.replace(match[0], `from ${JSON.stringify(dependency)}`);
  }
  const url = asModule(compiled);
  modules.set(specifier, url);
  return url;
}

const store = await import(await loadSource("@/backend/content/content-store"));
const standards = await import(await loadSource("@/shared/text-standards"));
const { buildTypographyCss } = await import(await loadSource("@/shared/text-standard-css"));

test("saved brand, navigation and link labels survive save and reload", async () => {
  settings.clear();
  const copy = await store.getSiteCopy();
  const edits = {
    brand: "我的摄影站",
    navSeries: "照片",
    navEssays: "文章",
    navCollection: "喜欢",
    navAbout: "关于我",
    enterSeries: "查看系列",
  };
  const saved = await store.saveSiteCopy({ ...copy, values: { ...copy.values, ...edits } });
  const reloaded = await store.getSiteCopy();
  for (const [key, value] of Object.entries(edits)) {
    assert.equal(saved.values[key], value, `save response for ${key}`);
    assert.equal(reloaded.values[key], value, `reloaded value for ${key}`);
  }
});

test("clearing configured labels persists and does not restore defaults", async () => {
  settings.clear();
  const copy = await store.getSiteCopy();
  const saved = await store.saveSiteCopy({
    ...copy,
    values: { ...copy.values, brand: "", navAbout: "", enterSeries: "" },
    textFormats: { "copy::brand": { font: "kai", size: 24, bold: true, color: "gray" } },
  });
  const reloaded = await store.getSiteCopy();
  for (const key of ["brand", "navAbout", "enterSeries"]) {
    assert.equal(saved.values[key], "");
    assert.equal(reloaded.values[key], "");
  }
  assert.deepEqual(reloaded.textFormats, saved.textFormats);
});

test("standards are explicitly enabled and archive the previous formats without mutating reads", async () => {
  settings.clear();
  const legacy = await store.saveSiteCopy({ ...(await store.getSiteCopy()), typography: { essay: { titleFont: "song", bodyFont: "song", titleSize: 0, bodySize: 20 } }, textFormats: { "series:one:title": { font: "kai", size: 90, color: "black", bold: true } } });
  const before = settings.get("site_copy_v1");
  const enabled = standards.enableTextStandards(legacy);
  assert.equal((await store.getSiteCopy()).textStandards, undefined);
  assert.equal(settings.get("site_copy_v1"), before);
  assert.deepEqual(enabled.textFormats, legacy.textFormats);
  assert.deepEqual(enabled.typography, legacy.typography);
  assert.equal(enabled.textStandards.styles["home:hero"].size, 90);
  assert.equal(enabled.textStandards.styles["home:sectionTitle"].size, 50);
  assert.equal(enabled.textStandards.styles["home:itemTitle"].size, 25);
  assert.deepEqual(enabled.textStandards.styles["home:summary"], { font: "sans", size: 20, color: "#626961", bold: false });
  await store.saveSiteCopy(enabled);
  assert.deepEqual((await store.getSiteCopy()).textStandards, enabled.textStandards);
  assert.deepEqual(standards.enableTextStandards(enabled), enabled);
  assert.ok(!buildTypographyCss(enabled).includes("data-text-format=\"series%3Aone%3Atitle"), "archived formats no longer render");
});

test("same content has independent formats in the homepage, cover, and end label", async () => {
  settings.clear();
  let copy = standards.enableTextStandards(await store.getSiteCopy());
  const key = "series:one:title";
  const home = { font: "sans", size: 80, color: "#365f83", bold: true };
  const cover = { font: "inherit", size: 0, color: "#ffffff", bold: null };
  copy = standards.applyTextFormat(copy, key, home, "home", "hero");
  copy = standards.applyTextFormat(copy, key, cover, "story", "overlayTitle");
  await store.saveSiteCopy(copy);
  let reloaded = await store.getSiteCopy();
  assert.deepEqual(reloaded.textStandards.overrides["home:hero|series:one:title"], home);
  assert.deepEqual(reloaded.textStandards.overrides["story:overlayTitle|series:one:title"], cover);
  assert.equal(reloaded.textStandards.overrides["story:label|series:one:title"], undefined);
  const css = buildTypographyCss(reloaded);
  assert.ok(css.includes('data-scoped-format="home%3Ahero%7Cseries%3Aone%3Atitle"'));
  assert.ok(css.includes('data-scoped-format="story%3AoverlayTitle%7Cseries%3Aone%3Atitle"'));
  reloaded = standards.applyTextFormat(reloaded, key, standards.inheritedFormat(), "home", "hero");
  await store.saveSiteCopy(reloaded);
  reloaded = await store.getSiteCopy();
  assert.equal(reloaded.textStandards.overrides["home:hero|series:one:title"], undefined);
  assert.deepEqual(reloaded.textStandards.overrides["story:overlayTitle|series:one:title"], cover);
});

test("custom colors and standards survive the stored JSON used by sync and backup", async () => {
  settings.clear();
  const copy = standards.enableTextStandards(await store.getSiteCopy());
  copy.textStandards.styles["home:summary"].color = "#AbC123";
  await store.saveSiteCopy(copy);
  const exported = JSON.parse(JSON.stringify({ site_settings: [{ key: "site_copy_v1", value: settings.get("site_copy_v1") }] }));
  settings.clear();
  settings.set(exported.site_settings[0].key, exported.site_settings[0].value);
  const restored = await store.getSiteCopy();
  assert.equal(restored.textStandards.styles["home:summary"].color, "#abc123");
  assert.equal(restored.textStandards.version, 2);
  assert.equal(restored.textStandards.styles["essay:body"].font, "song");
  assert.equal(restored.textStandards.styles["about:body"].font, "song");
});

test("reject invalid colors, sizes, unknown roles, and malformed override keys before saving", async () => {
  settings.clear();
  const copy = standards.enableTextStandards(await store.getSiteCopy());
  await store.saveSiteCopy(copy);
  const persisted = settings.get("site_copy_v1");
  for (const color of ["red", "#abc", "#12345g", "#fff;background:red", "</style>"]) {
    const invalid = structuredClone(copy);
    invalid.textStandards.styles["home:summary"].color = color;
    await assert.rejects(store.saveSiteCopy(invalid));
  }
  for (const size of [-1, 1, 9, 121, 20.5, "20"]) {
    const invalid = structuredClone(copy);
    invalid.textStandards.styles["home:summary"].size = size;
    await assert.rejects(store.saveSiteCopy(invalid));
  }
  const unknown = structuredClone(copy);
  unknown.textStandards.styles["login:body"] = unknown.textStandards.styles["home:summary"];
  await assert.rejects(store.saveSiteCopy(unknown));
  const malformed = structuredClone(copy);
  malformed.textStandards.overrides['home:hero|series:one:title"]{}'] = { font: "inherit", size: 10, bold: null };
  await assert.rejects(store.saveSiteCopy(malformed));
  assert.equal(settings.get("site_copy_v1"), persisted);
});

test("preview and responsive CSS agree on desktop scaling and phone heading proportions", () => {
  const hero = standards.findStandard("home", "hero");
  const summary = standards.findStandard("home", "summary");
  assert.equal(standards.previewPixels(hero, { size: 90 }, "desktop"), 117);
  assert.equal(standards.previewPixels(summary, { size: 20 }, "desktop"), 26);
  assert.equal(standards.previewPixels(summary, { size: 20 }, "mobile"), 16);
  assert.ok(standards.previewPixels(hero, { size: 90 }, "mobile") < 46);
  assert.equal(standards.previewPixels(hero, { size: 45 }, "desktop"), 58.5);
  assert.equal(standards.previewPixels(hero, { size: 45 }, "mobile"), standards.previewPixels(hero, { size: 90 }, "mobile") / 2);
  const ids = standards.standardDefinitions.map(def => standards.standardId(def.page, def.role));
  assert.equal(new Set(ids).size, ids.length);
});

test("saving standards preserves latest copy and single-text overrides", async () => {
  settings.clear();
  const initial = standards.enableTextStandards(await store.getSiteCopy());
  await store.saveSiteCopy(initial);
  const draft = structuredClone(initial.textStandards);
  draft.styles["home:summary"].color = "#365f83";
  const latest = standards.applyTextFormat({ ...initial, values: { ...initial.values, brand: "新的品牌" } }, "series:one:title", { font: "kai", size: 80, bold: null }, "home", "hero");
  await store.saveSiteCopy(latest);
  await store.saveTextStandards(draft);
  const saved = await store.getSiteCopy();
  assert.equal(saved.values.brand, "新的品牌");
  assert.equal(saved.textStandards.styles["home:summary"].color, "#365f83");
  assert.deepEqual(saved.textStandards.overrides, latest.textStandards.overrides);
});

test("photography cover standards stay linked when edited from either page and saved", async () => {
  settings.clear();
  let copy = standards.enableTextStandards(await store.getSiteCopy());
  const unrelated = structuredClone(copy.textStandards.styles["home:hero"]);
  for (const role of ["overlayTitle", "overlayLabel"]) {
    const directory = standards.findStandard("series", role);
    const detail = standards.findStandard("story", role);
    for (const page of ["series", "story"]) {
      const style = { font: page === "series" ? "sans" : "kai", size: role === "overlayTitle" ? 96 : 18, color: "#abc123", bold: true };
      copy.textStandards = standards.updateStandard(copy.textStandards, `${page}:${role}`, style);
      await store.saveSiteCopy(copy);
      copy = await store.getSiteCopy();
      assert.deepEqual(copy.textStandards.styles[`series:${role}`], style);
      assert.deepEqual(copy.textStandards.styles[`story:${role}`], style);
      for (const device of ["desktop", "tablet", "mobile"]) {
        assert.equal(standards.previewPixels(directory, style, device), standards.previewPixels(detail, style, device));
      }
    }
    copy.textStandards = standards.updateStandard(copy.textStandards, `story:${role}`, standards.defaultStandard(detail));
    assert.deepEqual(standards.resolveStandard(copy.textStandards, directory), standards.defaultStandard(detail));
  }
  assert.deepEqual(copy.textStandards.styles["home:hero"], unrelated);
});

test("old divergent photography cover settings use the directory standard without writing on read", async () => {
  settings.clear();
  const copy = standards.enableTextStandards(await store.getSiteCopy());
  copy.textStandards.styles["series:overlayTitle"] = { font: "song", size: 92, color: "#ffffff", bold: false };
  copy.textStandards.styles["story:overlayTitle"] = { font: "sans", size: 60, color: "#abc123", bold: true };
  const stored = JSON.stringify(copy);
  settings.set("site_copy_v1", stored);
  const reloaded = await store.getSiteCopy();
  const directory = standards.findStandard("series", "overlayTitle");
  const detail = standards.findStandard("story", "overlayTitle");
  assert.deepEqual(standards.resolveStandard(reloaded.textStandards, directory), standards.resolveStandard(reloaded.textStandards, detail));
  assert.equal(settings.get("site_copy_v1"), stored);
});
