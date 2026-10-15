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
    R2_ACCESS_KEY_ID?: string;
    R2_SECRET_ACCESS_KEY?: string;
    R2_ACCOUNT_ID?: string;
    R2_BUCKET_NAME?: string;
  }
}
