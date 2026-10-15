import { parseEssayBody } from "@/shared/essay-body";

export function EssayBody({ body }: { body: string }) {
  return <div className="essay-body">{parseEssayBody(body).map((block,index)=>block.type === "image" ? <figure key={index}><img src={block.url} alt={block.caption || "随笔配图"} loading="lazy"/>{block.caption && <figcaption data-text-page="essay" data-text-role="caption">{block.caption}</figcaption>}</figure> : <p data-text-page="essay" data-text-role="body" key={index}>{block.text}</p>)}</div>;
}
