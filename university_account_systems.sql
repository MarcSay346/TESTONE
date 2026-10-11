-- schema for Tiger (PostgreSQL). Safe to re-run: drops and rebuilds everything.
DROP TABLE IF EXISTS fit_checks, schedules, group_members, friend_groups, accounts CASCADE;

CREATE TABLE accounts (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    email           VARCHAR(100) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    university_name VARCHAR(150) NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE friend_groups (
    id            SERIAL PRIMARY KEY,
    group_name    VARCHAR(100) NOT NULL,
    created_by_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at    TIMESTAMP DEFAULT NOW()
);

-- replaces the member_ids JSON column: one row per (group, member)
CREATE TABLE group_members (
    group_id   INT REFERENCES friend_groups(id) ON DELETE CASCADE,
    account_id INT REFERENCES accounts(id)      ON DELETE CASCADE,
    joined_at  TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (group_id, account_id)
);

CREATE TABLE schedules (
    id         SERIAL PRIMARY KEY,
    account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    class_name VARCHAR(100) NOT NULL,
    class_time TIMESTAMP NOT NULL,
    status     VARCHAR(20) DEFAULT 'pending'
               CHECK (status IN ('checked_in', 'skipped', 'pending')),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE fit_checks (
    id             SERIAL PRIMARY KEY,
    account_id     INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    image_url      VARCHAR(255) NOT NULL,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    total_ratings  INT DEFAULT 0,
    posted_at      TIMESTAMP DEFAULT NOW()
);