import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";
const moduleUrl=source=>`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
globalThis.__studioAccessAuth={session:{username:"owner"},csrf:true};
const db=new DatabaseSync(":memory:");
for(const table of ["series","favorites"])db.exec(`CREATE TABLE ${table} (id TEXT PRIMARY KEY,title TEXT,description TEXT,sort_order INTEGER,access TEXT,published INTEGER,version INTEGER,updated_at INTEGER,deleted_at INTEGER);`);
globalThis.__studioAccessDb={prepare(sql){let params=[];return {bind(...values){assert.ok(values.length<=100,"D1 supports at most 100 bound parameters");params=values;return this;},async all(){return {results:db.prepare(sql).all(...params)};}};}};
const storeStub=moduleUrl("export const getDatabase=()=>globalThis.__studioAccessDb;export const getSiteContent=async()=>({});export const upsertEntity=async()=>({id:'x'});export const deleteEntity=async()=>{};export const saveAboutContent=async()=>({});export const saveSiteCopy=async()=>({});export const saveTextStandards=async()=>({});export const getSiteCopy=async()=>({});");
const helperSource=(await readFile(new URL("../src/backend/content/studio-access.ts",import.meta.url),"utf8")).replace('from "./content-store"',`from "${storeStub}"`);
const helperUrl=moduleUrl(compile(helperSource));
const {setStudioAccess,validateBulkAccess}=await import(helperUrl);
let route=compile(await readFile(new URL("../src/app/api/studio/route.ts",import.meta.url),"utf8"));
for(const [name,url] of [
  ["@/backend/content/content-store",storeStub],
  ["@/backend/content/studio-access",helperUrl],
  ["@/backend/auth/admin-auth",moduleUrl("export const getAdminSession=async()=>globalThis.__studioAccessAuth.session;export const validateCsrf=()=>globalThis.__studioAccessAuth.csrf;")],
  ["@/shared/site-copy",moduleUrl("export const validateSiteCopy=v=>v;")],
  ["@/shared/text-standards",moduleUrl("export const applyTextFormat=v=>v;")],
])route=route.replaceAll(`"${name}"`,`"${url}"`);
const {POST}=await import(moduleUrl(route));
function seed(){for(const table of ["series","favorites"]){db.exec(`DELETE FROM ${table}`);const insert=db.prepare(`INSERT INTO ${table} VALUES (?,?,?,?,?,?,?,?,?)`);insert.run("one","Keep title","Keep description",8,"private",0,4,1,null);insert.run("deleted","Deleted","Hidden",9,"draft",0,1,1,100);}}
test("bulk permissions update only access metadata, leave content/order intact, and report missing/deleted IDs",async()=>{
  seed();const result=await setStudioAccess(validateBulkAccess({entity:"series",ids:["one","deleted","missing"],access:"public"}));
  assert.deepEqual(result.updated.map(r=>[r.id,r.access,r.version]),[["one","public",5]]);
  assert.deepEqual(result.skipped.map(r=>r.id),["deleted","missing"]);
  const row=db.prepare("SELECT * FROM series WHERE id='one'").get();
  assert.equal(row.title,"Keep title");assert.equal(row.description,"Keep description");assert.equal(row.sort_order,8);assert.equal(row.published,1);assert.ok(row.updated_at>1);
  const draft=await setStudioAccess(validateBulkAccess({entity:"favorite",ids:["one"],access:"draft"}));
  assert.equal(draft.updated[0].access,"draft");assert.equal(db.prepare("SELECT published FROM favorites WHERE id='one'").get().published,0);
});
test("bulk validation rejects unsupported entities, states and invalid or oversized selection",()=>{
  for(const input of [{entity:"photo",ids:["one"],access:"public"},{entity:"series",ids:["one"],access:"unknown"},{entity:"series",ids:[],access:"private"},{entity:"series",ids:[" "],access:"public"},{entity:"series",ids:Array(101).fill("one"),access:"draft"}])assert.throws(()=>validateBulkAccess(input));
  assert.deepEqual(validateBulkAccess({entity:"series",ids:["one","one"],access:"private"}).ids,["one"]);
});
test("the full 100-item request fits D1 parameter limits and safely binds arbitrary identifiers",async()=>{
  seed();const ids=["one","' OR 1=1 --",...Array.from({length:98},(_,i)=>`missing-${i}`)];
  const result=await setStudioAccess(validateBulkAccess({entity:"series",ids,access:"private"}));
  assert.equal(result.updated.length,1);assert.equal(result.skipped.length,99);
  assert.equal(db.prepare("SELECT version FROM series WHERE id='deleted'").get().version,1);
});
test("bulk API requires both the admin session and CSRF and rejects malformed requests before writing",async()=>{
  seed();const body={action:"set-access",entity:"series",ids:["one"],access:"public"};
  const request=payload=>new Request("https://sonforu.work/api/studio",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
  globalThis.__studioAccessAuth.session=null;assert.equal((await POST(request(body))).status,403);
  globalThis.__studioAccessAuth.session={username:"owner"};globalThis.__studioAccessAuth.csrf=false;assert.equal((await POST(request(body))).status,403);
  globalThis.__studioAccessAuth.csrf=true;assert.equal((await POST(request({...body,access:"invalid"}))).status,400);
  assert.equal(db.prepare("SELECT access FROM series WHERE id='one'").get().access,"private");
  const response=await POST(request(body));assert.equal(response.status,200);assert.equal((await response.json()).updated[0].access,"public");
});
