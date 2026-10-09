import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sourceDir = path.resolve("..", "图片");
const publicDir = path.resolve("public", "photos");
const files = [
  ["5J4A5492.JPG", "01-fog-clock"],
  ["5J4A5497.JPG", "02-rain-taxi"],
  ["5J4A5541.JPG", "03-night-bridge"],
  ["5J4A5561.JPG", "04-city-fragments"],
  ["5J4A5802.JPG", "05-river-boat"],
  ["5J4A5846.JPG", "06-train-through-city"],
  ["烟雨江南古桥倒影.png", "07-jiangnan-bridge"],
];

await mkdir(publicDir, { recursive: true });
for (const [sourceName, targetName] of files) {
  const source = path.join(sourceDir, sourceName);
  await sharp(source).rotate().resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true }).webp({ quality: 86, effort: 5 }).toFile(path.join(publicDir, `${targetName}.webp`));
}
console.log(`Prepared ${files.length} photographs.`);
