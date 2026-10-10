import { essayImageUrls } from "@/lib/essay-body";
import { env } from "cloudflare:workers";
import {
  defaultContent,
  defaultAbout,
  type AboutContent,
  type AccessLevel,
  type Essay,
  type Favorite,
  type Photo,
  type Series,
  type SiteContent,
} from "@/lib/default-content";

export type Entity = "series" | "photo" | "essay" | "favorite";

const accessLevels = new Set<AccessLevel>(["draft", "private", "public"]);

export function getDatabase(): D1Database | null {
  try {
    return env.DB ?? null;
  } catch {
    return null;
  }
}

function access(value: unknown): AccessLevel {
  return accessLevels.has(value as AccessLevel) ? (value as AccessLevel) : "draft";
}

function text(value: unknown, field: string, max = 5000): string {
  const result = String(value ?? "").trim();
  if (!result && ["标题", "标识", "所属系列"].includes(field)) throw new Error(`${field}不能为空`);
  if (result.length > max) throw new Error(`${field}内容过长`);
  return result;
}

function number(value: unknown, fallback = 0): number {
  const result = Number(value ?? fallback);
  if (!Number.isFinite(result)) throw new Error("数字格式无效");
  return result;
}

function safeSlug(value: unknown): string {
  const result = text(value, "标识", 160);
  if (!/^[a-z0-9\u4e00-\u9fff]+(?:-[a-z0-9\u4e00-\u9fff]+)*$/i.test(result)) throw new Error("网址标识格式无效");
  return result;
}

function safeUrl(value: unknown, externalOnly = false): string {
  const result = String(value ?? "").trim();
  if (!result) return "";
  if (!externalOnly && result.startsWith("/") && !result.startsWith("//")) return result;
  try {
    const url = new URL(result);
    if (url.protocol === "https:" || url.protocol === "http:") return result;
  } catch {}
  throw new Error("链接格式无效");
}

async function migrateLegacyAccess(db: D1Database) {
  const marker = await db.prepare("SELECT value FROM app_meta WHERE key = ?").bind("access_v1_migrated").first();
  if (marker) return;
  await db.batch([
    db.prepare("UPDATE series SET access = CASE WHEN published = 1 THEN 'public' ELSE 'draft' END"),
    db.prepare("UPDATE essays SET access = CASE WHEN status != 'published' THEN 'draft' WHEN visibility = 'public' THEN 'public' ELSE 'private' END"),
    db.prepare("UPDATE favorites SET access = CASE WHEN published = 1 THEN 'public' ELSE 'draft' END"),
    db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)").bind("access_v1_migrated", new Date().toISOString()),
  ]);
}

async function seed(db: D1Database) {
  const existing = await db.prepare("SELECT id FROM series LIMIT 1").first();
  if (existing) return;
  const statements: D1PreparedStatement[] = [];
  for (const item of defaultContent.series) {
    statements.push(db.prepare("INSERT OR IGNORE INTO series (id,slug,title,description,cover_url,access,published,sort_order) VALUES (?,?,?,?,?,?,?,?)").bind(item.id,item.slug,item.title,item.description,item.coverUrl,item.access,item.access === "public" ? 1 : 0,item.sortOrder));
    for (const photo of item.photos) statements.push(db.prepare("INSERT OR IGNORE INTO photos (id,series_id,image_url,original_url,width,height,alt,caption,location,taken_at,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(photo.id,photo.seriesId,photo.imageUrl,photo.originalUrl,photo.width,photo.height,photo.alt,photo.caption,photo.location,photo.takenAt,photo.sortOrder));
  }
  for (const item of defaultContent.essays) statements.push(db.prepare("INSERT OR IGNORE INTO essays (id,slug,title,excerpt,body,access,visibility,status,published_at,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(item.id,item.slug,item.title,item.excerpt,item.body,item.access,item.access === "public" ? "public" : "private",item.access === "draft" ? "draft" : "published",item.publishedAt,item.sortOrder));
  for (const item of defaultContent.favorites) statements.push(db.prepare("INSERT OR IGNORE INTO favorites (id,title,category,note,image_url,url,access,sort_order,published) VALUES (?,?,?,?,?,?,?,?,?)").bind(item.id,item.title,item.category,item.note,item.imageUrl,item.url,item.access,item.sortOrder,item.access === "public" ? 1 : 0));
  await db.batch(statements);
}

async function applyRequestedContentUpdates(db: D1Database) {
  const key = "essay_songhua_title_20261010";
  if (await db.prepare("SELECT value FROM app_meta WHERE key = ?").bind(key).first()) return;
  await db.batch([
    db.prepare("UPDATE essays SET title = ? WHERE id = ? AND title = ? AND NOT EXISTS (SELECT 1 FROM app_meta WHERE key = ?)")
      .bind("一段关于Songhua的独白", "essay-private-draft", "一封从未寄出的短笺", key),
    db.prepare("INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)").bind(key, new Date().toISOString()),
  ]);
}

async function applySeriesExpansion(db: D1Database) {
  const key = "photo_series_expansion_20261010_v1";
  if (await db.prepare("SELECT value FROM app_meta WHERE key = ?").bind(key).first()) return;
  const statements: D1PreparedStatement[] = [];
  for (const item of defaultContent.series) {
    statements.push(
      db.prepare("INSERT OR IGNORE INTO series (id,slug,title,description,cover_url,access,published,sort_order) VALUES (?,?,?,?,?,?,?,?)")
        .bind(item.id,item.slug,item.title,item.description,item.coverUrl,item.access,item.access === "public" ? 1 : 0,item.sortOrder),
    );
    for (const photo of item.photos) {
      statements.push(
        db.prepare("INSERT OR IGNORE INTO photos (id,series_id,image_url,original_url,width,height,alt,caption,location,taken_at,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
          .bind(photo.id,photo.seriesId,photo.imageUrl,photo.originalUrl,photo.width,photo.height,photo.alt,photo.caption,photo.location,photo.takenAt,photo.sortOrder),
      );
    }
  }
  statements.push(db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)").bind(key, new Date().toISOString()));
  await db.batch(statements);
}

function fallbackContent(includePrivate: boolean): SiteContent {
  const cloned = structuredClone(defaultContent);
  if (includePrivate) return cloned;
  return {
    about: cloned.about,
    series: cloned.series.filter((item) => item.access === "public"),
    essays: cloned.essays.filter((item) => item.access === "public"),
    favorites: cloned.favorites.filter((item) => item.access === "public"),
  };
}

export async function getSiteContent(includePrivate = false): Promise<SiteContent> {
  const db = getDatabase();
  if (!db) return fallbackContent(includePrivate);
  try {
    await migrateLegacyAccess(db);
    await seed(db);
    await applyRequestedContentUpdates(db);
    await applySeriesExpansion(db);
    const [seriesResult, photoResult, essayResult, favoriteResult] = await db.batch([
      db.prepare(`SELECT * FROM series ${includePrivate ? "" : "WHERE access = 'public'"} ORDER BY sort_order, title`),
      db.prepare("SELECT * FROM photos ORDER BY series_id, sort_order"),
      db.prepare(`SELECT * FROM essays ${includePrivate ? "" : "WHERE access = 'public'"} ORDER BY sort_order, published_at DESC, title`),
      db.prepare(`SELECT * FROM favorites ${includePrivate ? "" : "WHERE access = 'public'"} ORDER BY sort_order, title`),
    ]);
    const photos = (photoResult.results as Record<string, unknown>[]).map((r): Photo => ({ id:String(r.id), seriesId:String(r.series_id), imageUrl:String(r.image_url), originalUrl:String(r.original_url), width:Number(r.width), height:Number(r.height), alt:String(r.alt), caption:String(r.caption), location:String(r.location), takenAt:String(r.taken_at), sortOrder:Number(r.sort_order) }));
    const series = (seriesResult.results as Record<string, unknown>[]).map((r): Series => ({ id:String(r.id), slug:String(r.slug), title:String(r.title), description:String(r.description), coverUrl:String(r.cover_url), access:access(r.access), sortOrder:Number(r.sort_order), photos:photos.filter((p)=>p.seriesId===String(r.id)) }));
    const essays = (essayResult.results as Record<string, unknown>[]).map((r): Essay => ({ id:String(r.id), slug:String(r.slug), title:String(r.title), excerpt:String(r.excerpt), body:String(r.body), access:access(r.access), publishedAt:String(r.published_at), sortOrder:Number(r.sort_order) }));
    const favorites = (favoriteResult.results as Record<string, unknown>[]).map((r): Favorite => ({ id:String(r.id), title:String(r.title), category:String(r.category), note:String(r.note), imageUrl:String(r.image_url), url:String(r.url), access:access(r.access), sortOrder:Number(r.sort_order) }));
    return { series, essays, favorites, about: await getAboutContent() };
  } catch (error) {
    console.error("Content database unavailable", error);
    return fallbackContent(includePrivate);
  }
}

export async function upsertEntity(entity: Entity, record: Record<string, unknown>) {
  const db = getDatabase();
  if (!db) throw new Error("数据库暂时不可用");
  await migrateLegacyAccess(db);
  await seed(db);
  await applyRequestedContentUpdates(db);
  await applySeriesExpansion(db);
  const id = String(record.id || crypto.randomUUID());

  if (entity === "series") {
    const level = access(record.access);
    await db.prepare("INSERT INTO series (id,slug,title,description,cover_url,access,published,sort_order) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,description=excluded.description,cover_url=excluded.cover_url,access=excluded.access,published=excluded.published,sort_order=excluded.sort_order").bind(id,safeSlug(record.slug),text(record.title,"标题",200),text(record.description,"简介",3000),safeUrl(record.coverUrl),level,level === "public" ? 1 : 0,number(record.sortOrder)).run();
  }
  if (entity === "photo") {
    await db.prepare("INSERT INTO photos (id,series_id,image_url,original_url,width,height,alt,caption,location,taken_at,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET series_id=excluded.series_id,image_url=excluded.image_url,original_url=excluded.original_url,width=excluded.width,height=excluded.height,alt=excluded.alt,caption=excluded.caption,location=excluded.location,taken_at=excluded.taken_at,sort_order=excluded.sort_order").bind(id,text(record.seriesId,"所属系列",100),safeUrl(record.imageUrl),safeUrl(record.originalUrl),number(record.width),number(record.height),text(record.alt,"替代文字",500),text(record.caption,"照片注释",3000),text(record.location,"地点",300),text(record.takenAt,"拍摄日期",100),number(record.sortOrder)).run();
  }
  if (entity === "essay") {
    const level = access(record.access);
    await db.prepare("INSERT INTO essays (id,slug,title,excerpt,body,access,visibility,status,published_at,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,excerpt=excluded.excerpt,body=excluded.body,access=excluded.access,visibility=excluded.visibility,status=excluded.status,published_at=excluded.published_at,sort_order=excluded.sort_order").bind(id,safeSlug(record.slug),text(record.title,"标题",200),text(record.excerpt,"摘要",1000),text(record.body,"正文",100000),level,level === "public" ? "public" : "private",level === "draft" ? "draft" : "published",text(record.publishedAt,"发布日期",30),number(record.sortOrder)).run();
  }
  if (entity === "favorite") {
    const level = access(record.access);
    await db.prepare("INSERT INTO favorites (id,title,category,note,image_url,url,access,sort_order,published) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,category=excluded.category,note=excluded.note,image_url=excluded.image_url,url=excluded.url,access=excluded.access,sort_order=excluded.sort_order,published=excluded.published").bind(id,text(record.title,"标题",200),text(record.category,"分类",100),text(record.note,"短评",5000),safeUrl(record.imageUrl),safeUrl(record.url,true),level,number(record.sortOrder),level === "public" ? 1 : 0).run();
  }
  return { id };
}

export async function deleteEntity(entity: Entity, id: string) {
  const db = getDatabase();
  if (!db) throw new Error("数据库暂时不可用");
  const table = entity === "photo" ? "photos" : entity === "essay" ? "essays" : entity === "favorite" ? "favorites" : "series";
  await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
}

export async function getAssetAccess(assetUrl: string): Promise<AccessLevel | null> {
  const db = getDatabase();
  if (!db) return null;
  await migrateLegacyAccess(db);
  const [photoResult, favoriteResult, essayResult] = await db.batch([
    db.prepare("SELECT s.access FROM photos p JOIN series s ON s.id = p.series_id WHERE p.image_url = ? OR p.original_url = ?").bind(assetUrl, assetUrl),
    db.prepare("SELECT access FROM favorites WHERE image_url = ?").bind(assetUrl),
    db.prepare("SELECT access, body FROM essays WHERE instr(body, ?) > 0").bind(assetUrl),
  ]);
  const levels = [...photoResult.results, ...favoriteResult.results].map((row) => access((row as Record<string, unknown>).access));
  for (const row of essayResult.results as Record<string, unknown>[]) {
    if (essayImageUrls(String(row.body)).includes(assetUrl)) levels.push(access(row.access));
  }
  if (levels.includes("public")) return "public";
  if (levels.includes("private")) return "private";
  if (levels.includes("draft")) return "draft";
  return null;
}

export function validateAboutContent(record: Record<string, unknown>): AboutContent {
  return { title: text(record.title, "标题", 200), body: text(record.body, "介绍正文", 10000), note: text(record.note, "补充说明", 2000) };
}

export async function getAboutContent(): Promise<AboutContent> {
  const db = getDatabase();
  if (!db) return { ...defaultAbout };
  try {
    const row = await db.prepare("SELECT value FROM app_meta WHERE key = ?").bind("about_content_v1").first<{ value: string }>();
    return row ? validateAboutContent(JSON.parse(row.value)) : { ...defaultAbout };
  } catch (error) {
    console.error("About content unavailable", error);
    return { ...defaultAbout };
  }
}

export async function saveAboutContent(record: Record<string, unknown>) {
  const content = validateAboutContent(record);
  const db = getDatabase();
  if (!db) throw new Error("数据库暂时不可用");
  await db.prepare("INSERT INTO app_meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind("about_content_v1", JSON.stringify(content)).run();
  return content;
}
