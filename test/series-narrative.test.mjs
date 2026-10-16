import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path/posix';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
import { buildRestoreChanges } from '../scripts/lib/restore-changes.mjs';
import { normalizeSyncRow } from '../scripts/lib/sync-content.mjs';

const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
for (const file of (await readdir(new URL('../drizzle', import.meta.url))).filter(name => name.endsWith('.sql')).sort()) sqlite.exec(await readFile(new URL('../drizzle/' + file, import.meta.url), 'utf8'));
const adapter = {
  prepare(sql) {
    let args = [];
    const statement = {
      bind(...values) { assert.ok(values.length <= 100); args = values; return statement; },
      async first() { return sqlite.prepare(sql).get(...args) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...args) }; },
      async run() { const result = sqlite.prepare(sql).run(...args); return { success: true, meta: { changes: Number(result.changes) } }; },
      execute() { const prepared = sqlite.prepare(sql); return prepared.columns().length ? { results: prepared.all(...args), meta: { changes: 0 } } : { results: [], meta: { changes: Number(prepared.run(...args).changes) } }; },
    };
    return statement;
  },
  async batch(statements) { sqlite.exec('BEGIN'); try { const results = statements.map(statement => statement.execute()); sqlite.exec('COMMIT'); return results; } catch (error) { sqlite.exec('ROLLBACK'); throw error; } },
};
globalThis.__narrativeEnv = { DB: adapter };
globalThis.__narrativeAuth = { session: {}, csrf: true };
const url = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const modules = new Map([
  ['react', url('export const cache=fn=>fn;')],
  ['cloudflare:workers', url('export const env=globalThis.__narrativeEnv;')],
  ['@/backend/auth/admin-auth', url('export const getAdminSession=async()=>globalThis.__narrativeAuth.session;export const validateCsrf=()=>globalThis.__narrativeAuth.csrf;')],
]);
async function load(specifier) {
  if (modules.has(specifier)) return modules.get(specifier);
  const root = specifier.slice(2);
  let text = ts.transpileModule(await readFile(new URL('../src/' + root + '.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  for (const match of text.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
    const dependency = match[1].startsWith('.') ? '@/' + path.normalize(path.join(path.dirname(root), match[1])) : match[1];
    text = text.replace(match[0], `from ${JSON.stringify(await load(dependency))}`);
  }
  const compiled = url(text); modules.set(specifier, compiled); return compiled;
}
const writing = await import(await load('@/shared/series-narrative'));
const store = await import(await load('@/backend/content/content-store'));
const sync = await import(await load('@/backend/sync/sync-service'));
const { syncVersionGuard, validateNarrativeSync } = await import(await load('@/backend/sync/narrative-sync'));
const { POST } = await import(await load('@/app/api/studio/route'));
const { studioItemDirty, mergeStudioReload } = await import(await load('@/shared/studio-list'));
const narrative = (anchor = 'p2') => ({ intro: '真实导语', chapters: [{ id: 'chapter-one', beforePhotoId: anchor, title: '雨中的距离', body: '第一段观察。\n\n第二段思考。' }], closing: '仍在思考的问题。' });
const row = () => sqlite.prepare("SELECT * FROM series WHERE id='story'").get();
const record = () => ({ id: 'story', slug: 'story', title: '原始标题', description: '目录短简介', coverUrl: '/photos/01-fog-clock.webp', access: 'public', sortOrder: 1, version: row().version });
const photo = id => sqlite.prepare('SELECT * FROM photos WHERE id=?').get(id);
function seed() {
  sqlite.exec('DELETE FROM photos; DELETE FROM series; DELETE FROM essays; DELETE FROM favorites; DELETE FROM sync_conflicts;');
  sqlite.prepare('INSERT OR REPLACE INTO app_meta VALUES (?,?)').run('access_v1_migrated', 'done');
  const insert = sqlite.prepare('INSERT INTO series(id,slug,title,description,access,published,sort_order) VALUES(?,?,?,?,?,?,?)');
  insert.run('story', 'story', '原始标题', '目录短简介', 'public', 1, 1); insert.run('other', 'other', '其他系列', '', 'public', 1, 2);
  const add = sqlite.prepare('INSERT INTO photos(id,series_id,image_url,original_url,width,height,alt,sort_order) VALUES(?,?,?,?,?,?,?,?)');
  for (const [i, id] of ['p1', 'p2', 'p3', 'p4'].entries()) add.run(id, 'story', '/photos/01-fog-clock.webp', '/photos/01-fog-clock.webp', 1467, 2200, id, i);
  add.run('foreign', 'other', '/photos/01-fog-clock.webp', '/photos/01-fog-clock.webp', 1467, 2200, '', 1);
  globalThis.__narrativeAuth = { session: {}, csrf: true };
}
const save = value => store.upsertEntity('series', { ...record(), narrative: value });
const request = body => POST(new Request('https://example.com/api/studio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));

test('migration adds empty narrative without changing existing content or access', () => {
  seed(); assert.deepEqual(writing.readNarrative(row().narrative_json), writing.emptyNarrative()); assert.equal(row().description, '目录短简介'); assert.equal(row().access, 'public');
});
test('writing validates plain text, stable IDs, unique anchors, and storage bounds', () => {
  assert.deepEqual(writing.readNarrative('{}'), writing.emptyNarrative()); assert.deepEqual(writing.validateNarrative(narrative()), narrative());
  for (const input of [null, [], { intro: 5 }, { intro: 'x'.repeat(10001) }, { chapters: [{ id: '', beforePhotoId: 'p1' }] }, { chapters: [narrative().chapters[0], narrative().chapters[0]] }, { chapters: [{ ...narrative().chapters[0], id: 'a' }, { ...narrative().chapters[0], id: 'b' }] }]) assert.throws(() => writing.validateNarrative(input));
  assert.equal(writing.validateNarrative({ intro: '短' }).intro, '短'); assert.equal(writing.validateNarrative({ intro: '<script>alert(1)</script>' }).intro, '<script>alert(1)</script>');
});
test('series writing round-trips and legacy requests preserve the new fields', async () => {
  seed(); await save(narrative()); const written = row().narrative_json;
  await store.upsertEntity('series', { ...record(), description: '更新的短简介' }); assert.equal(row().narrative_json, written);
  const read = (await store.getSiteContent(true)).series.find(item => item.id === 'story'); assert.deepEqual(read.narrative, narrative()); assert.equal(read.description, '更新的短简介');
});
test('foreign/deleted anchors and stale writing saves are rejected without clearing content', async () => {
  seed(); await save(narrative()); const before = row();
  await assert.rejects(save(narrative('foreign')), /当前系列/);
  sqlite.exec("UPDATE photos SET deleted_at=1 WHERE id='p4'"); await assert.rejects(save(narrative('p4')), /当前系列/);
  await assert.rejects(store.upsertEntity('series', { ...record(), version: 1, narrative: { ...narrative(), intro: 'stale' } }), /已更新/);
  assert.equal(row().narrative_json, before.narrative_json); assert.equal(row().version, before.version);
});
test('anchor photos require an explicit deletion decision and validate replacement membership', async () => {
  seed(); await save(narrative()); const before = row();
  await assert.rejects(store.deleteEntity('photo', 'p2'), /章节起点/);
  await assert.rejects(store.deleteEntity('photo', 'p2', { beforePhotoId: 'foreign', version: before.version }), /当前系列/);
  await assert.rejects(store.deleteEntity('photo', 'p2', { beforePhotoId: 'p3', version: 1 }), /已更新/);
  assert.equal(photo('p2').deleted_at, null); assert.equal(row().narrative_json, before.narrative_json);
});
test('photo deletion moves its chapter and commits photo/series versions together', async () => {
  seed(); await save(narrative()); const version = row().version;
  const result = await store.deleteEntity('photo', 'p2', { beforePhotoId: 'p3', version });
  assert.ok(photo('p2').deleted_at); assert.equal(row().version, version + 1); assert.equal(result.series.version, version + 1); assert.equal(result.series.narrative.chapters[0].beforePhotoId, 'p3'); assert.equal(result.series.narrative.intro, narrative().intro);
});
test('explicit chapter deletion preserves other writing and unbound photo deletion preserves chapters', async () => {
  seed(); await save(narrative()); await store.deleteEntity('photo', 'p1'); assert.equal(writing.readNarrative(row().narrative_json).chapters.length, 1);
  await store.deleteEntity('photo', 'p2', { beforePhotoId: null, version: row().version }); const written = writing.readNarrative(row().narrative_json); assert.deepEqual(written.chapters, []); assert.equal(written.intro, narrative().intro); assert.equal(written.closing, narrative().closing);
});
test('editing a caption cannot erase series writing, and moving an anchor to another series is rejected', async () => {
  seed(); await save(narrative()); const p = photo('p2');
  const edit = { id: p.id, seriesId: p.series_id, imageUrl: p.image_url, originalUrl: p.original_url, width: p.width, height: p.height, alt: p.alt, caption: '新的作品注释', location: '', takenAt: '', sortOrder: p.sort_order };
  await store.upsertEntity('photo', edit); assert.equal(photo('p2').caption, edit.caption); assert.deepEqual(writing.readNarrative(row().narrative_json), narrative());
  await assert.rejects(store.upsertEntity('photo', { ...edit, seriesId: 'other' }), /章节起点/); assert.equal(photo('p2').series_id, 'story');
});
test('private and draft narratives never reach visitor content while the owner retains them', async () => {
  seed(); await save(narrative()); sqlite.exec("UPDATE series SET access='private' WHERE id='story'");
  const guest = (await store.getSiteContent()).series.find(item => item.id === 'story'); assert.equal(guest.description, '目录短简介'); assert.equal(guest.narrative, undefined); assert.deepEqual(guest.photos, []); assert.ok(!JSON.stringify(guest).includes('真实导语'));
  assert.deepEqual((await store.getSiteContent(true)).series.find(item => item.id === 'story').narrative, narrative());
  sqlite.exec("UPDATE series SET access='draft' WHERE id='story'"); assert.ok(!(await store.getSiteContent()).series.some(item => item.id === 'story'));
});
test('API rejects missing admin/CSRF and reports anchor conflicts instead of success', async () => {
  seed(); globalThis.__narrativeAuth.session = null; assert.equal((await request({ action: 'upsert', entity: 'series', record: { ...record(), narrative: narrative() } })).status, 403);
  globalThis.__narrativeAuth = { session: {}, csrf: false }; assert.equal((await request({ action: 'delete', entity: 'photo', id: 'p2' })).status, 403);
  globalThis.__narrativeAuth.csrf = true; await save(narrative()); const originalError = console.error; console.error = () => {};
  try { const response = await request({ action: 'delete', entity: 'photo', id: 'p2' }); assert.equal(response.status, 409); assert.match((await response.json()).error, /章节起点/); } finally { console.error = originalError; }
});
test('sync schema 4 exports writing and imports it without losing intro, chapters or closing', async () => {
  seed(); await save(narrative()); const snapshot = await sync.exportSync(); assert.equal(snapshot.schemaVersion, 4); const exported = snapshot.records.series.find(item => item.id === 'story'); assert.deepEqual(JSON.parse(exported.narrative_json), narrative());
  const changed = { ...exported, title: '同步后的标题', narrative_json: JSON.stringify({ ...narrative(), closing: '同步后的收尾' }), version: exported.version + 1 };
  assert.equal((await sync.importSync({ schemaVersion: 4, changes: [{ entity: 'series', data: changed, baseVersion: exported.version }] })).applied.length, 1); assert.equal(row().title, changed.title); assert.equal(writing.readNarrative(row().narrative_json).closing, '同步后的收尾');
  await assert.rejects(sync.importSync({ schemaVersion: 3, changes: [] }), /结构版本/);
});
test('sync rejects orphaning a chapter before any rows are written', async () => {
  seed(); await save(narrative()); const before = row();
  await assert.rejects(sync.importSync({ schemaVersion: 4, changes: [{ entity: 'series', data: { ...before, title: '不能部分应用' }, baseVersion: before.version }, { entity: 'photos', data: { ...photo('p2'), deleted_at: 100, version: 2 }, baseVersion: 1 }] }), /失效的章节/);
  assert.equal(row().title, before.title); assert.equal(photo('p2').deleted_at, null);
});
test('a conflicting series holds related photo changes and keeps both writing versions for resolution', async () => {
  seed(); await save(narrative()); const before = row();
  const incoming = { ...before, title: '远端标题', narrative_json: JSON.stringify({ ...narrative(), intro: '远端导语' }), version: before.version + 1 };
  const result = await sync.importSync({ schemaVersion: 4, changes: [{ entity: 'series', data: incoming, baseVersion: before.version - 1 }, { entity: 'photos', data: { ...photo('p2'), deleted_at: 100, version: 2 }, baseVersion: 1 }] });
  assert.deepEqual(result.applied, []); assert.equal(result.conflicts.length, 2); assert.equal(photo('p2').deleted_at, null); assert.equal(row().narrative_json, before.narrative_json);
  const conflict = sqlite.prepare("SELECT id FROM sync_conflicts WHERE entity='series'").get(); await sync.resolveConflict(conflict.id, 'remote'); assert.equal(writing.readNarrative(row().narrative_json).intro, '远端导语'); assert.ok(row().version > before.version);
});
test('transaction guard prevents stale sync from partially overwriting newer writing', async () => {
  seed(); const guard = syncVersionGuard(adapter, [{ entity: 'series', data: { id: 'story' }, baseVersion: 1 }]); sqlite.exec("UPDATE series SET version=2 WHERE id='story'");
  await assert.rejects(adapter.batch([guard, adapter.prepare("UPDATE series SET title='stale' WHERE id='story'")])); assert.equal(row().title, '原始标题'); assert.equal(row().version, 2);
});
test('schema 3 backups preserve newer writing while schema 4 restores its captured narrative', () => {
  const existing = { schemaVersion: 4, records: { series: [{ id: 'story', narrative_json: JSON.stringify(narrative()), version: 4 }] } };
  const legacy = buildRestoreChanges({ schemaVersion: 3, records: { series: [{ id: 'story', title: 'old' }] } }, existing);
  assert.equal(legacy.schemaVersion, 4); assert.equal(legacy.changes[0].baseVersion, 4); assert.equal(legacy.changes[0].data.narrative_json, existing.records.series[0].narrative_json);
  const backup = { schemaVersion: 4, records: { series: [{ id: 'story', narrative_json: JSON.stringify({ ...narrative(), intro: '备份导语' }) }] } }; assert.equal(JSON.parse(buildRestoreChanges(backup, existing).changes[0].data.narrative_json).intro, '备份导语');
  assert.throws(() => buildRestoreChanges({ ...backup, schemaVersion: 5 }, existing), /不兼容/);
});
test('unsaved narrative participates in dirty detection and survives a studio refresh', () => {
  const series = { id: 'story', photos: [], narrative: writing.emptyNarrative() }, base = { series: [series], essays: [], favorites: [], about: {}, copy: {} };
  const draft = { ...base, series: [{ ...series, narrative: narrative() }] }; assert.ok(studioItemDirty(draft.series[0], series));
  assert.deepEqual(mergeStudioReload(draft, base, { ...base, series: [{ ...series, version: 2 }] }).series[0].narrative, narrative());
});

test('sync protects observed parent versions when a concurrent chapter starts using a photo', async () => {
  seed(); const changes = [{ entity: 'photos', data: { ...photo('p1'), deleted_at: 100, version: 2 }, baseVersion: 1 }];
  const dependencies = await validateNarrativeSync(adapter, changes), guard = syncVersionGuard(adapter, [...changes, ...dependencies]);
  await save(narrative('p1'));
  await assert.rejects(adapter.batch([guard, adapter.prepare("UPDATE photos SET deleted_at=100 WHERE id='p1'")]));
  assert.equal(photo('p1').deleted_at, null); assert.equal(writing.readNarrative(row().narrative_json).chapters[0].beforePhotoId, 'p1');
});

test('a photo move cannot orphan a chapter added between validation and the write', async () => {
  seed(); const prepare = adapter.prepare; let injected = false;
  adapter.prepare = function(sql) { const statement = prepare(sql), run = statement.run; statement.run = async function() {
    if (sql.startsWith('INSERT INTO photos') && !injected) { injected = true; sqlite.prepare("UPDATE series SET narrative_json=?,version=version+1 WHERE id='story'").run(JSON.stringify(narrative('p2'))); }
    return run.call(statement);
  }; return statement; };
  try { await assert.rejects(store.upsertEntity('photo', { id:'p2',seriesId:'other',imageUrl:'/photo.webp',originalUrl:'/photo.webp',width:1200,height:1800,alt:'',caption:'',location:'',takenAt:'',sortOrder:1 }), /章节起点/); }
  finally { adapter.prepare = prepare; }
  assert.equal(photo('p2').series_id,'story'); assert.equal(writing.readNarrative(row().narrative_json).chapters[0].beforePhotoId,'p2');
});

test('sync imports new chapters and their new photos together regardless of input order', async () => {
  seed(); const series = { ...row(), id:'new-story',slug:'new-story',version:1,narrative_json:JSON.stringify(narrative('new-photo')) };
  const p = { ...photo('p1'),id:'new-photo',series_id:'new-story',version:1 };
  const result = await sync.importSync({schemaVersion:4,changes:[{entity:'photos',data:p,baseVersion:0},{entity:'series',data:series,baseVersion:0}]});
  assert.equal(result.applied.length,2); assert.equal(photo('new-photo').series_id,'new-story');
  assert.deepEqual(writing.readNarrative(sqlite.prepare("SELECT narrative_json FROM series WHERE id='new-story'").get().narrative_json),narrative('new-photo'));
});

test('empty migration defaults match old sync baselines while real writing remains a change', () => {
  const old = { id:'story', title:'保持旧同步基线', version:2, updated_at:10 };
  assert.deepEqual(normalizeSyncRow({...old,narrative_json:JSON.stringify(writing.emptyNarrative())}),normalizeSyncRow(old));
  assert.notDeepEqual(normalizeSyncRow({...old,narrative_json:JSON.stringify(narrative())}),normalizeSyncRow(old));
  const written = narrative(); assert.deepEqual(normalizeSyncRow({...old,narrative_json:JSON.stringify(written)}),normalizeSyncRow({...old,narrative_json:JSON.stringify({closing:written.closing,chapters:written.chapters,intro:written.intro})}));
});
