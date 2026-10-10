import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test("brand copy is managed in source",async()=>{const source=await readFile(new URL("../src/config/site.ts",import.meta.url),"utf8");assert.match(source,/brand:\s*"Song"/);assert.match(source,/navAbout:\s*"Song"/);assert.match(source,/enterSeries:\s*"More"/);});
test("secrets are documented but not committed",async()=>{const source=await readFile(new URL("../.env.example",import.meta.url),"utf8");assert.match(source,/ADMIN_PASSWORD=replace-with/);assert.match(source,/SYNC_SECRET=replace-with/);});
