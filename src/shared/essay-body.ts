export type EssayBlock = { type: "text"; text: string } | { type: "image"; url: string; caption: string };

const imagePattern = /^!\[([^\]\n]*)\]\(([^\s)]+)\)$/;
function allowedImageUrl(url: string): boolean {
  return /^\/api\/assets\/(?:uploads|media)\/display\/[a-zA-Z0-9-]+\.webp$/.test(url);
}
export function parseEssayBody(body: string): EssayBlock[] {
  const blocks: EssayBlock[] = [];
  let lines: string[] = [];
  const flush = () => { const text = lines.join("\n").trim(); if (text) blocks.push({ type: "text", text }); lines = []; };
  for (const line of body.replace(/\r\n/g, "\n").split("\n")) {
    const match = line.trim().match(imagePattern);
    if (match && allowedImageUrl(match[2])) { flush(); blocks.push({ type: "image", url: match[2], caption: match[1] }); }
    else if (!line.trim()) flush();
    else lines.push(line);
  }
  flush();
  return blocks;
}
export function essayImageUrls(body: string): string[] {
  return parseEssayBody(body).flatMap((block) => block.type === "image" ? [block.url] : []);
}
export function imageMarkup(url: string, caption = ""): string {
  if (!allowedImageUrl(url)) throw new Error("图片地址无效");
  return `![${caption.replace(/[\[\]\r\n]/g, " ")}](${url})`;
}
