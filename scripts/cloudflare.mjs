import { readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const [command] = process.argv.slice(2);
if (!["build", "deploy", "migrate"].includes(command)) {
  throw new Error("Expected build, deploy, or migrate.");
}
const configPath = "wrangler.cloudflare.jsonc";
const config = JSON.parse(await readFile(new URL(`../${configPath}`, import.meta.url), "utf8"));
if (command !== "build" && config.d1_databases.some(db => db.database_id === "00000000-0000-4000-8000-000000000000")) {
  throw new Error("Create the Cloudflare D1 database and set its database_id in wrangler.cloudflare.jsonc first. See docs/CLOUDFLARE.md.");
}

function run(relativePath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), ...args], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, SONG_CLOUDFLARE_DEPLOY: "1" },
    });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`${relativePath} exited with ${code}`)));
  });
}

if (command === "migrate") {
  await run("node_modules/wrangler/bin/wrangler.js", ["d1", "migrations", "apply", "DB", "--remote", "--config", configPath]);
} else {
  try {
    await run("node_modules/vinext/dist/cli.js", ["build"]);
  } finally {
    // Vite can copy local environment files for preview. Never upload those.
    for (const name of [".dev.vars", ".dev.vars.production"]) {
      await rm(new URL(`../dist/server/${name}`, import.meta.url), { force: true });
    }
  }
  if (command === "deploy") {
    await run("node_modules/wrangler/bin/wrangler.js", ["deploy", "--config", "dist/server/wrangler.json"]);
  }
}
