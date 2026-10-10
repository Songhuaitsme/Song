declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ADMIN_USERNAME?: string;
    ADMIN_PASSWORD?: string;
    SESSION_SECRET?: string;
    SYNC_SECRET?: string;
    LOCAL_DEV?: string;
    SITE_URL?: string;
  }
}
