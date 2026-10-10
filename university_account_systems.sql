CREATE DATABASE IF NOT EXISTS campus_social,
USE campus_social,

CREATE TABLE universities(
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
);
-- combine status for check ins
CREATE TABLE accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    university_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE RESTRICT
);

CREATE TABLE friend_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_name VARCHAR(100) NOT NULL,
    created_by_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_id) REFERENCES accounts(id) ON DELETE CASCADE
);


CREATE TABLE group_members (
    group_id INT NOT NULL,
    account_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, account_id),
    FOREIGN KEY (group_id) REFERENCES friend_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);


CREATE TABLE schedules(
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT NOT NULL,
    class_time VARCHAR(100) NOT NULL,
    class_time DATETIME NOT NULL,
    status ENUM('checked_in', 'skipped', 'pending') DEFAULT 'pending',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE fit_checks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE fit_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fit_check_id INT NOT NULL,
    rating INT NOT NULL,
    rated_at INT NOT NULL,
    FOREIGN KEY (fit_check_id) REFERENCES fit_checks(id) ON DELETE CASCADE
);

