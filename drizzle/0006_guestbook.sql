CREATE TABLE `guestbook_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`body` text NOT NULL,
	`reply` text DEFAULT '' NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`created_at` integer NOT NULL,
	`replied_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT "guestbook_visibility" CHECK("guestbook_messages"."visibility" IN ('public','hidden'))
);
--> statement-breakpoint
CREATE INDEX `idx_guestbook_public_date` ON `guestbook_messages` (`deleted_at`,`visibility`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_guestbook_updated` ON `guestbook_messages` (`updated_at`);--> statement-breakpoint
CREATE TABLE `guestbook_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`source_hash` text NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_guestbook_source_date` ON `guestbook_submissions` (`source_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_guestbook_source_content` ON `guestbook_submissions` (`source_hash`,`content_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_guestbook_submissions_expiry` ON `guestbook_submissions` (`created_at`);