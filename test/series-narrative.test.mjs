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
const layouts = await import(await load('@/shared/series-layout'));
const layoutOperations = await import(await load('@/shared/series-layout-operations'));
const { seriesEditorTarget } = await import(await load('@/shared/studio-series-sections'));
const store = await import(await load('@/backend/content/content-store'));
const sync = await import(await load('@/backend/sync/sync-service'));
const { syncVersionGuard, validateNarrativeSync } = await import(await load('@/backend/sync/narrative-sync'));
const { POST } = await import(await load('@/app/api/studio/route'));
const { studioItemDirty, mergeStudioReload } = await import(await load('@/shared/studio-list'));
const { entireSeriesPayload, applyEntireSeriesSave } = await import(await load('@/shared/series-save'));
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
test('sync schema 5 exports writing and imports it without losing intro, chapters or closing', async () => {
  seed(); await save(narrative()); const snapshot = await sync.exportSync(); assert.equal(snapshot.schemaVersion, 7); const exported = snapshot.records.series.find(item => item.id === 'story'); assert.deepEqual(JSON.parse(exported.narrative_json), narrative());
  const changed = { ...exported, title: '同步后的标题', narrative_json: JSON.stringify({ ...narrative(), closing: '同步后的收尾' }), version: exported.version + 1 };
  assert.equal((await sync.importSync({ schemaVersion: sync.SYNC_SCHEMA_VERSION, changes: [{ entity: 'series', data: changed, baseVersion: exported.version }] })).applied.length, 1); assert.equal(row().title, changed.title); assert.equal(writing.readNarrative(row().narrative_json).closing, '同步后的收尾');
  await assert.rejects(sync.importSync({ schemaVersion: 3, changes: [] }), /结构版本/);
});
test('sync rejects orphaning a chapter before any rows are written', async () => {
  seed(); await save(narrative()); const before = row();
  await assert.rejects(sync.importSync({ schemaVersion: sync.SYNC_SCHEMA_VERSION, changes: [{ entity: 'series', data: { ...before, title: '不能部分应用' }, baseVersion: before.version }, { entity: 'photos', data: { ...photo('p2'), deleted_at: 100, version: 2 }, baseVersion: 1 }] }), /失效的章节/);
  assert.equal(row().title, before.title); assert.equal(photo('p2').deleted_at, null);
});
test('a conflicting series holds related photo changes and keeps both writing versions for resolution', async () => {
  seed(); await save(narrative()); const before = row();
  const incoming = { ...before, title: '远端标题', narrative_json: JSON.stringify({ ...narrative(), intro: '远端导语' }), version: before.version + 1 };
  const result = await sync.importSync({ schemaVersion: sync.SYNC_SCHEMA_VERSION, changes: [{ entity: 'series', data: incoming, baseVersion: before.version - 1 }, { entity: 'photos', data: { ...photo('p2'), deleted_at: 100, version: 2 }, baseVersion: 1 }] });
  assert.deepEqual(result.applied, []); assert.equal(result.conflicts.length, 2); assert.equal(photo('p2').deleted_at, null); assert.equal(row().narrative_json, before.narrative_json);
  const conflict = sqlite.prepare("SELECT id FROM sync_conflicts WHERE entity='series'").get(); await assert.rejects(sync.resolveConflict(conflict.id, 'remote'),/失效的章节/); assert.equal(row().narrative_json,before.narrative_json); assert.equal(photo('p2').deleted_at,null); await sync.resolveConflict(conflict.id,'local'); assert.equal((await sync.listConflicts()).length,0);
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
  seed(); const batch=adapter.batch;let injected=false;
  adapter.batch=async function(statements){if(!injected){injected=true;sqlite.prepare("UPDATE series SET narrative_json=?,version=version+1 WHERE id='story'").run(JSON.stringify(narrative('p2')));}return batch(statements);};
  try { await assert.rejects(store.upsertEntity('photo', { id:'p2',seriesId:'other',imageUrl:'/photo.webp',originalUrl:'/photo.webp',width:1200,height:1800,alt:'',caption:'',location:'',takenAt:'',sortOrder:1 }), /未保存任何排版/); }
  finally { adapter.batch = batch; }
  assert.equal(photo('p2').series_id,'story'); assert.equal(writing.readNarrative(row().narrative_json).chapters[0].beforePhotoId,'p2');
});

test('sync imports new chapters and their new photos together regardless of input order', async () => {
  seed(); const series = { ...row(), id:'new-story',slug:'new-story',version:1,narrative_json:JSON.stringify(narrative('new-photo')) };
  const p = { ...photo('p1'),id:'new-photo',series_id:'new-story',version:1 };
  const result = await sync.importSync({schemaVersion:sync.SYNC_SCHEMA_VERSION,changes:[{entity:'photos',data:p,baseVersion:0},{entity:'series',data:series,baseVersion:0}]});
  assert.equal(result.applied.length,2); assert.equal(photo('new-photo').series_id,'new-story');
  assert.deepEqual(writing.readNarrative(sqlite.prepare("SELECT narrative_json FROM series WHERE id='new-story'").get().narrative_json),narrative('new-photo'));
});

test('empty migration defaults match old sync baselines while real writing remains a change', () => {
  const old = { id:'story', title:'保持旧同步基线', version:2, updated_at:10 };
  assert.deepEqual(normalizeSyncRow({...old,narrative_json:JSON.stringify(writing.emptyNarrative())}),normalizeSyncRow(old));
  assert.notDeepEqual(normalizeSyncRow({...old,narrative_json:JSON.stringify(narrative())}),normalizeSyncRow(old));
  const written = narrative(); assert.deepEqual(normalizeSyncRow({...old,narrative_json:JSON.stringify(written)}),normalizeSyncRow({...old,narrative_json:JSON.stringify({closing:written.closing,chapters:written.chapters,intro:written.intro})}));
});

const layoutPhotos = () => ['p1','p2','p3','p4'].map(id=>({...photo(id),id,width:1467,height:2200}));
const group = (id,ids,template=ids.length===1?'narrow':ids.length===2?'pair':ids.length===3?'triple':'quad') => ({id,template,gap:'space',items:ids.map(layouts.layoutImage)});
const manual = () => ({version:1,groups:[group('a',['p1','p2']),group('b',['p3','p4'])]});
const layoutRecord = layout => ({...record(),layout,photoOrder:(layout?layouts.layoutIds(layout):layoutPhotos().sort((a,b)=>a.sort_order-b.sort_order).map(p=>p.id)).map(id=>({id,version:photo(id).version}))});

test('group width validates and round-trips for every template without changing old layouts',()=>{
  seed();
  for(const template of layouts.layoutTemplates)for(const widthPercent of [25,55,70,85,100]){
    const value={version:1,groups:[{...group('g',layoutPhotos().slice(0,template.count).map(p=>p.id),template.id),widthPercent}]};
    assert.deepEqual(layouts.readLayout(JSON.stringify(value)),value);
    assert.equal(layouts.layoutSections(layoutPhotos(),value).sections[0].groups[0].group.widthPercent,widthPercent);
  }
  assert.deepEqual(layouts.validateLayout(manual()),manual());
  for(const widthPercent of [0,24,101,55.5,'70',null,NaN,Infinity]){
    const value=manual();value.groups[0].widthPercent=widthPercent;assert.throws(()=>layouts.validateLayout(value),/展示宽度/);
  }
});

test('widths follow groups through moves, splitting, merging, chapter splits and photo reconciliation',()=>{
  seed();const photos=layoutPhotos(),value=manual();value.groups[0].widthPercent=55;value.groups[1].widthPercent=85;
  const moved=layoutOperations.editLayout(value,{type:'move-group',id:'a',before:2},photos);assert.deepEqual(moved.groups.map(g=>g.widthPercent),[85,55]);
  const split=layoutOperations.editLayout(value,{type:'split',id:'a'},photos);assert.deepEqual(split.groups.map(g=>g.widthPercent),[55,55,85]);
  const merged=layoutOperations.editLayout(value,{type:'merge',id:'a'},photos);assert.equal(merged.groups[0].widthPercent,55);
  const joined=layoutOperations.editLayout(value,{type:'move-photo',id:'p1',groupId:'b',before:0},photos);assert.deepEqual(joined.groups.map(g=>g.widthPercent),[55,85]);
  const independent=layoutOperations.editLayout(value,{type:'move-photo',id:'p1',before:1},photos);assert.deepEqual(independent.groups.map(g=>g.widthPercent),[55,55,85]);
  const chapters=layouts.reconcileLayout(value,photos,narrative('p2').chapters);assert.deepEqual(chapters.groups.map(g=>g.widthPercent),[55,55,85]);
  const afterDelete=layouts.reconcileLayout(value,photos.slice(1));assert.equal(afterDelete.groups[0].widthPercent,55);
  const afterAdd=layouts.reconcileLayout(value,[...photos,{id:'new',width:100,height:100}]);assert.equal(afterAdd.groups.at(-1).widthPercent,undefined);
  assert.equal(value.groups[0].items.length,2);
});

test('width save is version guarded, preserves captions, and old series requests retain layout',async()=>{
  seed();const value=manual();value.groups[0].widthPercent=70;
  const beforePhoto=photo('p1');await store.upsertEntity('series',layoutRecord(value));assert.deepEqual(JSON.parse(row().layout_json),value);assert.equal(photo('p1').caption,beforePhoto.caption);
  await store.upsertEntity('series',{...record(),title:'只改系列标题'});assert.equal(JSON.parse(row().layout_json).groups[0].widthPercent,70);
  const before=row();await assert.rejects(store.upsertEntity('series',{...layoutRecord(value),version:1}),/已更新/);assert.deepEqual(row(),before);
  const bad=manual();bad.groups[0].widthPercent=101;const response=await request({action:'upsert',entity:'series',record:layoutRecord(bad)});assert.equal(response.status,400);assert.deepEqual(row(),before);
});

test('widths survive sync, grouped conflict resolution and backup restoration; old sync is rejected',async()=>{
  seed();const value=manual();value.groups[0].widthPercent=55;await store.upsertEntity('series',layoutRecord(value));
  const snapshot=await sync.exportSync();assert.equal(snapshot.schemaVersion,7);assert.equal(JSON.parse(snapshot.records.series.find(s=>s.id==='story').layout_json).groups[0].widthPercent,55);
  const before=row(),incoming=structuredClone(value);incoming.groups[0].widthPercent=85;
  await assert.rejects(sync.importSync({schemaVersion:5,changes:[]}),/版本不一致/);
  await sync.importSync({schemaVersion:sync.SYNC_SCHEMA_VERSION,changes:[{entity:'series',data:{...before,layout_json:JSON.stringify(incoming)},baseVersion:before.version-1}]});
  const [conflict]=await sync.listConflicts();await sync.resolveConflict(conflict.id,'remote');assert.equal(JSON.parse(row().layout_json).groups[0].widthPercent,85);
  const restored=buildRestoreChanges(snapshot,await sync.exportSync());await sync.importSync(restored);assert.equal(JSON.parse(row().layout_json).groups[0].widthPercent,55);
});

test('legacy backups preserve matching group widths and reject incompatible groups or photo sets',()=>{
  const value=manual();value.groups[0].widthPercent=70;
  const current={schemaVersion:6,records:{series:[{id:'story',layout_json:JSON.stringify(value),version:3}]}};
  for(const schemaVersion of [3,4,5]){
    const backup={schemaVersion,records:{series:[{id:'story',layout_json:JSON.stringify(manual())}]}};
    const result=buildRestoreChanges(backup,current);assert.equal(result.schemaVersion,6);assert.equal(JSON.parse(result.changes[0].data.layout_json).groups[0].widthPercent,70);assert.equal(backup.records.series[0].layout_json,JSON.stringify(manual()));
    const missing=buildRestoreChanges({schemaVersion,records:{series:[{id:'story'}]}},current);assert.equal(missing.changes[0].data.layout_json,current.records.series[0].layout_json);
  }
  for(const change of [v=>v.groups[0].id='other',v=>v.groups[0].items.pop(),v=>[v.groups[0].items[0],v.groups[1].items[0]]=[v.groups[1].items[0],v.groups[0].items[0]]]){
    const old=manual();change(old);assert.throws(()=>buildRestoreChanges({schemaVersion:5,records:{series:[{id:'story',layout_json:JSON.stringify(old)}]}},current),/无法匹配/);
  }
  assert.throws(()=>buildRestoreChanges({schemaVersion:5,records:{series:[{id:'story',layout_json:null}]}},current),/无法匹配/);
  const reset=buildRestoreChanges({schemaVersion:6,records:{series:[{id:'story',layout_json:JSON.stringify(manual())}]}},current);assert.equal(JSON.parse(reset.changes[0].data.layout_json).groups[0].widthPercent,undefined);
});

test('deep links resolve the correct collapsed editor section',()=>{
  const series={id:'story',photos:[{id:'p1'}],narrative:narrative()};
  for(const target of ['series-text-story','chapter-chapter-one'])assert.equal(seriesEditorTarget(series,target),'text');
  assert.equal(seriesEditorTarget(series,'series-layout-story'),'layout');
  for(const target of ['series-photos-story','p1'])assert.equal(seriesEditorTarget(series,target),'photos');
  assert.equal(seriesEditorTarget(series,'story'),null);assert.equal(seriesEditorTarget(series,'unknown'),null);
});

test('layout migration is opt-in and automatic conversion preserves original rows and image order',()=>{
  seed();assert.equal(row().layout_json,null);
  const photos=layoutPhotos(),before=structuredClone(photos),converted=layouts.automaticLayout(photos,[]);
  assert.deepEqual(converted.groups.map(g=>g.template),['pair','pair']);assert.deepEqual(layouts.layoutIds(converted),photos.map(p=>p.id));assert.deepEqual(photos,before);
  assert.deepEqual(normalizeSyncRow({...row(),layout_json:null}),normalizeSyncRow({...row(),layout_json:undefined}));
});
test('all nine templates validate, preserve framing and use one continuous photo sequence',()=>{
  seed();for(const template of layouts.layoutTemplates){const photos=layoutPhotos().slice(0,template.count),layout={version:1,groups:[group('g',photos.map(p=>p.id),template.id)]};
    layout.groups[0].gap='seamless';layout.groups[0].items[0]={photoId:photos[0].id,fit:'cover',x:20,y:80};
    assert.deepEqual(layouts.validateLayout(layout),layout);layouts.validateLayoutPhotos(layout,photos,[],true);
    const rendered=layouts.layoutSections(photos,layout);assert.deepEqual(rendered.sections[0].groups[0].items.map(p=>p.index),photos.map((_,i)=>i));assert.equal(rendered.sections[0].groups[0].items[0].frame.y,80);
  }
});
test('layout rejects invalid templates, counts, duplicate/foreign/missing photos, invalid crop and chapter crossings',()=>{
  seed();for(const change of [g=>g.template='unknown',g=>g.items.pop(),g=>g.gap='other',g=>g.items[0].x=101,g=>g.items[0].y=NaN,g=>g.items[0].fit='stretch',g=>g.items[1].photoId=g.items[0].photoId]){
    const value=manual();change(value.groups[0]);assert.throws(()=>layouts.validateLayout(value));
  }
  for(const value of [{version:1,groups:[group('x',['p1'])]},{version:1,groups:[group('x',['p1','p2','p3','foreign'])]}])assert.throws(()=>layouts.validateLayoutPhotos(value,layoutPhotos()));
  assert.throws(()=>layouts.validateLayoutPhotos(manual(),layoutPhotos(),narrative('p2').chapters),/跨越章节/);
});
test('layout and photo order commit atomically without overwriting annotations or image fields',async()=>{
  seed();sqlite.prepare("UPDATE photos SET caption='不可覆盖的注释',location='现场' WHERE id='p1'").run();
  const before=photo('p1'),value=manual();value.groups.reverse();
  const saved=await store.upsertEntity('series',layoutRecord(value));
  assert.equal(saved.version,2);assert.deepEqual(JSON.parse(row().layout_json),value);assert.deepEqual(sqlite.prepare("SELECT id FROM photos WHERE series_id='story' ORDER BY sort_order").all().map(p=>p.id),['p3','p4','p1','p2']);
  for(const field of ['caption','location','image_url','original_url','width','height','alt'])assert.equal(photo('p1')[field],before[field]);
  assert.equal(photo('p1').version,before.version+1);assert.equal(saved.photoOrder[0].id,'p3');
});
test('layout rejects stale series/photo versions and a concurrent write rolls back the entire batch',async()=>{
  seed();const incoming=layoutRecord(manual());sqlite.prepare("UPDATE photos SET version=version+1 WHERE id='p2'").run();
  await assert.rejects(store.upsertEntity('series',incoming),/照片版本/);assert.equal(row().layout_json,null);
  const batch=adapter.batch;let injected=false;adapter.batch=async statements=>{if(!injected&&statements.length){injected=true;sqlite.prepare("UPDATE photos SET caption='并发修改',version=version+1 WHERE id='p3'").run();}return batch(statements);};
  try{await assert.rejects(store.upsertEntity('series',layoutRecord(manual())),/未保存任何排版/);}finally{adapter.batch=batch;}
  assert.equal(row().layout_json,null);assert.equal(row().version,1);assert.equal(photo('p3').caption,'并发修改');assert.equal(photo('p1').sort_order,0);
});
test('missing photo set cannot be silently saved and a failed transaction never partially reorders',async()=>{
  seed();const input=layoutRecord(manual());input.photoOrder.pop();await assert.rejects(store.upsertEntity('series',input),/清单/);assert.equal(row().version,1);
  const prepare=adapter.prepare;adapter.prepare=sql=>prepare(sql.startsWith('UPDATE photos SET sort_order=')?"SELECT json('intentional-failure')":sql);
  try{await assert.rejects(store.upsertEntity('series',layoutRecord(manual())));}finally{adapter.prepare=prepare;}
  assert.equal(row().layout_json,null);assert.equal(row().version,1);assert.equal(photo('p1').sort_order,0);
});
test('legacy saves preserve layout while direct photo sorting cannot corrupt manual groups',async()=>{
  seed();const value=manual();await store.upsertEntity('series',layoutRecord(value));await store.upsertEntity('series',{...record(),title:'只改标题'});assert.deepEqual(JSON.parse(row().layout_json),value);
  const p=photo('p1'),edit={id:p.id,seriesId:p.series_id,imageUrl:p.image_url,originalUrl:p.original_url,width:p.width,height:p.height,alt:'修改替代文字',caption:'新注释',location:'',takenAt:'',sortOrder:p.sort_order};
  await store.upsertEntity('photo',edit);assert.equal(photo('p1').caption,'新注释');assert.deepEqual(JSON.parse(row().layout_json),value);
  await assert.rejects(store.upsertEntity('photo',{...edit,sortOrder:99}),/图片排版/);assert.equal(photo('p1').sort_order,1);
});
test('manual uploads append independently, deletion prunes groups, and retained templates adjust to their new count',async()=>{
  seed();await store.upsertEntity('series',layoutRecord(manual()));
  await store.upsertEntity('photo',{id:'new',seriesId:'story',imageUrl:'/new.webp',originalUrl:'/new.webp',width:1200,height:800,alt:'',caption:'',location:'',takenAt:'',sortOrder:5});
  assert.deepEqual(layouts.layoutIds(JSON.parse(row().layout_json)),['p1','p2','p3','p4','new']);assert.equal(JSON.parse(row().layout_json).groups.at(-1).template,'wide');
  const removed=await store.deleteEntity('photo','p1');assert.equal(removed.series.layout.groups[0].template,'narrow');assert.deepEqual(layouts.layoutIds(removed.series.layout),['p2','p3','p4','new']);
  await store.deleteEntity('photo','p2');assert.equal(JSON.parse(row().layout_json).groups.length,2);
});
test('layout operations support merge/split, moving photos/groups, independent drops, and chapter reconciliation without data loss',()=>{
  seed();const photos=layoutPhotos(),value=manual(),original=structuredClone(value);
  const merged=layoutOperations.editLayout(value,{type:'merge',id:'a'},photos);assert.equal(merged.groups[0].template,'quad');assert.equal(merged.groups.length,1);
  const split=layoutOperations.editLayout(merged,{type:'split',id:'a'},photos);assert.equal(split.groups.length,4);
  const moved=layoutOperations.editLayout(value,{type:'move-group',id:'b',before:0},photos);assert.deepEqual(layouts.layoutIds(moved),['p3','p4','p1','p2']);
  const photoMoved=layoutOperations.editLayout(value,{type:'move-photo',id:'p2',groupId:'b',before:0},photos);assert.equal(photoMoved.groups[1].template,'triple');assert.deepEqual(layouts.layoutIds(photoMoved),['p1','p2','p3','p4']);
  const independent=layoutOperations.editLayout(value,{type:'move-photo',id:'p2',before:1},photos);assert.equal(independent.groups.length,3);
  assert.throws(()=>layoutOperations.editLayout(value,{type:'merge',id:'a'},photos,narrative('p3').chapters),/章节边界/);
  const reconciled=layouts.reconcileLayout(value,photos,narrative('p2').chapters);assert.equal(reconciled.groups.length,3);assert.deepEqual(layouts.layoutIds(reconciled),['p1','p2','p3','p4']);assert.deepEqual(value,original);
});
test('moving chapter anchors splits groups while numbering and chapter text stay continuous',()=>{
  seed();const value=manual(),photos=layoutPhotos(),chapters=narrative('p3').chapters;
  const moved=layoutOperations.moveLayoutPhoto(value,photos,chapters,'p3',-1);layouts.validateLayoutPhotos(moved,photos,chapters);
  assert.deepEqual(layouts.layoutIds(moved),['p1','p3','p2','p4']);const rendered=layouts.layoutSections(photos,moved,chapters);
  assert.equal(rendered.sections[1].chapter.id,'chapter-one');assert.deepEqual(rendered.sections.flatMap(s=>s.groups.flatMap(g=>g.items.map(i=>i.index))),[0,1,2,3]);
});
test('private layout and photo identifiers never reach visitor content or HTML data',async()=>{
  seed();await store.upsertEntity('series',{...layoutRecord(manual()),access:'private'});
  const owner=await store.getSiteContent(true),visitor=await store.getSiteContent(false);assert.ok(owner.series.find(s=>s.id==='story').layout);const hidden=visitor.series.find(s=>s.id==='story');assert.equal(hidden.layout,undefined);assert.deepEqual(hidden.photos,[]);
});
test('sync schema 5 round-trips custom groups, blocks orphan layouts and preserves layouts for old backup requests',async()=>{
  seed();await store.upsertEntity('series',layoutRecord(manual()));const snapshot=await sync.exportSync(),current=row();assert.equal(snapshot.schemaVersion,7);
  const layout=JSON.parse(current.layout_json);layout.groups[0].gap='seamless';const changed={...current,layout_json:JSON.stringify(layout),version:current.version+1};
  await sync.importSync({schemaVersion:sync.SYNC_SCHEMA_VERSION,changes:[{entity:'series',data:changed,baseVersion:current.version}]});assert.equal(JSON.parse(row().layout_json).groups[0].gap,'seamless');
  await assert.rejects(sync.importSync({schemaVersion:sync.SYNC_SCHEMA_VERSION,changes:[{entity:'photos',data:{...photo('p1'),deleted_at:100,version:photo('p1').version+1},baseVersion:photo('p1').version}]}),/排版照片/);assert.equal(photo('p1').deleted_at,null);
  const restored=buildRestoreChanges({schemaVersion:4,records:{series:[{...row(),layout_json:undefined}]}},{schemaVersion:5,records:{series:[row()]}});assert.equal(restored.changes[0].data.layout_json,row().layout_json);
});
test('API enforces administrator/CSRF, dirty layouts survive reload, and photo fields are not part of order payloads',async()=>{
  seed();const rec=layoutRecord(manual());globalThis.__narrativeAuth={session:null,csrf:true};assert.equal((await request({action:'upsert',entity:'series',record:rec})).status,403);
  globalThis.__narrativeAuth={session:{},csrf:false};assert.equal((await request({action:'upsert',entity:'series',record:rec})).status,403);
  globalThis.__narrativeAuth={session:{},csrf:true};assert.equal((await request({action:'upsert',entity:'series',record:rec})).status,200);
  const base={series:[{id:'story',photos:[],layout:null}],essays:[],favorites:[],about:{},copy:{}},draft={...base,series:[{...base.series[0],layout:manual()}]};assert.ok(studioItemDirty(draft.series[0],base.series[0]));assert.deepEqual(mergeStudioReload(draft,base,base).series[0].layout,manual());
  assert.deepEqual(Object.keys(layoutOperations.seriesPhotoOrder({photos:[{id:'p1',width:1,height:1,caption:'保留',version:3}]} )[0]),['id','version']);
});

test('related layout/order sync conflicts resolve as one atomic group and refuse newer local edits',async()=>{
  seed();await store.upsertEntity('series',layoutRecord(manual()));const seriesBefore=row(),photosBefore=layoutPhotos();
  const layout=JSON.parse(seriesBefore.layout_json);layout.groups.reverse();const ids=layouts.layoutIds(layout);
  const changes=[{entity:'series',data:{...seriesBefore,layout_json:JSON.stringify(layout),version:seriesBefore.version+1},baseVersion:seriesBefore.version},...ids.map((id,index)=>{const p=photosBefore.find(p=>p.id===id);return{entity:'photos',data:{...p,sort_order:index+1,version:p.version+1},baseVersion:p.version};})];
  sqlite.prepare("UPDATE series SET version=version+1,title='本地修改' WHERE id='story'").run();
  const result=await sync.importSync({schemaVersion:sync.SYNC_SCHEMA_VERSION,changes});assert.equal(result.applied.length,0);assert.equal(result.conflicts.length,5);
  const conflicts=await sync.listConflicts();assert.ok(conflicts.every(c=>c.groupCount===5));assert.equal(conflicts[0].recordId,conflicts[0].record_id);
  await sync.resolveConflict(conflicts[0].id,'remote');assert.deepEqual(layouts.layoutIds(JSON.parse(row().layout_json)),ids);assert.deepEqual(sqlite.prepare("SELECT id FROM photos WHERE series_id='story' ORDER BY sort_order").all().map(p=>p.id),ids);assert.equal((await sync.listConflicts()).length,0);
  const before=row();await sync.importSync({schemaVersion:sync.SYNC_SCHEMA_VERSION,changes:[{entity:'series',data:{...before,title:'远端标题'},baseVersion:before.version-1}]});
  const [stale]=await sync.listConflicts();sqlite.prepare("UPDATE series SET version=version+1,title='较新的本地内容' WHERE id='story'").run();await assert.rejects(sync.resolveConflict(stale.id,'remote'),/新编辑/);assert.equal(row().title,'较新的本地内容');await sync.resolveConflict(stale.id,'local');assert.equal((await sync.listConflicts()).length,0);
});
test('large layout keeps every photo, restricts template capacity and validates the complete order',()=>{
  const photos=Array.from({length:1000},(_,i)=>({id:'many-'+i,width:i%3?1000:2500,height:i%3?1500:1000,version:1}));
  const value=layouts.automaticLayout(photos);layouts.validateLayoutPhotos(value,photos,[],true);assert.equal(layouts.layoutIds(value).length,1000);assert.equal(new Set(layouts.layoutIds(value)).size,1000);assert.ok(value.groups.every(g=>g.items.length<=4));
  const trimmed=layouts.reconcileLayout(value,photos.slice(1),[]);assert.equal(layouts.layoutIds(trimmed).length,999);
});

test('restoring automatic layout preserves draft order and never persists client-only state',async()=>{
  seed();await store.upsertEntity('series',layoutRecord(manual()));const photos=layoutPhotos(),order=['p4','p3','p2','p1'];
  const response=await store.upsertEntity('series',{...record(),layout:null,draftPhotoOrder:order,photoOrder:layoutOperations.seriesPhotoOrder({photos:photos.map(p=>({...p,version:p.version})),layout:null,draftPhotoOrder:order})});
  assert.equal(row().layout_json,null);assert.deepEqual(response.photoOrder.map(p=>p.id),order);const stored=(await store.getSiteContent(true)).series.find(s=>s.id==='story');assert.deepEqual(stored.photos.map(p=>p.id),order);assert.equal(stored.draftPhotoOrder,undefined);
});
test('stale photo annotations cannot overwrite a newer photo after a layout save',async()=>{
  seed();const before=photo('p1');await store.upsertEntity('series',layoutRecord(manual()));
  await assert.rejects(store.upsertEntity('photo',{id:before.id,seriesId:before.series_id,version:before.version,imageUrl:before.image_url,originalUrl:before.original_url,width:before.width,height:before.height,alt:'',caption:'过期注释',location:'',takenAt:'',sortOrder:before.sort_order}),/照片已更新/);assert.equal(photo('p1').caption,'');
});
test('a thousand-photo order saves atomically through bounded JSON parameters',async()=>{
  seed();sqlite.exec("DELETE FROM photos WHERE series_id='story'");const insert=sqlite.prepare('INSERT INTO photos(id,series_id,image_url,original_url,width,height,sort_order) VALUES(?,?,?,?,?,?,?)');
  for(let i=0;i<1000;i++)insert.run('large-'+i,'story','/photo.webp','/photo.webp',1200,1800,i+1);
  const photos=sqlite.prepare("SELECT id,width,height,version FROM photos WHERE series_id='story' ORDER BY sort_order").all(),layout=layouts.automaticLayout(photos);layout.groups.reverse();
  const response=await store.upsertEntity('series',{...record(),layout,photoOrder:layoutOperations.seriesPhotoOrder({photos,layout})});assert.equal(response.photoOrder.length,1000);assert.deepEqual(sqlite.prepare("SELECT id FROM photos WHERE series_id='story' ORDER BY sort_order").all().map(p=>p.id),layouts.layoutIds(layout));
});

const editableSeries=async()=> (await store.getSiteContent(true)).series.find(item=>item.id==='story');
test('whole-series save commits metadata, access, narrative, layout, order and every photo field together',async()=>{
  seed();const series=await editableSeries();series.title='全系列保存';series.description='新的短简介';series.coverUrl='/new-cover.webp';series.access='private';series.narrative=narrative('p3');series.layout=manual();series.layout.groups[0].gap='seamless';
  const before=photo('p1');Object.assign(series.photos[0],{alt:'新的替代文字',caption:'  新的注释  ',location:'新的地点',takenAt:'2026-10-16',imageUrl:'/do-not-write.webp',width:999});series.photos[3].caption='第四张注释';
  const response=await store.saveEntireSeries(entireSeriesPayload(series));assert.equal(row().title,'全系列保存');assert.equal(row().access,'private');assert.equal(row().published,0);assert.deepEqual(JSON.parse(row().narrative_json),series.narrative);assert.deepEqual(JSON.parse(row().layout_json),series.layout);
  assert.equal(photo('p1').caption,'新的注释');assert.equal(photo('p1').alt,'新的替代文字');assert.equal(photo('p1').location,'新的地点');assert.equal(photo('p1').taken_at,'2026-10-16');assert.equal(photo('p4').caption,'第四张注释');assert.equal(photo('p1').image_url,before.image_url);assert.equal(photo('p1').width,before.width);assert.equal(response.photoEdits.length,4);
});
test('one invalid photo or duplicate/foreign entry prevents every whole-series write',async()=>{
  for(const mutate of [s=>s.photos[3].caption='x'.repeat(3001),s=>s.photos[3].id='foreign',s=>s.photos[3].id='p1',s=>s.photos.pop()]){
    seed();const series=await editableSeries(),before={...row()};series.title='不能部分保存';series.photos[0].caption='不能部分保存';const payload=entireSeriesPayload(series);mutate(payload);
    await assert.rejects(store.saveEntireSeries(payload));assert.deepEqual({...row()},before);assert.equal(photo('p1').caption,'');assert.equal(photo('p1').sort_order,0);
  }
});
test('stale whole-series edits and a database failure cannot partially commit metadata, order or annotations',async()=>{
  seed();let series=await editableSeries();series.title='不能覆盖';series.photos[0].caption='不能覆盖';sqlite.prepare("UPDATE photos SET caption='另一端的修改',version=version+1 WHERE id='p4'").run();await assert.rejects(store.saveEntireSeries(entireSeriesPayload(series)),/照片版本/);assert.equal(row().title,'原始标题');assert.equal(photo('p1').caption,'');assert.equal(photo('p4').caption,'另一端的修改');
  seed();series=await editableSeries();series.title='事务回滚';series.photos[0].caption='事务回滚';const prepare=adapter.prepare;
  adapter.prepare=sql=>prepare(sql.startsWith('WITH edits AS')?"SELECT json('injected-photo-failure') WHERE ? IS NOT NULL AND ? IS NOT NULL":sql);
  try{await assert.rejects(store.saveEntireSeries(entireSeriesPayload(series)));}finally{adapter.prepare=prepare;}
  assert.equal(row().title,'原始标题');assert.equal(row().version,1);assert.equal(photo('p1').caption,'');assert.equal(photo('p1').sort_order,0);assert.equal(photo('p1').version,1);
});
test('whole-series save increments each changed photo once and leaves unchanged photo versions alone',async()=>{
  seed();await store.saveEntireSeries(entireSeriesPayload(await editableSeries()));let series=await editableSeries();const before=series.photos.map(photo=>photo.version);series.photos[0].caption='单独修改';await store.saveEntireSeries(entireSeriesPayload(series));assert.equal(photo('p1').version,before[0]+1);assert.equal(photo('p2').version,before[1]);
  series=await editableSeries();series.layout=manual();series.layout.groups.reverse();series.photos[0].caption='同时改顺序和注释';const version=photo('p1').version;const response=await store.saveEntireSeries(entireSeriesPayload(series));assert.equal(photo('p1').version,version+1);assert.equal(response.photoOrder.find(p=>p.id==='p1').version,version+1);
});
test('whole-series API checks administrator, CSRF, input validity and supports empty new series',async()=>{
  seed();const record=entireSeriesPayload(await editableSeries()),body={action:'save-series',entity:'series',record};globalThis.__narrativeAuth={session:null,csrf:true};assert.equal((await request(body)).status,403);globalThis.__narrativeAuth={session:{},csrf:false};assert.equal((await request(body)).status,403);globalThis.__narrativeAuth={session:{},csrf:true};assert.equal((await request({...body,entity:'photo'})).status,400);
  assert.equal((await request(body)).status,200);const result=await store.saveEntireSeries({id:'empty-new',slug:'empty-new',title:'新系列',description:'',coverUrl:'',access:'draft',sortOrder:10,photos:[],photoOrder:[]});assert.equal(result.series.title,'新系列');assert.deepEqual(result.photoEdits,[]);
});
test('whole-series acknowledgement clears saved dirty state and retains inputs typed during saving',async()=>{
  seed();const snapshot=await editableSeries();snapshot.title='点击时的标题';snapshot.photos[0].caption=' 点击时的注释 ';snapshot.draftPhotoOrder=['p4','p3','p2','p1'];const result=await store.saveEntireSeries(entireSeriesPayload(snapshot));
  const content={series:[snapshot],essays:[],favorites:[],about:{},copy:{}},baseline=applyEntireSeriesSave(content,snapshot,result,false),clean=applyEntireSeriesSave(content,snapshot,result,true);assert.equal(studioItemDirty(clean.series[0],baseline.series[0]),false);assert.equal(clean.series[0].draftPhotoOrder,undefined);assert.equal(clean.series[0].photos.find(p=>p.id==='p1').caption,'点击时的注释');
  const newer=structuredClone(snapshot);newer.title='等待时继续输入的标题';newer.photos[0].caption='等待时继续输入的注释';newer.photos[1].location='未提交的地点';
  const working=applyEntireSeriesSave({...content,series:[newer]},snapshot,result,true).series[0];assert.equal(working.title,newer.title);assert.equal(working.photos.find(p=>p.id==='p1').caption,newer.photos[0].caption);assert.equal(working.photos.find(p=>p.id==='p2').location,newer.photos[1].location);assert.ok(studioItemDirty(working,baseline.series[0]));
  await store.saveEntireSeries(entireSeriesPayload(working));assert.equal(photo('p1').caption,newer.photos[0].caption);assert.equal(row().title,newer.title);
});
test('whole-series photo annotations save at scale with bounded parameters and bound text',async()=>{
  seed();sqlite.exec("DELETE FROM photos WHERE series_id='story'");const insert=sqlite.prepare('INSERT INTO photos(id,series_id,image_url,original_url,width,height,sort_order) VALUES(?,?,?,?,?,?,?)');for(let i=0;i<1000;i++)insert.run('whole-'+i,'story','/photo.webp','/photo.webp',1200,1800,i+1);
  const series=await editableSeries();for(const photo of series.photos)photo.caption="现场记录 '); SELECT 1; -- "+photo.id;const response=await store.saveEntireSeries(entireSeriesPayload(series));assert.equal(response.photoEdits.length,1000);assert.equal(photo('whole-999').caption,series.photos.find(p=>p.id==='whole-999').caption);assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM photos WHERE series_id='story'").get().n,1000);
});
