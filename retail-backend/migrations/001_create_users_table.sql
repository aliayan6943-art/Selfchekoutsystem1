-- ============================================================================
-- Smart Retail Self-Checkout — Users Table Migration
-- ============================================================================
-- Run this against `smart_retail_db` to create the users table.
--
-- Schema matches the PRD:
--   user_id       UUID PRIMARY KEY
--   phone_number  VARCHAR(15) UNIQUE NOT NULL
--   is_active     BOOLEAN DEFAULT TRUE
--   created_at    TIMESTAMPTZ (auto-set)
--   updated_at    TIMESTAMPTZ (auto-updated)
-- ============================================================================

-- Enable the uuid-ossp extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the users table
CREATE TABLE IF NOT EXISTS users (
    user_id       UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number  VARCHAR(15)     NOT NULL UNIQUE,
    is_active     BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Index on phone_number for fast OTP-verification lookups
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users (phone_number);

-- Trigger to auto-update `updated_at` on row modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verify
SELECT 'Users table created successfully' AS status;
