import { buildRestoreChanges } from "./lib/restore-changes.mjs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadLocalEnv, required, endpoint, syncRequest } from "./lib/env.mjs";
const file=process.argv[2];if(!file)throw new Error("用法：npm run restore -- <备份文件> [--production]");const env=await loadLocalEnv(),kind=process.argv.includes("--production")?"production":"local",base=endpoint(env,kind),secret=required(env,"SYNC_SECRET"),backup=JSON.parse(await readFile(resolve(file),"utf8"));const current=await(await syncRequest(base,"/api/sync/export?since=0",secret)).json();
const payload=buildRestoreChanges(backup,current);
console.log(await(await syncRequest(base,"/api/sync/import",secret,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)})).json());
