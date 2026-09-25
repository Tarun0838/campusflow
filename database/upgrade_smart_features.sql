-- ========================================================
-- CampusFlow: Upgrade for Smart Campus Service Management
-- Backward-compatible schema additions
-- ========================================================

USE `campusflow`;

-- 1. Optional prerequisite service dependency
-- Allows simple prerequisite definition (e.g. Accounts & Fees before Examination Cell)
SET @exist_col := (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'services' 
      AND COLUMN_NAME = 'prerequisite_service_id'
);

SET @sql_stmt := IF(@exist_col = 0, 
    'ALTER TABLE `services` ADD COLUMN `prerequisite_service_id` INT NULL DEFAULT NULL AFTER `average_time`, ADD FOREIGN KEY (`prerequisite_service_id`) REFERENCES `services`(`id`) ON DELETE SET NULL;',
    'SELECT "Column prerequisite_service_id already exists" AS notice;'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Optional completion timestamp for tokens
SET @exist_col2 := (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'tokens' 
      AND COLUMN_NAME = 'completed_at'
);

SET @sql_stmt2 := IF(@exist_col2 = 0, 
    'ALTER TABLE `tokens` ADD COLUMN `completed_at` TIMESTAMP NULL DEFAULT NULL AFTER `created_at`;',
    'SELECT "Column completed_at already exists" AS notice;'
);
PREPARE stmt2 FROM @sql_stmt2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- Set a sensible prerequisite example:
-- Examination Cell (1) requires Accounts & Fees (2) clearance
UPDATE `services` SET `prerequisite_service_id` = 2 WHERE `id` = 1 AND `prerequisite_service_id` IS NULL;
