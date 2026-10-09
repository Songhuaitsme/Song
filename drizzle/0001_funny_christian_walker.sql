CREATE TABLE `admin_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`credential_fingerprint` text NOT NULL,
	`csrf_token` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_admin_sessions_expires` ON `admin_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`attempt_key` text PRIMARY KEY NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`window_started_at` integer NOT NULL,
	`locked_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_login_attempts_locked` ON `login_attempts` (`locked_until`);--> statement-breakpoint
ALTER TABLE `essays` ADD `access` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_essays_access_date` ON `essays` (`access`,`published_at`);--> statement-breakpoint
ALTER TABLE `favorites` ADD `access` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_favorites_access_order` ON `favorites` (`access`,`sort_order`);--> statement-breakpoint
ALTER TABLE `series` ADD `access` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_series_access_order` ON `series` (`access`,`sort_order`);