import { env } from "cloudflare:workers";
import { defaultContent, type Essay, type Favorite, type Photo, type Series, type SiteContent } from "@/lib/default-content";

type Entity = "series" | "photo" | "essay" | "favorite";

function dbOrNull(): D1Database | null { try { return env.DB ?? null; } catch { return null; } }
const bool = (value: unknown) => value === true || value === 1;

async function seed(db: D1Database) {
  const existing = await db.prepare("SELECT id FROM series LIMIT 1").first();
  if (existing) return;
  const statements: D1PreparedStatement[] = [];
  for (const item of defaultContent.series) {
    statements.push(db.prepare("INSERT OR IGNORE INTO series (id,slug,title,description,cover_url,published,sort_order) VALUES (?,?,?,?,?,?,?)").bind(item.id,item.slug,item.title,item.description,item.coverUrl,item.published?1:0,item.sortOrder));
    for (const photo of item.photos) statements.push(db.prepare("INSERT OR IGNORE INTO photos (id,series_id,image_url,original_url,width,height,alt,caption,location,taken_at,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(photo.id,photo.seriesId,photo.imageUrl,photo.originalUrl,photo.width,photo.height,photo.alt,photo.caption,photo.location,photo.takenAt,photo.sortOrder));
  }
  for (const item of defaultContent.essays) statements.push(db.prepare("INSERT OR IGNORE INTO essays (id,slug,title,excerpt,body,visibility,status,published_at) VALUES (?,?,?,?,?,?,?,?)").bind(item.id,item.slug,item.title,item.excerpt,item.body,item.visibility,item.status,item.publishedAt));
  for (const item of defaultContent.favorites) statements.push(db.prepare("INSERT OR IGNORE INTO favorites (id,title,category,note,image_url,url,sort_order,published) VALUES (?,?,?,?,?,?,?,?)").bind(item.id,item.title,item.category,item.note,item.imageUrl,item.url,item.sortOrder,item.published?1:0));
  await db.batch(statements);
}

export async function getSiteContent(includePrivate = false): Promise<SiteContent> {
  const db = dbOrNull();
  if (!db) return structuredClone(defaultContent);
  try {
    await seed(db);
    const [seriesResult, photoResult, essayResult, favoriteResult] = await db.batch([
      db.prepare(`SELECT * FROM series ${includePrivate ? "" : "WHERE published = 1"} ORDER BY sort_order, title`),
      db.prepare("SELECT * FROM photos ORDER BY series_id, sort_order"),
      db.prepare(`SELECT * FROM essays ${includePrivate ? "" : "WHERE status = 'published' AND visibility = 'public'"} ORDER BY published_at DESC, title`),
      db.prepare(`SELECT * FROM favorites ${includePrivate ? "" : "WHERE published = 1"} ORDER BY sort_order, title`),
    ]);
    const photos = (photoResult.results as Record<string, unknown>[]).map((r): Photo => ({ id:String(r.id), seriesId:String(r.series_id), imageUrl:String(r.image_url), originalUrl:String(r.original_url), width:Number(r.width), height:Number(r.height), alt:String(r.alt), caption:String(r.caption), location:String(r.location), takenAt:String(r.taken_at), sortOrder:Number(r.sort_order) }));
    const series = (seriesResult.results as Record<string, unknown>[]).map((r): Series => ({ id:String(r.id), slug:String(r.slug), title:String(r.title), description:String(r.description), coverUrl:String(r.cover_url), published:bool(r.published), sortOrder:Number(r.sort_order), photos:photos.filter((p)=>p.seriesId===String(r.id)) }));
    const essays = (essayResult.results as Record<string, unknown>[]).map((r): Essay => ({ id:String(r.id), slug:String(r.slug), title:String(r.title), excerpt:String(r.excerpt), body:String(r.body), visibility:r.visibility === "public" ? "public" : "private", status:r.status === "published" ? "published" : "draft", publishedAt:String(r.published_at) }));
    const favorites = (favoriteResult.results as Record<string, unknown>[]).map((r): Favorite => ({ id:String(r.id), title:String(r.title), category:String(r.category), note:String(r.note), imageUrl:String(r.image_url), url:String(r.url), sortOrder:Number(r.sort_order), published:bool(r.published) }));
    return { series, essays, favorites };
  } catch (error) {
    console.error("Content database unavailable", error);
    return structuredClone(defaultContent);
  }
}

export async function upsertEntity(entity: Entity, record: Record<string, unknown>) {
  const db = dbOrNull(); if (!db) throw new Error("数据库暂时不可用");
  await seed(db);
  const id = String(record.id || crypto.randomUUID());
  if (entity === "series") await db.prepare("INSERT INTO series (id,slug,title,description,cover_url,published,sort_order) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,description=excluded.description,cover_url=excluded.cover_url,published=excluded.published,sort_order=excluded.sort_order").bind(id,String(record.slug),String(record.title),String(record.description??""),String(record.coverUrl??""),bool(record.published)?1:0,Number(record.sortOrder??0)).run();
  if (entity === "photo") await db.prepare("INSERT INTO photos (id,series_id,image_url,original_url,width,height,alt,caption,location,taken_at,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET series_id=excluded.series_id,image_url=excluded.image_url,original_url=excluded.original_url,width=excluded.width,height=excluded.height,alt=excluded.alt,caption=excluded.caption,location=excluded.location,taken_at=excluded.taken_at,sort_order=excluded.sort_order").bind(id,String(record.seriesId),String(record.imageUrl),String(record.originalUrl),Number(record.width),Number(record.height),String(record.alt??""),String(record.caption??""),String(record.location??""),String(record.takenAt??""),Number(record.sortOrder??0)).run();
  if (entity === "essay") await db.prepare("INSERT INTO essays (id,slug,title,excerpt,body,visibility,status,published_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,excerpt=excluded.excerpt,body=excluded.body,visibility=excluded.visibility,status=excluded.status,published_at=excluded.published_at").bind(id,String(record.slug),String(record.title),String(record.excerpt??""),String(record.body??""),record.visibility==="public"?"public":"private",record.status==="published"?"published":"draft",String(record.publishedAt??"")).run();
  if (entity === "favorite") await db.prepare("INSERT INTO favorites (id,title,category,note,image_url,url,sort_order,published) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,category=excluded.category,note=excluded.note,image_url=excluded.image_url,url=excluded.url,sort_order=excluded.sort_order,published=excluded.published").bind(id,String(record.title),String(record.category??"其他"),String(record.note??""),String(record.imageUrl??""),String(record.url??""),Number(record.sortOrder??0),bool(record.published)?1:0).run();
  return { id };
}

export async function deleteEntity(entity: Entity, id: string) {
  const db = dbOrNull(); if (!db) throw new Error("数据库暂时不可用");
  const table = entity === "photo" ? "photos" : entity === "essay" ? "essays" : entity === "favorite" ? "favorites" : "series";
  await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
}
