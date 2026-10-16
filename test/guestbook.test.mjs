import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path/posix';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
import { buildRestoreChanges } from '../scripts/lib/restore-changes.mjs';

const db = new DatabaseSync(':memory:');
for (const file of (await readdir(new URL('../drizzle', import.meta.url))).filter(name=>name.endsWith('.sql')).sort()) db.exec(await readFile(new URL('../drizzle/'+file,import.meta.url),'utf8'));
let failBatch=false, now=1_800_000_000_000; const originalNow=Date.now; Date.now=()=>now;
const adapter={prepare(sql){let args=[];const statement={bind(...values){assert.ok(values.length<=100);args=values;return statement;},async first(){return db.prepare(sql).get(...args)??null;},async all(){return{results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return{meta:{changes:Number(r.changes)}};},execute(){const p=db.prepare(sql);if(p.columns().length)return{results:p.all(...args),meta:{changes:0}};const r=p.run(...args);return{results:[],meta:{changes:Number(r.changes)}};}};return statement;},async batch(statements){db.exec('BEGIN');try{const out=[];for(const s of statements){out.push(s.execute());if(failBatch&&out.length===2)throw Error('simulated failure');}db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}};
globalThis.__guestEnv={DB:adapter,SESSION_SECRET:'test-session-secret-'.repeat(3),LOCAL_DEV:'0'};globalThis.__guestAuth={session:{},csrf:true};
const uri=text=>`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const modules=new Map([['react',uri('export const cache=fn=>fn;')],['cloudflare:workers',uri('export const env=globalThis.__guestEnv;')],['@/backend/auth/admin-auth',uri('export const getAdminSession=async()=>globalThis.__guestAuth.session;export const validateCsrf=()=>globalThis.__guestAuth.csrf;')]]);
async function load(specifier){if(modules.has(specifier))return modules.get(specifier);const root=specifier.slice(2);let source=ts.transpileModule(await readFile(new URL('../src/'+root+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;for(const match of source.matchAll(/\bfrom\s+["']([^"']+)["']/g)){const dep=match[1].startsWith('.')?'@/'+path.normalize(path.join(path.dirname(root),match[1])):match[1];source=source.replace(match[0],`from ${JSON.stringify(await load(dep))}`);}const result=uri(source);modules.set(specifier,result);return result;}
const store=await import(await load('@/backend/content/guestbook-store')),publicApi=await import(await load('@/app/api/messages/route')),adminApi=await import(await load('@/app/api/studio/messages/route')),sync=await import(await load('@/backend/sync/sync-service'));
const request=(body,ip='203.0.113.5',headers={},url='https://example.test/api/messages')=>new Request(url,{method:'POST',headers:{origin:'https://example.test','content-type':'application/json','cf-connecting-ip':ip,...headers},body:JSON.stringify(body)});
const payload=(body='留下一点想法。')=>({id:crypto.randomUUID(),nickname:'访客',body,website:''});
const rows=()=>db.prepare('SELECT * FROM guestbook_messages ORDER BY created_at DESC,id DESC').all();
const insert=(index,visibility='public')=>{const p=payload('留言 '+index);db.prepare("INSERT INTO guestbook_messages(id,nickname,body,reply,visibility,created_at,replied_at,version,updated_at,deleted_at) VALUES(?,?,?,'',?,?,NULL,1,?,NULL)").run(p.id,'昵称 '+index,p.body,visibility,now+index,now+index);return p;};
beforeEach(()=>{db.exec('DELETE FROM guestbook_messages;DELETE FROM guestbook_submissions;DELETE FROM sync_conflicts;');now=1_800_000_000_000;failBatch=false;globalThis.__guestAuth={session:{},csrf:true};});
test.after(()=>{Date.now=originalNow;db.close();});

test('visitor publishes immediately, fields are plain text, and private metadata never reaches the DTO',async()=>{
  const p={...payload('<script>window.x=1</script>\n\n第二段'),nickname:'  来客 😀  ',reply:'不能冒充主人',visibility:'hidden'};
  const r=await publicApi.POST(request(p));assert.equal(r.status,200);const result=await r.json();assert.equal(result.message.nickname,'来客 😀');assert.equal(result.message.body,p.body);assert.equal(result.message.reply,'');assert.equal(rows()[0].visibility,'public');
  assert.deepEqual(Object.keys(result.message).sort(),['body','createdAt','id','nickname','repliedAt','reply']);
  const aux=db.prepare('SELECT * FROM guestbook_submissions').get();assert.match(aux.source_hash,/^[0-9a-f]{64}$/);assert.ok(!JSON.stringify(aux).includes('203.0.113.5'));assert.ok(!JSON.stringify(result).includes(aux.source_hash));
});
test('identical retries and concurrent double clicks create exactly one message and consume one slot',async()=>{
  const p=payload();const results=await Promise.all([publicApi.POST(request(p)),publicApi.POST(request(p))]);assert.ok(results.every(r=>r.status===200));assert.equal(rows().length,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM guestbook_submissions').get().n,1);
  assert.equal((await publicApi.POST(request({...p,body:'改变内容'}))).status,409);
});
test('per-source minute limit is atomic, returns retry-after, and keeps other sources independent',async()=>{
  const results=await Promise.all([publicApi.POST(request(payload('内容一'))),publicApi.POST(request(payload('内容二')))]);assert.deepEqual(results.map(r=>r.status).sort(),[200,429]);assert.ok(Number(results.find(r=>r.status===429).headers.get('retry-after'))>0);assert.equal(rows().length,1);
  assert.equal((await publicApi.POST(request(payload('另一个来源'),'203.0.113.6'))).status,200);now+=60_000;assert.equal((await publicApi.POST(request(payload('一分钟后')))).status,200);
});
test('rolling day limit is ten submissions, then expires without retaining raw addresses',async()=>{
  for(let i=0;i<10;i++){assert.equal((await publicApi.POST(request(payload('不同内容 '+i)))).status,200);now+=60_001;}
  const limited=await publicApi.POST(request(payload('第十一条')));assert.equal(limited.status,429);assert.ok((await limited.json()).error.includes('次数'));assert.equal(rows().length,10);
  now+=86_400_000;assert.equal((await publicApi.POST(request(payload('新的一天')))).status,200);assert.equal(db.prepare('SELECT COUNT(*) n FROM guestbook_submissions').get().n,1);
});
test('same-source repeated text is blocked even with a new nickname and id after the minute expires',async()=>{
  await publicApi.POST(request(payload('相同内容\n\n下一段')));now+=60_001;const r=await publicApi.POST(request({...payload('相同内容 下一段'),nickname:'换个名字'}));assert.equal(r.status,429);assert.ok((await r.json()).error.includes('重复'));assert.equal(rows().length,1);
});
test('failed batch rolls back message and rate state, and a retry can succeed immediately',async()=>{
  const p=payload();failBatch=true;assert.equal((await publicApi.POST(request(p))).status,503);assert.equal(rows().length,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM guestbook_submissions').get().n,0);failBatch=false;assert.equal((await publicApi.POST(request(p))).status,200);
});
test('body, nickname, origin, content type, honeypot, id and payload-size validation are enforced',async()=>{
  for(const patch of [{nickname:''},{nickname:'x'.repeat(31)},{body:' '},{body:'x'.repeat(1001)},{nickname:'a\nb'},{body:'\u0000'},{id:'unsafe'},{website:'spam'}])assert.equal((await publicApi.POST(request({...payload(),...patch}))).status,400);
  assert.equal((await publicApi.POST(request(payload(),undefined,{origin:'https://evil.test'}))).status,403);assert.equal((await publicApi.POST(request(payload(),undefined,{'content-type':'text/plain'}))).status,415);
  assert.equal((await publicApi.POST(request({...payload(),extra:'x'.repeat(17000)}))).status,413);assert.equal(rows().length,0);
  const emoji={...payload('😀'.repeat(1000)),nickname:'😀'.repeat(30)};assert.equal((await publicApi.POST(request(emoji))).status,200);
});
test('public pagination is newest first, counts exclude hidden/deleted rows, and bad parameters fail',async()=>{
  for(let i=0;i<42;i++)insert(i,i===41?'hidden':'public');db.prepare('UPDATE guestbook_messages SET deleted_at=? WHERE body=?').run(now,'留言 40');
  const first=await store.listMessages();assert.equal(first.total,40);assert.equal(first.pages,2);assert.equal(first.items.length,20);assert.equal(first.items[0].body,'留言 39');assert.equal(first.counts.hidden,0);
  const second=await store.listMessages({page:2});assert.equal(second.items.at(-1).body,'留言 0');assert.equal(new Set([...first.items,...second.items].map(m=>m.id)).size,40);
  const admin=await store.listMessages({admin:true,visibility:'hidden',query:'41'});assert.equal(admin.total,1);assert.equal(admin.counts.all,41);assert.equal(admin.counts.hidden,1);
  for(const page of [0,-1,1.5,NaN,1_000_001])await assert.rejects(store.listMessages({page}));
});
test('admin endpoints require session and CSRF; visitor cannot change original text or post replies',async()=>{
  const p=insert(1);globalThis.__guestAuth.session=null;assert.equal((await adminApi.GET(new Request('https://example.test/api/studio/messages'))).status,403);assert.equal((await adminApi.POST(request({action:'reply',id:p.id,version:1,reply:'非法'}))).status,403);
  globalThis.__guestAuth={session:{},csrf:false};assert.equal((await adminApi.POST(request({action:'delete',id:p.id,version:1}))).status,403);
  globalThis.__guestAuth.csrf=true;const r=await adminApi.POST(request({action:'reply',id:p.id,version:1,reply:'主人回复',body:'覆盖原文',nickname:'改名'}));assert.equal(r.status,200);assert.equal(rows()[0].body,p.body);assert.equal(rows()[0].nickname,'昵称 1');assert.equal(rows()[0].reply,'主人回复');
});
test('reply, hide, reopen, clear reply, and deletion follow version checks and protect public data',async()=>{
  const p=payload();await publicApi.POST(request(p));let row=rows()[0];
  await store.manageMessage({action:'reply',id:p.id,version:row.version,reply:'谢谢来访。'});let list=await store.listMessages();assert.equal(list.items[0].reply,'谢谢来访。');assert.ok(list.items[0].repliedAt);
  await assert.rejects(store.manageMessage({action:'reply',id:p.id,version:1,reply:'旧回复'}),e=>e.status===409);assert.equal(rows()[0].reply,'谢谢来访。');
  row=rows()[0];await store.manageMessage({action:'set-visibility',id:p.id,version:row.version,visibility:'hidden'});assert.equal((await store.listMessages()).total,0);assert.equal((await(await publicApi.POST(request(p))).json()).message,null);
  row=rows()[0];await store.manageMessage({action:'set-visibility',id:p.id,version:row.version,visibility:'public'});assert.equal((await store.listMessages()).items[0].reply,'谢谢来访。');
  row=rows()[0];await store.manageMessage({action:'reply',id:p.id,version:row.version,reply:''});assert.equal(rows()[0].replied_at,null);
  row=rows()[0];await store.manageMessage({action:'delete',id:p.id,version:row.version});assert.equal((await store.listMessages()).total,0);assert.equal((await(await publicApi.POST(request(p))).json()).message,null);assert.equal(rows().length,1);
});
test('sync backs up messages and replies but excludes rate data; restored records validate',async()=>{
  const p=payload();await publicApi.POST(request(p));await store.manageMessage({action:'reply',id:p.id,version:1,reply:'备份中的回复'});const backup=await sync.exportSync();assert.equal(backup.schemaVersion,7);assert.equal(backup.records.guestbook_messages.length,1);assert.equal(backup.records.guestbook_submissions,undefined);
  await store.manageMessage({action:'reply',id:p.id,version:2,reply:'较新的回复'});await sync.importSync(buildRestoreChanges(backup,await sync.exportSync()));assert.equal(rows()[0].reply,'备份中的回复');
  const row=rows()[0];for(const patch of [{visibility:'bad'},{created_at:9_000_000_000_000_000},{reply:'',replied_at:now}])await assert.rejects(sync.importSync({schemaVersion:7,changes:[{entity:'guestbook_messages',data:{...row,...patch},baseVersion:row.version}]}));assert.equal(rows()[0].visibility,'public');
});
test('message sync conflicts reject newer local replies and old snapshots preserve existing messages',async()=>{
  const p=insert(1),row=rows()[0];await sync.importSync({schemaVersion:7,changes:[{entity:'guestbook_messages',data:{...row,reply:'远端回复',replied_at:now,version:2},baseVersion:0}]});const[conflict]=await sync.listConflicts();assert.ok(conflict);
  await store.manageMessage({action:'reply',id:p.id,version:1,reply:'最新本地回复'});await assert.rejects(sync.resolveConflict(conflict.id,'remote'),/新编辑/);assert.equal(rows()[0].reply,'最新本地回复');await sync.resolveConflict(conflict.id,'local');
  const current=await sync.exportSync();for(const schemaVersion of [3,4,5,6]){const changes=buildRestoreChanges({schemaVersion,records:{series:[]}},current);assert.equal(changes.schemaVersion,7);assert.ok(!changes.changes.some(c=>c.entity==='guestbook_messages'));await sync.importSync(changes);assert.equal(rows()[0].reply,'最新本地回复');}
});
