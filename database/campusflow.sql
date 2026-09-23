-- CampusFlow - Minimal Database Schema
CREATE DATABASE IF NOT EXISTS `campusflow` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `campusflow`;

-- 1. Users
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL UNIQUE,
    `password` VARCHAR(255) NOT NULL,
    `role` ENUM('student', 'staff', 'admin') NOT NULL DEFAULT 'student'
);

-- 2. Services
CREATE TABLE IF NOT EXISTS `services` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `prefix` VARCHAR(10) NOT NULL UNIQUE,
    `average_time` INT NOT NULL DEFAULT 5,
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active'
);

-- 3. Tokens
CREATE TABLE IF NOT EXISTS `tokens` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `student_id` INT NOT NULL,
    `service_id` INT NOT NULL,
    `token_number` INT NOT NULL,
    `token_code` VARCHAR(20) NOT NULL,
    `status` ENUM('waiting', 'called', 'processing', 'completed') NOT NULL DEFAULT 'waiting',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

-- Seed Services
INSERT INTO `services` (`id`, `name`, `prefix`, `average_time`, `status`) VALUES
(1, 'Examination Cell', 'EX', 4, 'active'),
(2, 'Accounts & Fees', 'AC', 3, 'active'),
(3, 'Library', 'LB', 2, 'active'),
(4, 'ID Card Section', 'ID', 5, 'active'),
(5, 'Scholarship Cell', 'SC', 6, 'active'),
(6, 'Administration', 'AD', 4, 'active')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Seed Users (Bcrypt hashes)
INSERT INTO `users` (`id`, `name`, `email`, `password`, `role`) VALUES
(1, 'Admin Tarun', 'admin@campusflow.local', '$2y$12$vCjzd.xgRw.4E2jxqml09udXjWjsoqF9w7c3NDOEoMKmkEpvZvcsG', 'admin'),
(2, 'Staff Officer', 'staff@campusflow.local', '$2y$12$n0DCDGcDMY29UlTLu9tbEeUPIxHedtn7Bueh5yAsQ96q9vHOl/GGu', 'staff'),
(3, 'Student Tarun', 'student@campusflow.local', '$2y$12$yObZoX6XdWzeE6ByMdQdyOWfVIz4qZRhoPLcHztZ1GfWzEyVa37CS', 'student')
ON DUPLICATE KEY UPDATE `email` = VALUES(`email`);
