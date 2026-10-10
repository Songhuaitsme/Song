import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const series = sqliteTable("series", {
  id: text("id").primaryKey(), slug: text("slug").notNull(), title: text("title").notNull(), description: text("description").notNull().default(""), coverUrl: text("cover_url").notNull().default(""), access: text("access").notNull().default("draft"), published: integer("published", { mode: "boolean" }).notNull().default(true), sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [uniqueIndex("idx_series_slug").on(table.slug), index("idx_series_published_order").on(table.published, table.sortOrder), index("idx_series_access_order").on(table.access, table.sortOrder)]);
export const photos = sqliteTable("photos", {
  id: text("id").primaryKey(), seriesId: text("series_id").notNull().references(() => series.id, { onDelete: "cascade" }), imageUrl: text("image_url").notNull(), originalUrl: text("original_url").notNull(), width: integer("width").notNull(), height: integer("height").notNull(), alt: text("alt").notNull().default(""), caption: text("caption").notNull().default(""), location: text("location").notNull().default(""), takenAt: text("taken_at").notNull().default(""), sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [index("idx_photos_series_order").on(table.seriesId, table.sortOrder)]);
export const essays = sqliteTable("essays", {
  id: text("id").primaryKey(), slug: text("slug").notNull(), title: text("title").notNull(), excerpt: text("excerpt").notNull().default(""), body: text("body").notNull().default(""), access: text("access").notNull().default("draft"), visibility: text("visibility").notNull().default("private"), status: text("status").notNull().default("draft"), publishedAt: text("published_at").notNull().default(""), sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [uniqueIndex("idx_essays_slug").on(table.slug), index("idx_essays_public").on(table.status, table.visibility, table.publishedAt), index("idx_essays_access_date").on(table.access, table.publishedAt), index("idx_essays_access_order").on(table.access, table.sortOrder)]);
export const favorites = sqliteTable("favorites", {
  id: text("id").primaryKey(), title: text("title").notNull(), category: text("category").notNull().default("其他"), note: text("note").notNull().default(""), imageUrl: text("image_url").notNull().default(""), url: text("url").notNull().default(""), access: text("access").notNull().default("draft"), sortOrder: integer("sort_order").notNull().default(0), published: integer("published", { mode: "boolean" }).notNull().default(true),
}, (table) => [index("idx_favorites_published_order").on(table.published, table.sortOrder), index("idx_favorites_access_order").on(table.access, table.sortOrder)]);

export const adminSessions = sqliteTable("admin_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  credentialFingerprint: text("credential_fingerprint").notNull(),
  csrfToken: text("csrf_token").notNull(),
  createdAt: integer("created_at").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("idx_admin_sessions_expires").on(table.expiresAt)]);

export const loginAttempts = sqliteTable("login_attempts", {
  attemptKey: text("attempt_key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  windowStartedAt: integer("window_started_at").notNull(),
  lockedUntil: integer("locked_until").notNull().default(0),
}, (table) => [index("idx_login_attempts_locked").on(table.lockedUntil)]);

export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
