CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`original_key` text NOT NULL,
	`display_key` text NOT NULL,
	`original_url` text NOT NULL,
	`display_url` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`checksum` text NOT NULL,
	`perceptual_hash` text DEFAULT '' NOT NULL,
	`size` integer NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`access` text DEFAULT 'private' NOT NULL,
	`assignment` text DEFAULT 'unassigned' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_media_checksum` ON `media_assets` (`checksum`);--> statement-breakpoint
CREATE INDEX `idx_media_access_updated` ON `media_assets` (`access`,`updated_at`);--> statement-breakpoint
CREATE TABLE `site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_site_settings_updated` ON `site_settings` (`updated_at`);--> statement-breakpoint
CREATE TABLE `sync_conflicts` (
	`id` text PRIMARY KEY NOT NULL,
	`entity` text NOT NULL,
	`record_id` text NOT NULL,
	`local_version` integer NOT NULL,
	`remote_version` integer NOT NULL,
	`local_data` text NOT NULL,
	`remote_data` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_sync_conflicts_status` ON `sync_conflicts` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`direction` text NOT NULL,
	`status` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_sync_runs_started` ON `sync_runs` (`started_at`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `essays` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `essays` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `essays` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `favorites` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `favorites` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `favorites` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `photos` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `series` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `series` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `series` ADD `deleted_at` integer;