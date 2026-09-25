-- ========================================================
-- CampusFlow: Demo Seed Data for Smart Campus Features
-- Optional demo data for hackathon evaluation & demonstration
-- ========================================================

USE `campusflow`;

-- Insert realistic historical and active tokens if needed for demonstration
-- Using existing student user IDs (1, 2, 3, 18, 21) or fallback to 3
SET @std1 := 3;
SET @std2 := 18;
SET @std3 := 21;

-- 1. Realistic distribution of completed tokens for Campus Demand analysis
-- Distributed across campus working hours (9 AM - 3 PM)
INSERT INTO `tokens` (`student_id`, `service_id`, `token_number`, `token_code`, `status`, `created_at`, `completed_at`) VALUES
-- 09:00 AM window
(@std1, 2, 101, 'AC-101', 'completed', CONCAT(CURDATE(), ' 09:12:00'), CONCAT(CURDATE(), ' 09:15:00')),
(@std2, 3, 101, 'LB-101', 'completed', CONCAT(CURDATE(), ' 09:25:00'), CONCAT(CURDATE(), ' 09:27:00')),
(@std3, 4, 101, 'ID-101', 'completed', CONCAT(CURDATE(), ' 09:40:00'), CONCAT(CURDATE(), ' 09:46:00')),

-- 10:00 AM window
(@std1, 2, 102, 'AC-102', 'completed', CONCAT(CURDATE(), ' 10:05:00'), CONCAT(CURDATE(), ' 10:09:00')),
(@std2, 2, 103, 'AC-103', 'completed', CONCAT(CURDATE(), ' 10:18:00'), CONCAT(CURDATE(), ' 10:22:00')),
(@std3, 1, 101, 'EX-101', 'completed', CONCAT(CURDATE(), ' 10:30:00'), CONCAT(CURDATE(), ' 10:35:00')),
(@std1, 3, 102, 'LB-102', 'completed', CONCAT(CURDATE(), ' 10:45:00'), CONCAT(CURDATE(), ' 10:48:00')),
(@std2, 5, 101, 'SC-101', 'completed', CONCAT(CURDATE(), ' 10:52:00'), CONCAT(CURDATE(), ' 10:58:00')),

-- 11:00 AM window (Rising rush)
(@std1, 2, 104, 'AC-104', 'completed', CONCAT(CURDATE(), ' 11:02:00'), CONCAT(CURDATE(), ' 11:06:00')),
(@std2, 2, 105, 'AC-105', 'completed', CONCAT(CURDATE(), ' 11:12:00'), CONCAT(CURDATE(), ' 11:16:00')),
(@std3, 2, 106, 'AC-106', 'completed', CONCAT(CURDATE(), ' 11:21:00'), CONCAT(CURDATE(), ' 11:25:00')),
(@std1, 1, 102, 'EX-102', 'completed', CONCAT(CURDATE(), ' 11:32:00'), CONCAT(CURDATE(), ' 11:37:00')),
(@std2, 1, 103, 'EX-103', 'completed', CONCAT(CURDATE(), ' 11:41:00'), CONCAT(CURDATE(), ' 11:46:00')),
(@std3, 4, 102, 'ID-102', 'completed', CONCAT(CURDATE(), ' 11:48:00'), CONCAT(CURDATE(), ' 11:53:00')),
(@std1, 6, 101, 'AD-101', 'completed', CONCAT(CURDATE(), ' 11:55:00'), CONCAT(CURDATE(), ' 11:59:00')),

-- 12:00 PM window (Peak rush hour)
(@std1, 2, 107, 'AC-107', 'completed', CONCAT(CURDATE(), ' 12:05:00'), CONCAT(CURDATE(), ' 12:09:00')),
(@std2, 2, 108, 'AC-108', 'completed', CONCAT(CURDATE(), ' 12:14:00'), CONCAT(CURDATE(), ' 12:18:00')),
(@std3, 2, 109, 'AC-109', 'completed', CONCAT(CURDATE(), ' 12:22:00'), CONCAT(CURDATE(), ' 12:26:00')),
(@std1, 1, 104, 'EX-104', 'completed', CONCAT(CURDATE(), ' 12:30:00'), CONCAT(CURDATE(), ' 12:35:00')),
(@std2, 1, 105, 'EX-105', 'completed', CONCAT(CURDATE(), ' 12:38:00'), CONCAT(CURDATE(), ' 12:43:00')),
(@std3, 3, 103, 'LB-103', 'completed', CONCAT(CURDATE(), ' 12:44:00'), CONCAT(CURDATE(), ' 12:47:00')),
(@std1, 5, 102, 'SC-102', 'completed', CONCAT(CURDATE(), ' 12:49:00'), CONCAT(CURDATE(), ' 12:56:00')),
(@std2, 2, 110, 'AC-110', 'completed', CONCAT(CURDATE(), ' 12:54:00'), CONCAT(CURDATE(), ' 12:58:00')),

-- 01:00 PM window (Peak continuing)
(@std1, 2, 111, 'AC-111', 'completed', CONCAT(CURDATE(), ' 13:08:00'), CONCAT(CURDATE(), ' 13:12:00')),
(@std2, 2, 112, 'AC-112', 'completed', CONCAT(CURDATE(), ' 13:15:00'), CONCAT(CURDATE(), ' 13:19:00')),
(@std3, 1, 106, 'EX-106', 'completed', CONCAT(CURDATE(), ' 13:28:00'), CONCAT(CURDATE(), ' 13:33:00')),
(@std1, 3, 104, 'LB-104', 'completed', CONCAT(CURDATE(), ' 13:35:00'), CONCAT(CURDATE(), ' 13:38:00')),
(@std2, 4, 103, 'ID-103', 'completed', CONCAT(CURDATE(), ' 13:42:00'), CONCAT(CURDATE(), ' 13:48:00')),
(@std3, 2, 113, 'AC-113', 'completed', CONCAT(CURDATE(), ' 13:51:00'), CONCAT(CURDATE(), ' 13:55:00')),

-- 02:00 PM window (Declining rush)
(@std1, 2, 114, 'AC-114', 'completed', CONCAT(CURDATE(), ' 14:10:00'), CONCAT(CURDATE(), ' 14:14:00')),
(@std2, 1, 107, 'EX-107', 'completed', CONCAT(CURDATE(), ' 14:22:00'), CONCAT(CURDATE(), ' 14:27:00')),
(@std3, 3, 105, 'LB-105', 'completed', CONCAT(CURDATE(), ' 14:35:00'), CONCAT(CURDATE(), ' 14:38:00')),
(@std1, 5, 103, 'SC-103', 'completed', CONCAT(CURDATE(), ' 14:48:00'), CONCAT(CURDATE(), ' 14:55:00')),

-- 03:00 PM window (Calm)
(@std1, 3, 106, 'LB-106', 'completed', CONCAT(CURDATE(), ' 15:10:00'), CONCAT(CURDATE(), ' 15:13:00')),
(@std2, 2, 115, 'AC-115', 'completed', CONCAT(CURDATE(), ' 15:25:00'), CONCAT(CURDATE(), ' 15:29:00'));

-- 2. Demo waiting tokens for Bottleneck & Counter Allocation demonstration
-- Accounts & Fees (service_id=2) has high queue (12 waiting)
-- Examination Cell (service_id=1) has moderate queue (6 waiting)
-- Library (service_id=3) has low queue (1 waiting)
INSERT INTO `tokens` (`student_id`, `service_id`, `token_number`, `token_code`, `status`, `created_at`) VALUES
(@std1, 2, 201, 'AC-201', 'waiting', DATE_SUB(NOW(), INTERVAL 45 MINUTE)),
(@std2, 2, 202, 'AC-202', 'waiting', DATE_SUB(NOW(), INTERVAL 42 MINUTE)),
(@std3, 2, 203, 'AC-203', 'waiting', DATE_SUB(NOW(), INTERVAL 38 MINUTE)),
(@std1, 2, 204, 'AC-204', 'waiting', DATE_SUB(NOW(), INTERVAL 35 MINUTE)),
(@std2, 2, 205, 'AC-205', 'waiting', DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
(@std3, 2, 206, 'AC-206', 'waiting', DATE_SUB(NOW(), INTERVAL 25 MINUTE)),
(@std1, 2, 207, 'AC-207', 'waiting', DATE_SUB(NOW(), INTERVAL 20 MINUTE)),
(@std2, 2, 208, 'AC-208', 'waiting', DATE_SUB(NOW(), INTERVAL 16 MINUTE)),
(@std3, 2, 209, 'AC-209', 'waiting', DATE_SUB(NOW(), INTERVAL 12 MINUTE)),
(@std1, 2, 210, 'AC-210', 'waiting', DATE_SUB(NOW(), INTERVAL 8 MINUTE)),
(@std2, 2, 211, 'AC-211', 'waiting', DATE_SUB(NOW(), INTERVAL 5 MINUTE)),
(@std3, 2, 212, 'AC-212', 'waiting', DATE_SUB(NOW(), INTERVAL 2 MINUTE)),

(@std1, 1, 201, 'EX-201', 'waiting', DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
(@std2, 1, 202, 'EX-202', 'waiting', DATE_SUB(NOW(), INTERVAL 24 MINUTE)),
(@std3, 1, 203, 'EX-203', 'waiting', DATE_SUB(NOW(), INTERVAL 18 MINUTE)),
(@std1, 1, 204, 'EX-204', 'waiting', DATE_SUB(NOW(), INTERVAL 14 MINUTE)),
(@std2, 1, 205, 'EX-205', 'waiting', DATE_SUB(NOW(), INTERVAL 9 MINUTE)),
(@std3, 1, 206, 'EX-206', 'waiting', DATE_SUB(NOW(), INTERVAL 3 MINUTE));
