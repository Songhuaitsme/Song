import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source=await readFile(new URL("../src/shared/studio-list.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {studioListPage,defaultStudioView,studioItemDirty,mergeStudioReload}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const favorite=(index,access="public")=>({id:`f-${index}`,title:`Favorite ${index}`,category:index%2?"电影":"书籍",note:`Note ${index}`,imageUrl:"",url:"",access,sortOrder:index,version:1,updatedAt:index*100});
const favorites=Array.from({length:65},(_,i)=>favorite(i,["public","private","draft"][i%3]));

test("status counts remain global while search, category and status filters combine before pagination",()=>{
  const view={...defaultStudioView,access:"private",query:"note",category:"电影",page:1};
  const page=studioListPage(favorites,favorites,view);
  assert.deepEqual(page.counts,{all:65,public:22,private:22,draft:21});
  assert.equal(page.filtered.length,11);
  assert.ok(page.items.every(item=>item.access==="private"&&item.category==="电影"));
  assert.deepEqual(favorites.map(item=>item.sortOrder),Array.from({length:65},(_,i)=>i));
});
test("lists page at 20 entries and clamp pages after status changes or empty results",()=>{
  assert.equal(studioListPage(favorites,favorites,defaultStudioView).items.length,20);
  assert.equal(studioListPage(favorites,favorites,{...defaultStudioView,page:4}).items.length,5);
  assert.equal(studioListPage(favorites,favorites,{...defaultStudioView,page:99}).page,4);
  const empty=studioListPage(favorites,favorites,{...defaultStudioView,query:"no matches",page:4});
  assert.equal(empty.page,1);assert.equal(empty.pages,1);assert.equal(empty.items.length,0);
});
test("unsaved permission edits stay in their saved status until successful save",()=>{
  const saved=[favorite(1,"private")],draft=[{...saved[0],access:"public"}];
  assert.equal(studioListPage(draft,saved,{...defaultStudioView,access:"private"}).items.length,1);
  assert.equal(studioListPage(draft,saved,{...defaultStudioView,access:"public"}).items.length,0);
  assert.equal(studioItemDirty(draft[0],saved[0]),true);
  assert.equal(studioItemDirty({...saved[0],version:2,updatedAt:300},saved[0]),false);
});
test("recent sorting uses saved timestamps and new unsaved drafts appear only as drafts",()=>{
  const page=studioListPage(favorites,favorites,{...defaultStudioView,sort:"recent"});
  assert.equal(page.items[0].id,"f-64");
  const added={...favorite(99),access:"public"};
  const draft=studioListPage([added],[],{...defaultStudioView,access:"draft"});
  assert.equal(draft.items.length,1);assert.equal(draft.counts.all,0);
});
test("series dirty state includes photo edits but ignores sync metadata",()=>{
  const saved={id:"series",title:"s",slug:"s",description:"desc",coverUrl:"",access:"private",sortOrder:1,photos:[{id:"p",alt:"old",version:1}]};
  assert.equal(studioItemDirty({...saved,photos:[{id:"p",alt:"new",version:1}]},saved),true);
  assert.equal(studioItemDirty({...saved,photos:[{id:"p",alt:"old",version:2}]},saved),false);
});
test("refresh keeps unsaved edits and newly created drafts while accepting committed server changes",()=>{
  const saved={series:[],essays:[],favorites:[favorite(1),favorite(2)],about:{title:"old"},copy:{values:{name:"old"}}};
  const current={...saved,favorites:[{...favorite(1),note:"unsaved"},favorite(2),favorite(3)],copy:{values:{name:"draft copy"}}};
  const remote={...saved,favorites:[{...favorite(1),version:2},{...favorite(2),title:"remote title"}],about:{title:"new"}};
  const result=mergeStudioReload(current,saved,remote);
  assert.equal(result.favorites[0].note,"unsaved");assert.equal(result.favorites[1].title,"remote title");
  assert.equal(result.favorites[2].id,"f-3");assert.equal(result.copy.values.name,"draft copy");assert.equal(result.about.title,"new");
});
