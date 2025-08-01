-- MariaDB Database Setup for Dev Todo System
-- Run this in HeidiSQL Query tab

-- Use the existing 'website' database
USE website;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    discord_id VARCHAR(20) UNIQUE,
    discord_username VARCHAR(50),
    role ENUM('none', 'staff', 'developer', 'admin') DEFAULT 'none',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_discord_id (discord_id),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    area ENUM('script', 'cars', 'clothing', 'mlo') NOT NULL,
    description TEXT NOT NULL,
    assignee_id INT,
    evidence_url VARCHAR(500),
    created_by_id INT NOT NULL,
    status ENUM('pending', 'progress', 'completed', 'rejected') DEFAULT 'pending',
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_status (status),
    INDEX idx_area (area),
    INDEX idx_assignee (assignee_id),
    INDEX idx_created_by (created_by_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default admin user (password: admin123)
-- Hash generated for 'admin123'
INSERT INTO users (username, email, password_hash, role) VALUES 
('admin', 'admin@yoursite.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LVbTJ3w9XVnbwcB8m', 'admin')
ON DUPLICATE KEY UPDATE role = 'admin';

-- Insert sample developer users (password: dev123)
INSERT INTO users (username, email, password_hash, role) VALUES 
('hanssen', 'hanssen@yoursite.com', '$2a$12$rQv2c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LVbTJ3w9XVnbwcB8n', 'developer'),
('alice', 'alice@yoursite.com', '$2a$12$sQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LVbTJ3w9XVnbwcB8o', 'developer'),
('bob', 'bob@yoursite.com', '$2a$12$tQv4c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LVbTJ3w9XVnbwcB8p', 'developer')
ON DUPLICATE KEY UPDATE username = VALUES(username);

-- Insert sample staff user (password: staff123)
INSERT INTO users (username, email, password_hash, role) VALUES 
('john', 'john@yoursite.com', '$2a$12$uQv5c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LVbTJ3w9XVnbwcB8q', 'staff')
ON DUPLICATE KEY UPDATE username = VALUES(username);

-- Insert sample tasks for testing
INSERT INTO tasks (title, area, description, assignee_id, created_by_id, status) VALUES 
('Fix car spawning issue', 'cars', 'Cars are not spawning correctly in the downtown area. Players report that vehicles disappear after 30 seconds.', 2, 5, 'progress'),
('Update clothing textures', 'clothing', 'New clothing textures need to be implemented for the summer collection. High priority for next update.', 3, 5, 'pending'),
('MLO lighting bug', 'mlo', 'Interior lighting is too dark in the new casino MLO. Players cannot see properly inside.', 4, 1, 'completed'),
('Script optimization needed', 'script', 'The vehicle handling script is causing performance issues during peak hours.', 2, 5, 'pending'),
('New weapon skins', 'clothing', 'Add new weapon skin textures as requested by the community.', NULL, 1, 'rejected')
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- Create composite indexes for better performance
CREATE INDEX idx_tasks_composite ON tasks(status, area, assignee_id);
CREATE INDEX idx_users_role_username ON users(role, username);

-- Show the created tables
SHOW TABLES;

-- Display table structures
DESCRIBE users;
DESCRIBE tasks;

-- Show sample data
SELECT 'Users:' as Info;
SELECT id, username, email, role, created_at FROM users;

SELECT 'Tasks:' as Info;
SELECT id, title, area, status, created_at FROM tasks;