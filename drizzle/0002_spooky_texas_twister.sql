ALTER TABLE `essays` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `essays` SET `sort_order` = `rowid` WHERE `sort_order` = 0;--> statement-breakpoint
CREATE INDEX `idx_essays_access_order` ON `essays` (`access`,`sort_order`);
