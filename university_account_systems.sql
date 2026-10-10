CREATE DATABASE IF NOT EXISTS campus_social;
USE campus_social;

CREATE TABLE accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    university_name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE friend_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_name VARCHAR(100) NOT NULL,
    created_by_id INT NOT NULL,
    member_ids JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT NOT NULL,
    class_name VARCHAR(100) NOT NULL,
    class_time DATETIME NOT NULL,
    status ENUM('checked_in', 'skipped', 'pending') DEFAULT 'pending',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE fit_checks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    total_ratings INT DEFAULT 0,
    posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
